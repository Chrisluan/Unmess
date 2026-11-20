import { getIO } from "./socket";
import { salaComValores, salaSemValores } from "./socketRooms";
import { ocultarValores } from "../helpers/permissions/valores";

/**
 * Emite um evento do funil respeitando `crm:viewValues`.
 *
 * Completo para quem pode ver os números, mascarado para quem não pode. Usar
 * isto no lugar de `io.to(companyRoom(...)).emit("deal", ...)`: o emit direto
 * para a sala da empresa ignora a permissão e vaza o dinheiro pelo socket,
 * mesmo com a API respondendo certo.
 */
const emitirDeal = (
  companyId: number | string | null | undefined,
  payload: unknown,
  evento = "deal"
): void => {
  // Sem empresa (super-admin ainda sem escolher uma) não há sala para avisar.
  if (companyId === null || companyId === undefined) return;

  const io = getIO();
  io.to(salaComValores(companyId)).emit(evento, payload);
  io.to(salaSemValores(companyId)).emit(evento, ocultarValores(payload));
};

export default emitirDeal;
