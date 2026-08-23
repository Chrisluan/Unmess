import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
  Button,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import makeStyles from '@mui/styles/makeStyles';

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TableEmpty from "../../components/EmptyState/TableEmpty";
import AddIcon from "@mui/icons-material/Add";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";
import Title from "../../components/Title";
import { Can } from "../../components/Can";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@mui/icons-material";
import QueueModal from "../../components/QueueModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles((theme) => ({
  /**
   * Painel de conteúdo das telas de listagem.
   *
   * Ganhou borda e margem: o Paper deixou de ter sombra no tema novo, e sem
   * nenhuma das duas a tabela ficava solta no meio da página, encostada nas
   * bordas da janela sem nada dizendo onde ela começa.
   */
  descricao: {
    padding: theme.spacing(1.5, 2, 0),
    maxWidth: 720,
  },

  mainPaper: {
    flex: 1,
    margin: theme.spacing(1.5, 2, 2),
    padding: theme.spacing(0.5),
    // "auto" e não "scroll": a barra vazia desenhava uma faixa cinza fixa na
    // direita de toda listagem, inclusive nas que cabem na tela.
    overflowY: "auto",
    // Sem isto a tabela larga estoura o painel e rola a página inteira.
    overflowX: "auto",
    border: `1px solid ${theme.palette.divider}`,
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_QUEUES") {
    const queues = action.payload;
    const newQueues = [];

    queues.forEach((queue) => {
      const queueIndex = state.findIndex((q) => q.id === queue.id);
      if (queueIndex !== -1) {
        state[queueIndex] = queue;
      } else {
        newQueues.push(queue);
      }
    });

    return [...state, ...newQueues];
  }

  if (action.type === "UPDATE_QUEUES") {
    const queue = action.payload;
    const queueIndex = state.findIndex((u) => u.id === queue.id);

    if (queueIndex !== -1) {
      state[queueIndex] = queue;
      return [...state];
    } else {
      return [queue, ...state];
    }
  }

  if (action.type === "DELETE_QUEUE") {
    const queueId = action.payload;
    const queueIndex = state.findIndex((q) => q.id === queueId);
    if (queueIndex !== -1) {
      state.splice(queueIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const Queues = () => {
  const classes = useStyles();

  const [queues, dispatch] = useReducer(reducer, []);
  const [loading, setLoading] = useState(false);

  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/queue");
        dispatch({ type: "LOAD_QUEUES", payload: data });

        setLoading(false);
      } catch (err) {
        toastError(err);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const socket = openSocket();

    socket.on("queue", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUEUES", payload: data.queue });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_QUEUE", payload: data.queueId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenQueueModal = () => {
    setQueueModalOpen(true);
    setSelectedQueue(null);
  };

  const handleCloseQueueModal = () => {
    setQueueModalOpen(false);
    setSelectedQueue(null);
  };

  const handleEditQueue = (queue) => {
    setSelectedQueue(queue);
    setQueueModalOpen(true);
  };

  const handleCloseConfirmationModal = () => {
    setConfirmModalOpen(false);
    setSelectedQueue(null);
  };

  const handleDeleteQueue = async (queueId) => {
    try {
      await api.delete(`/queue/${queueId}`);
      toast.success(i18n.t("queues.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setSelectedQueue(null);
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          selectedQueue &&
          `${i18n.t("queues.confirmationModal.deleteTitle")} ${
            selectedQueue.name
          }?`
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmationModal}
        danger
        confirmLabel={i18n.t("queues.confirmDelete")}
        onConfirm={() => handleDeleteQueue(selectedQueue.id)}
      >
        {i18n.t("queues.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QueueModal
        open={queueModalOpen}
        onClose={handleCloseQueueModal}
        queueId={selectedQueue?.id}
      />
      <MainHeader>
        <Title>{i18n.t("queues.title")}</Title>
        <MainHeaderButtonsWrapper>
          <Can permission="queues:create">
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenQueueModal}
            >
              {i18n.t("queues.buttons.add")}
            </Button>
          </Can>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {/* Uma linha dizendo para que serve a tela. "Setores" sozinho não conta
          o que um setor faz com a conversa que chega. */}
      <Typography variant="body2" color="textSecondary" className={classes.descricao}>
        {i18n.t("queues.description")}
      </Typography>
      <Paper className={classes.mainPaper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("queues.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.color")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.greeting")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.isDefault")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("queues.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {queues.map((queue) => (
                <TableRow key={queue.id}>
                  <TableCell>{queue.name}</TableCell>
                  <TableCell align="center">
                    <div className={classes.customTableCell}>
                      <span
                        style={{
                          backgroundColor: queue.color,
                          width: 60,
                          height: 20,
                          alignSelf: "center",
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell align="center">
                    <div className={classes.customTableCell}>
                      <Typography
                        style={{ width: 300, align: "center" }}
                        noWrap
                        variant="body2"
                      >
                        {queue.greetingMessage}
                      </Typography>
                    </div>
                  </TableCell>
                  <TableCell align="center">
                    {queue.isDefault && (
                      <Chip
                        size="small"
                        color="primary"
                        label={i18n.t("queues.table.isDefault")}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Can permission="queues:edit">
                      <Tooltip title={i18n.t("queues.actions.edit")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("queues.actions.edit")}
                          onClick={() => handleEditQueue(queue)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    </Can>

                    <Can permission="queues:delete">
                      <Tooltip title={i18n.t("queues.actions.delete")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("queues.actions.delete")}
                          onClick={() => {
                            setSelectedQueue(queue);
                            setConfirmModalOpen(true);
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </Tooltip>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && queues.length === 0 && (
                <TableEmpty
                  colSpan={5}
                  icon={AccountTreeOutlinedIcon}
                  title={i18n.t("queues.empty.title")}
                  description={i18n.t("queues.empty.message")}
                  action={
                    <Can permission="queues:create">
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenQueueModal}
                      >
                        {i18n.t("queues.buttons.add")}
                      </Button>
                    </Can>
                  }
                />
              )}
              {loading && <TableRowSkeleton columns={4} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Queues;
