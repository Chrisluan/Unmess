import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PrintIcon from "@mui/icons-material/Print";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import { getBackendUrl } from "../../config";

const useStyles = makeStyles(theme => ({
  bloco: { padding: 12, display: "flex", flexDirection: "column", gap: 10 },

  cabecalho: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  pedido: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 6,
    overflow: "hidden",
  },

  pedidoTopo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
    cursor: "pointer",
    background: theme.palette.action.hover,
  },

  titulo: { fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  etapa: { fontSize: 11, opacity: 0.75 },
  total: { fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" },

  corpo: { padding: 10, display: "flex", flexDirection: "column", gap: 8 },

  // Grade fixa: descrição elástica, números estreitos e alinhados entre linhas.
  linha: {
    display: "grid",
    gridTemplateColumns: "1fr 52px 64px 28px",
    gap: 6,
    alignItems: "center",
  },

  linhaTotal: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: 8,
    fontSize: 13,
    fontWeight: 700,
  },

  vazio: { fontSize: 12, opacity: 0.7, padding: "6px 0" },
  acoes: { display: "flex", gap: 6, flexWrap: "wrap" },
}));

const moeda = valor =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const totalDaLinha = item =>
  Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discount || 0));

/**
 * Pedidos ligados a esta conversa.
 *
 * Fica no painel lateral do atendimento porque é ali que a pergunta aparece:
 * "o que já foi orçado para este cliente?". Antes era preciso sair da conversa,
 * abrir o CRM e procurar o card — e, na prática, ninguém fazia.
 *
 * A edição dos itens salva a lista inteira de uma vez (PUT), e não item a item:
 * é assim que o backend espera, e evita deixar o pedido pela metade se a
 * conexão cair no meio da digitação.
 */
