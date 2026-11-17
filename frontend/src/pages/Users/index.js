import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";

import makeStyles from '@mui/styles/makeStyles';
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import Tooltip from "@mui/material/Tooltip";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TableEmpty from "../../components/EmptyState/TableEmpty";
import SearchField from "../../components/SearchField";
import AddIcon from "@mui/icons-material/Add";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import UserModal from "../../components/UserModal";
import UserAccessModal from "../../components/Access/UserAccessModal";
import { Can } from "../../components/Can";
import useAccessCatalog from "../../hooks/useAccessCatalog";
import SecurityIcon from "@mui/icons-material/Security";
import Typography from "@mui/material/Typography";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "UPDATE_PRESENCE") {
    const { userId, online } = action.payload;
    const userIndex = state.findIndex((u) => u.id === userId);

    if (userIndex !== -1) {
      state[userIndex] = { ...state[userIndex], online };
      return [...state];
    }
    return state;
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
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
  mainPaper: {
    flex: 1,
    margin: theme.spacing(0, 2, 2),
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

const Users = () => {
  const classes = useStyles();
  const catalogo = useAccessCatalog();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [permissoesDe, setPermissoesDe] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [users, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_USERS", payload: data.users });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("user", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    });

    // Presença em tempo real: o backend emite quando o atendente conecta
    // ou desconecta o último socket.
    socket.on("userPresence", (data) => {
      dispatch({ type: "UPDATE_PRESENCE", payload: data });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleOpenUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(true);
  };

  const handleCloseUserModal = () => {
    setSelectedUser(null);
    setUserModalOpen(false);
  };

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
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
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${
            deletingUser.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        danger
        confirmLabel={i18n.t("users.confirmDelete")}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>
      {permissoesDe && !catalogo.carregando && (
        <UserAccessModal
          open
          userId={permissoesDe.id}
          userName={permissoesDe.name}
          catalogo={catalogo}
          onClose={() => setPermissoesDe(null)}
          onSaved={() => setPageNumber(1)}
        />
      )}
      <UserModal
        open={userModalOpen}
        onClose={handleCloseUserModal}
        aria-labelledby="form-dialog-title"
        userId={selectedUser && selectedUser.id}
      />
      <MainHeader>
        <Title>{i18n.t("users.title")}</Title>
        <MainHeaderButtonsWrapper>
          <SearchField
            value={searchParam}
            onChange={handleSearch}
            onClear={() => setSearchParam("")}
            placeholder={i18n.t("users.searchPlaceholder")}
          />
          <Can permission="users:create">
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenUserModal}
            >
              {i18n.t("users.buttons.add")}
            </Button>
          </Can>
        </MainHeaderButtonsWrapper>
      </MainHeader>
      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center">
                {i18n.t("users.table.status")}
              </TableCell>
              <TableCell>{i18n.t("users.table.name")}</TableCell>
              <TableCell>{i18n.t("users.table.email")}</TableCell>
              {/* Duas colunas viraram uma. "Perfil" mostrava um valor que não
                  fazia nada, e "Perfil de acesso" mostrava o que de fato
                  valia — lado a lado, com nomes quase idênticos. */}
              <TableCell>{i18n.t("users.table.role")}</TableCell>
              <TableCell>{i18n.t("users.table.whatsapp")}</TableCell>
              <TableCell align="center">
                {i18n.t("users.table.maxSimultaneousTickets")}
              </TableCell>
              
              <TableCell align="center">
                {i18n.t("users.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell align="center">
                    <Tooltip
                      title={
                        user.online
                          ? i18n.t("users.table.online")
                          : i18n.t("users.table.offline")
                      }
                    >
                      <FiberManualRecordIcon
                        fontSize="small"
                        color={user.online ? "success" : "disabled"}
                        style={{ verticalAlign: "middle" }}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.role?.name || (
                      <Typography variant="caption" color="error">
                        {i18n.t("users.noRole")}
                      </Typography>
                    )}
                    {user.accessExceptions && (
                      <Tooltip
                        arrow
                        title={i18n.t("users.hasExceptionsHelp")}
                      >
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          style={{ marginLeft: 6 }}
                        >
                          {i18n.t("users.hasExceptions")}
                        </Typography>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell>{user.whatsapp?.name || "—"}</TableCell>
                  <TableCell align="center">
                    {user.maxSimultaneousTickets > 0 ? (
                      user.maxSimultaneousTickets
                    ) : (
                      <Tooltip title={i18n.t("users.unlimited")} arrow>
                        <span>∞</span>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {/* Cada ação pergunta pela própria permissão. A de acesso
                        não é mais desabilitada "porque a pessoa é admin" —
                        Administrador é um cargo, e trocá-lo é uma operação
                        legítima; quem barra é a regra do servidor, que não
                        deixa a empresa ficar sem administrador. */}
                    <Can permission="roles:assign">
                      <Tooltip title={i18n.t("users.actions.access")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("users.actions.access")}
                          onClick={() => setPermissoesDe(user)}
                        >
                          <SecurityIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>

                    <Can permission="users:edit">
                      <Tooltip title={i18n.t("users.actions.edit")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("users.actions.edit")}
                          onClick={() => handleEditUser(user)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>

                    <Can permission="users:delete">
                      <Tooltip title={i18n.t("users.actions.delete")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("users.actions.delete")}
                          onClick={() => {
                            setConfirmModalOpen(true);
                            setDeletingUser(user);
                          }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableEmpty
                  colSpan={7}
                  icon={searchParam ? SearchOffIcon : PeopleAltOutlinedIcon}
                  title={
                    searchParam
                      ? i18n.t("users.empty.searchTitle")
                      : i18n.t("users.empty.title")
                  }
                  description={
                    searchParam
                      ? i18n.t("users.empty.searchMessage")
                      : i18n.t("users.empty.message")
                  }
                  action={
                    !searchParam && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenUserModal}
                      >
                        {i18n.t("users.buttons.add")}
                      </Button>
                    )
                  }
                />
              )}
              {loading && <TableRowSkeleton columns={7} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Users;
