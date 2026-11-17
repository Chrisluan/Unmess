import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  resumo: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
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

  numero: { fontSize: "1rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" },

  cabecalho: {
    display: "grid",
    gridTemplateColumns: "48px 1fr 1fr 40px",
    gap: 8,
    padding: "0 4px 6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },

  linha: {
    display: "grid",
    gridTemplateColumns: "48px 1fr 1fr 40px",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
  },

  posicao: {
    fontSize: "0.8rem",
    fontWeight: 700,
    textAlign: "center",
    color: theme.palette.text.secondary,
  },

  /**
   * O confronto entre a soma das parcelas e o total do pedido.
   *
   * É o único jeito de a pessoa confirmar sem conferir na calculadora — e a
   * confirmação existe justamente para permitir ajustes que podem
   * desbalancear a conta.
   */
  conferencia: {
    marginTop: theme.spacing(2),
    padding: theme.spacing(1.5),
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: theme.spacing(2),
  },

  bate: { color: theme.palette.success.main, fontWeight: 700 },
  naoBate: { color: theme.palette.error.main, fontWeight: 700 },
  centro: { display: "flex", justifyContent: "center", padding: 40 },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Confirmação da cobrança de uma venda faturada.
 *
 * O sistema propõe as parcelas a partir da condição de pagamento; esta janela
 * existe para alguém conferir antes de virar dívida do cliente. Gravar direto
 * tiraria a chance de corrigir uma condição escolhida errado no fechamento, e
 * desfazer cobrança lançada é bem mais caro do que ajustar uma linha aqui.
 *
 * Nada é gravado enquanto a proposta está aberta: trocar a condição de
 * pagamento só refaz a conta.
 */
const CobrancaModal = ({ open, deal, cadastros, onClose, onGerado }) => {
  const classes = useStyles();

  const [proposta, setProposta] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [termId, setTermId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(
    async (condicao) => {
      if (!deal?.id) return;
      setCarregando(true);
      try {
        const { data } = await api.get(`/finance/propor/${deal.id}`, {
          params: condicao ? { paymentTermId: condicao } : {},
        });
        setProposta(data);
        setParcelas(data.parcelas || []);
        setTermId(data.paymentTermId || "");
      } catch (err) {
        toastError(err);
      } finally {
        setCarregando(false);
      }
    },
    [deal]
  );

  useEffect(() => {
    if (open) {
      setCategoriaId("");
      buscar();
    }
  }, [open, buscar]);

  const mudarCondicao = (id) => {
    setTermId(id);
    buscar(id);
  };

  const mudarParcela = (indice, campo, valor) =>
    setParcelas((atual) =>
      atual.map((p, i) => (i === indice ? { ...p, [campo]: valor } : p))
    );

  const removerParcela = (indice) =>
    setParcelas((atual) => atual.filter((_, i) => i !== indice));

  const adicionarParcela = () =>
    setParcelas((atual) => [
      ...atual,
      {
        installment: atual.length + 1,
        installments: atual.length + 1,
        dueDate: new Date().toISOString().slice(0, 10),
        amount: 0,
      },
    ]);

  const soma = parcelas.reduce((s, p) => s + Number(p.amount || 0), 0);
  const total = Number(proposta?.total || 0);
  // Um centavo de tolerância: o arredondamento das parcelas não pode travar a
  // confirmação de uma proposta que o próprio sistema montou.
  const bate = Math.abs(soma - total) < 0.011;

  const gerar = async () => {
    setSalvando(true);
    try {
      await api.post("/finance/receivables", {
        dealId: deal.id,
        parcelas: parcelas.map((p, i) => ({
          installment: i + 1,
          dueDate: p.dueDate,
          amount: Number(p.amount) || 0,
        })),
        descricao: proposta?.descricao,
        customerId: proposta?.customerId,
        paymentTermId: termId || null,
        categoryId: categoriaId || null,
      });
      if (onGerado) await onGerado();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Gerar cobrança</DialogTitle>

      <DialogContent dividers>
        {carregando || !proposta ? (
          <div className={classes.centro}>
            <CircularProgress />
          </div>
        ) : (
          <>
            <div className={classes.resumo}>
              <div className={classes.bloco}>
                <span className={classes.rotulo}>Pedido</span>
                <span style={{ fontWeight: 600 }}>{proposta.descricao}</span>
              </div>
              <div className={classes.bloco}>
                <span className={classes.rotulo}>Cliente</span>
                <span>{proposta.customerName || "—"}</span>
              </div>
              <div className={classes.bloco} style={{ marginLeft: "auto" }}>
                <span className={classes.rotulo}>A cobrar</span>
                <span className={classes.numero}>{moeda(proposta.total)}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <TextField
                select
                size="small"
                label="Condição de pagamento"
                value={termId || ""}
                onChange={(e) => mudarCondicao(e.target.value)}
                fullWidth
              >
                <MenuItem value="">À vista</MenuItem>
                {(cadastros?.paymentTerms || [])
                  .filter((t) => t.active !== false)
                  .map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
              </TextField>

              <TextField
                select
                size="small"
                label="Categoria"
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Sem categoria</MenuItem>
                {(cadastros?.categories || [])
                  .filter((c) => c.kind === "income" && c.active !== false)
                  .map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
              </TextField>
            </div>

            <div className={classes.cabecalho}>
              <span style={{ textAlign: "center" }}>Nº</span>
              <span>Vencimento</span>
              <span>Valor</span>
              <span />
            </div>

            {parcelas.map((p, i) => (
              <div key={i} className={classes.linha}>
                <span className={classes.posicao}>{i + 1}</span>
                <TextField
                  size="small"
                  type="date"
                  value={String(p.dueDate).slice(0, 10)}
                  onChange={(e) => mudarParcela(i, "dueDate", e.target.value)}
                />
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ step: "0.01", min: 0 }}
                  value={p.amount}
                  onChange={(e) => mudarParcela(i, "amount", e.target.value)}
                />
                <IconButton
                  size="small"
                  onClick={() => removerParcela(i)}
                  disabled={parcelas.length <= 1}
                  title="Remover parcela"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </div>
            ))}

            <Button size="small" startIcon={<AddIcon />} onClick={adicionarParcela}>
              Parcela
            </Button>

            <div className={classes.conferencia}>
              <Typography variant="body2">
                Soma das parcelas: <strong>{moeda(soma)}</strong>
              </Typography>
              <Typography
                variant="body2"
                className={bate ? classes.bate : classes.naoBate}
              >
                {bate
                  ? "Confere com o pedido"
                  : `Diferença de ${moeda(Math.abs(soma - total))}`}
              </Typography>
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disableElevation
          onClick={gerar}
          disabled={!bate || salvando || carregando || !parcelas.length}
          startIcon={salvando ? <CircularProgress size={14} /> : null}
        >
          Gerar cobrança
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CobrancaModal;
