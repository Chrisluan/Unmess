import usePermissions from "../../hooks/usePermissions";

/**
 * Mostra o conteúdo só para quem tem a permissão.
 *
 *   <Can permission="tickets:delete">
 *     <BotaoExcluir />
 *   </Can>
 *
 *   <Can anyOf={["crm:edit", "crm:move"]} fallback={<Aviso />}>
 *     ...
 *   </Can>
 *
 * O modo antigo — `role` + `perform` contra uma tabela de regras escrita neste
 * arquivo — saiu. Ele decidia por perfil ("admin pode transferir chat"), o que
 * era uma terceira fonte de verdade sobre permissão, ao lado do catálogo e do
 * campo `profile`. Três fontes para a mesma pergunta é uma garantia de que
 * duas estarão erradas.
 */
const Can = ({ permission, anyOf, allOf, children, fallback = null }) => {
  const { can, canAny, canAll } = usePermissions();

  let permitido = false;
  if (permission) permitido = can(permission);
  else if (anyOf) permitido = canAny(anyOf);
  else if (allOf) permitido = canAll(allOf);

  if (!permitido) return fallback;
  return children ?? null;
};

export { Can };
export default Can;
