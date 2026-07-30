import { Request, Response } from "express";

import { getIO } from "../libs/socket";
import getCompanyId from "../helpers/GetCompanyId";

import UpdateSettingService from "../services/SettingServices/UpdateSettingService";
import ListSettingsService from "../services/SettingServices/ListSettingsService";
import GetSetting from "../helpers/GetSetting";

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

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { settingKey: key } = req.params;
  const { value } = req.body;

  const setting = await UpdateSettingService({
    key,
    value,
    companyId: getCompanyId(req)
  });

  const io = getIO();
  io.to(`company-${req.user.companyId}`).emit("settings", {
    action: "update",
    setting
  });

  return res.status(200).json(setting);
};
