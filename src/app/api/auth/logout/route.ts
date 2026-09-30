import { clearAuthCookie } from "@/lib/auth";
import { cookies } from "next/headers";
import { CSRF_COOKIE_NAME } from "@/lib/csrf";
import { apiSuccess } from "@/lib/api-response";
import { handleApiError } from "@/lib/error-handler";

export async function POST() {
  try {
    await clearAuthCookie();
    const cookieStore = await cookies();
    cookieStore.delete(CSRF_COOKIE_NAME);
    return apiSuccess({ message: "Logged out successfully" }, 200);
  } catch (error) {
    return handleApiError(error, "API_AUTH_LOGOUT");
  }
}

