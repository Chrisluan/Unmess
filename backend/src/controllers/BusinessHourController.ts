import { Request, Response } from "express";

import getCompanyId from "../helpers/GetCompanyId";
import ListBusinessHoursService from "../services/BusinessHourServices/ListBusinessHoursService";
import UpsertBusinessHoursService from "../services/BusinessHourServices/UpsertBusinessHoursService";
import {
  listHolidays,
  createHoliday,
  deleteHoliday
} from "../services/BusinessHourServices/HolidayService";

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

// ── Feriados / exceções ─────────────────────────────────────────────────────

export const indexHolidays = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const holidays = await listHolidays(getCompanyId(req));

  return res.status(200).json(holidays);
};

export const storeHoliday = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const holiday = await createHoliday(getCompanyId(req), req.body);

  return res.status(200).json(holiday);
};

export const removeHoliday = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { holidayId } = req.params;

  await deleteHoliday(getCompanyId(req), holidayId);

  return res.status(200).json({ message: "Holiday deleted" });
};
