import { Request, Response } from "express";

import GetDashboardMetricsService from "../services/DashboardServices/GetDashboardMetricsService";

type IndexQuery = {
  startDate?: string;
  endDate?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { startDate, endDate } = req.query as IndexQuery;

  const metrics = await GetDashboardMetricsService({
    companyId: req.user.companyId,
    startDate,
    endDate
  });

  return res.status(200).json(metrics);
};
