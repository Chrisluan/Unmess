import { fn, col } from "sequelize";

import Queue from "../../models/Queue";
import Ticket from "../../models/Ticket";
import User from "../../models/User";

interface Setor {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
}

interface Atendente {
  id: number;
  name: string;
  online: boolean;
  lastSeenAt: Date | null;
  emAtendimento: number;
  queues: Pick<Setor, "id" | "name" | "color">[];
}

interface Response {
  setores: Setor[];
  atendentes: Atendente[];
}

/**
 * Para onde uma conversa pode ir: os setores e as pessoas da empresa.
 *
 * Existe porque o modal de transferência buscava isso em `/users` e `/queue`,
 * guardadas por "ver usuários" e "ver filas" — permissões de quem administra,
 * não de quem atende. Um atendente com "transferir" e sem elas abria o modal e
 * não achava ninguém. Aqui a pergunta é outra ("para onde posso mandar esta
 * conversa?"), e a resposta traz só o necessário para escolher: nome, se está
 * online, em quais setores atua e quantas conversas já tem nas mãos.
 */
const ListarDestinosDeTransferenciaService = async (
  companyId: number
): Promise<Response> => {
  const [filas, usuarios, cargas] = await Promise.all([
    Queue.findAll({
      where: { companyId },
      attributes: ["id", "name", "color", "isDefault"],
      order: [["name", "ASC"]]
    }),
    User.findAll({
      where: { companyId },
      attributes: ["id", "name", "online", "lastSeenAt"],
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id", "name", "color"],
          through: { attributes: [] }
        }
      ],
      order: [["name", "ASC"]]
    }),
    Ticket.findAll({
      where: { companyId, status: "open" },
      attributes: ["userId", [fn("COUNT", col("id")), "total"]],
      group: ["userId"],
      raw: true
    }) as unknown as Promise<{ userId: number | null; total: number }[]>
  ]);

  const cargaPorUsuario = new Map<number, number>();
  cargas.forEach(linha => {
    if (linha.userId) cargaPorUsuario.set(linha.userId, Number(linha.total));
  });

  return {
    setores: filas.map(fila => ({
      id: fila.id,
      name: fila.name,
      color: fila.color,
      isDefault: Boolean(fila.isDefault)
    })),
    atendentes: usuarios.map(usuario => ({
      id: usuario.id,
      name: usuario.name,
      online: Boolean(usuario.online),
      lastSeenAt: usuario.lastSeenAt || null,
      emAtendimento: cargaPorUsuario.get(usuario.id) || 0,
      queues: (usuario.queues || []).map(fila => ({
        id: fila.id,
        name: fila.name,
        color: fila.color
      }))
    }))
  };
};

export default ListarDestinosDeTransferenciaService;
