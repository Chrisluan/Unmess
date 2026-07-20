import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import authConfig from "../config/auth";

let io: SocketIO;

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number;
  iat: number;
  exp: number;
}

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: [
      "http://localhost:3001",
      "http://192.168.1.11:3001"
    ],
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
