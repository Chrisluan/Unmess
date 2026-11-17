import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import EmptyState from "../../components/EmptyState";

import api from "../../services/api";
import toastError from "../../errors/toastError";

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

  contas: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  conta: {
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 1.5),
    minWidth: 160,
  },

  dinheiro: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  centro: { display: "flex", justifyContent: "center", padding: 48 },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataCurta = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}`;
};

const KINDS = { cash: "Caixa", bank: "Banco", card: "Cartão" };

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
 * Fluxo de caixa do período.
 *
 * O realizado é a soma dos lançamentos; o previsto, o que está a receber e
 * vence no mesmo período. Os dois juntos respondem a pergunta que se faz aqui
 * — "dá para pagar o fornecedor sexta?" —, que o saldo de hoje sozinho não
 * responde.
 */
const AbaCaixa = () => {
  const classes = useStyles();

  const inicial = mesCorrente();
  const [de, setDe] = useState(inicial.de);
  const [ate, setAte] = useState(inicial.ate);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/fluxo", { params: { de, ate } });
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

  if (carregando) {
    return (
      <div className={classes.centro}>
        <CircularProgress />
      </div>
    );
  }

  const dias = dados?.dias || [];

  return (
    <>
      <div className={classes.filtros}>
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
      </div>

      <div className={classes.resumo}>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Saldo inicial</span>
          <span className={classes.numero}>{moeda(dados?.saldoInicial)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Entradas</span>
          <span className={`${classes.numero} ${classes.entrada}`}>
            {moeda(dados?.entradas)}
          </span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Saídas</span>
          <span className={`${classes.numero} ${classes.saida}`}>
            {moeda(dados?.saidas)}
          </span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Saldo final</span>
          <span
            className={`${classes.numero} ${
              Number(dados?.saldoFinal) < 0 ? classes.negativo : ""
            }`}
          >
            {moeda(dados?.saldoFinal)}
          </span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Previsto no período</span>
          <span className={classes.numero}>{moeda(dados?.previsto)}</span>
        </div>
      </div>

      {(dados?.contas || []).length > 0 && (
        <div className={classes.contas}>
          {dados.contas.map((c) => (
            <div key={c.id} className={classes.conta}>
              <div className={classes.rotulo}>{KINDS[c.kind] || c.kind}</div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div
                className={`${classes.numero} ${
                  c.saldo < 0 ? classes.negativo : ""
                }`}
              >
                {moeda(c.saldo)}
              </div>
            </div>
          ))}
        </div>
      )}

      {dias.length === 0 ? (
        <EmptyState
          icon={AccountBalanceWalletOutlinedIcon}
          title="Nenhum movimento no período"
          description="Recebimentos e pagamentos baixados aparecem aqui, agrupados por dia."
        />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dia</TableCell>
              <TableCell align="right">Entradas</TableCell>
              <TableCell align="right">Saídas</TableCell>
              <TableCell align="right">Saldo acumulado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dias.map((d) => (
              <TableRow key={d.dia} hover>
                <TableCell className={classes.dinheiro}>
                  {dataCurta(d.dia)}
                </TableCell>
                <TableCell align="right" className={classes.dinheiro}>
                  {d.entradas > 0 ? moeda(d.entradas) : "—"}
                </TableCell>
                <TableCell align="right" className={classes.dinheiro}>
                  {d.saidas > 0 ? moeda(d.saidas) : "—"}
                </TableCell>
                <TableCell
                  align="right"
                  className={`${classes.dinheiro} ${
                    d.saldo < 0 ? classes.negativo : ""
                  }`}
                >
                  {moeda(d.saldo)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};

export default AbaCaixa;
