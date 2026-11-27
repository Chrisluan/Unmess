import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import getCompanyId from "../helpers/GetCompanyId";
import { comConsistencia } from "../helpers/consistencia/motor";
import CreateQueueService from "../services/QueueService/CreateQueueService";
import DeleteQueueService from "../services/QueueService/DeleteQueueService";
import ListQueuesService from "../services/QueueService/ListQueuesService";
import ShowQueueService from "../services/QueueService/ShowQueueService";
import UpdateQueueService from "../services/QueueService/UpdateQueueService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const queues = await ListQueuesService(getCompanyId(req));

  return res.status(200).json(queues);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { name, color, greetingMessage } = req.body;

  const queue = await CreateQueueService({
    name,
    color,
    greetingMessage,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("queue", {
    action: "update",
    queue
  });

  return res.status(200).json(queue);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { queueId } = req.params;

  const queue = await ShowQueueService(queueId, getCompanyId(req));

  return res.status(200).json(queue);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;

  const companyId = getCompanyId(req);
  const queue = await comConsistencia(companyId, "fila", transaction =>
    UpdateQueueService(queueId, req.body, companyId, transaction)
  );

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("queue", {
    action: "update",
    queue
  });

  return res.status(201).json(queue);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { queueId } = req.params;

  const companyId = getCompanyId(req);
  await comConsistencia(companyId, "fila", transaction =>
    DeleteQueueService(queueId, companyId, transaction)
  );

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("queue", {
    action: "delete",
    queueId: +queueId
  });

  return res.status(200).send();
};
