import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PUT, DELETE } from "./route";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    rule: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findFirst: vi.fn(),
    },
  },
}));

describe("Rules Management API Endpoints (/api/admin/rules)", () => {
  const mockUser = {
    id: "user-123",
    email: "admin@example.com",
    role: "ADMIN",
    orgId: "org-456",
  };



  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Authorization & Permissions", () => {
    it("should return 401 if user session is absent on GET", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);
      const response = await GET(new Request("http://localhost/api/admin/rules"));
      expect(response.status).toBe(401);
    });

    it("should return 403 Forbidden if user lacks rules:manage permission on POST", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(false);

      const response = await POST(new Request("http://localhost/api/admin/rules", {
        method: "POST",
        body: JSON.stringify({}),
      }));
      expect(response.status).toBe(403);
    });
  });

  describe("GET", () => {
    it("should return list of rules scoped to the user's organization", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const mockRulesList = [
        { id: "rule-1", pattern: "color", replacement: "colour", category: "SPELLING", orgId: "org-456" },
      ];
      vi.mocked(db.rule.findMany).mockResolvedValue(mockRulesList as unknown as Awaited<ReturnType<typeof db.rule.findMany>>);

      const response = await GET(new Request("http://localhost/api/admin/rules"));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual(mockRulesList);
      
      expect(db.rule.findMany).toHaveBeenCalledWith({
        where: { orgId: "org-456" },
        orderBy: { updatedAt: "desc" },
      });
    });

    it("should apply search filtering and category constraints properly", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.rule.findMany).mockResolvedValue([]);

      await GET(new Request("http://localhost/api/admin/rules?search=col&category=grammar"));

      expect(db.rule.findMany).toHaveBeenCalledWith({
        where: {
          orgId: "org-456",
          category: "GRAMMAR",
          OR: [
            { pattern: { contains: "col" } },
            { explanation: { contains: "col" } },
            { replacement: { contains: "col" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
      });
    });
  });

  describe("POST", () => {
    it("should return 400 Bad Request if category is missing or inactive", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      vi.mocked(db.category.findFirst).mockResolvedValue(null); // Category not found

      const requestBody = {
        pattern: "vitalize",
        replacement: "vitalise",
        category: "TONE",
        explanation: "Prefer UK spelling.",
      };

      const response = await POST(new Request("http://localhost/api/admin/rules", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Category 'TONE' not found");
    });

    it("should successfully create a new rule and map organizational boundaries", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      
      const mockCategory = { id: "cat-tone-id", name: "TONE", isActive: true };
      vi.mocked(db.category.findFirst).mockResolvedValue(mockCategory as unknown as Awaited<ReturnType<typeof db.category.findFirst>>);

      const mockRule = { id: "rule-987", pattern: "prioritize" };
      vi.mocked(db.rule.create).mockResolvedValue(mockRule as unknown as Awaited<ReturnType<typeof db.rule.create>>);

      const requestBody = {
        pattern: "prioritize",
        replacement: "prioritise",
        category: "TONE",
        explanation: "Prefer tone rules.",
      };

      const response = await POST(new Request("http://localhost/api/admin/rules", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body).toEqual(mockRule);

      expect(db.rule.create).toHaveBeenCalledWith({
        data: {
          pattern: "prioritize",
          replacement: "prioritise",
          category: "TONE",
          categoryId: "cat-tone-id",
          explanation: "Prefer tone rules.",
          isActive: true,
          orgId: "org-456",
        },
      });
    });
  });

  describe("PUT", () => {
    it("should return 403 Forbidden if admin attempts to modify a rule belonging to another organization", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser); // Org is org-456
      vi.mocked(hasPermission).mockReturnValue(true);

      const foreignRule = { id: "foreign-rule-id", orgId: "org-999" };
      vi.mocked(db.rule.findUnique).mockResolvedValue(foreignRule as unknown as Awaited<ReturnType<typeof db.rule.findUnique>>);

      const requestBody = {
        id: "foreign-rule-id",
        pattern: "mismatch",
        replacement: "mock-replacement",
        category: "GRAMMAR",
        explanation: "Test explanation",
      };

      const response = await PUT(new Request("http://localhost/api/admin/rules", {
        method: "PUT",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toContain("Cannot modify rules belonging to another organization");
    });

    it("should successfully update rules within tenant boundaries", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const ownRule = { id: "own-rule-id", orgId: "org-456", category: "GRAMMAR", categoryId: "cat-g" };
      vi.mocked(db.rule.findUnique).mockResolvedValue(ownRule as unknown as Awaited<ReturnType<typeof db.rule.findUnique>>);
      vi.mocked(db.category.findFirst).mockResolvedValue({ id: "cat-g", name: "GRAMMAR", isActive: true } as unknown as Awaited<ReturnType<typeof db.category.findFirst>>);
      vi.mocked(db.rule.update).mockImplementation((args) => Promise.resolve(args.data) as unknown as Promise<Awaited<ReturnType<typeof db.rule.update>>>);

      const requestBody = {
        id: "own-rule-id",
        pattern: "updated-pattern",
        replacement: "mock-replacement",
        category: "GRAMMAR",
        explanation: "Test explanation",
        isActive: false,
      };

      const response = await PUT(new Request("http://localhost/api/admin/rules", {
        method: "PUT",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(200);
      expect(db.rule.update).toHaveBeenCalledWith({
        where: { id: "own-rule-id" },
        data: {
          pattern: "updated-pattern",
          replacement: "mock-replacement",
          isActive: false,
          category: "GRAMMAR",
          categoryId: "cat-g",
          explanation: "Test explanation",
        },
      });
    });
  });

  describe("DELETE", () => {
    it("should return 403 Forbidden if admin attempts to delete a rule belonging to another organization", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const foreignRule = { id: "foreign-rule-id", orgId: "org-999" };
      vi.mocked(db.rule.findUnique).mockResolvedValue(foreignRule as unknown as Awaited<ReturnType<typeof db.rule.findUnique>>);

      const response = await DELETE(new Request("http://localhost/api/admin/rules?id=foreign-rule-id", {
        method: "DELETE",
      }));

      expect(response.status).toBe(403);
    });

    it("should successfully delete the rule inside tenant bounds", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const ownRule = { id: "own-rule-id", orgId: "org-456" };
      vi.mocked(db.rule.findUnique).mockResolvedValue(ownRule as unknown as Awaited<ReturnType<typeof db.rule.findUnique>>);

      const response = await DELETE(new Request("http://localhost/api/admin/rules?id=own-rule-id", {
        method: "DELETE",
      }));

      expect(response.status).toBe(200);
      expect(db.rule.delete).toHaveBeenCalledWith({
        where: { id: "own-rule-id" },
      });
    });
  });
});
