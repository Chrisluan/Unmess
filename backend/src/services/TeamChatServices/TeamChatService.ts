import { Op, QueryTypes } from "sequelize";

import AppError from "../../errors/AppError";
import TeamChannel, { TipoDeCanal } from "../../models/TeamChannel";
import TeamChannelMember from "../../models/TeamChannelMember";
import TeamMessage from "../../models/TeamMessage";
import User from "../../models/User";

/**
 * Regras do chat de equipe.
 *
 * Duas regras de acesso, e só duas:
 *   - canal aberto (`channel`): qualquer pessoa da empresa;
 *   - conversa a dois (`direct`): só as duas pessoas.
 *
 * Toda leitura passa por `canalAcessivel`, que responde 404 — e não 403 —
 * para o que a pessoa não alcança: dizer "existe, mas não é seu" já é contar
 * que duas pessoas conversam.
 */

const TAMANHO_MAXIMO = 4000;
const POR_PAGINA = 50;

const ATRIBUTOS_DO_AUTOR = ["id", "name"];

export interface MensagemSerializada {
  id: number;
  channelId: number;
  userId: number | null;
  user: { id: number; name: string } | null;
  body: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export const serializarMensagem = (
  mensagem: TeamMessage
): MensagemSerializada => ({
  id: mensagem.id,
  channelId: mensagem.channelId,
  userId: mensagem.userId,
  user: mensagem.user
    ? { id: mensagem.user.id, name: mensagem.user.name }
    : null,
  // Apagada some o texto, fica o lugar.
  body: mensagem.deletedAt ? "" : mensagem.body,
  editedAt: mensagem.editedAt,
  deletedAt: mensagem.deletedAt,
  createdAt: mensagem.createdAt
});

export const chaveDaConversa = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

/** Os dois ids de uma conversa a dois, a partir da chave. */
export const participantesDaConversa = (canal: TeamChannel): number[] =>
  (canal.directKey || "")
    .split(":")
    .map(Number)
    .filter(n => Number.isFinite(n) && n > 0);

export const canalAcessivel = async (
  channelId: number | string,
  companyId: number,
  userId: number
): Promise<TeamChannel> => {
  const canal = await TeamChannel.findOne({
    where: { id: channelId, companyId, archived: false }
  });
  if (!canal) throw new AppError("ERR_TEAM_CHANNEL_NOT_FOUND", 404);

  if (canal.kind === "direct") {
    if (!participantesDaConversa(canal).includes(Number(userId))) {
      throw new AppError("ERR_TEAM_CHANNEL_NOT_FOUND", 404);
    }
  }

  return canal;
};

/**
 * Toda empresa começa com um canal "Geral". Criado na primeira listagem, e
 * não num seed, porque o seed só roda uma vez e empresa nova nasce depois.
 */
const garantirCanalGeral = async (companyId: number): Promise<void> => {
  const existe = await TeamChannel.count({
    where: { companyId, kind: "channel" }
  });
  if (existe > 0) return;
  await TeamChannel.create({
    companyId,
    kind: "channel",
    name: "Geral",
    topic: "Avisos e conversa de toda a equipe",
    position: 0
  } as TeamChannel);
};

export interface CanalListado {
  id: number;
  kind: TipoDeCanal;
  name: string | null;
  topic: string | null;
  position: number;
  unread: number;
  lastMessageId: number;
  lastMessageAt: Date | null;
  peer: { id: number; name: string; online: boolean } | null;
}

export const listarCanais = async (
  companyId: number,
  userId: number
): Promise<CanalListado[]> => {
  await garantirCanalGeral(companyId);

  const abertos = await TeamChannel.findAll({
    where: { companyId, kind: "channel", archived: false },
    order: [
      ["position", "ASC"],
      ["name", "ASC"]
    ]
  });

  const conversas = await TeamChannel.findAll({
    where: {
      companyId,
      kind: "direct",
      archived: false,
      directKey: {
        [Op.or]: [
          { [Op.like]: `${userId}:%` },
          { [Op.like]: `%:${userId}` }
        ]
      }
    }
  });

  const canais = [...abertos, ...conversas];
  if (canais.length === 0) return [];

  const ids = canais.map(c => c.id);

  // Não lidas e última mensagem de todos os canais numa consulta só.
  const resumo = await TeamMessage.sequelize!.query<{
    channelId: number;
    unread: number;
    lastId: number;
    lastAt: Date | null;
  }>(
    `SELECT m.channelId AS channelId,
            SUM(CASE WHEN m.id > COALESCE(mb.lastReadMessageId, 0)
                      AND (m.userId IS NULL OR m.userId <> :userId)
                      AND m.deletedAt IS NULL THEN 1 ELSE 0 END) AS unread,
            MAX(m.id) AS lastId,
            MAX(m.createdAt) AS lastAt
       FROM TeamMessages m
       LEFT JOIN TeamChannelMembers mb
              ON mb.channelId = m.channelId AND mb.userId = :userId
      WHERE m.companyId = :companyId AND m.channelId IN (:ids)
      GROUP BY m.channelId`,
    {
      replacements: { userId, companyId, ids },
      type: QueryTypes.SELECT
    }
  );
  const porCanal = new Map(resumo.map(r => [Number(r.channelId), r]));

  const idsDosPares = conversas
    .map(c => participantesDaConversa(c).find(id => id !== userId))
    .filter((id): id is number => !!id);
  const pares = idsDosPares.length
    ? await User.findAll({
        where: { id: idsDosPares, companyId },
        attributes: ["id", "name", "online"]
      })
    : [];
  const parPorId = new Map(pares.map(u => [u.id, u]));

  return canais
    .map((canal): CanalListado | null => {
      const r = porCanal.get(canal.id);
      let peer: CanalListado["peer"] = null;
      if (canal.kind === "direct") {
        const outroId = participantesDaConversa(canal).find(id => id !== userId);
        const outro = outroId ? parPorId.get(outroId) : undefined;
        // Conversa com quem saiu da empresa some da lista.
        if (!outro) return null;
        peer = { id: outro.id, name: outro.name, online: !!outro.online };
      }
      return {
        id: canal.id,
        kind: canal.kind,
        name: canal.name,
        topic: canal.topic,
        position: canal.position,
        unread: Number(r?.unread ?? 0),
        lastMessageId: Number(r?.lastId ?? 0),
        lastMessageAt: r?.lastAt ?? null,
        peer
      };
    })
    .filter((c): c is CanalListado => c !== null);
};

const validarNome = (nome: unknown): string => {
  const limpo = String(nome ?? "").trim().replace(/\s+/g, " ");
  if (!limpo) throw new AppError("ERR_TEAM_CHANNEL_NAME_REQUIRED");
  if (limpo.length > 60) throw new AppError("ERR_TEAM_CHANNEL_NAME_TOO_LONG");
  return limpo;
};

const validarTopico = (topico: unknown): string | null => {
  const limpo = String(topico ?? "").trim();
  if (!limpo) return null;
  return limpo.slice(0, 200);
};

export const criarCanal = async (
  companyId: number,
  userId: number,
  dados: { name?: unknown; topic?: unknown; position?: unknown }
): Promise<TeamChannel> => {
  const name = validarNome(dados.name);
  const repetido = await TeamChannel.findOne({
    where: { companyId, kind: "channel", archived: false, name }
  });
  if (repetido) throw new AppError("ERR_TEAM_CHANNEL_DUPLICATED");

  const ultimo = (await TeamChannel.max("position", {
    where: { companyId, kind: "channel" }
  })) as number | null;

  return TeamChannel.create({
    companyId,
    kind: "channel",
    name,
    topic: validarTopico(dados.topic),
    position: Number.isFinite(Number(dados.position))
      ? Number(dados.position)
      : (ultimo ?? 0) + 1,
    createdById: userId
  } as TeamChannel);
};

export const editarCanal = async (
  companyId: number,
  channelId: number | string,
  dados: { name?: unknown; topic?: unknown; position?: unknown }
): Promise<TeamChannel> => {
  const canal = await TeamChannel.findOne({
    where: { id: channelId, companyId, kind: "channel", archived: false }
  });
  if (!canal) throw new AppError("ERR_TEAM_CHANNEL_NOT_FOUND", 404);

  const mudancas: Partial<TeamChannel> = {};
  if (dados.name !== undefined) {
    const name = validarNome(dados.name);
    const repetido = await TeamChannel.findOne({
      where: {
        companyId,
        kind: "channel",
        archived: false,
        name,
        id: { [Op.ne]: canal.id }
      }
    });
    if (repetido) throw new AppError("ERR_TEAM_CHANNEL_DUPLICATED");
    mudancas.name = name;
  }
  if (dados.topic !== undefined) mudancas.topic = validarTopico(dados.topic);
  if (dados.position !== undefined && Number.isFinite(Number(dados.position))) {
    mudancas.position = Number(dados.position);
  }

  await canal.update(mudancas);
  return canal;
};

export const arquivarCanal = async (
  companyId: number,
  channelId: number | string
): Promise<TeamChannel> => {
  const canal = await TeamChannel.findOne({
    where: { id: channelId, companyId, kind: "channel", archived: false }
  });
  if (!canal) throw new AppError("ERR_TEAM_CHANNEL_NOT_FOUND", 404);

  // O último canal não sai: o chat sem canal nenhum seria recriado com um
  // "Geral" novo na próxima listagem, e o histórico do antigo ficaria órfão.
  const restantes = await TeamChannel.count({
    where: { companyId, kind: "channel", archived: false }
  });
  if (restantes <= 1) throw new AppError("ERR_TEAM_CHANNEL_LAST");

  await canal.update({ archived: true });
  return canal;
};

/** Abre — ou reabre — a conversa a dois com outra pessoa da empresa. */
export const abrirConversa = async (
  companyId: number,
  userId: number,
  outroId: number
): Promise<TeamChannel> => {
  if (!outroId || outroId === userId) {
    throw new AppError("ERR_TEAM_DIRECT_INVALID");
  }
  const outro = await User.findOne({ where: { id: outroId, companyId } });
  if (!outro) throw new AppError("ERR_TEAM_DIRECT_INVALID", 404);

  const directKey = chaveDaConversa(userId, outroId);
  const [canal] = await TeamChannel.findOrCreate({
    where: { companyId, directKey },
    defaults: { companyId, directKey, kind: "direct" } as TeamChannel
  });
  if (canal.archived) await canal.update({ archived: false });
  return canal;
};

export const listarMensagens = async (
  canal: TeamChannel,
  antesDe?: number
): Promise<MensagemSerializada[]> => {
  const where: any = { channelId: canal.id };
  if (antesDe && Number.isFinite(antesDe)) where.id = { [Op.lt]: antesDe };

  const mensagens = await TeamMessage.findAll({
    where,
    include: [{ model: User, attributes: ATRIBUTOS_DO_AUTOR }],
    order: [["id", "DESC"]],
    limit: POR_PAGINA
  });

  return mensagens.reverse().map(serializarMensagem);
};

const validarTexto = (texto: unknown): string => {
  const limpo = String(texto ?? "").replace(/\r\n/g, "\n").trim();
  if (!limpo) throw new AppError("ERR_TEAM_MESSAGE_EMPTY");
  if (limpo.length > TAMANHO_MAXIMO) {
    throw new AppError("ERR_TEAM_MESSAGE_TOO_LONG");
  }
  return limpo;
};

export const enviarMensagem = async (
  canal: TeamChannel,
  userId: number,
  texto: unknown
): Promise<MensagemSerializada> => {
  const body = validarTexto(texto);
  const criada = await TeamMessage.create({
    companyId: canal.companyId,
    channelId: canal.id,
    userId,
    body
  } as TeamMessage);

  // Quem escreve leu até ali.
  await marcarComoLido(canal.id, userId, criada.id);

  await criada.reload({
    include: [{ model: User, attributes: ATRIBUTOS_DO_AUTOR }]
  });
  return serializarMensagem(criada);
};

const mensagemDaEmpresa = async (
  companyId: number,
  messageId: number | string
): Promise<TeamMessage> => {
  const mensagem = await TeamMessage.findOne({
    where: { id: messageId, companyId },
    include: [
      { model: User, attributes: ATRIBUTOS_DO_AUTOR },
      { model: TeamChannel }
    ]
  });
  if (!mensagem || mensagem.deletedAt) {
    throw new AppError("ERR_TEAM_MESSAGE_NOT_FOUND", 404);
  }
  return mensagem;
};

export const editarMensagem = async (
  companyId: number,
  userId: number,
  messageId: number | string,
  texto: unknown
): Promise<{ mensagem: MensagemSerializada; canal: TeamChannel }> => {
  const mensagem = await mensagemDaEmpresa(companyId, messageId);
  // Editar é só do autor: nem quem gerencia o canal põe palavras na boca
  // de outra pessoa.
  if (mensagem.userId !== userId) {
    throw new AppError("ERR_TEAM_MESSAGE_NOT_YOURS", 403);
  }
  await mensagem.update({ body: validarTexto(texto), editedAt: new Date() });
  return { mensagem: serializarMensagem(mensagem), canal: mensagem.channel };
};

export const apagarMensagem = async (
  companyId: number,
  userId: number,
  messageId: number | string,
  podeModerar: boolean
): Promise<{ mensagem: MensagemSerializada; canal: TeamChannel }> => {
  const mensagem = await mensagemDaEmpresa(companyId, messageId);
  const ehDoAutor = mensagem.userId === userId;
  // Moderação vale para os canais da empresa; numa conversa a dois quem
  // gerencia canais não é parte.
  const podeApagar =
    ehDoAutor || (podeModerar && mensagem.channel?.kind === "channel");
  if (!podeApagar) throw new AppError("ERR_TEAM_MESSAGE_NOT_YOURS", 403);

  await mensagem.update({ deletedAt: new Date() });
  return { mensagem: serializarMensagem(mensagem), canal: mensagem.channel };
};

export const marcarComoLido = async (
  channelId: number,
  userId: number,
  ateId?: number
): Promise<number> => {
  const ultimo =
    ateId ??
    (((await TeamMessage.max("id", { where: { channelId } })) as number) || 0);

  const [membro] = await TeamChannelMember.findOrCreate({
    where: { channelId, userId },
    defaults: { channelId, userId, lastReadMessageId: ultimo } as TeamChannelMember
  });
  // Nunca volta atrás: duas abas lendo fora de ordem não "desleem".
  if (membro.lastReadMessageId < ultimo) {
    await membro.update({ lastReadMessageId: ultimo });
  }
  return Math.max(membro.lastReadMessageId, ultimo);
};

/** Quem da empresa pode ser chamado para conversar. */
export const listarPessoas = async (
  companyId: number
): Promise<{ id: number; name: string; online: boolean; lastSeenAt: Date | null }[]> => {
  const pessoas = await User.findAll({
    where: { companyId },
    attributes: ["id", "name", "online", "lastSeenAt"],
    order: [["name", "ASC"]]
  });
  return pessoas.map(p => ({
    id: p.id,
    name: p.name,
    online: !!p.online,
    lastSeenAt: p.lastSeenAt ?? null
  }));
};
