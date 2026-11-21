import { parseISO, isValid, isBefore, startOfDay } from "date-fns";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Formata valores de negócio. O DECIMAL do MySQL chega como string em algumas
 * rotas, então normalizamos antes de formatar.
 */
export const formatarValor = (valor) => moeda.format(Number(valor) || 0);

/**
 * Versão curta para o cabeçalho da coluna, onde não cabe o valor por extenso.
 * 12.400 vira "R$ 12,4 mil"; 1.250.000 vira "R$ 1,3 mi".
 */
export const formatarValorCurto = (valor) => {
  const numero = Number(valor) || 0;

  if (Math.abs(numero) >= 1000000) {
    return `R$ ${(numero / 1000000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mi`;
  }

  if (Math.abs(numero) >= 1000) {
    return `R$ ${(numero / 1000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} mil`;
  }

  return formatarValor(numero);
};

export const paraData = (valor) => {
  if (!valor) return null;
  const data = typeof valor === "string" ? parseISO(valor) : new Date(valor);
  return isValid(data) ? data : null;
};

/**
 * Previsão vencida — usada para destacar o card em vermelho. Compara por dia:
 * um negócio previsto para hoje ainda não está atrasado.
 */
export const estaAtrasado = (expectedCloseAt, status) => {
  if (status !== "open") return false;
  const data = paraData(expectedCloseAt);
  if (!data) return false;
  return isBefore(startOfDay(data), startOfDay(new Date()));
};

/**
 * Telefone do WhatsApp em formato de gente.
 *
 * O número chega como "5511987654321", com o código do país colado no DDD e
 * no assinante. Assim ele não é legível de relance nem confere com o que o
 * cliente dita ao telefone, que é justamente o uso: bater o card com quem
 * está ligando.
 */
export const formatarTelefone = (numero) => {
  const digitos = String(numero || "").replace(/\D/g, "");
  if (!digitos) return "";

  // 55 + DDD + assinante. O corte só vale a partir de 12 dígitos: abaixo
  // disso o "55" pode ser o próprio DDD de Caxias do Sul.
  const nacional =
    digitos.startsWith("55") && digitos.length >= 12
      ? digitos.slice(2)
      : digitos;

  if (nacional.length === 11) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 7)}-${nacional.slice(7)}`;
  }

  if (nacional.length === 10) {
    return `(${nacional.slice(0, 2)}) ${nacional.slice(2, 6)}-${nacional.slice(6)}`;
  }

  // Fora do padrão brasileiro (internacional, grupo, ramal): mostrar como
  // veio é melhor que quebrar em pedaços errados.
  return String(numero);
};
