import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import EmptyState from "../../components/EmptyState";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaidIcon from "@mui/icons-material/PriceCheckOutlined";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import CobrancaModal from "../../components/Finance/CobrancaModal";
import BaixaModal from "../../components/Finance/BaixaModal";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  filtros: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  totais: {
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

  vencido: { color: theme.palette.error.main },

  /**
   * A fila de vendas faturadas sem cobrança.
   *
   * Fica no topo, com a cor de acento: é uma pendência da empresa, não um
   * aviso decorativo, e some sozinha quando alguém resolve.
   */
  pendencia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    flexWrap: "wrap",
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderLeft: `3px solid ${theme.palette.primary.main}`,
    background: theme.palette.action.selected,
  },

  situacao: {
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "1px 6px",
    border: "1px solid currentColor",
    whiteSpace: "nowrap",
  },

  aberta: { color: theme.palette.text.secondary },
  parcial: { color: theme.palette.warning.main },
  quitada: { color: theme.palette.success.main },
  atrasada: { color: theme.palette.error.main },
  cancelada: { color: theme.palette.text.disabled },

  dinheiro: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  centro: { display: "flex", justifyContent: "center", padding: 48 },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** "2026-09-19" vira "19/09/2026" sem passar por Date — que mudaria o dia. */
const dataCurta = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const hoje = () => new Date().toISOString().slice(0, 10);

const SITUACOES = {
  open: { texto: "Em aberto", classe: "aberta" },
  partial: { texto: "Parcial", classe: "parcial" },
  paid: { texto: "Quitada", classe: "quitada" },
  canceled: { texto: "Cancelada", classe: "cancelada" },
};

/**
 * Contas a receber.
 *
 * A situação de cada parcela é deduzida do valor contra o que já foi baixado —
 * o backend não guarda um campo "pago", justamente para ele não divergir das
 * baixas depois de um estorno.
 */
