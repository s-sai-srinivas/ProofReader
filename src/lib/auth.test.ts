import { describe, it, expect, vi, beforeEach } from "vitest";
import { signJWT, verifyJWT, getSessionUser, setAuthCookie, clearAuthCookie } from "./auth";
import { cookies } from "next/headers";
import { db } from "./db";

vi.mock("next/headers", () => {
  return {
    cookies: vi.fn(),
  };
});

vi.mock("./db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe("auth library (src/lib/auth)", () => {
  const mockCookieStore = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  describe("signJWT and verifyJWT", () => {
    it("should sign a payload and successfully verify it", async () => {
      const payload = { userId: "user-123", email: "test@example.com" };
      const token = await signJWT(payload);
      expect(typeof token).toBe("string");

      const verified = await verifyJWT(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe("user-123");
      expect(verified?.email).toBe("test@example.com");
    });

    it("should return null for an invalid token", async () => {
      const verified = await verifyJWT("invalid.token.here");
      expect(verified).toBeNull();
    });
  });

  describe("getSessionUser", () => {
    it("should return null if token cookie is absent", async () => {
      vi.mocked(mockCookieStore.get).mockReturnValue(undefined);

      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it("should return null if token verification fails", async () => {
      vi.mocked(mockCookieStore.get).mockReturnValue({ name: "token", value: "invalid" });

      const user = await getSessionUser();
      expect(user).toBeNull();
    });

    it("should return user if token is valid and user exists in database", async () => {
      const payload = { userId: "user-123", email: "test@example.com" };
      const token = await signJWT(payload);

      vi.mocked(mockCookieStore.get).mockReturnValue({ name: "token", value: token });

      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "ADMIN",
        roleId: "role-admin",
        roleRel: {
          id: "role-admin",
          name: "ADMIN",
          label: "Admin User",
          permissions: [],
        },
        orgId: "org-456",
        createdAt: new Date(),
      };
      vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof db.user.findUnique>>);

      const user = await getSessionUser();
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-123");
      expect(user?.role).toBe("ADMIN");
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-123" },
        select: expect.any(Object),
      });
    });

    it("should return null if database query throws an error", async () => {
      const payload = { userId: "user-123", email: "test@example.com" };
      const token = await signJWT(payload);

      vi.mocked(mockCookieStore.get).mockReturnValue({ name: "token", value: token });

      vi.mocked(db.user.findUnique).mockRejectedValue(new Error("DB Connection Error"));

      const user = await getSessionUser();
      expect(user).toBeNull();
    });
  });

  describe("setAuthCookie", () => {
    it("should set token cookie with correct HTTPOnly security parameters", async () => {
      await setAuthCookie("test-token-value");
      expect(mockCookieStore.set).toHaveBeenCalledWith("token", "test-token-value", {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        path: "/",
        maxAge: expect.any(Number),
      });
    });
  });

  describe("clearAuthCookie", () => {
    it("should delete the token cookie", async () => {
      await clearAuthCookie();
      expect(mockCookieStore.delete).toHaveBeenCalledWith("token");
    });
  });
});
