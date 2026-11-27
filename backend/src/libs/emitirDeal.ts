import { getIO } from "./socket";
import { salaComValores, salaSemValores } from "./socketRooms";
import { ocultarCustos, ocultarValores } from "../helpers/permissions/valores";

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

  // Custo nunca viaja pelo socket: as salas separam quem vê valores, não
  // quem vê custo. A tela busca os itens pela API, que mascara por pessoa.
  const semCusto = ocultarCustos(payload);
  const io = getIO();
  io.to(salaComValores(companyId)).emit(evento, semCusto);
  io.to(salaSemValores(companyId)).emit(evento, ocultarValores(semCusto));
};

export default emitirDeal;
