import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { config as appConfig } from "./lib/config";
import { validateCsrfToken } from "./lib/csrf";

const JWT_SECRET = appConfig.auth.jwtSecret;
const key = new TextEncoder().encode(JWT_SECRET);

interface JwtPayload {
  userId: string;
  email: string;
  exp?: number;
  purpose?: string;
  [key: string]: unknown;
}

const CSRF_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/health",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const token = request.cookies.get("token")?.value;

  // Correlation: Propagate x-request-id downstream and set it on all response headers
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Security: Generate a one-time dynamic nonce for script-src to drop unsafe-inline scripts
  const nonce = crypto.randomUUID();
  const cspHeader = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.groq.com; form-action 'self'; base-uri 'self'; object-src 'none';`;

  let isAuthenticated = false;
  let decodedPayload: JwtPayload | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: [appConfig.auth.jwtAlgorithm],
      });
      decodedPayload = payload as unknown as JwtPayload;
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isDashboardPage = pathname.startsWith("/dashboard");
  const isApiPage = pathname.startsWith("/api");

  // Helper to construct structured responses with security & correlation headers attached
  const buildResponse = (res: NextResponse) => {
    res.headers.set("x-request-id", requestId);
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  };

  // CSRF protection for state-changing API requests
  if (isApiPage && method !== "GET" && method !== "HEAD") {
    const isExempt = CSRF_EXEMPT_PATHS.some((path) => pathname.startsWith(path));
    if (!isExempt) {
      const csrfCookie = request.cookies.get("csrf-token")?.value;
      const csrfHeader = request.headers.get("x-csrf-token");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return buildResponse(
          NextResponse.json(
            { error: "CSRF validation failed: invalid or missing token" },
            { status: 403 }
          )
        );
      }
      const validToken = await validateCsrfToken(csrfHeader);
      if (!validToken) {
        return buildResponse(
          NextResponse.json(
            { error: "CSRF validation failed: token expired or invalid" },
            { status: 403 }
          )
        );
      }
    }
  }

  if (isApiPage) {
    const isPublicApi = pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/register") || pathname.startsWith("/api/health");
    if (!isPublicApi && !isAuthenticated) {
      return buildResponse(
        NextResponse.json({ error: "Unauthorized access blocked by proxy" }, { status: 401 })
      );
    }
  }

  if (isDashboardPage && !isAuthenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return buildResponse(NextResponse.redirect(url));
  }

  if (isAuthPage && isAuthenticated) {
    return buildResponse(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (isAuthenticated && decodedPayload && decodedPayload.exp) {
    const expMs = decodedPayload.exp * 1000;
    const nowMs = Date.now();
    const refreshThreshold = appConfig.auth.tokenRefreshThresholdMs;

    if (expMs - nowMs < refreshThreshold) {
      try {
        const refreshedToken = await new SignJWT({
          userId: decodedPayload.userId,
          email: decodedPayload.email,
        })
          .setProtectedHeader({ alg: appConfig.auth.jwtAlgorithm })
          .setIssuedAt()
          .setExpirationTime(appConfig.auth.jwtExpiresIn)
          .sign(key);

        response.cookies.set("token", refreshedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: appConfig.auth.jwtCookieMaxAge,
        });
      } catch {
        // fail-safe
      }
    }
  }

  return buildResponse(response);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/api/:path*"],
};
