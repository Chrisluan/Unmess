import { useContext, useCallback, useMemo } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";

/**
 * O que a pessoa logada pode fazer.
 *
 *   const { can, canAny, canAll } = usePermissions();
 *   if (can("tickets:delete")) { ... }
 *
 * A lista vem de `GET /access/me`, que é a mesma conta que o servidor faz
 * antes de deixar uma requisição passar. Isso não substitui a conferência do
 * backend — nada que roda no navegador substitui —, mas garante que a tela e a
 * API concordem sobre o que está liberado.
 *
 * Não existe mais atalho de administrador aqui. A versão anterior devolvia
 * `true` para tudo quando `user.profile` era "admin", e o backend fazia o
 * mesmo: o campo de texto que a tela de usuários deixava escolher era, na
 * prática, um interruptor de acesso total. Agora "Administrador" é um cargo
 * como os outros, só que com todas as permissões — e elas aparecem na lista,
 * uma a uma, como as de qualquer pessoa.
 */
const usePermissions = () => {
  const { user } = useContext(AuthContext);

  const permissions = useMemo(
    () => (Array.isArray(user?.permissions) ? user.permissions : []),
    [user?.permissions]
  );

  /** O super-admin da plataforma — o dono do servidor, não da empresa. */
  const isSuper = user?.profile === "super";

  const can = useCallback(
    (permission) => {
      if (!user || !permission) return false;
      return permissions.includes(permission);
    },
    [user, permissions]
  );

  const canAny = useCallback(
    (lista) => {
      if (!user || !Array.isArray(lista)) return false;
      return lista.some((p) => permissions.includes(p));
    },
    [user, permissions]
  );

  const canAll = useCallback(
    (lista) => {
      if (!user || !Array.isArray(lista)) return false;
      return lista.every((p) => permissions.includes(p));
    },
    [user, permissions]
  );

  return {
    can,
    canAny,
    canAll,
    isSuper,
    permissions,
    /** O cargo, para mostrar o nome dele na interface. */
    role: user?.role ?? null,
  };
};

export default usePermissions;
