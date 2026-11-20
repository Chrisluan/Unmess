import { Request, Response } from "express";
import { randomBytes } from "crypto";

import { getIO } from "../libs/socket";
import getCompanyId from "../helpers/GetCompanyId";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import GetSetting from "../helpers/GetSetting";
import { normalizarValor } from "../helpers/configuracoes/catalogo";

/**
 * Chaves que o atendente comum precisa ler para a tela de chat funcionar
 * (assinatura, som de notificação, etc.), com seus defaults. Não expõe
 * token de API nem nada administrativo.
 */
const ATTENDANCE_SETTINGS: Record<string, string> = {
  signMessages: "enabled",
  notificationSound: "enabled",
  allowAgentSeeAllTickets: "disabled",
  requireClosingStatus: "disabled",
  autoAssignTickets: "disabled"
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  // Autorização fica na rota (hasPermission("settings:view")). Checar
  // profile aqui anularia o sistema de grupos de permissão.
  const settings = await ListSettingsService(getCompanyId(req));

  return res.status(200).json(settings);
};

/**
 * Subconjunto de configurações liberado para qualquer usuário que atenda.
 * Sem isso o atendente não-admin recebe 403 em /settings e a tela de chat
 * perde assinatura e som de notificação.
 */
export const attendance = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);

  const entries = await Promise.all(
    Object.entries(ATTENDANCE_SETTINGS).map(async ([key, fallback]) => {
      const value = await GetSetting(key, companyId, fallback);
      return [key, value] as [string, string];
    })
  );

  // reduce em vez de Object.fromEntries: o target do projeto é ES6.
  const result = entries.reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

  return res.status(200).json(result);
};

const avisarTelas = (companyId: number, setting: unknown): void => {
  getIO().to(`company-${companyId}`).emit("settings", {
    action: "update",
    setting
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { settingKey: key } = req.params;
  const companyId = getCompanyId(req);

  // Só chaves do catálogo, no formato do catálogo. Ver helpers/configuracoes.
  const value = normalizarValor(key, req.body?.value);

  const setting = await UpdateSettingService({ key, value, companyId });

  avisarTelas(companyId, setting);

  return res.status(200).json(setting);
};

/**
 * Gera um novo token de API para a empresa.
 *
 * O token era sorteado no navegador com Math.random, que não é aleatoriedade
 * de verdade, e gravado pela rota genérica -- qualquer texto servia, inclusive
 * um curto ou repetido. Agora quem sorteia é o servidor, com 256 bits.
 */
export const gerarTokenDeApi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = getCompanyId(req);
  const value = randomBytes(32).toString("hex");

  const setting = await UpdateSettingService({
    key: "userApiToken",
    value,
    companyId
  });

  avisarTelas(companyId, setting);

  return res.status(200).json(setting);
};
