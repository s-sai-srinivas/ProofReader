import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";
import { config } from "./config";

const JWT_SECRET = config.auth.jwtSecret;
const key = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: string;
  email: string;
}

export async function signJWT(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: config.auth.jwtAlgorithm })
    .setIssuedAt()
    .setExpirationTime(config.auth.jwtExpiresIn)
    .sign(key);
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [config.auth.jwtAlgorithm],
    });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  
  if (!token) return null;
  
  const payload = await verifyJWT(token);
  if (!payload) return null;
  
  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roleId: true,
        roleRel: {
          select: {
            id: true,
            name: true,
            label: true,
            permissions: true,
          },
        },
        orgId: true,
        createdAt: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: config.auth.jwtCookieMaxAge,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
}
