import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Dialog from "@mui/material/Dialog";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import DescriptionIcon from "@mui/icons-material/DescriptionOutlined";
import ListAltIcon from "@mui/icons-material/ListAlt";
import ImageIcon from "@mui/icons-material/ImageOutlined";
import TaskAltIcon from "@mui/icons-material/FactCheckOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import AbaProposta from "./AbaProposta";
import AbaItens from "./AbaItens";
import AbaMaterial from "./AbaMaterial";
import AbaTarefas from "./AbaTarefas";
import AbaWhatsApp from "./AbaWhatsApp";
import { identidadeDoNegocio } from "../identidade";

const useStyles = makeStyles((theme) => ({
  topo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    background: theme.palette.mode === "dark" ? "#1b2431" : "#eef3fb",
  },

  tituloJanela: { fontSize: 15, fontWeight: 700 },

  abas: { borderBottom: `1px solid ${theme.palette.divider}`, minHeight: 46 },
  aba: { minHeight: 46, textTransform: "none", fontWeight: 600, fontSize: 13.5 },

  /**
   * Faixa de identificação, repetida em todas as abas.
   *
   * É o que responde "de quem é isto e quanto vale" sem obrigar a voltar para
   * a primeira aba — a pergunta aparece com o mesmo peso enquanto se mexe nos
   * itens ou nas tarefas.
   */
  faixa: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    margin: 16,
    padding: "10px 14px",
    borderRadius: 0,
    background: theme.palette.action.hover,
  },

  numero: {
    padding: "3px 10px",
    borderRadius: 0,
    background: theme.palette.primary.main,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  // Rastreio, não identidade: o número do orçamento de origem fica em segundo
  // plano para não competir com o número do pedido.
  numeroOrigem: {
    padding: "3px 10px",
    borderRadius: 0,
    border: `1px solid ${theme.palette.primary.main}`,
    color: theme.palette.primary.main,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  /**
   * Etiqueta de situação.
   *
   * A cor vem do tema, e não de um literal: os tons fixos que existiam aqui
   * eram escuros o bastante para sumir contra o fundo do modo escuro. Cada
   * situação ganha sua classe, e o tema resolve o par cor/fundo dos dois modos.
   */
  situacao: {
    padding: "3px 10px",
    borderRadius: 0,
    fontSize: 11.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    whiteSpace: "nowrap",
    border: "1px solid currentColor",
  },

  situacaoAberta: { color: theme.palette.warning.main },
  situacaoConcluida: { color: theme.palette.success.main },
  situacaoPerdida: { color: theme.palette.error.main },

  campoFaixa: { fontSize: 12.5, lineHeight: 1.5 },
  rotuloFaixa: { color: theme.palette.text.secondary, marginRight: 5 },

  valor: {
    marginLeft: "auto",
    textAlign: "right",
    lineHeight: 1.2,
  },

  valorRotulo: { fontSize: 11, color: theme.palette.text.secondary },
  valorNumero: {
    fontSize: 21,
    fontWeight: 700,
    color: theme.palette.text.primary,
    fontVariantNumeric: "tabular-nums",
  },

  corpo: { padding: "0 16px 16px", minHeight: 320 },
  carregando: { display: "flex", justifyContent: "center", padding: 48 },
}));

const SITUACOES = {
  open: { texto: "Em aberto", classe: "situacaoAberta" },
  moved: { texto: "Concluído", classe: "situacaoConcluida" },
  won: { texto: "Fechado", classe: "situacaoConcluida" },
  lost: { texto: "Perdido", classe: "situacaoPerdida" },
};

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Ficha do orçamento em janela, com as abas do processo.
 *
 * Substitui o painel lateral, que só cabia os dados básicos: a proposta tem
 * negociação, itens, tarefas e a conversa que a originou, e cada um desses
 * precisa de espaço para ser lido e editado.
 *
 * Os dados são carregados uma vez aqui e distribuídos às abas. Cada aba
 * buscando o seu faria a mesma requisição três vezes ao trocar de aba, e o
 * cabeçalho piscaria a cada troca.
 */
