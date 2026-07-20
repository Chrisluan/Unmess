import { useContext, useCallback, useMemo } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";

const ADMIN_PROFILES = ["admin", "super"];

/**
 * Hook central de autorização.
 *
 * Exemplo de uso:
 *   const { can, canAny, canAll } = usePermissions();
 *   if (can("tickets:delete")) { ... }
 *   if (canAny(["tickets:edit", "tickets:delete"])) { ... }
 *
 * Admin e super sempre retornam true.
 * As permissões vêm do user.permissions (array resolvido pelo backend no login).
 */
const usePermissions = () => {
  const { user } = useContext(AuthContext);

  const isAdmin = useMemo(
    () => ADMIN_PROFILES.includes(user?.profile),
    [user?.profile]
  );

  const userPermissions = useMemo(
    () => (Array.isArray(user?.permissions) ? user.permissions : []),
    [user?.permissions]
  );

  /**
   * Verifica se o usuário possui uma permissão específica.
   * @param {string} permission - Ex: "tickets:delete"
   */
  const can = useCallback(
    (permission) => {
      if (!user) return false;
      if (isAdmin) return true;
      return userPermissions.includes(permission);
    },
    [user, isAdmin, userPermissions]
  );

  /**
   * Verifica se o usuário possui ALGUMA das permissões listadas.
   * @param {string[]} permissions
   */
  const canAny = useCallback(
    (permissions) => {
      if (!user) return false;
      if (isAdmin) return true;
      return permissions.some((p) => userPermissions.includes(p));
    },
    [user, isAdmin, userPermissions]
  );

  /**
   * Verifica se o usuário possui TODAS as permissões listadas.
   * @param {string[]} permissions
   */
  const canAll = useCallback(
    (permissions) => {
      if (!user) return false;
      if (isAdmin) return true;
      return permissions.every((p) => userPermissions.includes(p));
    },
    [user, isAdmin, userPermissions]
  );

  return { can, canAny, canAll, isAdmin, permissions: userPermissions };
};

export default usePermissions;
