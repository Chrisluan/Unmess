import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";

import EmptyState from "../../components/EmptyState";
import api from "../../services/api";
import toastError from "../../errors/toastError";

import Shell from "./Shell";

const useStyles = makeStyles((theme) => ({
  filtros: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  resumo: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.action.hover,
  },

  bloco: { display: "flex", flexDirection: "column" },

  rotulo: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },

  numero: {
    fontSize: "1.05rem",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },

  entrada: { color: theme.palette.success.main },
  saida: { color: theme.palette.error.main },
  negativo: { color: theme.palette.error.main },

  // Duas colunas em tela larga, uma só quando não couber: os painéis são
  // listas curtas, e empilhá-los sempre desperdiçaria metade da largura numa
  // tela que existe para ser lida de relance.
  grade: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
  },

  painel: {
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
  },

  tituloPainel: {
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: "0.8rem",
    fontWeight: 700,
  },

  linha: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    "&:not(:last-child)": {
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
  },

  linhaRotulo: {
    flex: 1,
    fontSize: "0.85rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  linhaValor: {
    fontSize: "0.85rem",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  linhaParte: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
    fontVariantNumeric: "tabular-nums",
    minWidth: 44,
    textAlign: "right",
  },

  /**
   * A barra é desenhada com o próprio fundo da linha, e não com um gráfico.
   *
   * Uma lista de sete categorias com uma barra proporcional atrás responde
   * "qual é a maior" na mesma olhada que o número responde "quanto" — e não
   * traz uma biblioteca de gráficos, nem a decisão de paleta que vem junto
   * dela, para dentro de uma tela de tabela.
   */
  barra: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.14,
  },

  linhaComBarra: { position: "relative" },

  vazio: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },

  centro: { display: "flex", justifyContent: "center", padding: 48 },

  // A tela é caixa, não competência. Dizer isso é a diferença entre um número
  // que informa e um número que engana quem fatura a 30 dias.
  ressalva: {
    padding: theme.spacing(1.5, 2),
    borderTop: `1px solid ${theme.palette.divider}`,
  },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const percentual = (v) =>
  v === null || v === undefined
    ? "—"
    : `${Number(v).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`;

const FORMAS = {
  cash: "Dinheiro",
  pix: "PIX",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  boleto: "Boleto",
  transfer: "Transferência",
  check: "Cheque",
  other: "Outros",
};

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

const mesCurto = (iso) => {
  const [ano, mes] = String(iso || "").split("-");
  const i = Number(mes) - 1;
  return MESES[i] ? `${MESES[i]}/${String(ano).slice(2)}` : iso;
};

/** Primeiro e último dia do mês corrente, em ISO curto. */
const mesCorrente = () => {
  const hoje = new Date();
  const iso = (d) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
  return {
    de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    ate: iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
  };
};

/**
 * Uma lista com barra proporcional atrás de cada linha.
 *
 * `parte` é opcional: nas categorias ela seria redundante com a barra, mas na
 * concentração por cliente o número em percentual é justamente o que se veio
 * ler.
 */
const Painel = ({ titulo, itens, cor, formatar = moeda, comParte = false }) => {
  const classes = useStyles();
  const maior = Math.max(...itens.map((i) => Math.abs(i.valor)), 0);

  return (
    <div className={classes.painel}>
      <div className={classes.tituloPainel}>{titulo}</div>
      {itens.length === 0 ? (
        <div className={classes.vazio}>Nada no período.</div>
      ) : (
        itens.map((item) => (
          <div
            key={item.rotulo}
            className={`${classes.linha} ${classes.linhaComBarra}`}
          >
            <div
              className={classes.barra}
              style={{
                width: maior > 0 ? `${(Math.abs(item.valor) / maior) * 100}%` : 0,
                background: cor,
              }}
            />
            <Tooltip title={item.rotulo} placement="top-start">
              <span className={classes.linhaRotulo}>{item.rotulo}</span>
            </Tooltip>
            {comParte && (
              <span className={classes.linhaParte}>
                {percentual(item.participacao)}
              </span>
            )}
            <span className={classes.linhaValor}>{formatar(item.valor)}</span>
          </div>
        ))
      )}
    </div>
  );
};

/**
 * Métricas financeiras.
 *
 * As outras telas do módulo respondem "quem me deve" e "quanto tem na conta".
 * Nenhuma responde "o negócio está indo bem", que é a pergunta que faz alguém
 * abrir o financeiro num domingo. Faturamento sem despesa ao lado não diz
 * nada; saldo em conta diz menos ainda, porque ele sobe quando se atrasa
 * fornecedor.
 *
 * O que está aqui foi escolhido pelo que decide alguma coisa numa gráfica:
 * resultado do período, para onde o dinheiro vai, quanto está vencido e há
 * quanto tempo, de quem vem o faturamento, e como isso se move ao longo de um
 * ano. Nenhum indicador entrou por ser bonito de mostrar.
 */
