import React, { useState, useEffect, useReducer } from "react";
import openSocket from "../../services/socket-io";

import {
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import { Edit, DeleteOutline } from "@mui/icons-material";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { Can } from "../../components/Can";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TableEmpty from "../../components/EmptyState/TableEmpty";
import SearchField from "../../components/SearchField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import QuestionAnswerOutlinedIcon from "@mui/icons-material/QuestionAnswerOutlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import QuickAnswersModal from "../../components/QuickAnswersModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";

const reducer = (state, action) => {
  if (action.type === "LOAD_QUICK_ANSWERS") {
    const quickAnswers = action.payload;
    const newQuickAnswers = [];

    quickAnswers.forEach((quickAnswer) => {
      const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswer.id);
      if (quickAnswerIndex !== -1) {
        state[quickAnswerIndex] = quickAnswer;
      } else {
        newQuickAnswers.push(quickAnswer);
      }
    });

    return [...state, ...newQuickAnswers];
  }

  if (action.type === "UPDATE_QUICK_ANSWERS") {
    const quickAnswer = action.payload;
    const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswer.id);

    if (quickAnswerIndex !== -1) {
      state[quickAnswerIndex] = quickAnswer;
      return [...state];
    } else {
      return [quickAnswer, ...state];
    }
  }

  if (action.type === "DELETE_QUICK_ANSWERS") {
    const quickAnswerId = action.payload;

    const quickAnswerIndex = state.findIndex((q) => q.id === quickAnswerId);
    if (quickAnswerIndex !== -1) {
      state.splice(quickAnswerIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

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

  // Monoespaçado: o atalho é algo que se digita literalmente, e a fonte de
  // texto corrido não distingue l de I nem 0 de O.
  atalho: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  mensagem: {
    maxWidth: 620,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
}));

const QuickAnswers = () => {
  const classes = useStyles();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [quickAnswers, dispatch] = useReducer(reducer, []);
  const [selectedQuickAnswers, setSelectedQuickAnswers] = useState(null);
  const [quickAnswersModalOpen, setQuickAnswersModalOpen] = useState(false);
  const [deletingQuickAnswers, setDeletingQuickAnswers] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchQuickAnswers = async () => {
        try {
          const { data } = await api.get("/quick-answers", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_QUICK_ANSWERS", payload: data.quickAnswers });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchQuickAnswers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("quickAnswer", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_QUICK_ANSWERS", payload: data.quickAnswer });
      }

      if (data.action === "delete") {
        dispatch({
          type: "DELETE_QUICK_ANSWERS",
          payload: +data.quickAnswerId,
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(true);
  };

  const handleCloseQuickAnswersModal = () => {
    setSelectedQuickAnswers(null);
    setQuickAnswersModalOpen(false);
  };

  const handleEditQuickAnswers = (quickAnswer) => {
    setSelectedQuickAnswers(quickAnswer);
    setQuickAnswersModalOpen(true);
  };

  const handleDeleteQuickAnswers = async (quickAnswerId) => {
    try {
      await api.delete(`/quick-answers/${quickAnswerId}`);
      toast.success(i18n.t("quickAnswers.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingQuickAnswers(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingQuickAnswers &&
          `${i18n.t("quickAnswers.confirmationModal.deleteTitle")} ${
            deletingQuickAnswers.shortcut
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        danger
        confirmLabel={i18n.t("quickAnswers.confirmDelete")}
        onConfirm={() => handleDeleteQuickAnswers(deletingQuickAnswers.id)}
      >
        {i18n.t("quickAnswers.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      <QuickAnswersModal
        open={quickAnswersModalOpen}
        onClose={handleCloseQuickAnswersModal}
        aria-labelledby="form-dialog-title"
        quickAnswerId={selectedQuickAnswers && selectedQuickAnswers.id}
      ></QuickAnswersModal>
      <MainHeader>
        <Title>{i18n.t("quickAnswers.title")}</Title>
        <MainHeaderButtonsWrapper>
          <SearchField
            value={searchParam}
            onChange={handleSearch}
            onClear={() => setSearchParam("")}
            placeholder={i18n.t("quickAnswers.searchPlaceholderLong")}
          />
          <Can permission="quickAnswers:create">
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenQuickAnswersModal}
            >
              {i18n.t("quickAnswers.buttons.add")}
            </Button>
          </Can>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {/* O "/" da conversa é o que faz esta tela existir, e nada dizia isso. */}
      <Typography variant="body2" color="textSecondary" className={classes.descricao}>
        {i18n.t("quickAnswers.description")}
      </Typography>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{i18n.t("quickAnswers.table.shortcut")}</TableCell>
              <TableCell>{i18n.t("quickAnswers.table.message")}</TableCell>
              <TableCell align="center">
                {i18n.t("quickAnswers.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {quickAnswers.map((quickAnswer) => (
                <TableRow key={quickAnswer.id}>
                  <TableCell className={classes.atalho}>
                    /{quickAnswer.shortcut}
                  </TableCell>
                  <TableCell className={classes.mensagem}>
                    {quickAnswer.message}
                  </TableCell>
                  <TableCell align="center">
                    <Can permission="quickAnswers:edit">
                      <Tooltip title={i18n.t("quickAnswers.actions.edit")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("quickAnswers.actions.edit")}
                          onClick={() => handleEditQuickAnswers(quickAnswer)}
                        >
                          <Edit />
                        </IconButton>
                      </Tooltip>
                    </Can>

                    <Can permission="quickAnswers:delete">
                      <Tooltip title={i18n.t("quickAnswers.actions.delete")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("quickAnswers.actions.delete")}
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingQuickAnswers(quickAnswer);
                          }}
                        >
                          <DeleteOutline />
                        </IconButton>
                      </Tooltip>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && quickAnswers.length === 0 && (
                <TableEmpty
                  colSpan={3}
                  icon={searchParam ? SearchOffIcon : QuestionAnswerOutlinedIcon}
                  title={
                    searchParam
                      ? i18n.t("quickAnswers.empty.searchTitle")
                      : i18n.t("quickAnswers.empty.title")
                  }
                  description={
                    searchParam
                      ? i18n.t("quickAnswers.empty.searchMessage")
                      : i18n.t("quickAnswers.empty.message")
                  }
                  action={
                    !searchParam && (
                      <Can permission="quickAnswers:create">
                        <Button
                          variant="contained"
                          color="primary"
                          startIcon={<AddIcon />}
                          onClick={handleOpenQuickAnswersModal}
                        >
                          {i18n.t("quickAnswers.buttons.add")}
                        </Button>
                      </Can>
                    )
                  }
                />
              )}
              {loading && <TableRowSkeleton columns={3} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default QuickAnswers;
