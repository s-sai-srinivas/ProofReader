import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { logError } from "@/lib/logger";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return apiError(401, "Unauthorized");
  }

  try {
    // List all active categories scoped to their organization OR global ones
    const categories = await db.category.findMany({
      where: {
        isActive: true,
        OR: [
          { orgId: null },
          { orgId: user.orgId },
        ],
      },
      orderBy: { sortOrder: "asc" },
    });

    return apiSuccess(categories);
  } catch (error) {
    logError("API_PUBLIC_CATEGORIES_GET", error);
    return apiError(500, "Internal server error");
  }
}
