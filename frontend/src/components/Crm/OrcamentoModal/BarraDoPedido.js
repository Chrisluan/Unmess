import React, { useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import ShoppingCartCheckoutIcon from "@mui/icons-material/ShoppingCartCheckoutOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import { toast } from "react-toastify";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import { abrirOrdemDeProducao, abrirProposta } from "../../../helpers/ordemDeServico";
import Janela from "../../Janela";
import CustomerModal from "../../CustomerModal";
import TrilhaComercial from "../../TrilhaComercial";

const useStyles = makeStyles((theme) => ({
  barra: {
    margin: "0 16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  acoes: { display: "flex", gap: 8, flexWrap: "wrap" },
  requisito: { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
}));

const Requisito = ({ ok, children, acao }) => {
  const classes = useStyles();
  return (
    <div className={classes.requisito}>
      {ok ? (
        <CheckCircleIcon color="success" fontSize="small" />
      ) : (
        <RadioButtonUncheckedIcon color="warning" fontSize="small" />
      )}
      <Typography variant="body2" sx={{ flex: 1 }}>
        {children}
      </Typography>
      {!ok && acao}
    </div>
  );
};

/**
 * O que se faz com o orçamento daqui em diante: imprimir a proposta, gerar o
 * pedido, imprimir a ordem de produção, cancelar o pedido.
 *
 * Também mostra a trilha (contato › cliente › conversa › orçamento › pedido ›
 * cobrança), para quem abre o card saber de onde ele veio e onde está.
 */
const BarraDoPedido = ({ deal, onAlterado }) => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [gerando, setGerando] = useState(false);
  const [confirmarGerar, setConfirmarGerar] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [criarCliente, setCriarCliente] = useState(false);
  const [atualizarTrilha, setAtualizarTrilha] = useState(0);

  const papel = deal.papel || "orcamento";
  const pedido = deal.pedido && !deal.pedido.canceledAt ? deal.pedido : null;
  const noFunil = Boolean(deal.board?.isSalesFunnel);
  const itens = (deal.items || []).length;
  const temCliente = Boolean(deal.customerId);

  const verValores = can("crm:viewValues");
  const podeEmitir = can("crm:issueOrder");
  const podeGerar = can("crm:generateOrder");
  const podeCancelar = can("crm:cancelOrder");

  const recarregar = async () => {
    setAtualizarTrilha((n) => n + 1);
    if (onAlterado) await onAlterado();
  };

  const gerar = async () => {
    setGerando(true);
    try {
      const { data } = await api.post(`/deals/${deal.id}/pedido`);
      toast.success(`Pedido nº ${data?.pedido?.number ?? ""} gerado.`);
      setConfirmarGerar(false);
      await recarregar();
    } catch (err) {
      toastError(err);
    } finally {
      setGerando(false);
    }
  };

  const cancelar = async () => {
    if (!pedido) return;
    setCancelando(true);
    try {
      await api.post(`/orders/${pedido.id}/cancelar`, { motivo });
      toast.success(`Pedido nº ${pedido.number} cancelado. O orçamento pode ser editado de novo.`);
      setConfirmarCancelar(false);
      setMotivo("");
      await recarregar();
    } catch (err) {
      toastError(err);
    } finally {
      setCancelando(false);
    }
  };

  // Cliente criado a partir do contato: liga ao orçamento na hora, para o
  // requisito do pedido ficar resolvido sem sair da janela.
  const aoCriarCliente = async (cliente) => {
    setCriarCliente(false);
    if (!cliente?.id) return;
    try {
      await api.put(`/deals/${deal.id}`, { customerId: cliente.id });
      await recarregar();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.barra}>
      <TrilhaComercial dealId={deal.id} atualizarEm={atualizarTrilha} />

      {papel === "orcamento_aprovado" && pedido && (
        <Alert severity="success">
          Pedido nº {pedido.number} gerado deste orçamento. O orçamento fica como foi aprovado;
          mudanças agora são no pedido.
        </Alert>
      )}
      {papel === "producao" && pedido && (
        <Alert severity="info">
          Itens e documento vêm do pedido nº {pedido.number}
          {pedido.quoteNumber ? ` (orçamento nº ${pedido.quoteNumber})` : ""}.
          {!can("crm:editOrder") && " Para mudar os itens é preciso permissão de alterar pedido."}
        </Alert>
      )}

      <div className={classes.acoes}>
        {noFunil && podeEmitir && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<DescriptionIcon />}
            onClick={() => abrirProposta(deal.id).catch(toastError)}
          >
            Proposta
          </Button>
        )}

        {papel === "orcamento" && noFunil && podeGerar && deal.status !== "lost" && (
          <Button
            size="small"
            variant="contained"
            startIcon={<ShoppingCartCheckoutIcon />}
            onClick={() => setConfirmarGerar(true)}
          >
            Gerar pedido
          </Button>
        )}

        {pedido && podeEmitir && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrecisionManufacturingIcon />}
            onClick={() => abrirOrdemDeProducao(pedido.id).catch(toastError)}
          >
            Ordem de produção
          </Button>
        )}
        {pedido && podeEmitir && verValores && (
          <Button
            size="small"
            onClick={() => abrirOrdemDeProducao(pedido.id, true).catch(toastError)}
          >
            Via com valores
          </Button>
        )}

        {pedido && podeCancelar && (
          <Button
            size="small"
            color="error"
            startIcon={<BlockIcon />}
            onClick={() => setConfirmarCancelar(true)}
          >
            Cancelar pedido
          </Button>
        )}
      </div>

      <Janela
        open={confirmarGerar}
        onClose={() => setConfirmarGerar(false)}
        titulo="Gerar pedido"
        subtitulo="Congela itens e condições, dá número de pedido, marca a venda como ganha e abre o trabalho na produção."
        icone={<ShoppingCartCheckoutIcon />}
        rotuloConfirmar="Gerar pedido"
        onConfirmar={gerar}
        carregando={gerando}
        confirmarDesabilitado={!itens || !temCliente}
      >
        <Requisito ok={itens > 0}>
          {itens > 0 ? `${itens} item(ns) no orçamento` : "O orçamento não tem itens"}
        </Requisito>
        <Requisito
          ok={temCliente}
          acao={
            <Button size="small" onClick={() => setCriarCliente(true)}>
              Cadastrar cliente
            </Button>
          }
        >
          {temCliente
            ? `Cliente: ${deal.customer?.tradeName || deal.customer?.name}`
            : "Sem cliente cadastrado. Cobrança e nota precisam de nome e documento, não só do contato do WhatsApp."}
        </Requisito>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Depois de gerado, o orçamento não muda mais. Para corrigir, cancele o pedido.
        </Typography>
      </Janela>

      <Janela
        open={confirmarCancelar}
        onClose={() => setConfirmarCancelar(false)}
        titulo={`Cancelar o pedido nº ${pedido?.number ?? ""}?`}
        subtitulo="As parcelas em aberto são canceladas, os cards de produção saem do quadro e o orçamento volta a ser editável. Não é possível se já houver recebimento."
        icone={<BlockIcon />}
        tom="perigo"
        rotuloConfirmar="Cancelar pedido"
        rotuloCancelar="Voltar"
        onConfirmar={cancelar}
        carregando={cancelando}
      >
        <TextField
          label="Motivo"
          fullWidth
          size="small"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: cliente desistiu, medida errada"
        />
      </Janela>

      <CustomerModal
        open={criarCliente}
        onClose={() => setCriarCliente(false)}
        onSave={aoCriarCliente}
        initialValues={{
          name: deal.contact?.name || "",
          whatsapp: deal.contact?.number || "",
          contactId: deal.contactId || null,
        }}
      />
    </div>
  );
};

export default BarraDoPedido;
