import { Request, Response } from "express";

import getCompanyId from "../helpers/GetCompanyId";
import ListBusinessHoursService from "../services/BusinessHourServices/ListBusinessHoursService";
import UpsertBusinessHoursService from "../services/BusinessHourServices/UpsertBusinessHoursService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const hours = await ListBusinessHoursService(getCompanyId(req));

  return res.status(200).json(hours);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { days } = req.body;

  const hours = await UpsertBusinessHoursService(days, getCompanyId(req));

  return res.status(200).json(hours);
};
