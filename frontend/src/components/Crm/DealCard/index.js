import React from "react";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

import {
  formatarValor,
  formatarTelefone,
  paraData,
  estaAtrasado,
} from "../formatters";
import { clienteDoNegocio, identidadeDoNegocio } from "../identidade";
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
    position: "relative",
    padding: theme.spacing(1.25),
    // O botão de excluir só aparece ao passar o mouse (ou ao focar pelo
    // teclado): fixo em todo card, viraria uma coluna de lixeiras.
    "&:hover $excluir, &:focus-within $excluir": { opacity: 1 },
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

  excluir: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 1,
    padding: 4,
    opacity: 0,
    transition: "opacity 120ms",
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    "&:hover": {
      color: theme.palette.error.main,
      background: theme.palette.background.paper,
    },
    // Na tela de toque não existe "passar o mouse".
    "@media (hover: none)": { opacity: 1 },
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

  /**
   * Quem é o cliente, logo abaixo do título.
   *
   * Era um texto secundário miúdo, do tamanho de uma legenda. Num quadro com
   * dezenas de cards, "Camiseta 20un" não diz de quem é o trabalho, e o nome
   * é a segunda coisa que se procura depois do número — merece o mesmo peso
   * visual do resto da linha, não menos.
   */
  cliente: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    minWidth: 0,
  },

  fotoCliente: {
    width: 18,
    height: 18,
    fontSize: "0.6rem",
    flexShrink: 0,
  },

  nomeCliente: {
    fontSize: "0.78rem",
    fontWeight: 600,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },

  // O telefone identifica o card quando o nome não basta: dois "João" no
  // quadro, ou um contato que ainda não virou cadastro.
  telefoneCliente: {
    fontSize: "0.7rem",
    color: theme.palette.text.secondary,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },

  // Card que ninguém consegue identificar. Dito na cara, e não por omissão:
  // uma linha em branco parece defeito da tela, não falta de cadastro.
  semCliente: {
    fontSize: "0.72rem",
    fontStyle: "italic",
    color: theme.palette.text.disabled,
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
  onExcluir,
}) => {
  const classes = useStyles();

  const atrasado = estaAtrasado(deal.expectedCloseAt, deal.status);
  const previsao = paraData(deal.expectedCloseAt);
  const cliente = clienteDoNegocio(deal);
  const telefone = formatarTelefone(cliente.telefone);
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
      {onExcluir && (
        <Tooltip title="Excluir card" arrow>
          <IconButton
            size="small"
            className={classes.excluir}
            aria-label={`Excluir ${deal.title}`}
            draggable={false}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onExcluir();
            }}
          >
            <DeleteOutlineIcon style={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      )}

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

      {/* Sem isto, saber de quem é o card exigia abri-lo. */}
      <div className={classes.cliente}>
        {cliente.semCliente ? (
          <span className={classes.semCliente}>Sem cliente vinculado</span>
        ) : (
          <>
            <Avatar
              className={classes.fotoCliente}
              src={cliente.fotoUrl || undefined}
              alt={cliente.nome || telefone}
            >
              {iniciais(cliente.nome || telefone)}
            </Avatar>

            {cliente.nome ? (
              <>
                <span className={classes.nomeCliente} title={cliente.nome}>
                  {cliente.nome}
                </span>
                {/* O telefone entra ao lado do nome; sem nome ele já é a
                    identificação principal e aparece sozinho. */}
                {telefone && (
                  <span className={classes.telefoneCliente}>{telefone}</span>
                )}
              </>
            ) : (
              <span className={classes.nomeCliente}>{telefone}</span>
            )}
          </>
        )}
      </div>

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
