import { Prisma } from "@prisma/client";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api-response";
import { hasPermission } from "@/lib/permissions";
import { invalidateSettingsCache } from "@/lib/settings";
import { handleApiError } from "@/lib/error-handler";
import { isRateLimited } from "@/lib/rateLimit";

interface SettingUpdate {
  key: string;
  value: Prisma.InputJsonValue;
  type?: string;
}

async function checkSettingsAccess() {
  const user = await getSessionUser();
  if (!user) {
    return { error: "Unauthorized", status: 401 };
  }
  if (!hasPermission(user, "settings:manage")) {
    return { error: "Forbidden - Settings access required", status: 403 };
  }
  // Resiliency: rate-limit settings admin requests to 60/min
  if (await isRateLimited(`admin-settings-${user.id}`, 60, 60000)) {
    return { error: "Too many admin requests. Please try again after 60 seconds.", status: 429 };
  }
  return { user };
}

export async function GET() {
  const access = await checkSettingsAccess();
  if (access.error || !access.user) {
    return apiError(access.status || 401, access.error || "Unauthorized");
  }

  try {
    const settings = await db.setting.findMany({
      where: {
        OR: [
          { orgId: null },
          { orgId: access.user.orgId },
        ],
      },
      orderBy: { key: "asc" },
    });

    return apiSuccess(settings);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_SETTINGS_GET");
  }
}

export async function PUT(req: Request) {
  const access = await checkSettingsAccess();
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

    const { settings } = body;
    if (!settings || !Array.isArray(settings)) {
      return apiError(400, "Settings array is required");
    }

    const updatedSettings = await db.$transaction(
      settings.map((item: SettingUpdate) => {
        let valueToUpdate: unknown = item.value;

        if (item.type === "number") {
          valueToUpdate = Number(item.value);
        } else if (item.type === "boolean") {
          valueToUpdate = item.value === "true" || item.value === true;
        }

        return db.setting.update({
          where: { key: item.key },
          data: {
            value: valueToUpdate as Prisma.InputJsonValue,
          },
        });
      })
    );

    invalidateSettingsCache();

    return apiSuccess(updatedSettings);
  } catch (error) {
    return handleApiError(error, "API_ADMIN_SETTINGS_PUT");
  }
}
