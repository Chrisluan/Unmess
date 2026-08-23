import React, { useState, useEffect, useCallback } from "react";
import { Link as RouterLink } from "react-router-dom";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import NotesIcon from "@mui/icons-material/Notes";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CancelIcon from "@mui/icons-material/Cancel";
import FiberNewIcon from "@mui/icons-material/FiberNew";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { Can } from "../Can";
import ConfirmationModal from "../ConfirmationModal";
import { formatarValor, paraData, estaAtrasado } from "../Crm/formatters";

const useStyles = makeStyles((theme) => ({
  painel: {
    width: 420,
    maxWidth: "100vw",
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },

  cabecalho: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(2, 2, 1),
  },

  titulo: {
    fontWeight: 700,
    lineHeight: 1.25,
    wordBreak: "break-word",
  },

  corpo: {
    flex: 1,
    overflowY: "auto",
    padding: theme.spacing(0, 2, 2),
    ...theme.scrollbarStyles,
  },

  valor: {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: theme.palette.success.main,
  },

  grade: {
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: theme.spacing(0.75, 1.5),
    margin: theme.spacing(1.5, 0),
  },

  rotulo: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },

  dado: {
    fontSize: "0.8rem",
    fontWeight: 500,
    wordBreak: "break-word",
  },

  atrasado: {
    color: theme.palette.error.main,
    fontWeight: 700,
  },

  secao: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: theme.palette.text.disabled,
    margin: theme.spacing(2, 0, 1),
  },

  ticket: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1),
    borderRadius: 0,
    textDecoration: "none",
    color: "inherit",
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.03)",
    marginBottom: theme.spacing(0.5),
    "&:hover": {
      backgroundColor:
        theme.palette.mode === "dark"
          ? "rgba(255,255,255,0.08)"
          : "rgba(0,0,0,0.06)",
    },
  },

  ticketTexto: {
    flex: 1,
    minWidth: 0,
    fontSize: "0.78rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  formAtividade: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },

  acoesAtividade: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
  },

  item: {
    display: "flex",
    gap: theme.spacing(1),
    padding: theme.spacing(1, 0),
  },

  icone: {
    marginTop: 2,
    color: theme.palette.text.secondary,
  },

  itemCorpo: {
    flex: 1,
    minWidth: 0,
  },

  // Etiqueta da categoria: contorno em vez de fundo cheio, para não competir
  // com o texto da tarefa, que é o que se lê.
  categoria: {
    display: "inline-block",
    marginRight: 6,
    padding: "0 5px",
    border: "1px solid",
    borderRadius: 0,
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    verticalAlign: "1px",
  },
  itemTexto: {
    fontSize: "0.82rem",
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },

  concluida: {
    textDecoration: "line-through",
    color: theme.palette.text.disabled,
  },

  meta: {
    fontSize: "0.7rem",
    color: theme.palette.text.disabled,
  },

  centralizado: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(4),
  },
}));

const ICONES_ATIVIDADE = {
  note: NotesIcon,
  task: TaskAltIcon,
  stage_change: SwapHorizIcon,
  created: FiberNewIcon,
  won: EmojiEventsIcon,
  lost: CancelIcon,
};

const CORES_STATUS = {
  open: "default",
  won: "success",
  lost: "error",
};

/**
 * Painel lateral com a ficha do negócio: dados, conversas vinculadas e a
 * linha do tempo com notas, tarefas e o rastro automático das mudanças.
 */
