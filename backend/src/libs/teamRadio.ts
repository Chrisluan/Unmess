import { Server as SocketIO, Socket } from "socket.io";

import { logger } from "../utils/logger";
import { companyRoom, radioRoom, userRoom } from "./socketRooms";
import {
  canalAcessivel,
  participantesDaConversa
} from "../services/TeamChatServices/TeamChatService";

/**
 * Rádio da equipe: aperte para falar, solte para ouvir.
 *
 * ── Por que o áudio passa pelo servidor, e não de navegador a navegador ─────
 *
 * WebRTC ponto a ponto é o caminho "certo" para voz, e é o que não funciona
 * aqui sem infraestrutura que esta instalação não tem: metade dos acessos vem
 * de trás de NAT — celular no 4G, loja com roteador de operadora — e sem um
 * servidor TURN a conexão simplesmente não fecha. O socket já está aberto
 * para todo mundo que está logado, pelo mesmo túnel e pela mesma porta. O
 * áudio vai por ele.
 *
 * ── Por que um de cada vez ──────────────────────────────────────────────────
 *
 * É rádio: o canal tem uma vez só. Quem aperta com o canal livre fala; quem
 * aperta com alguém falando ouve "ocupado" e espera. Além de ser o costume de
 * quem já usou rádio, é o que mantém o custo previsível: o servidor
 * retransmite uma voz por canal, nunca uma por pessoa.
 *
 * ── Por que há limite de tempo ──────────────────────────────────────────────
 *
 * Todo rádio tem o seu "time-out timer": botão preso, celular no bolso com a
 * tecla apertada, e o canal fica mudo para todos. Passados TEMPO_MAXIMO_MS o
 * servidor corta a transmissão — não o cliente, que é justamente quem pode
 * estar travado.
 *
 * Nada aqui vai para o banco. O estado é de quem está na escuta agora; um
 * restart do servidor derruba as conexões e cada cliente entra de novo.
 */

const TEMPO_MAXIMO_MS = 60 * 1000;

/** Um pacote de 40 ms em μ-law a 16 kHz tem 640 bytes. Folga para 4x. */
const PACOTE_MAXIMO = 4096;

interface Ouvinte {
  socketId: string;
  userId: number;
  name: string;
  muted: boolean;
  deaf: boolean;
}

interface Transmissao {
  socketId: string;
  userId: number;
  name: string;
  desde: number;
  corte: NodeJS.Timeout;
}

interface Sala {
  companyId: number;
  channelId: number;
  /** Para onde vai a lista de quem está na sala: a empresa, ou os dois da conversa. */
  avisar: string[];
  /** Na conversa a dois, quem pode saber que a sala existe. */
  participantes: number[] | null;
  ouvintes: Map<string, Ouvinte>;
  falando: Transmissao | null;
}

const salas = new Map<string, Sala>();
const salaDoSocket = new Map<string, string>();

const chave = (companyId: number, channelId: number): string =>
  `${companyId}:${channelId}`;

interface Quem {
  userId: number;
  companyId: number;
  name: string;
}

const retrato = (sala: Sala) => ({
  channelId: sala.channelId,
  falando: sala.falando
    ? { userId: sala.falando.userId, name: sala.falando.name, desde: sala.falando.desde }
    : null,
  membros: Array.from(sala.ouvintes.values()).map(o => ({
    userId: o.userId,
    name: o.name,
    muted: o.muted,
    deaf: o.deaf
  }))
});

const anunciar = (io: SocketIO, sala: Sala): void => {
  let destino = io.to(sala.avisar[0]);
  sala.avisar.slice(1).forEach(s => {
    destino = destino.to(s);
  });
  destino.emit("radio:roster", retrato(sala));
};

const encerrarTransmissao = (
  io: SocketIO,
  sala: Sala,
  motivo: "solto" | "tempo" | "saiu"
): void => {
  if (!sala.falando) return;
  const { socketId, userId } = sala.falando;
  clearTimeout(sala.falando.corte);
  sala.falando = null;

  io.to(radioRoom(sala.companyId, sala.channelId)).emit("radio:ptt", {
    channelId: sala.channelId,
    userId,
    falando: false,
    motivo
  });
  if (motivo === "tempo") {
    io.to(socketId).emit("radio:tot", { channelId: sala.channelId });
  }
  anunciar(io, sala);
};

const sairDaSala = (io: SocketIO, socket: Socket): void => {
  const k = salaDoSocket.get(socket.id);
  if (!k) return;
  salaDoSocket.delete(socket.id);

  const sala = salas.get(k);
  if (!sala) return;

  socket.leave(radioRoom(sala.companyId, sala.channelId));
  sala.ouvintes.delete(socket.id);
  if (sala.falando?.socketId === socket.id) {
    encerrarTransmissao(io, sala, "saiu");
  }

  anunciar(io, sala);
  if (sala.ouvintes.size === 0) salas.delete(k);
};

/**
 * Uma pessoa, uma sala. Entrar no rádio por outra aba ou outro aparelho tira
 * a conexão anterior: duas escutas da mesma pessoa tocariam o mesmo áudio
 * duas vezes e apareceriam em dobro na lista.
 */
const derrubarOutrasConexoes = (
  io: SocketIO,
  quem: Quem,
  manter: string
): void => {
  salaDoSocket.forEach((k, socketId) => {
    if (socketId === manter) return;
    const sala = salas.get(k);
    const ouvinte = sala?.ouvintes.get(socketId);
    if (!sala || !ouvinte || ouvinte.userId !== quem.userId) return;
    if (sala.companyId !== quem.companyId) return;

    const outro = io.sockets.sockets.get(socketId);
    if (outro) {
      sairDaSala(io, outro);
      outro.emit("radio:kicked", { motivo: "outra-conexao" });
    } else {
      salaDoSocket.delete(socketId);
      sala.ouvintes.delete(socketId);
    }
  });
};

