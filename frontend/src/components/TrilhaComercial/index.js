import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import api from "../../services/api";

/**
 * A trilha comercial: Contato › Cliente › Conversa › Orçamento › Pedido ›
 * Cobrança, com o estado de cada etapa e o link para ela.
 *
 * Cada pedaço morava numa tela e nenhuma sabia das outras. Aqui a pessoa vê de
 * onde a venda veio e onde ela está -- e chega em qualquer etapa com um
 * clique, sem procurar pelo número.
 *
 * Recebe um ponto de partida (dealId, orderId, ticketId ou customerId) e pede
 * ao backend o caminho inteiro (GET /comercial/trilha).
 */

const useStyles = makeStyles((theme) => ({
  trilha: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 2,
    fontSize: 12.5,
  },
  etapa: {
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: "4px 8px",
    borderRadius: 0,
    border: `1px solid ${theme.palette.divider}`,
    lineHeight: 1.25,
    textAlign: "left",
    "&:hover": { background: theme.palette.action.hover },
  },
  rotulo: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: theme.palette.text.secondary,
  },
  valor: { fontWeight: 600, whiteSpace: "nowrap" },
  faltando: { borderStyle: "dashed", color: theme.palette.text.secondary },
  ok: { borderLeft: `3px solid ${theme.palette.success.main}` },
  atencao: { borderLeft: `3px solid ${theme.palette.warning.main}` },
  perigo: { borderLeft: `3px solid ${theme.palette.error.main}` },
  seta: { fontSize: 16, color: theme.palette.text.disabled },
}));

const SITUACAO_DO_PEDIDO = {
  a_cobrar: { texto: "a cobrar", tom: "atencao" },
  cobrado: { texto: "cobrado", tom: "atencao" },
  parcial: { texto: "pago em parte", tom: "atencao" },
  pago: { texto: "pago", tom: "ok" },
  cancelado: { texto: "cancelado", tom: "perigo" },
};

const moeda = (valor) =>
  valor === null || valor === undefined
    ? null
    : Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Etapa = ({ rotulo, valor, dica, tom, faltando, onClick }) => {
  const classes = useStyles();
  const conteudo = (
    <ButtonBase
      className={`${classes.etapa} ${faltando ? classes.faltando : ""} ${tom ? classes[tom] : ""}`}
      onClick={onClick}
      disabled={!onClick}
    >
      <span className={classes.rotulo}>{rotulo}</span>
      <span className={classes.valor}>{valor}</span>
    </ButtonBase>
  );
  return dica ? <Tooltip title={dica}>{conteudo}</Tooltip> : conteudo;
};

const TrilhaComercial = ({ dealId, orderId, ticketId, customerId, atualizarEm, onAbrirCliente }) => {
  const classes = useStyles();
  const history = useHistory();
  const [trilha, setTrilha] = useState(null);

  const carregar = useCallback(async () => {
    const params = { dealId, orderId, ticketId, customerId };
    if (!Object.values(params).some(Boolean)) return;
    try {
      const { data } = await api.get("/comercial/trilha", { params });
      setTrilha(data);
    } catch {
      // A trilha é um atalho: se falhar, a tela continua funcionando sem ela.
      setTrilha(null);
    }
  }, [dealId, orderId, ticketId, customerId]);

  useEffect(() => {
    carregar();
  }, [carregar, atualizarEm]);

  if (!trilha) return null;

  const { contato, cliente, conversas, orcamentos, pedidos, cobrancas } = trilha;
  const conversa = conversas?.[0];
  const orcamento = orcamentos?.[0];
  const pedido = pedidos?.find((p) => !p.canceledAt) || pedidos?.[0];
  const parcelas = (cobrancas || []).filter((c) => !pedido || c.orderId === pedido.id);
  const pagas = parcelas.filter((c) => c.status === "paid").length;
  const seta = <ChevronRightIcon className={classes.seta} />;

  return (
    <div className={classes.trilha}>
      <Etapa
        rotulo="Contato"
        valor={contato ? contato.name || contato.number : "sem contato"}
        faltando={!contato}
        onClick={contato ? () => history.push(`/contacts?busca=${encodeURIComponent(contato.number || "")}`) : null}
      />
      {seta}
      <Etapa
        rotulo="Cliente"
        valor={cliente ? cliente.name : "sem cadastro"}
        dica={cliente ? cliente.document || "Sem CNPJ/CPF" : "O pedido exige um cliente cadastrado"}
        faltando={!cliente}
        tom={cliente ? null : "atencao"}
        onClick={onAbrirCliente ? () => onAbrirCliente(cliente) : null}
      />
      {seta}
      <Etapa
        rotulo="Conversa"
        valor={conversa ? `#${conversa.id}` : "nenhuma"}
        faltando={!conversa}
        onClick={conversa ? () => history.push(`/tickets/${conversa.id}`) : null}
      />
      {seta}
      <Etapa
        rotulo="Orçamento"
        valor={orcamento ? `nº ${orcamento.number || orcamento.id}` : "nenhum"}
        dica={orcamento ? [orcamento.title, moeda(orcamento.value)].filter(Boolean).join(" · ") : null}
        faltando={!orcamento}
        onClick={orcamento && orcamento.id !== Number(dealId) ? () => history.push(`/crm?deal=${orcamento.id}`) : null}
      />
      {seta}
      <Etapa
        rotulo="Pedido"
        valor={pedido ? `nº ${pedido.number}` : "não gerado"}
        dica={
          pedido
            ? [
                pedido.producao ? `${pedido.producao.quadro} › ${pedido.producao.etapa}` : null,
                moeda(pedido.total),
              ]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        faltando={!pedido}
        tom={pedido ? (pedido.canceledAt ? "perigo" : "ok") : null}
        onClick={
          pedido?.producao?.dealId && pedido.producao.dealId !== Number(dealId)
            ? () => history.push(`/crm?deal=${pedido.producao.dealId}`)
            : null
        }
      />
      {seta}
      <Etapa
        rotulo="Cobrança"
        valor={
          pedido
            ? SITUACAO_DO_PEDIDO[pedido.situacao]?.texto || "—"
            : parcelas.length
              ? `${pagas}/${parcelas.length} pagas`
              : "nenhuma"
        }
        dica={parcelas.length ? `${pagas} de ${parcelas.length} parcela(s) paga(s)` : null}
        faltando={!pedido && !parcelas.length}
        tom={pedido ? SITUACAO_DO_PEDIDO[pedido.situacao]?.tom : null}
        onClick={
          pedido || parcelas.length
            ? () => history.push(`/finance/receber${pedido ? `?pedido=${pedido.number}` : ""}`)
            : null
        }
      />
    </div>
  );
};

export default TrilhaComercial;
