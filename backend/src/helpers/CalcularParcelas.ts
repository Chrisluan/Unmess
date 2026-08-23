export interface ParcelaCalculada {
  installment: number;
  installments: number;
  /** ISO curto (YYYY-MM-DD): vencimento é dia, não instante. */
  dueDate: string;
  amount: number;
}

interface Request {
  /** Valor total a parcelar, já com desconto aplicado. */
  total: number;
  /** Dias de vencimento de cada parcela, contados da data base. */
  dayOffsets: number[];
  /** Percentual de cada parcela; vazio divide em partes iguais. */
  percentages?: number[] | null;
  /** De quando contam os prazos — normalmente o dia do faturamento. */
  baseDate?: Date;
}

const centavos = (valor: number): number => Math.round(valor * 100);

/**
 * Soma dias a uma data e devolve só o dia, em ISO curto.
 *
 * A conta é feita em UTC de propósito. Somar 30 dias sobre um horário local
 * atravessa o horário de verão e devolve o dia anterior ou o seguinte em
 * algumas datas do ano -- e vencimento errado por um dia é multa.
 */
const somarDias = (base: Date, dias: number): string => {
  const d = new Date(
    Date.UTC(base.getFullYear(), base.getMonth(), base.getDate())
  );
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * Transforma uma condição de pagamento em parcelas com data e valor.
 *
 * **A soma das parcelas é exatamente o total.** Dividir 100,00 em três dá
 * 33,333... e arredondar cada uma para 33,33 perde um centavo: o cliente paga
 * 99,99 e a cobrança nunca fecha. Aqui a conta é feita em centavos inteiros e
 * a última parcela absorve a diferença -- é a convenção do comércio, e é a
 * única que garante que a soma bata.
 *
 * Não devolve nada gravado: quem chama decide se aquilo vira cobrança. É o que
 * permite propor as parcelas na tela e deixar a pessoa ajustar antes.
 */
export const calcularParcelas = ({
  total,
  dayOffsets,
  percentages,
  baseDate = new Date()
}: Request): ParcelaCalculada[] => {
  const prazos =
    Array.isArray(dayOffsets) && dayOffsets.length ? dayOffsets : [0];

  const quantidade = prazos.length;
  const totalEmCentavos = centavos(total);

  /**
   * Percentuais só entram se houver um para cada parcela. Uma lista pela
   * metade -- de uma condição editada sem cuidado -- daria parcela zerada no
   * fim, e é melhor cair na divisão igual do que cobrar errado em silêncio.
   */
  const usarPercentuais =
    Array.isArray(percentages) && percentages.length === quantidade;

  const parcelas: ParcelaCalculada[] = [];
  let distribuido = 0;

  for (let i = 0; i < quantidade; i += 1) {
    const ultima = i === quantidade - 1;

    const valorEmCentavos = ultima
      ? // A última recebe o que sobrou, e é isso que faz a soma fechar.
        totalEmCentavos - distribuido
      : Math.round(
          usarPercentuais
            ? (totalEmCentavos * Number(percentages![i] || 0)) / 100
            : totalEmCentavos / quantidade
        );

    distribuido += valorEmCentavos;

    parcelas.push({
      installment: i + 1,
      installments: quantidade,
      dueDate: somarDias(baseDate, Number(prazos[i]) || 0),
      amount: valorEmCentavos / 100
    });
  }

  return parcelas;
};

export default calcularParcelas;
