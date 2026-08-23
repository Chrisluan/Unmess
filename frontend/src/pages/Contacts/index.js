import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import makeStyles from '@mui/styles/makeStyles';
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import Avatar from "@mui/material/Avatar";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

import api from "../../services/api";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TableEmpty from "../../components/EmptyState/TableEmpty";
import SearchField from "../../components/SearchField";
import AddIcon from "@mui/icons-material/Add";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import ContactPhoneOutlinedIcon from "@mui/icons-material/ContactPhoneOutlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ContactModal from "../../components/ContactModal";
import ConfirmationModal from "../../components/ConfirmationModal/";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
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

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("contact", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleSaveTicket = async (contactId) => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user?.id,
        status: "open",
      });
      history.push(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const handleToggleKnown = async (contact) => {
    try {
      await api.put(`/contacts/${contact.id}/known`, {
        isKnown: !contact.isKnown,
      });
      // A lista se atualiza pelo evento de socket "contact"; aqui só o aviso.
      toast.success(
        i18n.t(
          contact.isKnown
            ? "contacts.known.toastUnset"
            : "contacts.known.toastSet"
        )
      );
    } catch (err) {
      toastError(err);
    }
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleimportContact = async () => {
    try {
      await api.post("/contacts/import");
      history.go(0);
    } catch (err) {
      toastError(err);
    }
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
    <MainContainer className={classes.mainContainer}>
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      ></ContactModal>
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${
                deletingContact.name
              }?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        danger={Boolean(deletingContact)}
        confirmLabel={
          deletingContact
            ? i18n.t("contacts.buttons.confirmDelete")
            : i18n.t("contacts.buttons.confirmImport")
        }
        onConfirm={() =>
          deletingContact
            ? handleDeleteContact(deletingContact.id)
            : handleimportContact()
        }
      >
        {deletingContact
          ? `${i18n.t("contacts.confirmationModal.deleteMessage")}`
          : `${i18n.t("contacts.confirmationModal.importMessage")}`}
      </ConfirmationModal>
      <MainHeader>
        <Title>{i18n.t("contacts.title")}</Title>
        <MainHeaderButtonsWrapper>
          <SearchField
            value={searchParam}
            onChange={handleSearch}
            onClear={() => setSearchParam("")}
            placeholder={i18n.t("contacts.searchPlaceholder")}
          />
          <Can permission="contacts:import">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<CloudDownloadOutlinedIcon />}
              onClick={() => setConfirmOpen(true)}
            >
              {i18n.t("contacts.buttons.import")}
            </Button>
          </Can>
          <Can permission="contacts:create">
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleOpenContactModal}
            >
              {i18n.t("contacts.buttons.add")}
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
              <TableCell padding="checkbox" />
              <TableCell>{i18n.t("contacts.table.name")}</TableCell>
              <TableCell align="center">
                {i18n.t("contacts.table.whatsapp")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("contacts.table.email")}
              </TableCell>
              <TableCell align="center">
                {i18n.t("contacts.table.actions")}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell style={{ paddingRight: 0 }}>
                    {<Avatar src={contact.profilePicUrl} />}
                  </TableCell>
                  <TableCell>
                    {contact.name}
                    {contact.isKnown && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={i18n.t("contacts.known.badge")}
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="center">{contact.number}</TableCell>
                  <TableCell align="center">{contact.email}</TableCell>
                  <TableCell align="center">
                    <Can permission="tickets:create">
                      <Tooltip title={i18n.t("contacts.actions.startChat")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("contacts.actions.startChat")}
                          onClick={() => handleSaveTicket(contact.id)}
                        >
                          <WhatsAppIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>
                    {/* Marcar como conhecido grava no contato: mesma
                        permissão de editá-lo. */}
                    <Can permission="contacts:edit">
                      <Tooltip
                        arrow
                        title={i18n.t(
                          contact.isKnown
                            ? "contacts.known.unset"
                            : "contacts.known.set"
                        )}
                      >
                        <IconButton
                          size="small"
                          aria-pressed={Boolean(contact.isKnown)}
                          onClick={() => handleToggleKnown(contact)}
                        >
                          {/* Marcado usa a cor de aviso, não a "secundária" —
                              que no tema atual é o mesmo cinza-escuro do ícone
                              desmarcado, deixando os dois estados idênticos. */}
                          {contact.isKnown ? (
                            <StarIcon color="warning" />
                          ) : (
                            <StarBorderIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Can>
                    <Can permission="contacts:edit">
                      <Tooltip title={i18n.t("contacts.actions.edit")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("contacts.actions.edit")}
                          onClick={() => hadleEditContact(contact.id)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>
                    <Can permission="contacts:delete">
                      <Tooltip title={i18n.t("contacts.actions.delete")} arrow>
                        <IconButton
                          size="small"
                          aria-label={i18n.t("contacts.actions.delete")}
                          onClick={() => {
                            setConfirmOpen(true);
                            setDeletingContact(contact);
                          }}
                        >
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Tooltip>
                    </Can>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && contacts.length === 0 && (
                <TableEmpty
                  colSpan={5}
                  icon={searchParam ? SearchOffIcon : ContactPhoneOutlinedIcon}
                  title={
                    searchParam
                      ? i18n.t("contacts.empty.searchTitle")
                      : i18n.t("contacts.empty.title")
                  }
                  description={
                    searchParam
                      ? i18n.t("contacts.empty.searchMessage")
                      : i18n.t("contacts.empty.message")
                  }
                  action={
                    !searchParam && (
                      <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={handleOpenContactModal}
                      >
                        {i18n.t("contacts.buttons.add")}
                      </Button>
                    )
                  }
                />
              )}
              {loading && <TableRowSkeleton avatar columns={3} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Contacts;
