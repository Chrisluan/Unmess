import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import CreateDealActivityService from "../services/DealActivityServices/CreateDealActivityService";
import UpdateDealActivityService from "../services/DealActivityServices/UpdateDealActivityService";
import DeleteDealActivityService from "../services/DealActivityServices/DeleteDealActivityService";
import AppError from "../errors/AppError";
import getCompanyId from "../helpers/GetCompanyId";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { dealId } = req.params;
  const { type, body, dueAt } = req.body;

  const schema = Yup.object().shape({
    body: Yup.string().required(),
    type: Yup.string().oneOf(["note", "task"])
  });

  try {
    await schema.validate({ body, type });
  } catch (err) {
    throw new AppError(err.message);
  }

  const activity = await CreateDealActivityService({
    dealId,
    type,
    body,
    dueAt,
    companyId: getCompanyId(req),
    userId: Number(req.user.id)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("dealActivity", {
    action: "create",
    activity
  });

  return res.status(200).json(activity);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { activityId } = req.params;
  const { body, dueAt, done } = req.body;

  const activity = await UpdateDealActivityService({
    activityId,
    body,
    dueAt,
    done,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("dealActivity", {
    action: "update",
    activity
  });

  return res.status(200).json(activity);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { activityId } = req.params;

  await DeleteDealActivityService(activityId, getCompanyId(req));

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("dealActivity", {
    action: "delete",
    activityId
  });

  return res.status(200).json({ message: "Deal activity deleted" });
};