const DealDetailsDrawer = ({ dealId, open, onClose, onEdit, onDelete }) => {
  const classes = useStyles();

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [texto, setTexto] = useState("");
  const [tarefa, setTarefa] = useState(false);
  const [vencimento, setVencimento] = useState("");
  const [tipoTarefa, setTipoTarefa] = useState("contato");
  const [tiposDeTarefa, setTiposDeTarefa] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const fetchDeal = useCallback(async () => {
    if (!dealId) return;

    setLoading(true);
    try {
      const { data } = await api.get(`/deals/${dealId}`);
      setDeal(data);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    if (open) {
      fetchDeal();
      setTexto("");
      setTarefa(false);
      setVencimento("");
    } else {
      setDeal(null);
    }
  }, [open, fetchDeal]);

  // O catálogo vem do backend, que é quem recusa tipo inválido: manter uma
  // segunda lista aqui garantiria que um dia as duas divergissem.
  useEffect(() => {
    let ativo = true;
    api
      .get("/tipos-de-tarefa")
      .then(({ data }) => ativo && setTiposDeTarefa(data.tipos || []))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const handleAdicionarAtividade = async () => {
    if (!texto.trim()) return;

    setSalvando(true);
    try {
      await api.post(`/deals/${dealId}/activities`, {
        type: tarefa ? "task" : "note",
        body: texto.trim(),
        dueAt: tarefa && vencimento ? vencimento : null,
        taskKind: tarefa ? tipoTarefa : null,
      });
      setTexto("");
      setVencimento("");
      await fetchDeal();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarTarefa = async (activity) => {
    try {
      await api.put(`/deal-activities/${activity.id}`, {
        done: !activity.doneAt,
      });
      await fetchDeal();
    } catch (err) {
      toastError(err);
    }
  };

  const handleExcluirAtividade = async (activityId) => {
    try {
      await api.delete(`/deal-activities/${activityId}`);
      toast.success(i18n.t("crm.toasts.activityDeleted"));
      await fetchDeal();
    } catch (err) {
      toastError(err);
    }
  };

  const renderAtividade = (activity) => {
    const Icone = ICONES_ATIVIDADE[activity.type] || NotesIcon;
    const editavel = ["note", "task"].includes(activity.type);
    const concluida = Boolean(activity.doneAt);
    const vence = paraData(activity.dueAt);
    const criada = paraData(activity.createdAt);
    // A categoria distingue "ligar para o cliente" de "imprimir o banner" numa
    // lista onde as duas seriam só texto.
    const categoria = activity.taskKind
      ? tiposDeTarefa.find((t) => t.id === activity.taskKind)
      : null;

    return (
      <div key={activity.id} className={classes.item}>
        {activity.type === "task" ? (
          <Checkbox
            size="small"
            checked={concluida}
            onChange={() => handleAlternarTarefa(activity)}
            style={{ padding: 0, marginTop: 2 }}
          />
        ) : (
          <Icone fontSize="small" className={classes.icone} />
        )}

        <div className={classes.itemCorpo}>
          <div
            className={`${classes.itemTexto} ${concluida ? classes.concluida : ""}`}
          >
            {categoria && (
              <span
                className={classes.categoria}
                style={{ color: categoria.cor, borderColor: categoria.cor }}
              >
                {categoria.label}
              </span>
            )}
            {activity.type === "stage_change" || activity.type === "created"
              ? i18n.t(`crm.activity.${activity.type}`, { body: activity.body })
              : activity.body}
          </div>

          <div className={classes.meta}>
            {criada && format(criada, "dd/MM/yyyy HH:mm", { locale: ptBR })}
            {activity.user ? ` · ${activity.user.name}` : ""}
            {vence
              ? ` · ${i18n.t("crm.activity.dueAt")} ${format(vence, "dd/MM/yyyy", {
                  locale: ptBR,
                })}`
              : ""}
          </div>
        </div>

        {editavel && (
          <Can permission="crm:edit">
            <IconButton
              size="small"
              onClick={() => handleExcluirAtividade(activity.id)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Can>
        )}
      </div>
    );
  };

  const previsao = paraData(deal?.expectedCloseAt);
  const atrasado = deal && estaAtrasado(deal.expectedCloseAt, deal.status);

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <ConfirmationModal
        title={i18n.t("crm.confirmationModal.deleteTitle")}
        open={confirmarExclusao}
        onClose={setConfirmarExclusao}
        danger
        confirmLabel="Excluir oportunidade"
        onConfirm={() => onDelete(dealId)}
      >
        {i18n.t("crm.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <div className={classes.painel}>
        {loading || !deal ? (
          <div className={classes.centralizado}>
            <CircularProgress />
          </div>
        ) : (
          <>
            <div className={classes.cabecalho}>
              <div style={{ minWidth: 0 }}>
                <Typography className={classes.titulo}>{deal.title}</Typography>
                <Chip
                  size="small"
                  label={deal.stage?.name}
                  style={{
                    backgroundColor: deal.stage?.color,
                    color: "#fff",
                    marginTop: 6,
                  }}
                />
                {deal.status !== "open" && (
                  <Chip
                    size="small"
                    color={CORES_STATUS[deal.status]}
                    label={i18n.t(`crm.status.${deal.status}`)}
                    style={{ marginTop: 6, marginLeft: 6 }}
                  />
                )}
              </div>

              <div style={{ display: "flex" }}>
                <Can permission="crm:edit">
                  <Tooltip title={i18n.t("crm.buttons.edit")} arrow>
                    <IconButton size="small" onClick={() => onEdit(deal.id)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Can>
                <Can permission="crm:delete">
                  <Tooltip title={i18n.t("crm.buttons.delete")} arrow>
                    <IconButton
                      size="small"
                      onClick={() => setConfirmarExclusao(true)}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Can>
                <IconButton size="small" onClick={onClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </div>
            </div>

            <Divider />

            <div className={classes.corpo}>
              <Typography className={classes.valor} style={{ marginTop: 12 }}>
                {formatarValor(deal.value)}
              </Typography>

              <div className={classes.grade}>
                <span className={classes.rotulo}>
                  {i18n.t("crm.dealModal.form.customer")}
                </span>
                <span className={classes.dado}>
                  {deal.customer?.tradeName ||
                    deal.customer?.name ||
                    deal.contact?.name ||
                    "—"}
                </span>

                <span className={classes.rotulo}>
                  {i18n.t("crm.dealModal.form.responsible")}
                </span>
                <span className={classes.dado}>
                  {deal.responsibleUser?.name || "—"}
                </span>

                <span className={classes.rotulo}>
                  {i18n.t("crm.dealModal.form.expectedCloseAt")}
                </span>
                <span
                  className={`${classes.dado} ${atrasado ? classes.atrasado : ""}`}
                >
                  {previsao
                    ? format(previsao, "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </span>

                {deal.status === "lost" && deal.lostReason && (
                  <>
                    <span className={classes.rotulo}>
                      {i18n.t("crm.lostModal.reason")}
                    </span>
                    <span className={classes.dado}>{deal.lostReason}</span>
                  </>
                )}
              </div>

              {deal.notes && (
                <>
                  <div className={classes.secao}>
                    {i18n.t("crm.dealModal.form.notes")}
                  </div>
                  <Typography className={classes.itemTexto}>
                    {deal.notes}
                  </Typography>
                </>
              )}

              {deal.tickets?.length > 0 && (
                <>
                  <div className={classes.secao}>
                    {i18n.t("crm.details.tickets")}
                  </div>
                  {deal.tickets.map((ticket) => (
                    <RouterLink
                      key={ticket.id}
                      to={`/tickets/${ticket.id}`}
                      className={classes.ticket}
                      onClick={onClose}
                    >
                      <WhatsAppIcon fontSize="small" style={{ color: "#25D366" }} />
                      <span className={classes.ticketTexto}>
                        {ticket.protocol
                          ? `#${ticket.protocol}`
                          : `#${ticket.id}`}
                        {ticket.lastMessage ? ` · ${ticket.lastMessage}` : ""}
                      </span>
                    </RouterLink>
                  ))}
                </>
              )}

              <div className={classes.secao}>
                {i18n.t("crm.details.timeline")}
              </div>

              <Can permission="crm:edit">
                <div className={classes.formAtividade}>
                  <TextField
                    multiline
                    rows={2}
                    size="small"
                    variant="outlined"
                    placeholder={
                      tarefa
                        ? i18n.t("crm.details.taskPlaceholder")
                        : i18n.t("crm.details.notePlaceholder")
                    }
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                  />

                  <div className={classes.acoesAtividade}>
                    <Button
                      size="small"
                      variant={tarefa ? "contained" : "outlined"}
                      color="primary"
                      onClick={() => setTarefa((atual) => !atual)}
                    >
                      {i18n.t("crm.details.asTask")}
                    </Button>

                    {tarefa && tiposDeTarefa.length > 0 && (
                      <TextField
                        select
                        size="small"
                        variant="outlined"
                        label="Tipo"
                        value={tipoTarefa}
                        onChange={(e) => setTipoTarefa(e.target.value)}
                        SelectProps={{ native: true }}
                        InputLabelProps={{ shrink: true }}
                        style={{ minWidth: 150 }}
                      >
                        {tiposDeTarefa.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </TextField>
                    )}

                    {tarefa && (
                      <TextField
                        type="date"
                        size="small"
                        variant="outlined"
                        InputLabelProps={{ shrink: true }}
                        label={i18n.t("crm.activity.dueAt")}
                        value={vencimento}
                        onChange={(e) => setVencimento(e.target.value)}
                      />
                    )}

                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      style={{ marginLeft: "auto" }}
                      disabled={salvando || !texto.trim()}
                      onClick={handleAdicionarAtividade}
                    >
                      {i18n.t("crm.buttons.add")}
                    </Button>
                  </div>
                </div>
              </Can>

              {deal.activities?.length > 0 ? (
                deal.activities.map(renderAtividade)
              ) : (
                <Typography variant="caption" color="textSecondary">
                  {i18n.t("crm.details.emptyTimeline")}
                </Typography>
              )}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};

export default DealDetailsDrawer;
