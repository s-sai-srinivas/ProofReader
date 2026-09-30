import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "./route";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { isRateLimited } from "@/lib/rateLimit";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  isRateLimited: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const mockDb = {
    category: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    rule: {
      updateMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
    correction: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  mockDb.$transaction.mockImplementation((callback) => {
    if (typeof callback === "function") {
      return callback(mockDb);
    }
    return Promise.resolve(callback);
  });
  return { db: mockDb };
});

describe("Categories Management API Endpoints (/api/admin/categories)", () => {
  const mockUser = {
    id: "user-123",
    email: "admin@example.com",
    role: "ADMIN",
    orgId: "org-456",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isRateLimited).mockResolvedValue(false);
    vi.mocked(db.$transaction).mockImplementation((callback) => {
      if (typeof callback === "function") {
        return callback(db);
      }
      return Promise.resolve(callback);
    });
  });

  describe("checkAdminAccess helper and authorization", () => {
    it("should return 401 if user session is absent", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);

      const response = await GET();
      expect(response.status).toBe(401);
    });

    it("should return 403 Forbidden if user lacks categories:manage permission", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(false);

      const response = await GET();
      expect(response.status).toBe(403);
    });

    it("should return 429 if admin request is rate limited", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(isRateLimited).mockResolvedValue(true);

      const response = await GET();
      expect(response.status).toBe(429);
    });
  });

  describe("GET", () => {
    it("should return organization-scoped and global active categories", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const mockCategories = [
        { id: "cat-1", name: "GRAMMAR", orgId: null },
        { id: "cat-2", name: "STYLE", orgId: "org-456" },
      ];
      vi.mocked(db.category.findMany).mockResolvedValue(mockCategories as unknown as Awaited<ReturnType<typeof db.category.findMany>>);

      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockCategories);

      expect(db.category.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          OR: [{ orgId: null }, { orgId: "org-456" }],
        },
        orderBy: { sortOrder: "asc" },
      });
    });
  });

  describe("POST", () => {
    it("should reject with 400 if JSON is malformed", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: "bad-json",
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it("should reject with 400 if name or label is missing", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ label: "Only Label" }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it("should reject with 400 if category name already exists", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findFirst).mockResolvedValue({ id: "exist-id" } as unknown as Awaited<ReturnType<typeof db.category.findFirst>>);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "Grammar", label: "Grammar Rules" }),
      });

      const response = await POST(req);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("already exists");
    });

    it("should successfully create a standard scoped category", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findFirst).mockResolvedValue(null);

      const mockCreated = { id: "new-cat-id", name: "SPELLING", label: "Spelling" };
      vi.mocked(db.category.create).mockResolvedValue(mockCreated as unknown as Awaited<ReturnType<typeof db.category.create>>);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name: "spelling", label: "Spelling Rules", description: "Desc", color: "#eee", sortOrder: 5, weight: 1.5 }),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual(mockCreated);

      expect(db.category.create).toHaveBeenCalledWith({
        data: {
          name: "SPELLING",
          label: "Spelling Rules",
          description: "Desc",
          color: "#eee",
          sortOrder: 5,
          weight: 1.5,
          orgId: "org-456",
        },
      });
    });
  });

  describe("PUT", () => {
    it("should reject with 400 if ID is missing", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "PUT",
        body: JSON.stringify({ label: "Updated Label" }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(400);
    });

    it("should return 404 if category is not found in database", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findUnique).mockResolvedValue(null);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "PUT",
        body: JSON.stringify({ id: "nonexistent", label: "Label" }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(404);
    });

    it("should return 403 if category orgId does not match user orgId (foreign or global)", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findUnique).mockResolvedValue({ id: "global-cat", orgId: null } as unknown as Awaited<ReturnType<typeof db.category.findUnique>>);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "PUT",
        body: JSON.stringify({ id: "global-cat", label: "Updated Global" }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(403);
    });

    it("should successfully update category fields if tenant verification is passed", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const existing = { id: "cat-123", name: "GRAMMAR", label: "Old", orgId: "org-456", description: "Old desc", color: "#000", sortOrder: 0, weight: 1.0, isActive: true };
      vi.mocked(db.category.findUnique).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof db.category.findUnique>>);
      vi.mocked(db.category.update).mockResolvedValue({ ...existing, label: "New" } as unknown as Awaited<ReturnType<typeof db.category.update>>);

      const req = new Request("http://localhost/api/admin/categories", {
        method: "PUT",
        body: JSON.stringify({ id: "cat-123", label: "New" }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(200);

      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "cat-123" },
        data: {
          label: "New",
          description: "Old desc",
          color: "#000",
          sortOrder: 0,
          weight: 1.0,
          isActive: true,
        },
      });
    });
  });

  describe("DELETE", () => {
    it("should return 400 if id parameter is missing", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const response = await DELETE(new Request("http://localhost/api/admin/categories"));
      expect(response.status).toBe(400);
    });

    it("should return 404 if category to delete is not found", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findUnique).mockResolvedValue(null);

      const response = await DELETE(new Request("http://localhost/api/admin/categories?id=nonexistent"));
      expect(response.status).toBe(404);
    });

    it("should return 403 if category orgId does not match user orgId", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findUnique).mockResolvedValue({ id: "global-cat", orgId: null } as unknown as Awaited<ReturnType<typeof db.category.findUnique>>);

      const response = await DELETE(new Request("http://localhost/api/admin/categories?id=global-cat"));
      expect(response.status).toBe(403);
    });

    it("should soft delete category and reassign rules + corrections within organization atomically", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const existing = { id: "cat-123", name: "GRAMMAR", orgId: "org-456" };
      vi.mocked(db.category.findUnique).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof db.category.findUnique>>);

      // Setup for mock reassignment target
      vi.mocked(db.category.findFirst).mockResolvedValue({ id: "cat-target", name: "SPELLING", isActive: true } as unknown as Awaited<ReturnType<typeof db.category.findFirst>>);
      vi.mocked(db.document.findMany).mockResolvedValue([{ id: "doc-1" }, { id: "doc-2" }] as unknown as Awaited<ReturnType<typeof db.document.findMany>>);

      const response = await DELETE(new Request("http://localhost/api/admin/categories?id=cat-123&reassignTo=cat-target"));
      expect(response.status).toBe(200);

      // Verify soft delete called on category table inside transaction
      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "cat-123" },
        data: { isActive: false },
      });

      // Verify reassignment is triggered on rules table
      expect(db.rule.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "cat-123", orgId: "org-456" },
        data: {
          categoryId: "cat-target",
          category: "SPELLING",
        },
      });

      // Verify reassignment is triggered on corrections table
      expect(db.correction.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "cat-123", documentId: { in: ["doc-1", "doc-2"] } },
        data: {
          categoryId: "cat-target",
          category: "SPELLING",
        },
      });
    });

    it("should soft delete category and set categoryId to null on rules + corrections if no reassign target is selected", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const existing = { id: "cat-123", name: "GRAMMAR", orgId: "org-456" };
      vi.mocked(db.category.findUnique).mockResolvedValue(existing as unknown as Awaited<ReturnType<typeof db.category.findUnique>>);
      vi.mocked(db.document.findMany).mockResolvedValue([{ id: "doc-1" }] as unknown as Awaited<ReturnType<typeof db.document.findMany>>);

      const response = await DELETE(new Request("http://localhost/api/admin/categories?id=cat-123"));
      expect(response.status).toBe(200);

      // Verify soft delete called on category table inside transaction
      expect(db.category.update).toHaveBeenCalledWith({
        where: { id: "cat-123" },
        data: { isActive: false },
      });

      // Verify categoryId is nulled out on rules
      expect(db.rule.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "cat-123", orgId: "org-456" },
        data: {
          categoryId: null,
        },
      });

      // Verify categoryId is nulled out on corrections
      expect(db.correction.updateMany).toHaveBeenCalledWith({
        where: { categoryId: "cat-123", documentId: { in: ["doc-1"] } },
        data: {
          categoryId: null,
        },
      });
    });
  });
});
