import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import ListSettingByValueService from "../services/SettingServices/ListSettingByValueService";

const isAuthApi = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const getToken = await ListSettingByValueService(token);
    if (!getToken) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    if (getToken.value !== token) {
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    // O token de API pertence a uma Setting de uma empresa específica.
    // Injetamos o companyId no req.user para que o ApiController opere
    // sempre no escopo correto da empresa dona do token.
    req.user = {
      id: "",
      profile: "api",
      companyId: getToken.companyId
    };
  } catch (err) {
    console.log(err);
    throw new AppError(
      "Invalid token. We'll try to assign a new one on next request",
      403
    );
  }

  return next();
};

export default isAuthApi;
