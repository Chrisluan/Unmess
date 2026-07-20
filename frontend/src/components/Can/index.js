import { useContext } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";

/**
 * Componente declarativo de controle de acesso.
 *
 * Novo uso (permissão granular):
 *   <Can permission="tickets:delete">
 *     <DeleteButton />
 *   </Can>
 *
 * Múltiplas permissões (qualquer uma):
 *   <Can anyOf={["tickets:edit", "tickets:delete"]}>
 *     ...
 *   </Can>
 *
 * Compatibilidade legada (role-based):
 *   <Can role={user.profile} perform="ticket-options:deleteTicket" yes={() => ...} no={() => ...} />
 */

// Regras legadas mantidas para compatibilidade
const legacyRules = {
  user: { static: [] },
  admin: {
    static: [
      "drawer-admin-items:view",
      "tickets-manager:showall",
      "user-modal:editProfile",
      "user-modal:editQueues",
      "ticket-options:deleteTicket",
      "ticket-options:transferWhatsapp",
      "contacts-page:deleteContact",
    ],
  },
  super: { static: ["drawer-super-items:view"] },
};

const legacyCheck = (role, action) => {
  const permissions = legacyRules[role];
  if (!permissions) return false;
  return permissions.static?.includes(action) ?? false;
};

const Can = ({
  // Novo sistema granular
  permission,
  anyOf,
  allOf,
  children,
  fallback = null,
  // Sistema legado (role-based)
  role,
  perform,
  yes,
  no,
}) => {
  const { can, canAny, canAll } = usePermissions();

  // ── Novo sistema granular ──────────────────────────────────────────────────
  if (permission || anyOf || allOf) {
    let allowed = false;

    if (permission) allowed = can(permission);
    else if (anyOf) allowed = canAny(anyOf);
    else if (allOf) allowed = canAll(allOf);

    if (!allowed) return fallback;
    return children ?? null;
  }

  // ── Sistema legado (compatibilidade) ───────────────────────────────────────
  if (role && perform) {
    const allowed = legacyCheck(role, perform);
    if (allowed) return yes ? yes() : null;
    return no ? no() : null;
  }

  return null;
};

export { Can };
export default Can;