type Ack = (resposta: Record<string, unknown>) => void;
const responder = (ack: unknown): Ack =>
  typeof ack === "function" ? (ack as Ack) : () => undefined;

export const registrarRadio = (
  io: SocketIO,
  socket: Socket,
  quem: Quem
): void => {
  const { companyId, userId } = quem;

  socket.join(userRoom(companyId, userId));

  socket.on("radio:join", async (channelId: unknown, ack: unknown) => {
    const resposta = responder(ack);
    const id = Number(channelId);
    if (!Number.isInteger(id) || id <= 0) {
      resposta({ ok: false, erro: "canal-invalido" });
      return;
    }

    let canal;
    try {
      canal = await canalAcessivel(id, companyId, userId);
    } catch (err) {
      resposta({ ok: false, erro: "canal-invalido" });
      return;
    }

    sairDaSala(io, socket);
    derrubarOutrasConexoes(io, quem, socket.id);

    const k = chave(companyId, id);
    let sala = salas.get(k);
    if (!sala) {
      const participantes =
        canal.kind === "direct" ? participantesDaConversa(canal) : null;
      sala = {
        companyId,
        channelId: id,
        avisar: participantes
          ? participantes.map(p => userRoom(companyId, p))
          : [companyRoom(companyId)],
        participantes,
        ouvintes: new Map(),
        falando: null
      };
      salas.set(k, sala);
    }

    sala.ouvintes.set(socket.id, {
      socketId: socket.id,
      userId,
      name: quem.name,
      muted: false,
      deaf: false
    });
    salaDoSocket.set(socket.id, k);
    socket.join(radioRoom(companyId, id));

    anunciar(io, sala);
    resposta({ ok: true, sala: retrato(sala) });
  });

  socket.on("radio:leave", (ack: unknown) => {
    sairDaSala(io, socket);
    responder(ack)({ ok: true });
  });

  socket.on("radio:ptt:start", (ack: unknown) => {
    const resposta = responder(ack);
    const sala = salas.get(salaDoSocket.get(socket.id) || "");
    const eu = sala?.ouvintes.get(socket.id);
    if (!sala || !eu) {
      resposta({ ok: false, erro: "fora-do-canal" });
      return;
    }
    if (eu.muted) {
      resposta({ ok: false, erro: "mudo" });
      return;
    }
    if (sala.falando && sala.falando.socketId !== socket.id) {
      resposta({ ok: false, erro: "ocupado", por: sala.falando.name });
      return;
    }
    if (!sala.falando) {
      const salaAtual = sala;
      sala.falando = {
        socketId: socket.id,
        userId,
        name: quem.name,
        desde: Date.now(),
        corte: setTimeout(
          () => encerrarTransmissao(io, salaAtual, "tempo"),
          TEMPO_MAXIMO_MS
        )
      };
      socket.to(radioRoom(companyId, sala.channelId)).emit("radio:ptt", {
        channelId: sala.channelId,
        userId,
        name: quem.name,
        falando: true
      });
      anunciar(io, sala);
    }
    resposta({ ok: true, limiteMs: TEMPO_MAXIMO_MS });
  });

  socket.on("radio:ptt:stop", () => {
    const sala = salas.get(salaDoSocket.get(socket.id) || "");
    if (sala?.falando?.socketId === socket.id) {
      encerrarTransmissao(io, sala, "solto");
    }
  });

  /**
   * O áudio em si. Só passa de quem está com a vez: um cliente adulterado
   * que mande pacotes sem ter apertado o botão fala sozinho.
   */
  socket.on("radio:audio", (pacote: unknown) => {
    const sala = salas.get(salaDoSocket.get(socket.id) || "");
    if (!sala || sala.falando?.socketId !== socket.id) return;
    if (!Buffer.isBuffer(pacote) || pacote.length === 0) return;
    if (pacote.length > PACOTE_MAXIMO) return;

    // Sem `volatile`, de propósito: ele descarta o pacote quando o socket de
    // destino ainda está escrevendo o anterior, e a fala chega em rajada logo
    // depois do aperto (o que foi dito enquanto o servidor confirmava a vez).
    // Com ele, o começo de toda frase sumia. Quem descarta atraso é o
    // cliente, que sabe o quanto a fila dele cresceu.
    socket
      .to(radioRoom(companyId, sala.channelId))
      .emit("radio:audio", { u: userId, d: pacote });
  });

  socket.on(
    "radio:state",
    (estado: { muted?: unknown; deaf?: unknown } | undefined) => {
      const sala = salas.get(salaDoSocket.get(socket.id) || "");
      const eu = sala?.ouvintes.get(socket.id);
      if (!sala || !eu) return;
      eu.muted = !!estado?.muted;
      eu.deaf = !!estado?.deaf;
      if (eu.muted && sala.falando?.socketId === socket.id) {
        encerrarTransmissao(io, sala, "solto");
      }
      anunciar(io, sala);
    }
  );

  /** Quem está em cada sala agora — para a lista de canais ao abrir a tela. */
  socket.on("radio:rosters", (ack: unknown) => {
    const visiveis = Array.from(salas.values())
      .filter(s => s.companyId === companyId)
      .filter(s => !s.participantes || s.participantes.includes(userId))
      .map(retrato);
    responder(ack)({ ok: true, salas: visiveis });
  });

  socket.on("disconnect", () => {
    try {
      sairDaSala(io, socket);
    } catch (err) {
      logger.error(`radio: erro ao sair da sala: ${err}`);
    }
  });
};
