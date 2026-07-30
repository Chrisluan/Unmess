import Setting from "../models/Setting";

/**
 * Leitura tolerante de configuração: devolve o fallback em vez de lançar erro
 * quando a chave ainda não existe para a empresa. Use este helper em fluxos de
 * atendimento — CheckSettings lança 404 e derrubaria o recebimento de mensagem.
 */
const GetSetting = async (
  key: string,
  companyId: number,
  fallback = ""
): Promise<string> => {
  const setting = await Setting.findOne({ where: { key, companyId } });

  if (!setting || setting.value === null || setting.value === undefined) {
    return fallback;
  }

  return setting.value;
};

export const GetSettingBoolean = async (
  key: string,
  companyId: number,
  fallback = false
): Promise<boolean> => {
  const value = await GetSetting(key, companyId, fallback ? "enabled" : "disabled");
  return value === "enabled" || value === "true";
};

export const GetSettingNumber = async (
  key: string,
  companyId: number,
  fallback = 0
): Promise<number> => {
  const value = await GetSetting(key, companyId, String(fallback));
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default GetSetting;
