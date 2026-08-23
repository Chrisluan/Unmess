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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import PaidIcon from "@mui/icons-material/PriceCheckOutlined";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import AddIcon from "@mui/icons-material/Add";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import EmptyState from "../../components/EmptyState";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  barra: {
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
  campos: { display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataCurta = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const hoje = () => new Date().toISOString().slice(0, 10);

const FORMAS = [
  { valor: "transfer", texto: "Transferência" },
  { valor: "pix", texto: "Pix" },
  { valor: "boleto", texto: "Boleto" },
  { valor: "cash", texto: "Dinheiro" },
  { valor: "debit", texto: "Cartão de débito" },
  { valor: "credit", texto: "Cartão de crédito" },
  { valor: "check", texto: "Cheque" },
  { valor: "other", texto: "Outro" },
];

/**
 * Contas a pagar.
 *
 * Mesma gramática da aba de receber — situação deduzida das baixas, baixa
 * parcial, estorno, cancelamento — porque é o mesmo problema visto do outro
 * lado, e duas gramáticas para a mesma coisa só dariam duas formas de errar.
 *
 * "Repetir por N meses" é como despesa fixa entra: gera as linhas de uma vez,
 * em vez de um motor de recorrência que teria que rodar todo dia e decidir o
 * que fazer quando ninguém ligou o servidor no dia 1º.
 */
const AbaPagar = ({ cadastros, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [situacao, setSituacao] = useState("all");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const [novaAberta, setNovaAberta] = useState(false);
  const [nova, setNova] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const podeLancar = can("finance:bill");
  const podeBaixar = can("finance:settle");

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/payables", {
        params: {
          situacao,
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
  }, [situacao, de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirNova = () => {
    setNova({
      description: "",
      dueDate: hoje(),
      amount: "",
      supplierId: "",
      categoryId: "",
      document: "",
      repetirMeses: 1,
    });
    setNovaAberta(true);
  };

  const salvarNova = async () => {
    setSalvando(true);
    try {
      await api.post("/finance/payables", {
        ...nova,
        amount: Number(nova.amount) || 0,
        supplierId: nova.supplierId || null,
        categoryId: nova.categoryId || null,
        repetirMeses: Number(nova.repetirMeses) || 1,
      });
      setNovaAberta(false);
      await carregar();
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarPagamento = async () => {
    setSalvando(true);
    try {
      await api.post(`/finance/payables/${pagando.linha.id}/pagar`, {
        accountId: pagando.contaId,
        amount: Number(pagando.valor),
        occurredAt: pagando.data,
        method: pagando.forma,
      });
      setPagando(null);
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const estornar = async (entryId) => {
    try {
      await api.delete(`/finance/entries/${entryId}`);
      await carregar();
    } catch (err) {
      toastError(err);
    }
  };

  const confirmarCancelamento = async () => {
    const alvo = cancelando;
    setCancelando(null);
    try {
      await api.put(`/finance/payables/${alvo.id}/cancelar`);
      await carregar();
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

  const linhas = dados?.payables || [];
  const totais = dados?.totais || {};
  const contas = (cadastros?.accounts || []).filter((c) => c.active !== false);

  return (
    <>
      <div className={classes.totais}>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Total</span>
          <span className={classes.numero}>{moeda(totais.total)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Pago</span>
          <span className={classes.numero}>{moeda(totais.pago)}</span>
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

      <div className={classes.barra}>
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
          <MenuItem value="paid">Pagas</MenuItem>
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

        {podeLancar && (
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={abrirNova}
            style={{ marginLeft: "auto" }}
          >
            Nova conta
          </Button>
        )}
      </div>

      {linhas.length === 0 ? (
        <EmptyState
          icon={PaymentsOutlinedIcon}
          title="Nenhuma conta a pagar"
          description="Ajuste o período ou a situação nos filtros acima, ou registre uma nova conta."
        />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Vencimento</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Fornecedor</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Pago</TableCell>
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

              const texto = linha.canceledAt
                ? "Cancelada"
                : quitada
                ? "Paga"
                : atrasada
                ? "Vencida"
                : pago > 0
                ? "Parcial"
                : "Em aberto";

              const classe = linha.canceledAt
                ? "cancelada"
                : quitada
                ? "quitada"
                : atrasada
                ? "atrasada"
                : pago > 0
                ? "parcial"
                : "aberta";

              const ultimaBaixa = (linha.entries || []).slice(-1)[0];

              return (
                <TableRow key={linha.id} hover>
                  <TableCell className={classes.dinheiro}>
                    {dataCurta(linha.dueDate)}
                  </TableCell>
                  <TableCell>
                    {linha.description}
                    {linha.installments > 1 && (
                      <span style={{ opacity: 0.6 }}>
                        {" "}
                        ({linha.installment}/{linha.installments})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{linha.supplier?.name || "—"}</TableCell>
                  <TableCell>{linha.category?.name || "—"}</TableCell>
                  <TableCell align="right" className={classes.dinheiro}>
                    {moeda(valor)}
                  </TableCell>
                  <TableCell align="right" className={classes.dinheiro}>
                    {pago > 0 ? moeda(pago) : "—"}
                  </TableCell>
                  <TableCell align="center">
                    <span className={`${classes.situacao} ${classes[classe]}`}>
                      {texto}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    {podeBaixar && !linha.canceledAt && !quitada && (
                      <Tooltip title="Registrar pagamento" arrow>
                        <IconButton
                          size="small"
                          onClick={() =>
                            setPagando({
                              linha,
                              valor: String(Number((valor - pago).toFixed(2))),
                              contaId: contas[0]?.id || "",
                              forma: "transfer",
                              data: hoje(),
                            })
                          }
                        >
                          <PaidIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {podeBaixar && ultimaBaixa && (
                      <Tooltip
                        title={`Estornar o pagamento de ${moeda(
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
                    {podeLancar && !linha.canceledAt && pago === 0 && (
                      <Tooltip title="Cancelar conta" arrow>
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

      {/* ── Nova conta ─────────────────────────────────────────────────── */}
      <Dialog
        open={novaAberta}
        onClose={() => setNovaAberta(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Nova conta a pagar</DialogTitle>
        <DialogContent dividers>
          {nova && (
            <div className={classes.campos}>
              <TextField
                size="small"
                label="Descrição"
                placeholder="Lona brilho 440g"
                value={nova.description}
                onChange={(e) =>
                  setNova({ ...nova, description: e.target.value })
                }
                autoFocus
              />
              <TextField
                size="small"
                type="number"
                label="Valor"
                inputProps={{ step: "0.01", min: 0 }}
                value={nova.amount}
                onChange={(e) => setNova({ ...nova, amount: e.target.value })}
              />
              <TextField
                size="small"
                type="date"
                label="Vencimento"
                InputLabelProps={{ shrink: true }}
                value={nova.dueDate}
                onChange={(e) => setNova({ ...nova, dueDate: e.target.value })}
              />
              <TextField
                select
                size="small"
                label="Fornecedor"
                value={nova.supplierId}
                onChange={(e) =>
                  setNova({ ...nova, supplierId: e.target.value })
                }
              >
                <MenuItem value="">Sem fornecedor</MenuItem>
                {(cadastros?.suppliers || [])
                  .filter((f) => f.active !== false)
                  .map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Categoria"
                value={nova.categoryId}
                onChange={(e) =>
                  setNova({ ...nova, categoryId: e.target.value })
                }
              >
                <MenuItem value="">Sem categoria</MenuItem>
                {(cadastros?.categories || [])
                  .filter((c) => c.kind === "expense" && c.active !== false)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
              </TextField>
              <TextField
                size="small"
                label="Documento"
                placeholder="Nota, boleto, contrato"
                value={nova.document}
                onChange={(e) => setNova({ ...nova, document: e.target.value })}
              />
              <TextField
                size="small"
                type="number"
                label="Repetir por (meses)"
                inputProps={{ min: 1, max: 60 }}
                value={nova.repetirMeses}
                onChange={(e) =>
                  setNova({ ...nova, repetirMeses: e.target.value })
                }
                helperText="1 é uma conta única. Acima disso, gera uma por mês — é como despesa fixa entra."
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNovaAberta(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={salvarNova}
            disabled={
              salvando ||
              !nova?.description?.trim() ||
              !(Number(nova?.amount) > 0) ||
              !nova?.dueDate
            }
          >
            Lançar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Pagamento ──────────────────────────────────────────────────── */}
      <Dialog
        open={Boolean(pagando)}
        onClose={() => setPagando(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Registrar pagamento</DialogTitle>
        <DialogContent dividers>
          {pagando && (
            <>
              <Typography variant="body2">{pagando.linha.description}</Typography>
              <Typography
                variant="caption"
                color="textSecondary"
                style={{ display: "block", marginBottom: 12 }}
              >
                Falta{" "}
                {moeda(
                  Number(pagando.linha.amount) -
                    Number(pagando.linha.paidAmount || 0)
                )}
              </Typography>

              <div className={classes.campos}>
                <TextField
                  size="small"
                  type="number"
                  label="Valor pago"
                  inputProps={{ step: "0.01", min: 0 }}
                  value={pagando.valor}
                  onChange={(e) =>
                    setPagando({ ...pagando, valor: e.target.value })
                  }
                  autoFocus
                />
                <TextField
                  size="small"
                  type="date"
                  label="Data do pagamento"
                  InputLabelProps={{ shrink: true }}
                  value={pagando.data}
                  onChange={(e) =>
                    setPagando({ ...pagando, data: e.target.value })
                  }
                />
                <TextField
                  select
                  size="small"
                  label="Conta"
                  value={pagando.contaId}
                  onChange={(e) =>
                    setPagando({ ...pagando, contaId: e.target.value })
                  }
                  helperText={
                    contas.length === 0
                      ? "Cadastre uma conta na aba Configuração"
                      : " "
                  }
                >
                  {contas.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  size="small"
                  label="Forma"
                  value={pagando.forma}
                  onChange={(e) =>
                    setPagando({ ...pagando, forma: e.target.value })
                  }
                >
                  {FORMAS.map((f) => (
                    <MenuItem key={f.valor} value={f.valor}>
                      {f.texto}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPagando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disableElevation
            onClick={confirmarPagamento}
            disabled={
              salvando || !pagando?.contaId || !(Number(pagando?.valor) > 0)
            }
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmationModal
        title="Cancelar esta conta?"
        open={Boolean(cancelando)}
        onClose={() => setCancelando(null)}
        danger
        confirmLabel="Cancelar lançamento"
        onConfirm={confirmarCancelamento}
      >
        A conta sai das somas mas continua no histórico. Não dá para desfazer
        pela tela.
      </ConfirmationModal>
    </>
  );
};

export default AbaPagar;
