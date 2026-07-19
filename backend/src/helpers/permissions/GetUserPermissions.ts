import User from "../../models/User";
import PermissionGroup from "../../models/PermissionGroup";
import { AVAILABLE_PERMISSIONS, Permission } from "./AvailablePermissions";

interface CustomPermissionsPayload {
  add?: string[];
  remove?: string[];
}

const parseCustomPermissions = (raw: string | null): CustomPermissionsPayload => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
};

// admin e super sempre têm acesso total - grupos/overrides só se aplicam a
// perfis operacionais (vendedor, producao, instalacao, financeiro, user).
const PROFILES_WITH_FULL_ACCESS = ["admin", "super"];

export const getUserPermissions = async (
  userId: number
): Promise<Permission[]> => {
  const user = await User.findByPk(userId, {
    include: [{ model: PermissionGroup, as: "permissionGroup" }]
  });

  if (!user) return [];

  if (PROFILES_WITH_FULL_ACCESS.includes(user.profile)) {
    return [...AVAILABLE_PERMISSIONS];
  }

  const basePermissions = user.permissionGroup
    ? (JSON.parse(user.permissionGroup.permissions || "[]") as string[])
    : [];

  const { add = [], remove = [] } = parseCustomPermissions(
    user.customPermissions
  );

  const finalSet = new Set(basePermissions);
  add.forEach(p => finalSet.add(p));
  remove.forEach(p => finalSet.delete(p));

  return Array.from(finalSet).filter(p =>
    (AVAILABLE_PERMISSIONS as readonly string[]).includes(p)
  ) as Permission[];
};

export const userHasPermission = async (
  userId: number,
  permission: Permission
): Promise<boolean> => {
  const permissions = await getUserPermissions(userId);
  return permissions.includes(permission);
};
