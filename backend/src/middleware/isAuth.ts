import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";
import { etiquetar } from "../helpers/permissions/routeGuard";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  companyId: number | null;
  companyName: string | null;
  iat: number;
  exp: number;
}

const isAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, profile, companyId, companyName } = decoded as TokenPayload;

    req.user = {
      id,
      profile,
      companyId,
      companyName,
    };
  } catch (err) {
    throw new AppError(
      "Invalid token. We'll try to assign a new one on next request",
      403
    );
  }

  return next();
};

export default etiquetar(isAuth, { tipo: "auth" });
