import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config } from "./config";

const CSRF_SECRET = config.auth.jwtSecret;
const key = new TextEncoder().encode(CSRF_SECRET);

export async function generateCsrfToken(): Promise<string> {
  const csrfToken = await new SignJWT({ purpose: "csrf" })
    .setProtectedHeader({ alg: config.auth.jwtAlgorithm })
    .setExpirationTime("1h")
    .sign(key);

  return csrfToken;
}

export async function validateCsrfToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [config.auth.jwtAlgorithm],
    });
    return payload.purpose === "csrf";
  } catch {
    return false;
  }
}

export const CSRF_COOKIE_NAME = "csrf-token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export async function setCsrfCookie(): Promise<string> {
  const token = await generateCsrfToken();
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });
  return token;
}
