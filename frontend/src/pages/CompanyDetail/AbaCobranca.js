import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import PriceCheckIcon from "@mui/icons-material/PriceCheckOutlined";
import UndoIcon from "@mui/icons-material/UndoOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import SyncIcon from "@mui/icons-material/SyncOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLongOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import EmptyState from "../../components/EmptyState";
import ConfirmationModal from "../../components/ConfirmationModal";
import EmitirFaturaModal from "./EmitirFaturaModal";

const useStyles = makeStyles((theme) => ({
  faixa: {
    display: "flex",
    alignItems: "stretch",
    flexWrap: "wrap",
    gap: 1,
    background: theme.palette.divider,
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: theme.spacing(2),
  },

  bloco: {
    background: theme.palette.background.paper,
    padding: "8px 14px",
    minWidth: 130,
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

  alerta: { color: theme.palette.error.main },
  bom: { color: theme.palette.success.main },

  cabecalho: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },

  carregando: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },

  tabela: { minWidth: 720 },

  numero: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },

  linhaVencida: {
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(242,131,122,0.10)"
        : "rgba(192,43,32,0.05)",
  },

  situacao: {
    display: "inline-flex",
    alignItems: "center",
    height: 20,
    padding: "0 7px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    border: "1px solid currentColor",
  },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const data = (iso) => {
  if (!iso) return "—";
  const [ano, mes, dia] = String(iso).slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
};

const SITUACOES = {
  pending: { rotulo: "Em aberto", classe: null },
  overdue: { rotulo: "Vencida", classe: "alerta" },
  paid: { rotulo: "Paga", classe: "bom" },
  canceled: { rotulo: "Cancelada", classe: null },
  failed: { rotulo: "Falhou", classe: "alerta" },
};

/**
 * Cobrança da empresa assinante.
 *
 * A faixa de cima responde as três perguntas que se faz antes de olhar a
 * lista: tem algo vencido, quanto está em aberto e quando vence o próximo.
 * A lista é o histórico, com o que o cliente precisa para pagar — linha
 * digitável e PDF — ao alcance de um clique, porque o pedido que mais chega
 * ao suporte é "me reenvia o boleto".
 */
const AbaCobranca = ({ company, onMudou, onResumo }) => {
  const classes = useStyles();

  const [invoices, setInvoices] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [emissaoAutomatica, setEmissaoAutomatica] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [emitindo, setEmitindo] = useState(false);
  const [confirmando, setConfirmando] = useState(null);
  const [ocupada, setOcupada] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data: dados } = await api.get(`/companies/${company.id}/invoices`);
      setInvoices(dados.invoices || []);
      setResumo(dados.resumo || null);
      setEmissaoAutomatica(Boolean(dados.emissaoAutomatica));
      onResumo?.(dados.resumo);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
    // onResumo vem do pai como seta nova a cada render; incluí-lo reiniciaria
    // a busca em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agir = async (invoiceId, caminho, corpo) => {
    setOcupada(invoiceId);
    try {
      await api.put(`/invoices/${invoiceId}/${caminho}`, corpo || {});
      await carregar();
      // Baixar ou cancelar pode devolver o acesso da empresa; o cabeçalho
      // precisa refletir isso sem exigir F5.
      onMudou?.();
    } catch (err) {
      toastError(err);
    } finally {
      setOcupada(null);
    }
  };

  const copiar = async (texto, aviso) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(aviso);
    } catch {
      // Sem permissão de área de transferência (acesso por HTTP): o valor
      // está na tela e dá para copiar à mão.
    }
  };

  if (carregando) {
    return (
      <div className={classes.carregando}>
        <CircularProgress />
      </div>
    );
  }

  const blocos = [
    {
      rotulo: "Vencidas",
      valor: resumo?.vencidas ?? 0,
      classe: (resumo?.vencidas || 0) > 0 ? classes.alerta : undefined,
    },
    {
      rotulo: "Valor vencido",
      valor: moeda(resumo?.valorVencido),
      classe: (resumo?.valorVencido || 0) > 0 ? classes.alerta : undefined,
    },
    { rotulo: "Em aberto", valor: moeda(resumo?.valorEmAberto) },
    { rotulo: "Próximo vencimento", valor: data(resumo?.proximoVencimento) },
    {
      rotulo: "Recebido no ano",
      valor: moeda(resumo?.pagoNoAno),
      classe: classes.bom,
    },
  ];

  return (
    <>
      <EmitirFaturaModal
        open={emitindo}
        company={company}
        emissaoAutomatica={emissaoAutomatica}
        onClose={() => setEmitindo(false)}
        onEmitida={() => {
          setEmitindo(false);
          carregar();
        }}
      />

      <ConfirmationModal
        title="Cancelar esta fatura?"
        open={Boolean(confirmando)}
        onClose={() => setConfirmando(null)}
        danger
        confirmLabel="Cancelar fatura"
        cancelLabel="Voltar"
        onConfirm={() => agir(confirmando, "cancel")}
      >
        A cobrança deixa de valer e, quando ela veio do gateway, o boleto
        também é cancelado lá. Essa ação não pode ser desfeita.
      </ConfirmationModal>

      {!emissaoAutomatica && (
        <Alert severity="info" style={{ marginBottom: 16 }}>
          Nenhum gateway configurado: as faturas são registradas aqui e o boleto
          continua sendo emitido no banco. Defina <code>ASAAS_API_KEY</code> no
          .env do servidor para emitir automaticamente.
        </Alert>
      )}

      <div className={classes.faixa}>
        {blocos.map((b) => (
          <div key={b.rotulo} className={classes.bloco}>
            <span className={classes.rotulo}>{b.rotulo}</span>
            <span className={`${classes.valor} ${b.classe || ""}`}>
              {b.valor}
            </span>
          </div>
        ))}
      </div>

      <div className={classes.cabecalho}>
        <Typography variant="subtitle2">Faturas</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setEmitindo(true)}
        >
          {emissaoAutomatica ? "Emitir cobrança" : "Registrar cobrança"}
        </Button>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptLongIcon}
          title="Nenhuma cobrança emitida"
          description="Emita a primeira mensalidade desta empresa. O valor e o vencimento vêm do que está cadastrado na Visão geral."
          action={
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setEmitindo(true)}
            >
              {emissaoAutomatica ? "Emitir cobrança" : "Registrar cobrança"}
            </Button>
          }
        />
      ) : (
        <Table size="small" className={classes.tabela}>
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Pagamento</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => {
              const situacao = SITUACOES[invoice.status] || SITUACOES.pending;
              const vencida = invoice.status === "overdue";
              const encerrada = ["paid", "canceled"].includes(invoice.status);

              return (
                <TableRow
                  key={invoice.id}
                  className={vencida ? classes.linhaVencida : ""}
                >
                  <TableCell>
                    {invoice.description}
                    {invoice.lastError && (
                      <Typography
                        variant="caption"
                        display="block"
                        color="error"
                      >
                        {invoice.lastError}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell className={classes.numero}>
                    {data(invoice.dueDate)}
                  </TableCell>
                  <TableCell align="right" className={classes.numero}>
                    {moeda(invoice.amount)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`${classes.situacao} ${
                        situacao.classe ? classes[situacao.classe] : ""
                      }`}
                    >
                      {situacao.rotulo}
                    </span>
                  </TableCell>
                  <TableCell className={classes.numero}>
                    {invoice.paidAt ? data(invoice.paidAt) : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {invoice.digitableLine && (
                      <Tooltip title="Copiar linha digitável" arrow>
                        <IconButton
                          size="small"
                          aria-label="Copiar linha digitável"
                          onClick={() =>
                            copiar(invoice.digitableLine, "Linha copiada.")
                          }
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {(invoice.bankSlipUrl || invoice.invoiceUrl) && (
                      <Tooltip title="Abrir o boleto" arrow>
                        <IconButton
                          size="small"
                          aria-label="Abrir o boleto"
                          onClick={() =>
                            window.open(
                              invoice.bankSlipUrl || invoice.invoiceUrl,
                              "_blank",
                              "noopener"
                            )
                          }
                        >
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {invoice.providerChargeId && (
                      <Tooltip title="Consultar situação no gateway" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Consultar situação no gateway"
                            disabled={ocupada === invoice.id}
                            onClick={() => agir(invoice.id, "sync")}
                          >
                            <SyncIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    {!encerrada && (
                      <Tooltip title="Dar baixa (pagamento recebido)" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Dar baixa"
                            disabled={ocupada === invoice.id}
                            onClick={() => agir(invoice.id, "pay")}
                          >
                            <PriceCheckIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    {invoice.status === "paid" && (
                      <Tooltip title="Desfazer a baixa" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Desfazer a baixa"
                            disabled={ocupada === invoice.id}
                            onClick={() => agir(invoice.id, "unpay")}
                          >
                            <UndoIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}

                    {!encerrada && (
                      <Tooltip title="Cancelar a cobrança" arrow>
                        <span>
                          <IconButton
                            size="small"
                            aria-label="Cancelar a cobrança"
                            disabled={ocupada === invoice.id}
                            onClick={() => setConfirmando(invoice.id)}
                          >
                            <BlockIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
};

export default AbaCobranca;
