import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    category: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/categories (Public Scoped Categories)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should return 401 if user session is absent", async () => {
    vi.mocked(getSessionUser).mockResolvedValue(null);

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("should list scoped categories successfully if user is authenticated", async () => {
    const mockUser = { id: "user-123", orgId: "org-456" };
    vi.mocked(getSessionUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getSessionUser>>);

    const mockCats = [{ id: "cat-1", name: "GRAMMAR", orgId: null }];
    vi.mocked(db.category.findMany).mockResolvedValue(mockCats as unknown as Awaited<ReturnType<typeof db.category.findMany>>);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual(mockCats);
  });

  it("should return 500 error if query throws database failure", async () => {
    const mockUser = { id: "user-123", orgId: "org-456" };
    vi.mocked(getSessionUser).mockResolvedValue(mockUser as unknown as Awaited<ReturnType<typeof getSessionUser>>);
    vi.mocked(db.category.findMany).mockRejectedValue(new Error("Database disconnected"));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
