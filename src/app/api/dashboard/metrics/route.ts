import { getSessionUser } from "@/lib/auth";
import { getUserMetrics } from "@/lib/metrics";
import { apiError, apiSuccess } from "@/lib/api-response";
import { handleApiError } from "@/lib/error-handler";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return apiError(401, "Unauthorized");
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 50));
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const {
      totalDocuments,
      totalWordsScanned,
      totalCorrectionsDetected,
      averageQualityScore,
      categoryBreakdown,
      historicalActivity,
    } = await getUserMetrics(user.id, user.orgId, limit, offset);

    return apiSuccess({
      totalDocuments,
      totalWordsScanned,
      totalCorrectionsDetected,
      averageQualityScore,
      categoryBreakdown,
      historicalActivity,
    });
  } catch (error) {
    return handleApiError(error, "API_DASHBOARD_METRICS_GET");
  }
}

