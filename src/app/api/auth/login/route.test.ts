import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { db } from "@/lib/db";
import { signJWT, setAuthCookie } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import bcrypt from "bcryptjs";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  signJWT: vi.fn(),
  setAuthCookie: vi.fn(),
}));

vi.mock("@/lib/csrf", () => ({
  setCsrfCookie: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("should return 429 if login is rate limited", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "Password123!" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body.error).toContain("Too many login attempts");
  });

  it("should return 400 if JSON payload is invalid", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: "not-json",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid JSON payload");
  });

  it("should return 400 if schema validation fails", async () => {
    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "invalid-email", password: "short" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Validation failed");
  });

  it("should return 401 if credentials are invalid (user not found)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "unknown@example.com", password: "Password123!" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toContain("Invalid credentials");
  });

  it("should return 401 if password check fails", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      passwordHash: "some-hash",
      name: "Test User",
    };
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof db.user.findUnique>>);
    vi.mocked(bcrypt.compare).mockResolvedValue(false);

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "WrongPassword123!" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
    expect(bcrypt.compare).toHaveBeenCalledWith("WrongPassword123!", "some-hash");
  });

  it("should log in successfully, sign token and set cookies", async () => {
    const mockUser = {
      id: "user-123",
      email: "test@example.com",
      passwordHash: "valid-hash",
      name: "Test User",
    };
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof db.user.findUnique>>);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);
    vi.mocked(signJWT).mockResolvedValue("signed-token-string");

    const req = new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "test@example.com", password: "Password123!" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.message).toBe("Logged in successfully");
    expect(body.user).toEqual({ id: "user-123", name: "Test User", email: "test@example.com" });

    expect(signJWT).toHaveBeenCalledWith({ userId: "user-123", email: "test@example.com" });
    expect(setAuthCookie).toHaveBeenCalledWith("signed-token-string");
  });
});
