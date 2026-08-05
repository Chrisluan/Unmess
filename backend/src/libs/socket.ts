import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import { isAllowedOrigin } from "../helpers/IsAllowedOrigin";
import authConfig from "../config/auth";
import User from "../models/User";

let io: SocketIO;

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

// Um mesmo atendente pode ter várias abas abertas. Só marcamos offline
// quando o último socket dele cai.
const socketsByUser = new Map<string, Set<string>>();

const setUserPresence = async (
  userId: string,
  companyId: number,
  online: boolean
): Promise<void> => {
  try {
    await User.update(
      { online, lastSeenAt: new Date() },
      { where: { id: userId } }
    );

    io.to(`company-${companyId}`).emit("userPresence", {
      userId: Number(userId),
      online
    });
  } catch (error) {
    logger.error(`Error updating presence for user ${userId}: ${error}`);
  }
};

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      credentials: true,
      origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"), false);
      }
    }
  });

  io.on("connection", socket => {
    const { token } = socket.handshake.query;
    let tokenData: TokenPayload | null = null;
    try {
      tokenData = verify(token, authConfig.secret) as TokenPayload;
      logger.debug(JSON.stringify(tokenData), "io-onConnection: tokenData");
    } catch (error) {
      logger.error(JSON.stringify(error), "Error decoding token");
      socket.disconnect();
      return io;
    }

    // Isola os eventos de cada socket na room da própria empresa (tenant),
    // evitando que uma empresa receba eventos (tickets, contatos, etc.)
    // de outra empresa através do mesmo servidor Socket.io compartilhado.
    if (tokenData?.companyId) {
      socket.join(`company-${tokenData.companyId}`);
    }

    const userId = tokenData?.id;
    const companyId = tokenData?.companyId;

    if (userId && companyId) {
      const existing = socketsByUser.get(userId) ?? new Set<string>();
      const wasOffline = existing.size === 0;
      existing.add(socket.id);
      socketsByUser.set(userId, existing);

      if (wasOffline) {
        setUserPresence(userId, companyId, true);
      }
    }

    logger.info("Client Connected");
    socket.on("joinChatBox", (ticketId: string) => {
      logger.info("A client joined a ticket channel");
      socket.join(ticketId);
    });

    socket.on("joinNotification", () => {
      logger.info("A client joined notification channel");
      socket.join("notification");
    });

    socket.on("joinTickets", (status: string) => {
      logger.info(`A client joined to ${status} tickets channel.`);
      socket.join(status);
    });

    socket.on("disconnect", () => {
      logger.info("Client disconnected");

      if (userId && companyId) {
        const existing = socketsByUser.get(userId);
        if (existing) {
          existing.delete(socket.id);
          if (existing.size === 0) {
            socketsByUser.delete(userId);
            setUserPresence(userId, companyId, false);
          }
        }
      }
    });

    return socket;
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};