const AbaReceber = ({ cadastros, onPendentesChange }) => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [pendentes, setPendentes] = useState([]);

  const [situacao, setSituacao] = useState("all");
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const [cobrandoDeal, setCobrandoDeal] = useState(null);
  const [baixando, setBaixando] = useState(null);
  const [cancelando, setCancelando] = useState(null);

  const podeCobrar = can("finance:bill");
  const podeBaixar = can("finance:settle");

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/receivables", {
        params: {
          situacao,
          searchParam: busca || undefined,
          vencimentoDe: de || undefined,
          vencimentoAte: ate || undefined,
          porPagina: 200,
        },
      });
      setDados(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [situacao, busca, de, ate]);

  const carregarPendentes = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/pendentes");
      setPendentes(data.deals || []);
      if (onPendentesChange) onPendentesChange((data.deals || []).length);
    } catch {
      // Sem permissão de faturar, a fila simplesmente não aparece — não é
      // motivo para estourar erro sobre a listagem que já carregou.
    }
  }, [onPendentesChange]);

  useEffect(() => {
    // Debounce só na busca; os demais filtros são cliques e podem consultar já.
    const t = setTimeout(carregar, busca ? 400 : 0);
    return () => clearTimeout(t);
  }, [carregar, busca]);

  useEffect(() => {
    carregarPendentes();
  }, [carregarPendentes]);

  const aoMudar = async () => {
    await Promise.all([carregar(), carregarPendentes()]);
  };

  const estornar = async (entryId) => {
    try {
      await api.delete(`/finance/entries/${entryId}`);
      await aoMudar();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmarCancelamento = async () => {
    const alvo = cancelando;
    setCancelando(null);
    try {
      await api.put(`/finance/receivables/${alvo.id}/cancelar`);
      await aoMudar();
    } catch (err) {
      toastError(err);
    }
  };

  if (carregando) {
    return (
      <div className={classes.centro}>
        <CircularProgress />
      </div>
    );
  }

  const linhas = dados?.receivables || [];
  const totais = dados?.totais || {};

  return (
    <>
      {pendentes.length > 0 && podeCobrar && (
        <div className={classes.pendencia}>
          <div>
            <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
              {pendentes.length === 1
                ? "1 venda faturada ainda sem cobrança"
                : `${pendentes.length} vendas faturadas ainda sem cobrança`}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              O sistema calcula as parcelas; você confere antes de gravar.
            </Typography>
          </div>
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={() => setCobrandoDeal(pendentes[0])}
          >
            Gerar cobrança
          </Button>
        </div>
      )}

      <div className={classes.totais}>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Total</span>
          <span className={classes.numero}>{moeda(totais.total)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Recebido</span>
          <span className={classes.numero}>{moeda(totais.recebido)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Em aberto</span>
          <span className={classes.numero}>{moeda(totais.aberto)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Vencido</span>
          <span
            className={`${classes.numero} ${
              totais.vencido > 0 ? classes.vencido : ""
            }`}
          >
            {moeda(totais.vencido)}
          </span>
        </div>
      </div>

      <div className={classes.filtros}>
        <TextField
          select
          size="small"
          label="Situação"
          value={situacao}
          onChange={(e) => setSituacao(e.target.value)}
          style={{ minWidth: 150 }}
        >
          <MenuItem value="all">Todas</MenuItem>
          <MenuItem value="open">Em aberto</MenuItem>
          <MenuItem value="partial">Parcial</MenuItem>
          <MenuItem value="overdue">Vencidas</MenuItem>
          <MenuItem value="paid">Quitadas</MenuItem>
          <MenuItem value="canceled">Canceladas</MenuItem>
        </TextField>

        <TextField
          size="small"
          type="date"
          label="Vence de"
          InputLabelProps={{ shrink: true }}
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <TextField
          size="small"
          type="date"
          label="até"
          InputLabelProps={{ shrink: true }}
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />

        <TextField
          size="small"
          label="Buscar"
          placeholder="Descrição do pedido"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ minWidth: 200 }}
        />
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          icon={ReceiptLongOutlinedIcon}
          title="Nenhuma cobrança encontrada"
          description="Ajuste o período ou a situação nos filtros acima. As cobranças nascem das oportunidades faturadas no CRM."
        />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vencimento</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Cliente</TableCell>
              <TableCell align="center">Parcela</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Recebido</TableCell>
              <TableCell align="center">Situação</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {linhas.map((linha) => {
              const pago = Number(linha.paidAmount || 0);
              const valor = Number(linha.amount || 0);
              const quitada = pago >= valor - 0.005;

              const atrasada =
                !linha.canceledAt &&
                !quitada &&
                String(linha.dueDate).slice(0, 10) < hoje();

              const base = linha.canceledAt
                ? SITUACOES.canceled
                : quitada
                ? SITUACOES.paid
                : pago > 0
                ? SITUACOES.partial
                : SITUACOES.open;

              // Vencida tem precedência na cor: é a única que pede ação hoje.
              const situacaoTexto = atrasada ? "Vencida" : base.texto;
              const situacaoClasse = atrasada ? "atrasada" : base.classe;

              const ultimaBaixa = (linha.entries || []).slice(-1)[0];

              return (
                <TableRow key={linha.id} hover>
                  <TableCell className={classes.dinheiro}>
                    {dataCurta(linha.dueDate)}
                  </TableCell>
                  <TableCell>{linha.description}</TableCell>
                  <TableCell>
                    {linha.customer?.tradeName || linha.customer?.name || "—"}
                  </TableCell>
                  <TableCell align="center">
                    {linha.installment}/{linha.installments}
                  </TableCell>
                  <TableCell align="right" className={classes.dinheiro}>
                    {moeda(valor)}
                  </TableCell>
                  <TableCell align="right" className={classes.dinheiro}>
                    {pago > 0 ? moeda(pago) : "—"}
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className={`${classes.situacao} ${
                        classes[situacaoClasse]
                      }`}
                    >
                      {situacaoTexto}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    {podeBaixar && !linha.canceledAt && !quitada && (
                      <Tooltip title="Dar baixa" arrow>
                        <IconButton
                          size="small"
                          onClick={() => setBaixando(linha)}
                        >
                          <PaidIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {podeBaixar && ultimaBaixa && (
                      <Tooltip
                        title={`Estornar a baixa de ${moeda(
                          ultimaBaixa.amount
                        )}`}
                        arrow
                      >
                        <IconButton
                          size="small"
                          onClick={() => estornar(ultimaBaixa.id)}
                        >
                          <UndoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {podeCobrar && !linha.canceledAt && pago === 0 && (
                      <Tooltip title="Cancelar cobrança" arrow>
                        <IconButton
                          size="small"
                          onClick={() => setCancelando(linha)}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <CobrancaModal
        open={Boolean(cobrandoDeal)}
        deal={cobrandoDeal}
        cadastros={cadastros}
        onClose={() => setCobrandoDeal(null)}
        onGerado={async () => {
          setCobrandoDeal(null);
          await aoMudar();
        }}
      />

      <BaixaModal
        open={Boolean(baixando)}
        receivable={baixando}
        contas={cadastros?.accounts || []}
        onClose={() => setBaixando(null)}
        onBaixado={async () => {
          setBaixando(null);
          await aoMudar();
        }}
      />

      <ConfirmationModal
        title="Cancelar esta cobrança?"
        open={Boolean(cancelando)}
        onClose={() => setCancelando(null)}
        danger
        confirmLabel="Cancelar cobrança"
        onConfirm={confirmarCancelamento}
      >
        A parcela deixa de ser cobrada e sai das somas, mas continua no
        histórico. Não dá para desfazer pela tela.
      </ConfirmationModal>
    </>
  );
};

export default AbaReceber;
