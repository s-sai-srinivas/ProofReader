import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "./route";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/settings";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    setting: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === "function") {
        return arg(db);
      }
      return Promise.resolve(arg);
    }),
  },
}));

vi.mock("@/lib/settings", () => ({
  invalidateSettingsCache: vi.fn(),
}));

describe("Settings API Endpoints (/api/admin/settings)", () => {
  const mockUser = {
    id: "user-123",
    email: "admin@example.com",
    role: "ADMIN",
    orgId: "org-456",
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("GET", () => {
    it("should return 401 Unauthorized if no active user session exists", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);

      const response = await GET();
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 403 Forbidden if user lacks settings:manage permission", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(false);

      const response = await GET();
      expect(response.status).toBe(403);
      
      const body = await response.json();
      expect(body.error).toContain("Settings access required");
    });

    it("should query and return organization scoped and global settings for authorized admin", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      
      const mockSettingsList = [
        { key: "setting-1", value: "val-1", orgId: null },
        { key: "setting-2", value: "val-2", orgId: "org-456" },
      ];
      vi.mocked(db.setting.findMany).mockResolvedValue(mockSettingsList as unknown as Awaited<ReturnType<typeof db.setting.findMany>>);

      const response = await GET();
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toEqual(mockSettingsList);

      // Verify db boundary filtering matches user's org
      expect(db.setting.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { orgId: null },
            { orgId: "org-456" },
          ],
        },
        orderBy: { key: "asc" },
      });
    });
  });

  describe("PUT", () => {
    it("should return 401 Unauthorized if no active user session exists on save", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(null);
      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: [] }),
      });

      const response = await PUT(req);
      expect(response.status).toBe(401);
    });

    it("should return 400 Bad Request if request body has an invalid JSON format", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      
      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: "invalid-json-text",
      });

      const response = await PUT(req);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain("Invalid JSON payload");
    });

    it("should return 400 Bad Request if body settings array is missing", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);
      
      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({}),
      });

      const response = await PUT(req);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain("Settings array is required");
    });

    it("should cast types correctly and update settings in transaction, then invalidate settings cache", async () => {
      vi.mocked(getSessionUser).mockResolvedValue(mockUser);
      vi.mocked(hasPermission).mockReturnValue(true);

      const requestSettings = [
        { key: "ai_timeout_ms", value: "30000", type: "number" },
        { key: "enable_strict_auth", value: "true", type: "boolean" },
        { key: "ai_model", value: "llama-3.3-70b-versatile", type: "string" },
      ];

      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: requestSettings }),
      });

      vi.mocked(db.setting.update).mockImplementation((args) => Promise.resolve(args.data) as unknown as Promise<Awaited<ReturnType<typeof db.setting.update>>>);

      const response = await PUT(req);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body).toBeDefined();

      // Verify transaction database updates were triggered with casted types
      expect(db.setting.update).toHaveBeenCalledTimes(3);
      expect(db.setting.update).toHaveBeenNthCalledWith(1, {
        where: { key: "ai_timeout_ms" },
        data: { value: 30000 },
      });
      expect(db.setting.update).toHaveBeenNthCalledWith(2, {
        where: { key: "enable_strict_auth" },
        data: { value: true },
      });
      expect(db.setting.update).toHaveBeenNthCalledWith(3, {
        where: { key: "ai_model" },
        data: { value: "llama-3.3-70b-versatile" },
      });

      // Assert settings cache was invalidated
      expect(invalidateSettingsCache).toHaveBeenCalled();
    });
  });
});
