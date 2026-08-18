import React from "react";

import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";

import { i18n } from "../../../translate/i18n";
import { Can } from "../../Can";
import DealCard from "../DealCard";
import { formatarValorCurto } from "../formatters";

const useStyles = makeStyles((theme) => ({
  coluna: {
    display: "flex",
    flexDirection: "column",
    flex: "0 0 280px",
    maxHeight: "100%",
    borderRadius: 8,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.03)"
        : "rgba(0,0,0,0.03)",
  },

  // Realce enquanto um card sobrevoa a coluna, para o destino ficar óbvio.
  colunaAtiva: {
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(37,118,210,0.14)"
        : "rgba(37,118,210,0.08)",
  },

  cabecalho: {
    padding: theme.spacing(1, 1.25),
    borderTop: "3px solid",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },

  linhaTitulo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(0.5),
  },

  nome: {
    flex: 1,
    fontWeight: 700,
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  marca: {
    fontSize: 15,
    color: theme.palette.text.disabled,
    flexShrink: 0,
  },

  totais: {
    display: "flex",
    alignItems: "baseline",
    gap: theme.spacing(0.75),
    marginTop: 2,
  },

  valorTotal: {
    fontWeight: 700,
    fontSize: "0.8rem",
  },

  lista: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75),
    overflowY: "auto",
    flex: 1,
    minHeight: 80,
    ...theme.scrollbarStyles,
  },

  // Linha fina que mostra onde o card vai cair.
  marcador: {
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.palette.primary.main,
    margin: theme.spacing(0.25, 0),
  },

  vazio: {
    padding: theme.spacing(2, 1),
    textAlign: "center",
    fontSize: "0.75rem",
    color: theme.palette.text.disabled,
  },
}));

/**
 * Coluna do Kanban: cabeçalho com totais e a pilha de cards.
 *
 * O índice de soltura é calculado pela metade do card sobrevoado — acima da
 * metade insere antes, abaixo insere depois. É o que faz o marcador cair onde
 * a pessoa espera em vez de sempre no fim da coluna.
 */
const KanbanColumn = ({
  stage,
  deals,
  dragging,
  dropTarget,
  podeMover,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDrop,
  onCardClick,
  onAddDeal,
}) => {
  const classes = useStyles();

  const total = deals.reduce((acc, deal) => acc + (Number(deal.value) || 0), 0);
  const arrastandoAqui = dropTarget?.stageId === stage.id;

  const handleDragOverCard = (event, indice) => {
    if (!dragging || !podeMover) return;
    event.preventDefault();
    event.stopPropagation();

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const metadeDeBaixo = event.clientY - top > height / 2;

    onDragOverCard({ stageId: stage.id, index: metadeDeBaixo ? indice + 1 : indice });
  };

  // Sobrevoar o espaço vazio abaixo dos cards enfileira no fim.
  const handleDragOverColuna = (event) => {
    if (!dragging || !podeMover) return;
    event.preventDefault();
    onDragOverCard({ stageId: stage.id, index: deals.length });
  };

  const handleDrop = (event) => {
    if (!dragging || !podeMover) return;
    event.preventDefault();
    onDrop(stage.id, arrastandoAqui ? dropTarget.index : deals.length);
  };

  return (
    <div
      className={`${classes.coluna} ${arrastandoAqui ? classes.colunaAtiva : ""}`}
      onDragOver={handleDragOverColuna}
      onDrop={handleDrop}
    >
      <div
        className={classes.cabecalho}
        style={{ borderTopColor: stage.color || "#2576d2" }}
      >
        <div className={classes.linhaTitulo}>
          {/* Entrada e saída marcadas no próprio cabeçalho: sem isso não dá
              para saber, olhando o board, qual coluna faz o card mudar de
              quadro — e a surpresa só apareceria ao arrastar. */}
          {stage.isInitial && (
            <Tooltip title={i18n.t("crm.stagesModal.initialHelp")} arrow>
              <LoginIcon className={classes.marca} />
            </Tooltip>
          )}
          {stage.isFinal && (
            <Tooltip title={i18n.t("crm.stagesModal.finalHelp")} arrow>
              <LogoutIcon className={classes.marca} />
            </Tooltip>
          )}
          <Tooltip title={stage.name} arrow>
            <Typography className={classes.nome}>{stage.name}</Typography>
          </Tooltip>
          <Can permission="crm:create">
            <Tooltip title={i18n.t("crm.buttons.addDeal")} arrow>
              <IconButton size="small" onClick={onAddDeal}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Can>
        </div>
        <div className={classes.totais}>
          <span className={classes.valorTotal}>
            {formatarValorCurto(total)}
          </span>
          <Typography variant="caption" color="textSecondary">
            {i18n.t("crm.summary.deals", { count: deals.length })}
          </Typography>
        </div>
      </div>

      <div className={classes.lista}>
        {deals.length === 0 && !arrastandoAqui && (
          <div className={classes.vazio}>{i18n.t("crm.emptyStage")}</div>
        )}

        {deals.map((deal, indice) => (
          <React.Fragment key={deal.id}>
            {arrastandoAqui && dropTarget.index === indice && (
              <div className={classes.marcador} />
            )}
            <div onDragOver={(e) => handleDragOverCard(e, indice)}>
              <DealCard
                deal={deal}
                arrastavel={podeMover}
                arrastando={dragging?.deal?.id === deal.id}
                onDragStart={() => onDragStart(deal, indice)}
                onDragEnd={onDragEnd}
                onClick={() => onCardClick(deal.id)}
              />
            </div>
          </React.Fragment>
        ))}

        {arrastandoAqui && dropTarget.index >= deals.length && (
          <div className={classes.marcador} />
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
