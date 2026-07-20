import { Request, Response } from "express";
import { decode } from "jsonwebtoken";
import AppError from "../errors/AppError";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import { SuperSelectCompanyService } from "../services/AuthServices/SuperSelectCompanyService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  SendRefreshToken(res, refreshToken);

  return res.status(200).json({ token, user: serializedUser });
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  let companyOverride;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const accessToken = authHeader.replace("Bearer ", "");
    const decoded = decode(accessToken) as any;
    if (decoded?.companyId) {
      companyOverride = {
        companyId: decoded.companyId,
        companyName: decoded.companyName,
      };
    }
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token,
    companyOverride
  );

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  res.clearCookie("jrt");
  return res.send();
};

/**
 * Super-admin seleciona uma empresa para operar como admin dela.
 * Emite um novo access token com o companyId injetado.
 * O refresh token permanece o mesmo (sem reautenticação).
 */
export const selectCompany = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.body;

  if (req.user.profile !== "super") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const token = await SuperSelectCompanyService({
    superUserId: Number(req.user.id),
    companyId: Number(companyId),
  });

  return res.status(200).json({ token });
};
