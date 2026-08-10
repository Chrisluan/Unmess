/**
 * Há quanto tempo o cliente está esperando, em formato curto ("12min", "2h").
 *
 * O ponto de partida é a última atualização do ticket — que, num atendimento
 * pendente, é a mensagem mais recente do cliente.
 */
export const formatWaitingTime = (desde, agora = new Date()) => {
  if (!desde) return null;

  const inicio = desde instanceof Date ? desde : new Date(desde);
  if (Number.isNaN(inicio.getTime())) return null;

  const minutos = Math.floor((agora - inicio) / 60000);
  if (minutos < 0) return null;
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos}min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) {
    const resto = minutos % 60;
    return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
  }

  const dias = Math.floor(horas / 24);
  return `${dias}d`;
};

/**
 * Faixa de urgência da espera. Os cortes são de atendimento, não técnicos:
 * até 5 minutos é resposta normal, até 30 já incomoda, acima disso o cliente
 * tende a achar que foi esquecido.
 */
export const waitingLevel = (desde, agora = new Date()) => {
  if (!desde) return "ok";

  const inicio = desde instanceof Date ? desde : new Date(desde);
  if (Number.isNaN(inicio.getTime())) return "ok";

  const minutos = Math.floor((agora - inicio) / 60000);
  if (minutos >= 30) return "critico";
  if (minutos >= 5) return "atencao";
  return "ok";
};
