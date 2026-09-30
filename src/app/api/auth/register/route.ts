import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signJWT, setAuthCookie } from "@/lib/auth";
import { setCsrfCookie } from "@/lib/csrf";
import { isRateLimited } from "@/lib/rateLimit";
import { RegisterSchema } from "@/lib/validation";
import { apiError, apiSuccess } from "@/lib/api-response";
import { config } from "@/lib/config";
import { getSetting } from "@/lib/settings";
import { handleApiError } from "@/lib/error-handler";
import { sanitizeText, sanitizeEmail } from "@/lib/sanitize";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "anonymous-register";

    const { limit, windowMs } = config.rateLimit.register;
    if (await isRateLimited(`register-${ip}`, limit, windowMs)) {
      return apiError(429, `Too many registration attempts. Please try again after ${windowMs / 1000} seconds.`);
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return apiError(400, "Invalid JSON payload");
    }

    const minLength = await getSetting("password_min_length", config.app.passwordMinLength);
    if (body && typeof body.password === "string" && body.password.length < minLength) {
      return apiError(400, "Validation failed", {
        password: { _errors: [`Password must be at least ${minLength} characters`] }
      });
    }

    const validation = RegisterSchema.safeParse(body);
    if (!validation.success) {
      return apiError(400, "Validation failed", validation.error.format());
    }

    const { name, email, password, orgName } = validation.data;

    const cleanName = sanitizeText(name);
    const cleanOrgName = orgName && orgName.trim() ? sanitizeText(orgName.trim()) : `${cleanName}'s Workspace`;
    const cleanEmail = sanitizeEmail(email);

    const existingUser = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return apiError(400, "A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const user = await db.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: cleanOrgName,
        },
      });

      if (!org.id) {
        throw new Error("Failed to initialize organization identifier.");
      }

      return tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          passwordHash,
          role: "ADMIN",
          orgId: org.id,
        },
      });
    });

    const token = await signJWT({ userId: user.id, email: user.email });
    await setAuthCookie(token);
    await setCsrfCookie();

    return apiSuccess(
      {
        message: "User registered successfully",
        user: { id: user.id, name: user.name, email: user.email },
      },
      201
    );
  } catch (error) {
    return handleApiError(error, "API_AUTH_REGISTER");
  }
}
