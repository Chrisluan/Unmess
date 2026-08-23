import React, { useEffect, useState, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Tooltip from "@mui/material/Tooltip";
import Skeleton from "@mui/material/Skeleton";

import api from "../../../services/api";

const useStyles = makeStyles((theme) => ({
  faixa: {
    display: "flex",
    alignItems: "stretch",
    gap: 1,
    background: theme.palette.divider,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    overflowX: "auto",
    marginBottom: theme.spacing(1),
  },

  bloco: {
    background: theme.palette.background.paper,
    padding: "7px 14px",
    minWidth: 110,
    flex: "1 0 auto",
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  rotulo: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
  },

  valor: {
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.2,
  },

  // O que exige ação fica em cor de alerta; o resto é informação neutra.
  alerta: { color: theme.palette.error.main },
  bom: { color: theme.palette.success.main },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

/**
 * Indicadores do funil.
 *
 * Fica acima das colunas porque responde antes de qualquer card: quanto tem no
 * funil, quanto disso é realista, e o que precisa de atenção hoje.
 *
 * Os números vêm de uma consulta agregada no backend, e não de somar os cards
 * carregados: com filtro ativo ou paginação, somar na tela daria o total do
 * que está à vista, não o do funil.
 */
const IndicadoresFunil = ({ boardId, recarregar, resumo }) => {
  const classes = useStyles();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const buscar = useCallback(async () => {
    try {
      const { data } = await api.get("/deals/indicadores", {
        params: boardId ? { boardId } : {},
      });
      setDados(data);
    } catch {
      // Indicador é apoio: falhar aqui não pode derrubar o quadro.
    } finally {
      setCarregando(false);
    }
  }, [boardId]);

  useEffect(() => {
    buscar();
  }, [buscar, recarregar]);

  if (carregando) {
    return (
      <div className={classes.faixa}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={classes.bloco}>
            <Skeleton width={70} height={12} />
            <Skeleton width={90} height={22} />
          </div>
        ))}
      </div>
    );
  }

  if (!dados) return null;

  const blocos = [
    { rotulo: "Oportunidades", valor: dados.total, dica: "Em aberto no funil" },
    { rotulo: "Valor total", valor: moeda(dados.valorTotal), dica: "Soma das oportunidades em aberto" },
    {
      rotulo: "Previsão",
      valor: moeda(dados.valorPonderado),
      dica: "Valor ponderado pela probabilidade de cada etapa — o que se espera fechar de fato",
    },
    ...(resumo
      ? [
          {
            rotulo: "Faturado",
            valor: moeda(resumo.billedValue),
            classe: classes.bom,
            dica: `${resumo.billedCount} oportunidade(s) já faturada(s)`,
          },
        ]
      : []),
    {
      rotulo: "Conversão",
      valor: `${dados.taxaConversao}%`,
      classe: dados.taxaConversao >= 50 ? classes.bom : undefined,
      dica: `${dados.ganhas} ganhas de ${dados.ganhas + dados.perdidas} decididas`,
    },
    { rotulo: "Ticket médio", valor: moeda(dados.ticketMedio), dica: "Média das oportunidades ganhas" },
    {
      rotulo: "Follow-ups hoje",
      valor: dados.followUpsHoje,
      dica: "Contatos marcados para hoje",
    },
    {
      rotulo: "Atrasadas",
      valor: dados.atrasadas,
      classe: dados.atrasadas > 0 ? classes.alerta : undefined,
      dica: "Follow-up venceu e ninguém retomou",
    },
    {
      rotulo: "Sem responsável",
      valor: dados.semResponsavel,
      classe: dados.semResponsavel > 0 ? classes.alerta : undefined,
      dica: "Oportunidades que ninguém assumiu",
    },
  ];

  return (
    <div className={classes.faixa}>
      {blocos.map((b) => (
        <Tooltip key={b.rotulo} title={b.dica} arrow>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>{b.rotulo}</span>
            <span className={`${classes.valor} ${b.classe || ""}`}>{b.valor}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
};

export default IndicadoresFunil;
