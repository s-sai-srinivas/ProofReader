import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateCsrfToken, validateCsrfToken, setCsrfCookie, CSRF_COOKIE_NAME } from "./csrf";
import { cookies } from "next/headers";

vi.mock("next/headers", () => {
  return {
    cookies: vi.fn(),
  };
});

describe("csrf library (src/lib/csrf)", () => {
  const mockCookieStore = {
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  describe("generateCsrfToken and validateCsrfToken", () => {
    it("should generate a token with the correct purpose and validate it successfully", async () => {
      const token = await generateCsrfToken();
      expect(typeof token).toBe("string");

      const isValid = await validateCsrfToken(token);
      expect(isValid).toBe(true);
    });

    it("should fail validation for tokens with incorrect purpose or invalid format", async () => {
      const isValidWithInvalidToken = await validateCsrfToken("invalid-token");
      expect(isValidWithInvalidToken).toBe(false);
    });
  });

  describe("setCsrfCookie", () => {
    it("should set the csrf cookie with the generated token and HTTPOnly/sameSite policies", async () => {
      const token = await setCsrfCookie();
      expect(typeof token).toBe("string");

      expect(mockCookieStore.set).toHaveBeenCalledWith(CSRF_COOKIE_NAME, token, {
        httpOnly: false,
        secure: false,
        sameSite: "strict",
        path: "/",
        maxAge: 3600,
      });
    });
  });
});
