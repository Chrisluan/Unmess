import { getBackendUrl } from "../config";

/**
 * Endereço completo de um anexo.
 *
 * O backend devolve o caminho relativo ("/public/arquivo.jpg"), e aqui ele é
 * prefixado com o endereço pelo qual esta página alcançou a API. Assim o mesmo
 * anexo funciona pelo IP da rede, pelo nome da máquina, pela VPN ou por
 * localhost, sem nada configurado.
 *
 * Aceita valor absoluto sem alterar, para não quebrar mensagens antigas nem
 * anexos vindos de outra origem.
 */
export const mediaUrl = valor => {
  if (!valor) return valor;
  if (/^https?:\/\//i.test(valor)) return valor;

  return `${getBackendUrl()}${valor.startsWith("/") ? "" : "/"}${valor}`;
};

export default mediaUrl;
