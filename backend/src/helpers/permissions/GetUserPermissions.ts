import User from "../../models/User";
import PermissionGroup from "../../models/PermissionGroup";
import { AVAILABLE_PERMISSIONS, Permission } from "./AvailablePermissions";

// Profiles com acesso total que ignoram o sistema granular.
const PROFILES_WITH_FULL_ACCESS = ["admin", "super"];

export interface UserPermissionsResult {
  permissions: Permission[];
  /** Permissões herdadas do grupo (antes dos overrides) */
  groupPermissions: string[];
  /** Permissões individuais que sobrescrevem o grupo */
  overrides: { allow: string[]; deny: string[] };
}

/**
 * Resolve permissões finais com prioridade:
 * 1. Override individual (allow/deny)
 * 2. Grupo de permissão
 * 3. Negado por padrão
 */
export const getUserPermissions = async (
  userId: number
): Promise<Permission[]> => {
  const result = await resolveUserPermissions(userId);
  return result.permissions;
};

export const resolveUserPermissions = async (
  userId: number
): Promise<UserPermissionsResult> => {
  const user = await User.findByPk(userId, {
    include: [{ model: PermissionGroup, as: "permissionGroup" }],
  });

  if (!user) {
    return { permissions: [], groupPermissions: [], overrides: { allow: [], deny: [] } };
  }

  if (PROFILES_WITH_FULL_ACCESS.includes(user.profile)) {
    const all = [...AVAILABLE_PERMISSIONS] as Permission[];
    return { permissions: all, groupPermissions: [], overrides: { allow: [], deny: [] } };
  }

  // Base: permissões do grupo
  const groupPermissions: string[] = user.permissionGroup
    ? parseJsonArray(user.permissionGroup.permissions)
    : [];

  // Overrides individuais
  const { add: allowOverrides = [], remove: denyOverrides = [] } =
    parseCustomPermissions(user.customPermissions);

  // Aplica lógica: grupo + allow overrides - deny overrides
  const finalSet = new Set(groupPermissions);
  allowOverrides.forEach(p => finalSet.add(p));
  denyOverrides.forEach(p => finalSet.delete(p));

  const permissions = Array.from(finalSet).filter(p =>
    (AVAILABLE_PERMISSIONS as readonly string[]).includes(p)
  ) as Permission[];

  return {
    permissions,
    groupPermissions,
    overrides: { allow: allowOverrides, deny: denyOverrides },
  };
};

export const userHasPermission = async (
  userId: number,
  permission: Permission
): Promise<boolean> => {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
};

// ── helpers privados ────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseCustomPermissions(raw: string | null): { add?: string[]; remove?: string[] } {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