const Metricas = () => {
  const classes = useStyles();

  const inicial = mesCorrente();
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/metricas", {
        params: { de, ate },
      });
      setDados(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const corpo = () => {
    if (carregando) {
      return (
        <div className={classes.centro}>
          <CircularProgress />
        </div>
      );
    }

    if (!dados) {
      return (
        <EmptyState
          icon={InsightsOutlinedIcon}
          title="Sem dados no período"
          description="Assim que houver recebimentos e pagamentos lançados, os indicadores aparecem aqui."
        />
      );
    }

    const { resultado, aReceber, aPagar, cobrancas } = dados;
    const formas = (dados.recebimentoPorForma || []).map((f) => ({
      ...f,
      rotulo: FORMAS[f.rotulo] || f.rotulo,
    }));
    const mensal = (dados.mensal || []).map((m) => ({
      rotulo: mesCurto(m.mes),
      valor: m.receitas - m.despesas,
      receitas: m.receitas,
      despesas: m.despesas,
    }));

    return (
      <>
        <div className={classes.resumo}>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Receitas</span>
            <span className={`${classes.numero} ${classes.entrada}`}>
              {moeda(resultado.receitas)}
            </span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Despesas</span>
            <span className={`${classes.numero} ${classes.saida}`}>
              {moeda(resultado.despesas)}
            </span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Resultado</span>
            <span
              className={`${classes.numero} ${
                resultado.resultado < 0 ? classes.negativo : ""
              }`}
            >
              {moeda(resultado.resultado)}
            </span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Margem</span>
            <span
              className={`${classes.numero} ${
                resultado.margem !== null && resultado.margem < 0
                  ? classes.negativo
                  : ""
              }`}
            >
              {percentual(resultado.margem)}
            </span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>A receber em aberto</span>
            <span className={classes.numero}>{moeda(aReceber.emAberto)}</span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Vencido</span>
            <span
              className={`${classes.numero} ${
                aReceber.vencido > 0 ? classes.negativo : ""
              }`}
            >
              {moeda(aReceber.vencido)}
            </span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>A pagar em aberto</span>
            <span className={classes.numero}>{moeda(aPagar.emAberto)}</span>
          </div>
          <div className={classes.bloco}>
            <span className={classes.rotulo}>Ticket médio</span>
            <span className={classes.numero}>
              {cobrancas.ticketMedio === null
                ? "—"
                : moeda(cobrancas.ticketMedio)}
            </span>
          </div>
        </div>

        <div className={classes.grade}>
          <Painel
            titulo="Resultado por mês (últimos 12)"
            itens={mensal}
            cor="#1976d2"
          />
          <Painel
            titulo="A receber por tempo de atraso"
            itens={dados.aReceber.envelhecimento || []}
            cor="#d32f2f"
          />
          <Painel
            titulo="Receitas por categoria"
            itens={dados.receitasPorCategoria || []}
            cor="#2e7d32"
          />
          <Painel
            titulo="Despesas por categoria"
            itens={dados.despesasPorCategoria || []}
            cor="#d32f2f"
          />
          <Painel
            titulo="Recebimento por forma de pagamento"
            itens={formas}
            cor="#1976d2"
          />
          <Painel
            titulo="Concentração por cliente"
            itens={dados.topClientes || []}
            cor="#ed6c02"
            comParte
          />
        </div>

        <div className={classes.ressalva}>
          <Typography variant="caption" color="textSecondary">
            Estes números são de caixa, não de competência: uma entrada aparece
            no mês em que o dinheiro entrou, não no mês da venda. Para vendas
            faturadas a prazo, o resultado do mês fica deslocado em relação ao
            que foi vendido nele. &quot;A receber&quot; e &quot;A pagar&quot;
            são a posição de hoje, e não do período escolhido.
          </Typography>
        </div>
      </>
    );
  };

  return (
    <Shell
      titulo="Métricas"
      descricao="Resultado do período, inadimplência, para onde o dinheiro vai e de quem ele vem."
      acoes={
        <>
          <TextField
            size="small"
            type="date"
            label="De"
            InputLabelProps={{ shrink: true }}
            value={de}
            onChange={(e) => setDe(e.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="Até"
            InputLabelProps={{ shrink: true }}
            value={ate}
            onChange={(e) => setAte(e.target.value)}
          />
        </>
      }
    >
      {corpo()}
    </Shell>
  );
};

export default Metricas;
