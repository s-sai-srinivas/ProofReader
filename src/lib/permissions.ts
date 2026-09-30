/**
 * Extensible Role-Based Access Control (RBAC) Permissions Engine for ProofReader
 * Supports dynamic database-defined role permissions with secure fallback defaults.
 */

export const PERMISSIONS = {
  "ADMIN": [
    "rules:manage",
    "categories:manage",
    "documents:read",
    "documents:write",
    "users:manage",
    "settings:manage",
  ],
  "PUBLISHER": [
    "documents:read",
    "documents:write",
  ],
  "EDITOR": [
    "documents:read",
    "documents:write",
    "rules:view",
  ],
  "VIEWER": [
    "documents:read",
  ],
} as const;

export type UserRole = keyof typeof PERMISSIONS;

export interface PermissionUser {
  role: string;
  roleRel?: {
    id: string;
    name: string;
    label: string;
    permissions: unknown;
  } | null;
}

/**
 * Checks whether a user possesses the requested permission.
 * Resolves dynamically from the DB role permissions if available,
 * falling back to hardcoded default roles mapping.
 */
export function hasPermission(
  user: PermissionUser | null | undefined,
  permission: string
): boolean {
  if (!user) return false;

  // 1. Dynamic Database Role permissions check
  if (user.roleRel?.permissions && Array.isArray(user.roleRel.permissions)) {
    return (user.roleRel.permissions as string[]).includes(permission);
  }

  // 2. Fallback to hardcoded role definitions
  const defaultPermissions = PERMISSIONS[user.role.toUpperCase() as UserRole] || [];
  return (defaultPermissions as readonly string[]).includes(permission);
}
