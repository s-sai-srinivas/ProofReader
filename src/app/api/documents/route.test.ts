import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "./route";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    document: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    correction: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((callback) => {
      if (typeof callback === "function") {
        return callback(db);
      }
      return Promise.resolve(callback);
    }),
  },
}));

describe("Documents API Endpoints (/api/documents)", () => {
  const mockUser = {
    id: "user-123",
    email: "writer@example.com",
    orgId: "org-456",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET", () => {
    it("should return 401 Unauthorized if no active user session exists", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);

      const response = await GET(new Request("http://localhost/api/documents"));
      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request if document id is missing from query parameters", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      const response = await GET(new Request("http://localhost/api/documents"));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Document ID required");
    });

    it("should enforce multi-tenant isolation, returning 404 if document owner or org does not match user", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      // Mock db search to yield null (document belongs to different user or organization)
      vi.mocked(db.document.findFirst).mockResolvedValue(null);

      const response = await GET(new Request("http://localhost/api/documents?id=doc-abc"));
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain("Document not found");

      expect(db.document.findFirst).toHaveBeenCalledWith({
        where: { id: "doc-abc", ownerId: "user-123", orgId: "org-456" },
        include: { corrections: true },
      });
    });

    it("should successfully return document and corrections if tenant boundary constraints are satisfied", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      
      const mockDocument = {
        id: "doc-abc",
        title: "Test doc",
        originalContent: "Text",
        ownerId: "user-123",
        orgId: "org-456",
        corrections: [],
      };
      vi.mocked(db.document.findFirst).mockResolvedValue(mockDocument as unknown as Awaited<ReturnType<typeof db.document.findFirst>>);

      const response = await GET(new Request("http://localhost/api/documents?id=doc-abc"));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toEqual(mockDocument);
    });
  });

  describe("POST (Create & Update)", () => {
    it("should return 401 Unauthorized if no session exists on save", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);
      const response = await POST(new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify({}),
      }));
      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request on schema validation errors", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      // Submit invalid document missing required 'title' and 'content' fields
      const response = await POST(new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify({
          status: "DRAFT",
        }),
      }));

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain("Validation failed");
    });

    it("should successfully create a new document scoped to current user and org context", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      const mockCreatedDoc = { id: "new-doc-id", title: "New Document Title" };
      vi.mocked(db.document.create).mockResolvedValue(mockCreatedDoc as unknown as Awaited<ReturnType<typeof db.document.create>>);

      const requestBody = {
        title: "New Document Title",
        content: "Draft writing of my paper.",
      };

      const response = await POST(new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockCreatedDoc);

      expect(db.document.create).toHaveBeenCalledWith({
        data: {
          title: "New Document Title",
          originalContent: "Draft writing of my paper.",
          wordCount: 5,
          ownerId: "user-123",
          orgId: "org-456",
          status: "DRAFT",
        },
      });
    });

    it("should block update with 409 Conflict if document version in body mismatches database version", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      const dbDocument = { id: "doc-abc", version: 5 }; // Version in DB is 5
      vi.mocked(db.document.findFirst).mockResolvedValue(dbDocument as unknown as Awaited<ReturnType<typeof db.document.findFirst>>);

      const requestBody = {
        id: "doc-abc",
        title: "Update Document Title",
        content: "Draft content.",
        version: 4, // Outdated version submitted
      };

      const response = await POST(new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error).toContain("Conflict: This document has been modified by another session");
    });

    it("should execute updates and refresh correction records in a single transaction if versions match", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);

      const dbDocument = { id: "doc-abc", version: 5, originalContent: "Sample draft." };
      vi.mocked(db.document.findFirst).mockResolvedValue(dbDocument as unknown as Awaited<ReturnType<typeof db.document.findFirst>>);

      const mockUpdatedDoc = { id: "doc-abc", version: 6 };
      vi.mocked(db.document.update).mockResolvedValue(mockUpdatedDoc as unknown as Awaited<ReturnType<typeof db.document.update>>);

      // Mock active categories in DB to validate submitted corrections categories
      const activeCats = [
        { id: "cat-grammar-id", name: "GRAMMAR", isActive: true },
        { id: "cat-style-id", name: "STYLE", isActive: true },
      ];
      vi.mocked(db.category.findMany).mockResolvedValue(activeCats as unknown as Awaited<ReturnType<typeof db.category.findMany>>);

      const requestBody = {
        id: "doc-abc",
        title: "Update Document Title",
        content: "Sample text content.", // Length is 21
        version: 5,
        corrections: [
          {
            category: "GRAMMAR",
            originalText: "Sample",
            suggestedText: "Example",
            explanation: "Better word choice.",
            offsetStart: 0,
            offsetEnd: 6,
          },
          {
            category: "INVALID_CAT", // Should be filtered out as inactive/unrecognized
            originalText: "text",
            suggestedText: "prose",
            explanation: "Style check.",
            offsetStart: 7,
            offsetEnd: 11,
          },
        ],
      };

      const response = await POST(new Request("http://localhost/api/documents", {
        method: "POST",
        body: JSON.stringify(requestBody),
      }));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockUpdatedDoc);

      // Verify Prisma transaction updates was called for document and corrections tables
      expect(db.document.update).toHaveBeenCalledWith({
        where: { id: "doc-abc" },
        data: {
          title: "Update Document Title",
          originalContent: "Sample text content.",
          correctedContent: null,
          wordCount: 3,
          status: "DRAFT",
          version: { increment: 1 },
        },
      });

      // Verify deletion of old corrections scoped to doc-abc
      expect(db.correction.deleteMany).toHaveBeenCalledWith({
        where: { documentId: "doc-abc" },
      });

      // Verify createMany only inserted the valid correction (GRAMMAR), filtering out the invalid category correction
      expect(db.correction.createMany).toHaveBeenCalledWith({
        data: [
          {
            documentId: "doc-abc",
            category: "GRAMMAR",
            categoryId: "cat-grammar-id",
            originalText: "Sample",
            suggestedText: "Example",
            explanation: "Better word choice.",
            offsetStart: 0,
            offsetEnd: 6,
          },
        ],
      });
    });
  });
});
