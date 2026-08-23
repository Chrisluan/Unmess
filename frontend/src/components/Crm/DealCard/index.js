import React from "react";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";

import { formatarValor, paraData, estaAtrasado } from "../formatters";
import { identidadeDoNegocio } from "../identidade";
import { mediaUrl } from "../../../helpers/mediaUrl";

const useStyles = makeStyles((theme) => ({
  // A capa sangra até a borda: o material é a primeira coisa que se reconhece,
  // e uma faixa de respiro em volta o transformaria em ilustração.
  capa: {
    width: "calc(100% + " + theme.spacing(2.5) + ")",
    margin: theme.spacing(-1.25, -1.25, 1, -1.25),
    height: 96,
    objectFit: "cover",
    display: "block",
    background: theme.palette.action.hover,
  },

  card: {
    padding: theme.spacing(1.25),
    borderRadius: 0,
    cursor: "pointer",
    borderLeft: "3px solid transparent",
    transition: "box-shadow 120ms, transform 120ms",
    "&:hover": {
      boxShadow: theme.shadows[3],
    },
  },

  arrastavel: {
    cursor: "grab",
  },

  // O card em movimento fica esmaecido para a linha de inserção ficar legível.
  arrastando: {
    opacity: 0.4,
  },

  atrasado: {
    borderLeftColor: theme.palette.error.main,
  },
  etiquetas: { display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 },

  etiqueta: {
    fontSize: 9.5,
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: 0,
    color: "#fff",
    whiteSpace: "nowrap",
  },

  followUp: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: 10.5,
    marginTop: 5,
  },

  followUpAtrasado: { color: theme.palette.error.main, fontWeight: 700 },

  aguardando: {
    fontSize: 9.5,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 0,
    color: theme.palette.warning.main,
    border: "1px solid currentColor",
  },
  faixa: {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 4,
  },

  concluido: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "1px 5px",
    borderRadius: 0,
    color: theme.palette.success.main,
    border: "1px solid currentColor",
  },

  // Venda fechada. O card continua no quadro porque o trabalho continua, mas
  // o dinheiro já entrou na conta do faturamento.
  ganho: {
    fontSize: 9.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "1px 5px",
    borderRadius: 0,
    color: theme.palette.primary.main,
    border: "1px solid currentColor",
  },

  // Número pelo qual o cliente pergunta: é a identidade do card, não decoração.
  identidade: {
    fontSize: 9.5,
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: 0,
    background: theme.palette.action.hover,
  },

  // Referência ao card de origem: discreta, porque é rastreio e não conteúdo.
  origem: {
    fontSize: 9.5,
    fontWeight: 600,
    padding: "1px 5px",
    borderRadius: 0,
    background: theme.palette.action.hover,
    opacity: 0.8,
  },
  titulo: {
    fontWeight: 600,
    fontSize: "0.875rem",
    lineHeight: 1.3,
    wordBreak: "break-word",
  },

  cliente: {
    display: "block",
    marginTop: 2,
  },

  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },

  valor: {
    fontWeight: 700,
    fontSize: "0.85rem",
    color: theme.palette.text.primary,
    fontVariantNumeric: "tabular-nums",
  },

  prazo: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    fontSize: "0.72rem",
    color: theme.palette.text.secondary,
  },

  prazoAtrasado: {
    color: theme.palette.error.main,
    fontWeight: 600,
  },

  avatar: {
    width: 22,
    height: 22,
    fontSize: "0.7rem",
  },
}));

const iniciais = (nome) =>
  (nome || "?")
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

const CORES_PRIORIDADE = {
  urgent: "#c02b20",
  high: "#a16207",
  normal: "transparent",
  low: "#94a3b8",
};

const ROTULO_ATENDIMENTO = {
  waiting_customer: "Aguardando cliente",
  waiting_team: "Aguardando equipe",
};

/**
 * Follow-up em linguagem de quem opera.
 *
 * "Hoje 15:30" responde na hora; "19/08/2026 15:30" obriga a comparar com o
 * calendario mental antes de saber se e urgente.
 */
const descreverFollowUp = (iso) => {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;

  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const dias = Math.round((dia - hoje) / 86400000);
  const hora = format(data, "HH:mm");

  if (dias === 0) return { texto: `Hoje ${hora}`, atrasado: data < agora };
  if (dias === 1) return { texto: `Amanha ${hora}`, atrasado: false };
  if (dias === -1) return { texto: `Ontem ${hora}`, atrasado: true };
  if (dias < 0) return { texto: `Ha ${Math.abs(dias)} dias`, atrasado: true };
  return { texto: format(data, "dd/MM HH:mm"), atrasado: false };
};