const TicketDeals = () => {
  const classes = useStyles();
  const { ticketId } = useParams();
  const { can } = usePermissions();

  const [deals, setDeals] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(null);
  const [rascunho, setRascunho] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const podeEditar = can("crm:edit");
  const podeCriar = can("crm:create");

  const carregar = useCallback(async () => {
    if (!ticketId) return;
    setCarregando(true);
    try {
      const { data } = await api.get(`/tickets/${ticketId}/deals`);
      setDeals(data.deals || []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [ticketId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = deal => {
    if (aberto === deal.id) {
      setAberto(null);
      return;
    }
    setAberto(deal.id);
    setRascunho(
      (deal.items || []).map(i => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "un",
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
      }))
    );
  };

  const mudarItem = (indice, campo, valor) => {
    setRascunho(atual =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item))
    );
  };

  const adicionarLinha = () =>
    setRascunho(atual => [
      ...atual,
      { description: "", quantity: 1, unit: "un", unitPrice: 0, discount: 0 },
    ]);

  const removerLinha = indice =>
    setRascunho(atual => atual.filter((_, i) => i !== indice));

  const salvar = async dealId => {
    setSalvando(true);
    try {
      await api.put(`/deals/${dealId}/items`, {
        items: rascunho.filter(i => i.description?.trim()),
      });
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  /**
   * A ordem de serviço abre em aba nova em vez de baixar: o backend devolve a
   * página pronta, e é o próprio navegador que imprime ou salva em PDF.
   */
  const emitirOrdem = dealId => {
    window.open(`${getBackendUrl()}/deals/${dealId}/ordem-servico`, "_blank", "noopener");
  };

  const criarPedido = async () => {
    const titulo = window.prompt("Descrição do novo pedido:");
    if (!titulo?.trim()) return;

    try {
      // Nasce sem etapa: o backend coloca no início do quadro padrão, e o card
      // já sai vinculado a esta conversa.
      const { data } = await api.post("/deals", { title: titulo.trim(), ticketId });
      await api.put(`/deals/${data.id}/ticket`, { ticketId }).catch(() => {});
      await carregar();
    } catch (err) {
      toastError(err);
    }
  };

  if (carregando) {
    return (
      <Paper square variant="outlined" className={classes.bloco}>
        <CircularProgress size={20} />
      </Paper>
    );
  }

  return (
    <Paper square variant="outlined" className={classes.bloco}>
      <div className={classes.cabecalho}>
        <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
          Pedidos e orçamentos
        </Typography>
        {podeCriar && (
          <Button size="small" startIcon={<AddIcon />} onClick={criarPedido}>
            Novo
          </Button>
        )}
      </div>

      {deals.length === 0 && (
        <Typography className={classes.vazio}>
          Nenhum pedido ligado a esta conversa ainda.
        </Typography>
      )}

      {deals.map(deal => {
        const estaAberto = aberto === deal.id;
        const itens = estaAberto ? rascunho : deal.items || [];
        const soma = itens.reduce((s, i) => s + totalDaLinha(i), 0);

        return (
          <div key={deal.id} className={classes.pedido}>
            <div className={classes.pedidoTopo} onClick={() => abrir(deal)}>
              <div style={{ minWidth: 0 }}>
                <div className={classes.titulo}>{deal.title}</div>
                <div className={classes.etapa}>
                  {deal.board?.name ? `${deal.board.name} · ` : ""}
                  {deal.stage?.name || "sem etapa"}
                  {deal.archivedAt ? " · arquivado" : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className={classes.total}>{moeda(soma)}</span>
                <ExpandMoreIcon
                  fontSize="small"
                  style={{
                    transform: estaAberto ? "rotate(180deg)" : "none",
                    transition: "transform .15s",
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>

            {estaAberto && (
              <div className={classes.corpo}>
                {rascunho.length === 0 && (
                  <Typography className={classes.vazio}>
                    Sem itens. Adicione o que será cobrado.
                  </Typography>
                )}

                {rascunho.map((item, i) => (
                  <div key={item.id || `novo-${i}`} className={classes.linha}>
                    <TextField
                      size="small"
                      variant="standard"
                      placeholder="Descrição"
                      value={item.description}
                      disabled={!podeEditar}
                      onChange={e => mudarItem(i, "description", e.target.value)}
                    />
                    <TextField
                      size="small"
                      variant="standard"
                      type="number"
                      placeholder="Qtd"
                      value={item.quantity}
                      disabled={!podeEditar}
                      onChange={e => mudarItem(i, "quantity", e.target.value)}
                      inputProps={{ min: 0, step: "0.001" }}
                    />
                    <TextField
                      size="small"
                      variant="standard"
                      type="number"
                      placeholder="Preço"
                      value={item.unitPrice}
                      disabled={!podeEditar}
                      onChange={e => mudarItem(i, "unitPrice", e.target.value)}
                      inputProps={{ min: 0, step: "0.01" }}
                    />
                    {podeEditar && (
                      <IconButton size="small" onClick={() => removerLinha(i)} title="Remover item">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </div>
                ))}

                <div className={classes.linhaTotal}>
                  <span>Total</span>
                  <span>{moeda(soma)}</span>
                </div>

                <div className={classes.acoes}>
                  {podeEditar && (
                    <>
                      <Button size="small" startIcon={<AddIcon />} onClick={adicionarLinha}>
                        Item
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={salvando}
                        onClick={() => salvar(deal.id)}
                      >
                        {salvando ? "Salvando…" : "Salvar"}
                      </Button>
                    </>
                  )}
                  <Button
                    size="small"
                    startIcon={<PrintIcon />}
                    onClick={() => emitirOrdem(deal.id)}
                  >
                    Ordem de serviço
                  </Button>
                </div>

                {deal.archivedAt && (
                  <Chip
                    size="small"
                    label="Este card já avançou de quadro — editar aqui altera o histórico."
                    style={{ height: "auto", padding: "4px 0", whiteSpace: "normal" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </Paper>
  );
};

export default TicketDeals;
