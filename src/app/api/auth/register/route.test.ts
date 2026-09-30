import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { db } from "@/lib/db";
import { signJWT, setAuthCookie } from "@/lib/auth";
import { isRateLimited } from "@/lib/rateLimit";
import { getSetting } from "@/lib/settings";
import bcrypt from "bcryptjs";

const { mockTx } = vi.hoisted(() => ({
  mockTx: {
    organization: {
      create: vi.fn(),
    },
    user: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      if (typeof callback === "function") {
        return callback(mockTx);
      }
      return Promise.resolve();
    }),
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

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
  },
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(getSetting).mockResolvedValue(8); // Default length: 8
  });

  it("should return 429 if registration is rate limited", async () => {
    vi.mocked(isRateLimited).mockResolvedValue(true);

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "alice@example.com", password: "Password123!", orgName: "Alice Org" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(429);
  });

  it("should return 400 if JSON payload is invalid", async () => {
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: "invalid-json",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("should return 400 if password is shorter than custom setting length", async () => {
    vi.mocked(getSetting).mockResolvedValue(12);

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "alice@example.com", password: "short", orgName: "Alice Org" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Validation failed");
  });

  it("should return 400 if other validation fields fail", async () => {
    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "", email: "not-an-email", password: "Short" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it("should return 400 if a user with the same email already exists", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: "existing-id" } as unknown as Awaited<ReturnType<typeof db.user.findUnique>>);

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "existing@example.com", password: "Password123!", orgName: "Alice Workspace" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("already exists");
  });

  it("should register successfully, create organization and user, and set cookie", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never);

    const mockOrg = { id: "org-777", name: "Alice Workspace" };
    vi.mocked(mockTx.organization.create).mockResolvedValue(mockOrg);

    const mockCreatedUser = { id: "user-888", name: "Alice", email: "alice@example.com" };
    vi.mocked(mockTx.user.create).mockResolvedValue(mockCreatedUser);

    vi.mocked(signJWT).mockResolvedValue("signed-token-string");

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "alice@example.com", password: "Password123!", orgName: "Alice Workspace" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.message).toBe("User registered successfully");
    expect(body.user).toEqual({ id: "user-888", name: "Alice", email: "alice@example.com" });

    expect(mockTx.organization.create).toHaveBeenCalledWith({
      data: { name: "Alice Workspace" },
    });
    expect(mockTx.user.create).toHaveBeenCalledWith({
      data: {
        name: "Alice",
        email: "alice@example.com",
        passwordHash: "hashed-pw",
        role: "ADMIN",
        orgId: "org-777",
      },
    });
    expect(signJWT).toHaveBeenCalledWith({ userId: "user-888", email: "alice@example.com" });
    expect(setAuthCookie).toHaveBeenCalledWith("signed-token-string");
  });

  it("should generate default workspace name if orgName is missing", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never);

    const mockOrg = { id: "org-777", name: "Alice's Workspace" };
    vi.mocked(mockTx.organization.create).mockResolvedValue(mockOrg);

    const mockCreatedUser = { id: "user-888", name: "Alice", email: "alice@example.com" };
    vi.mocked(mockTx.user.create).mockResolvedValue(mockCreatedUser);

    const req = new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Alice", email: "alice@example.com", password: "Password123!" }),
    });

    await POST(req);

    expect(mockTx.organization.create).toHaveBeenCalledWith({
      data: { name: "Alice's Workspace" },
    });
  });
});
