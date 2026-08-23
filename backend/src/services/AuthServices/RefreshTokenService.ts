import { verify } from "jsonwebtoken";
import { Response as Res } from "express";

import User from "../../models/User";
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService";
import GarantirEmpresaAtiva from "../../helpers/GarantirEmpresaAtiva";
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
}

interface Response {
  user: User;
  newToken: string;
  refreshToken: string;
}

interface CompanyOverride {
  companyId?: number | null;
  companyName?: string | null;
}

export const RefreshTokenService = async (
  res: Res,
  token: string,
  companyOverride?: CompanyOverride
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion } = decoded as RefreshTokenPayload;

    const user = await ShowUserService(id);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt");
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    // Bloquear a empresa precisa valer para quem já está com a tela aberta,
    // e não só no próximo login. O frontend renova o token de tempos em
    // tempos; é aqui que a sessão cai.
    await GarantirEmpresaAtiva(user);

    const userForToken =
      user.profile === "super" && companyOverride?.companyId
        ? ({
            ...user.get(),
            companyId: companyOverride.companyId,
            companyName: companyOverride.companyName,
          } as any)
        : user;

    const newToken = createAccessToken(userForToken);
    const refreshToken = createRefreshToken(user);

    return { user: userForToken, newToken, refreshToken };
  } catch (err) {
    res.clearCookie("jrt");
    // Um AppError daqui de dentro já é uma explicação — trocá-la por "sessão
    // expirada" mandaria o usuário tentar de novo para sempre, sem descobrir
    // que a empresa está suspensa.
    if (err instanceof AppError) throw err;
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