const DealCard = ({
  deal,
  arrastavel,
  arrastando,
  noFunil,
  onDragStart,
  onDragEnd,
  onClick,
}) => {
  const classes = useStyles();

  const atrasado = estaAtrasado(deal.expectedCloseAt, deal.status);
  const previsao = paraData(deal.expectedCloseAt);
  const cliente = deal.customer?.tradeName || deal.customer?.name || deal.contact?.name;
  const followUp = descreverFollowUp(deal.nextFollowUpAt);
  // Atraso tem precedencia sobre prioridade na borda: uma oportunidade
  // atrasada e mais urgente que qualquer prioridade marcada a mao.
  const corPrioridade = CORES_PRIORIDADE[deal.priority] || "transparent";
  const aguardando = ROTULO_ATENDIMENTO[deal.serviceStatus];
  const etiquetas = deal.tags || [];
  // O quadro ativo é quem sabe se este é o funil; o card sozinho não recebe o
  // quadro na listagem.
  const identidade = identidadeDoNegocio(deal, { noFunil });

  /**
   * A arte marcada como capa.
   *
   * A listagem já traz só a capa, mas a checagem de tipo fica: um PDF marcado
   * como capa por engano viraria uma imagem quebrada no meio do quadro.
   */
  const capa = (deal.attachments || []).find((anexo) =>
    String(anexo.mimetype || "").startsWith("image/")
  );

  return (
    <Paper
      variant="outlined"
      draggable={arrastavel}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={[
        classes.card,
        arrastavel ? classes.arrastavel : "",
        arrastando ? classes.arrastando : "",
        atrasado ? classes.atrasado : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        !atrasado && corPrioridade !== "transparent"
          ? { borderLeftColor: corPrioridade }
          : undefined
      }
    >
      {/* O material vem antes de tudo: numa gráfica, "banner 3x1" não diz o
          que é o trabalho, e a arte diz de relance. */}
      {capa && (
        <img
          className={classes.capa}
          src={mediaUrl(capa.fileName)}
          alt={capa.name || deal.title}
          loading="lazy"
        />
      )}

      {/* A faixa responde "o que é este card": o número pelo qual o cliente
          pergunta, se a venda já fechou e se o quadro já foi concluído. O card
          concluído continua visível (antes sumia), então precisa dizer que já
          passou. */}
      <div className={classes.faixa}>
        {deal.status === "moved" && <span className={classes.concluido}>Concluído</span>}
        {deal.wonAt && <span className={classes.ganho}>Ganho</span>}

        <span className={classes.identidade}>
          {identidade.rotulo} nº {identidade.numero}
        </span>

        {/* De onde este trabalho veio. O número do orçamento é o elo entre o
            que foi vendido e o que está sendo produzido -- antes o card mostrava
            o id do card anterior, que não é número de nada para quem atende. */}
        {identidade.orcamentoDeOrigem && (
          <span className={classes.origem}>
            Orçamento nº {identidade.orcamentoDeOrigem}
          </span>
        )}
      </div>

      <Typography className={classes.titulo}>{deal.title}</Typography>

      {cliente && (
        <Typography
          variant="caption"
          color="textSecondary"
          className={classes.cliente}
        >
          {cliente}
        </Typography>
      )}

      {etiquetas.length > 0 && (
        <div className={classes.etiquetas}>
          {etiquetas.slice(0, 3).map((t) => (
            <span
              key={t.id}
              className={classes.etiqueta}
              style={{ background: t.color || "#607d8b" }}
            >
              {t.name}
            </span>
          ))}
          {/* Acima de tres, o card vira parede de etiqueta e some o resto. */}
          {etiquetas.length > 3 && (
            <span className={classes.etiqueta} style={{ background: "#90a4ae" }}>
              +{etiquetas.length - 3}
            </span>
          )}
        </div>
      )}

      {(followUp || aguardando) && (
        <div className={classes.followUp}>
          {followUp && (
            <span className={followUp.atrasado ? classes.followUpAtrasado : ""}>
              {followUp.atrasado ? "Atrasado: " : "Proximo: "}
              {followUp.texto}
            </span>
          )}
          {aguardando && <span className={classes.aguardando}>{aguardando}</span>}
        </div>
      )}

      <div className={classes.rodape}>
        <span className={classes.valor}>{formatarValor(deal.value)}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {previsao && (
            <span
              className={`${classes.prazo} ${
                atrasado ? classes.prazoAtrasado : ""
              }`}
            >
              <EventOutlinedIcon style={{ fontSize: 13 }} />
              {format(previsao, "dd/MM", { locale: ptBR })}
            </span>
          )}

          {deal.responsibleUser && (
            <Tooltip title={deal.responsibleUser.name} arrow>
              <Avatar className={classes.avatar}>
                {iniciais(deal.responsibleUser.name)}
              </Avatar>
            </Tooltip>
          )}
        </div>
      </div>
    </Paper>
  );
};

export default DealCard;
