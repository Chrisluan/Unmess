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
