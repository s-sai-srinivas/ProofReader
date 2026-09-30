import { describe, it, expect } from "vitest";
import { API } from "./api-paths";

describe("API path constants", () => {
  it("should have correct path definitions", () => {
    expect(API.AUTH_LOGIN).toBe("/api/auth/login");
    expect(API.AUTH_REGISTER).toBe("/api/auth/register");
    expect(API.AUTH_LOGOUT).toBe("/api/auth/logout");
    expect(API.DOCUMENTS).toBe("/api/documents");
    expect(API.PROOFREAD).toBe("/api/proofread");
    expect(API.ADMIN_RULES).toBe("/api/admin/rules");
    expect(API.ADMIN_CATEGORIES).toBe("/api/admin/categories");
    expect(API.ADMIN_SETTINGS).toBe("/api/admin/settings");
    expect(API.DASHBOARD_METRICS).toBe("/api/dashboard/metrics");
    expect(API.CATEGORIES).toBe("/api/categories");
  });
});
