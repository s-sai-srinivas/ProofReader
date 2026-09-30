import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { clearAuthCookie } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  clearAuthCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    delete: vi.fn(),
  }),
}));

describe("POST /api/auth/logout", () => {
  it("should clear auth cookie and return 200 success message", async () => {
    const response = await POST();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe("Logged out successfully");
    expect(clearAuthCookie).toHaveBeenCalled();
  });
});
