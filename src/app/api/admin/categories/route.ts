import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/error-handler";
import { isRateLimited } from "@/lib/rateLimit";

async function checkAdminAccess() {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (!hasPermission(user, "categories:manage")) {
    return { error: "Forbidden - Admin access required", status: 403 };
  }
  
  // Resiliency: rate-limit settings admin requests to 60/min
  if (await isRateLimited(`admin-categories-${user.id}`, 60, 60000)) {
    return { error: "Too many admin requests. Please try again after 60 seconds.", status: 429 };
  }
  return { user };
}

export async function GET() {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  try {
    // List all active categories scoped to their org OR global categories
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { orgId: null },
          { orgId: access.user.orgId },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });

    return apiSuccess(categories);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_CATEGORIES_GET");
  }
}

export async function POST(req: Request) {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON payload");
    }

    const { name, label, description, color, sortOrder, weight } = body;

    if (!name || !label) {
      return apiError(400, "Name and label are required");
    }

    // Capitalize name to ensure standard category referencing (e.g. "GRAMMAR")
    const cleanName = name.trim().toUpperCase();

    // Check if category with this name already exists
    const existing = await db.category.findFirst({
      where: { name: cleanName, isActive: true },
    });

    if (existing) {
      return apiError(400, "A category with this name already exists");
    }

    const category = await db.category.create({
      data: {
        name: cleanName,
        label: label.trim(),
        description: description?.trim() || null,
        color: color?.trim() || "#7c3aed",
        sortOrder: Number(sortOrder) || 0,
        weight: weight !== undefined ? Number(weight) : 1.0,
        orgId: access.user.orgId,
      },
    });

    return apiSuccess(category, 201);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_CATEGORIES_POST");
  }
}

export async function PUT(req: Request) {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON payload");
    }

    const { id, label, description, color, sortOrder, weight, isActive } = body;

    if (!id) {
      return apiError(400, "Category ID is required");
    }

    const existingCategory = await db.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return apiError(404, "Category not found");
    }

    // Strict tenant boundary check: Global categories cannot be modified by organization admins
    if (existingCategory.orgId !== access.user.orgId) {
      return apiError(403, "Forbidden - Cannot modify global or foreign organization categories");
    }

    const category = await db.category.update({
      where: { id },
      data: {
        label: label !== undefined ? label.trim() : existingCategory.label,
        description: description !== undefined ? description?.trim() : existingCategory.description,
        color: color !== undefined ? color.trim() : existingCategory.color,
        sortOrder: sortOrder !== undefined ? Number(sortOrder) : existingCategory.sortOrder,
        weight: weight !== undefined ? Number(weight) : existingCategory.weight,
        isActive: isActive !== undefined ? Boolean(isActive) : existingCategory.isActive,
      },
    });

    return apiSuccess(category);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_CATEGORIES_PUT");
  }
}

export async function DELETE(req: Request) {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const reassignTo = searchParams.get("reassignTo");

  if (!id) {
    return apiError(400, "Category ID required");
  }

  try {
    const existingCategory = await db.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return apiError(404, "Category not found");
    }

    // Verify tenant boundaries
    if (existingCategory.orgId !== access.user.orgId) {
      return apiError(403, "Forbidden - Cannot delete global or foreign organization categories");
    }

    // Deactivate and reassign rules inside a transaction
    await db.$transaction(async (tx) => {
      // 1. Soft delete the category
      await tx.category.update({
        where: { id },
        data: { isActive: false },
      });

      // 2. Reassign rules
      if (reassignTo) {
        const targetCategory = await tx.category.findFirst({
          where: { id: reassignTo, isActive: true },
        });

        if (targetCategory) {
          await tx.rule.updateMany({
            where: { categoryId: id, orgId: access.user.orgId },
            data: {
              categoryId: reassignTo,
              category: targetCategory.name,
            },
          });

          // Fetch all document IDs scoped to user org to update their corrections atomically
          const orgDocs = await tx.document.findMany({
            where: { orgId: access.user.orgId },
            select: { id: true },
          });
          const orgDocIds = orgDocs.map((d) => d.id);

          if (orgDocIds.length > 0) {
            await tx.correction.updateMany({
              where: { categoryId: id, documentId: { in: orgDocIds } },
              data: {
                categoryId: reassignTo,
                category: targetCategory.name,
              },
            });
          }
        }
      } else {
        await tx.rule.updateMany({
          where: { categoryId: id, orgId: access.user.orgId },
          data: {
            categoryId: null,
          },
        });

        const orgDocs = await tx.document.findMany({
          where: { orgId: access.user.orgId },
          select: { id: true },
        });
        const orgDocIds = orgDocs.map((d) => d.id);

        if (orgDocIds.length > 0) {
          await tx.correction.updateMany({
            where: { categoryId: id, documentId: { in: orgDocIds } },
            data: {
              categoryId: null,
            },
          });
        }
      }
    });

    return apiSuccess({ message: "Category deactivated and rules updated successfully" });
  } catch (error) {
    return handleApiError(error, "API_ADMIN_CATEGORIES_DELETE");
  }
}