const OrcamentoModal = ({ open, dealId, onClose, onSalvo, onExcluir }) => {
  const classes = useStyles();

  const [aba, setAba] = useState(0);
  const [deal, setDeal] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    if (!dealId) return;
    setCarregando(true);
    try {
      const { data } = await api.get(`/deals/${dealId}`);
      setDeal(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (open) {
      setAba(0);
      carregar();
    }
  }, [open, carregar]);

  // Toda alteração recarrega a ficha e avisa o quadro: o total muda com os
  // itens, e o card atrás do modal ficaria desatualizado.
  const aoAlterar = async () => {
    await carregar();
    if (onSalvo) onSalvo();
  };

  const situacao = SITUACOES[deal?.status] || SITUACOES.open;

  // Orçamento enquanto está no funil; pedido depois disso. O rótulo e o número
  // mudam juntos -- ver components/Crm/identidade.
  const identidade = identidadeDoNegocio(deal);
  const tarefasAbertas = (deal?.activities || []).filter(
    (a) => a.type === "task" && !a.doneAt
  ).length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <div className={classes.topo}>
        <span className={classes.tituloJanela}>{identidade.rotulo}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {onExcluir && deal && (
            <IconButton
              size="small"
              onClick={() => onExcluir(deal.id)}
              title={`Excluir ${identidade.rotulo.toLowerCase()}`}
              aria-label={`Excluir ${identidade.rotulo.toLowerCase()}`}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onClose} aria-label="Fechar">
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>
      </div>

      <Tabs
        value={aba}
        onChange={(_e, novo) => setAba(novo)}
        className={classes.abas}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab className={classes.aba} icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Proposta" />
        <Tab className={classes.aba} icon={<ListAltIcon fontSize="small" />} iconPosition="start" label="Itens" />
        {/* Logo depois dos itens: o material é o que os itens descrevem, e a
            aba do lado é o lugar em que se procura por ele. */}
        <Tab className={classes.aba} icon={<ImageIcon fontSize="small" />} iconPosition="start" label="Material" />
        <Tab
          className={classes.aba}
          icon={<TaskAltIcon fontSize="small" />}
          iconPosition="start"
          label={
            <Badge badgeContent={tarefasAbertas} color="error">
              <span style={{ paddingRight: tarefasAbertas ? 12 : 0 }}>Tarefas</span>
            </Badge>
          }
        />
        <Tab className={classes.aba} icon={<WhatsAppIcon fontSize="small" />} iconPosition="start" label="WhatsApp" />
      </Tabs>

      {carregando || !deal ? (
        <div className={classes.carregando}>
          <CircularProgress />
        </div>
      ) : (
        <>
          <div className={classes.faixa}>
            <span
              className={`${classes.situacao} ${classes[situacao.classe]}`}
            >
              {situacao.texto}
            </span>

            <span className={classes.numero}>
              {identidade.rotulo} nº {identidade.numero}
            </span>

            {/* De onde o pedido veio: o número do orçamento é o que liga o
                trabalho ao que foi vendido, e é por ele que o cliente pergunta. */}
            {identidade.orcamentoDeOrigem && (
              <span className={classes.numeroOrigem}>
                Orçamento nº {identidade.orcamentoDeOrigem}
              </span>
            )}

            <div className={classes.campoFaixa}>
              <div>
                <span className={classes.rotuloFaixa}>Cliente:</span>
                {deal.customer?.name || deal.contact?.name || "—"}
              </div>
              <div>
                <span className={classes.rotuloFaixa}>Vendedor:</span>
                {deal.responsibleUser?.name || "—"}
              </div>
            </div>

            <div className={classes.valor}>
              <div className={classes.valorRotulo}>
                Valor do {identidade.rotulo.toLowerCase()}
              </div>
              <div className={classes.valorNumero}>{moeda(deal.value)}</div>
            </div>
          </div>

          <div className={classes.corpo}>
            {aba === 0 && <AbaProposta deal={deal} onSalvo={aoAlterar} />}
            {aba === 1 && <AbaItens deal={deal} onSalvo={aoAlterar} />}
            {aba === 2 && <AbaMaterial deal={deal} onSalvo={aoAlterar} />}
            {aba === 3 && <AbaTarefas deal={deal} onSalvo={aoAlterar} />}
            {aba === 4 && <AbaWhatsApp deal={deal} />}
          </div>
        </>
      )}
    </Dialog>
  );
};

export default OrcamentoModal;
