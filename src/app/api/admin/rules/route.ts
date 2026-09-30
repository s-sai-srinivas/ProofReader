import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { RuleSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";
import { handleApiError } from "@/lib/error-handler";
import { isRateLimited } from "@/lib/rateLimit";

// Helper to check admin access
async function checkAdminAccess() {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (!hasPermission(user, "rules:manage")) {
    return { error: "Forbidden - Admin access required", status: 403 };
  }
  // Resiliency: rate-limit settings admin requests to 60/min
  if (await isRateLimited(`admin-rules-${user.id}`, 60, 60000)) {
    return { error: "Too many admin requests. Please try again after 60 seconds.", status: 429 };
  }
  return { user };
}

export async function GET(req: Request) {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";

  try {
    // Force multi-tenant boundary matching user orgId
    const whereClause: import("@prisma/client").Prisma.RuleWhereInput = {
      orgId: access.user.orgId,
    };

    if (category && category !== "ALL") {
      whereClause.category = category.toUpperCase();
    }

    if (search) {
      whereClause.OR = [
        { pattern: { contains: search } },
        { explanation: { contains: search } },
        { replacement: { contains: search } },
      ];
    }

    const rules = await db.rule.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
    });

    return apiSuccess(rules);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_RULES_GET");
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

    const validation = RuleSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { pattern, replacement, category, explanation, isActive } = validation.data;

    // Look up matching dynamic category
    const cleanCategory = category.toUpperCase();
    const matchedCategory = await db.category.findFirst({
      where: {
        name: cleanCategory,
        isActive: true,
        OR: [
          { orgId: null },
          { orgId: access.user.orgId },
        ],
      },
    });

    if (!matchedCategory) {
      return apiError(400, `Category '${category}' not found or inactive`);
    }

    const rule = await db.rule.create({
      data: {
        pattern,
        replacement,
        category: cleanCategory,
        categoryId: matchedCategory.id,
        explanation,
        isActive: isActive !== undefined ? isActive : true,
        orgId: access.user.orgId, // Bind rule to admin's organization
      },
    });

    return apiSuccess(rule, 201);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_RULES_POST");
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

    const validation = RuleSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { id, pattern, replacement, category, explanation, isActive } = validation.data;

    if (!id) {
      return apiError(400, "Rule ID is required");
    }

    const existingRule = await db.rule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return apiError(404, "Rule not found");
    }

    // Strict multi-tenant boundaries check
    if (existingRule.orgId !== access.user.orgId) {
      return apiError(403, "Forbidden - Cannot modify rules belonging to another organization");
    }

    let categoryId = existingRule.categoryId;
    let cleanCategory = existingRule.category;

    if (category !== undefined) {
      cleanCategory = category.toUpperCase();
      const matchedCategory = await db.category.findFirst({
        where: {
          name: cleanCategory,
          isActive: true,
          OR: [
            { orgId: null },
            { orgId: access.user.orgId },
          ],
        },
      });

      if (!matchedCategory) {
        return apiError(400, `Category '${category}' not found or inactive`);
      }
      categoryId = matchedCategory.id;
    }

    const rule = await db.rule.update({
      where: { id },
      data: {
        pattern: pattern !== undefined ? pattern : existingRule.pattern,
        replacement: replacement !== undefined ? replacement : existingRule.replacement,
        category: cleanCategory,
        categoryId: categoryId,
        explanation: explanation !== undefined ? explanation : existingRule.explanation,
        isActive: isActive !== undefined ? isActive : existingRule.isActive,
      },
    });

    return apiSuccess(rule);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_RULES_PUT");
  }
}

export async function DELETE(req: Request) {
  const access = await checkAdminAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return apiError(400, "Rule ID required");
  }

  try {
    const existingRule = await db.rule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return apiError(404, "Rule not found");
    }

    // Strict multi-tenant boundaries check
    if (existingRule.orgId !== access.user.orgId) {
      return apiError(403, "Forbidden - Cannot delete rules belonging to another organization");
    }

    await db.rule.delete({
      where: { id },
    });

    return apiSuccess({ message: "Rule deleted successfully" });
  } catch (error) {
    return handleApiError(error, "API_ADMIN_RULES_DELETE");
  }
}

