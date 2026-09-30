import { describe, it, expect } from "vitest";
import { hasPermission } from "./permissions";

describe("permissions engine (src/lib/permissions)", () => {
  it("should return false if user is null or undefined", () => {
    expect(hasPermission(null, "rules:manage")).toBe(false);
    expect(hasPermission(undefined, "rules:manage")).toBe(false);
  });

  describe("dynamic database permissions check", () => {
    it("should allow permission if it is in the roleRel.permissions array", () => {
      const user = {
        role: "CUSTOM_ROLE",
        roleRel: {
          id: "role-1",
          name: "CUSTOM_ROLE",
          label: "Custom",
          permissions: ["documents:read", "custom:permission"],
        },
      };

      expect(hasPermission(user, "documents:read")).toBe(true);
      expect(hasPermission(user, "custom:permission")).toBe(true);
      expect(hasPermission(user, "rules:manage")).toBe(false);
    });

    it("should ignore invalid roleRel permissions that are not array types", () => {
      const user = {
        role: "ADMIN",
        roleRel: {
          id: "role-admin",
          name: "ADMIN",
          label: "Admin",
          permissions: "not-an-array" as unknown,
        },
      };

      // Since permissions is not an array, it should fallback to hardcoded ADMIN permissions
      expect(hasPermission(user, "rules:manage")).toBe(true);
      expect(hasPermission(user, "unrecognized:permission")).toBe(false);
    });
  });

  describe("fallback static permissions check", () => {
    it("should allow correct static permissions for hardcoded ADMIN role", () => {
      const user = { role: "ADMIN" };
      expect(hasPermission(user, "rules:manage")).toBe(true);
      expect(hasPermission(user, "categories:manage")).toBe(true);
      expect(hasPermission(user, "settings:manage")).toBe(true);
      expect(hasPermission(user, "nonexistent")).toBe(false);
    });

    it("should allow correct static permissions for EDITOR role", () => {
      const user = { role: "EDITOR" };
      expect(hasPermission(user, "documents:read")).toBe(true);
      expect(hasPermission(user, "rules:view")).toBe(true);
      expect(hasPermission(user, "rules:manage")).toBe(false);
    });

    it("should work for roles specified in mixed or lower case by converting to upper case", () => {
      const user = { role: "editor" };
      expect(hasPermission(user, "documents:read")).toBe(true);
      expect(hasPermission(user, "rules:view")).toBe(true);
      expect(hasPermission(user, "rules:manage")).toBe(false);
    });

    it("should return false for unrecognized static roles", () => {
      const user = { role: "UNKNOWN_ROLE" };
      expect(hasPermission(user, "documents:read")).toBe(false);
    });
  });
});
