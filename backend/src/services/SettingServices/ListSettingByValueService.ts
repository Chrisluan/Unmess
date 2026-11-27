import { timingSafeEqual } from "crypto";

import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";

interface Response {
  key: string;
  value: string;
  companyId: number;
}

// Abaixo disso não é um token gerado pelo sistema: é um valor qualquer de
// outra configuração ("enabled", "2", "") tentando se passar por um.
const TAMANHO_MINIMO = 32;

/**
 * Encontra a empresa dona de um token de API.
 *
 * A busca antes era só pelo valor, em todas as configurações: um
 * "Bearer enabled" casava com a primeira chave ligada de qualquer empresa e
 * autenticava como ela. Agora só a chave `userApiToken` conta.
 */
const ListSettingByValueService = async (
  value: string
): Promise<Response> => {
  if (!value || value.length < TAMANHO_MINIMO) {
    throw new AppError("ERR_NO_API_TOKEN_FOUND", 401);
  }

  const setting = await Setting.findOne({
    where: { key: "userApiToken", value }
  });

  if (!setting || !setting.value) {
    throw new AppError("ERR_NO_API_TOKEN_FOUND", 401);
  }

  // O banco compara sem diferenciar maiúsculas dependendo da collation; a
  // comparação final é exata e em tempo constante.
  const esperado = Buffer.from(setting.value);
  const recebido = Buffer.from(value);
  if (esperado.length !== recebido.length || !timingSafeEqual(esperado, recebido)) {
    throw new AppError("ERR_NO_API_TOKEN_FOUND", 401);
  }

  return { key: setting.key, value: setting.value, companyId: setting.companyId };
};

export default ListSettingByValueService;
