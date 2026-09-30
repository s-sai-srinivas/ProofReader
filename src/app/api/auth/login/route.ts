import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT, setAuthCookie } from "@/lib/auth";
import { setCsrfCookie } from "@/lib/csrf";
import { isRateLimited } from "@/lib/rateLimit";
import { LoginSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";
import { config } from "@/lib/config";
import { handleApiError } from "@/lib/error-handler";
import { sanitizeEmail } from "@/lib/sanitize";

const DUMMY_HASH = "$2b$10$nOUIs5kJ7naTuTFkC1UrZOyfF7LYLWn9HPXXiKLUqFLOae/.zT3qy";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "anonymous-login";

    const { limit, windowMs } = config.rateLimit.login;
    if (await isRateLimited(`login-${ip}`, limit, windowMs)) {
      return apiError(429, `Too many login attempts. Please try again after ${windowMs / 1000} seconds.`);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON payload");
    }

    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { email, password } = validation.data;
    const cleanEmail = sanitizeEmail(email);

    const user = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    const hash = user ? user.passwordHash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hash);

    if (!user || !isValid) {
      return apiError(401, "Invalid credentials");
    }

    const token = await signJWT({ userId: user.id, email: user.email });
    await setAuthCookie(token);
    await setCsrfCookie();

    return apiSuccess(
      {
        message: "Logged in successfully",
        user: { id: user.id, name: user.name, email: user.email },
      },
      200
    );
  } catch (error) {
    return handleApiError(error, "API_AUTH_LOGIN");
  }
}
