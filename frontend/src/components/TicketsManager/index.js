import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import makeStyles from "@mui/styles/makeStyles";
import InputBase from "@mui/material/InputBase";
import Badge from "@mui/material/Badge";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Popover from "@mui/material/Popover";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import TuneIcon from "@mui/icons-material/Tune";
import CloseIcon from "@mui/icons-material/Close";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";
import usePermissions from "../../hooks/usePermissions";
import TicketsQueueSelect from "../TicketsQueueSelect";
import TicketsWhatsappSelect from "../TicketsWhatsappSelect";
import TicketsTagSelect from "../TicketsTagSelect";
import TicketsUserSelect from "../TicketsUserSelect";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { ticketDate } from "../../helpers/messageDate";
import { formatWaitingTime } from "../../helpers/waitingTime";

const ABAS_PRINCIPAIS = [
  { valor: "myTickets", rotulo: "Minhas" },
  { valor: "waiting", rotulo: "Na fila" },
  { valor: "attending", rotulo: "Equipe" },
];

const ABAS_EXTRAS = [
  { valor: "known", rotulo: "Conhecidos", descricao: "Pessoas conhecidas, sem fila" },
  { valor: "groups", rotulo: "Grupos", descricao: "Conversas em grupo" },
  { valor: "closed", rotulo: "Resolvidas", descricao: "Conversas já encerradas" },
];

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    root: {
      position: "relative",
      display: "flex",
      height: "100%",
      flexDirection: "column",
      overflow: "hidden",
      backgroundColor: c.superficie,
      color: c.texto,
    },
    cabecalho: {
      padding: theme.spacing(2.5, 2, 1.5),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
      flex: "none",
    },
    linhaTitulo: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titulo: {
      fontWeight: 700,
      fontSize: "1.375rem",
      letterSpacing: "-0.015em",
      margin: 0,
    },
    fila: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 12,
      backgroundColor: c.atencaoSuave,
    },
    filaTexto: {
      flex: 1,
      minWidth: 0,
      fontSize: "0.875rem",
      lineHeight: 1.35,
      "& b": { display: "block", color: c.texto },
      "& span": { color: c.atencao, fontWeight: 600, fontSize: "0.8125rem" },
    },
    filaIcone: { color: c.atencao },
    busca: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 42,
      padding: "0 6px 0 12px",
      borderRadius: 10,
      backgroundColor: c.superficie2,
      border: `1px solid ${c.linha}`,
      color: c.textoApagado,
      "&:focus-within": { borderColor: c.primaria, boxShadow: c.foco },
    },
    buscaInput: {
      flex: 1,
      color: c.texto,
      fontSize: "0.9375rem",
      "& input::placeholder": { color: c.textoApagado, opacity: 1 },
    },
    segmentos: {
      display: "flex",
      gap: 2,
      padding: 4,
      borderRadius: 12,
      backgroundColor: c.hover,
    },
    segmento: {
      flex: 1,
      height: 34,
      borderRadius: 9,
      gap: 6,
      padding: "0 8px",
      fontSize: "0.875rem",
      fontWeight: 600,
      color: c.textoApagado,
      whiteSpace: "nowrap",
    },
    segmentoAtivo: {
      backgroundColor: c.superficie,
      color: c.texto,
      boxShadow: c.sombra,
    },
    contador: {
      minWidth: 20,
      height: 20,
      padding: "0 6px",
      borderRadius: 10,
      fontSize: "0.72rem",
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.sinal,
      color: c.sinalTexto,
    },
    contadorApagado: {
      backgroundColor: c.linha,
      color: c.textoApagado,
    },
    listas: {
      flex: 1,
      minHeight: 0,
      display: "flex",
      flexDirection: "column",
      borderTop: `1px solid ${c.linha}`,
    },
    painelFiltros: {
      width: 300,
      padding: theme.spacing(2),
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing(1.5),
    },
    painelTitulo: { fontWeight: 700, fontSize: "0.9375rem" },
    switchFiltro: { marginLeft: 0 },
  };
});

const TicketsManager = () => {
  const classes = useStyles();
  const history = useHistory();
  const [searchParam, setSearchParam] = useState("");
  const [textoBusca, setTextoBusca] = useState("");
  const [aba, setAba] = useState("myTickets");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [maisAnchor, setMaisAnchor] = useState(null);
  const [atendendo, setAtendendo] = useState(false);
  const buscaTimeout = useRef();
  const { user } = useContext(AuthContext);
  const { can } = usePermissions();
  const { isEnabled } = useContext(AttendanceSettingsContext);
  const [contagens, setContagens] = useState({});
  const [fila, setFila] = useState([]);
  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState(() => {
    try {
      const saved = localStorage.getItem("ticketsWhatsappFilter");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [filtrosAnchor, setFiltrosAnchor] = useState(null);
  const [agora, setAgora] = useState(() => new Date());

  const filtrosAtivos =
    (selectedWhatsappIds.length > 0 ? 1 : 0) +
    (selectedTagIds.length > 0 ? 1 : 0) +
    (selectedUserIds.length > 0 ? 1 : 0) +
    (selectedQueueIds.length !== userQueueIds.length ? 1 : 0);

  const limparFiltros = () => {
    setSelectedWhatsappIds([]);
    setSelectedTagIds([]);
    setSelectedUserIds([]);
    setSelectedQueueIds(userQueueIds);
  };

  useEffect(() => {
    try {
      localStorage.setItem("ticketsWhatsappFilter", JSON.stringify(selectedWhatsappIds));
    } catch {
      return;
    }
  }, [selectedWhatsappIds]);

  // Quem supervisiona abre a tela já vendo tudo -- era o comportamento de
  // quem tinha profile "admin", agora amarrado à permissão que de fato
  // controla isso no servidor.
  useEffect(() => {
    if (can("tickets:viewAll")) {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const contar = (chave) => (valor) =>
    setContagens((atual) => (atual[chave] === valor ? atual : { ...atual, [chave]: valor }));

  const handleSearch = (e) => {
    const termo = e.target.value;
    setTextoBusca(termo);
    clearTimeout(buscaTimeout.current);
    buscaTimeout.current = setTimeout(() => setSearchParam(termo.trim().toLowerCase()), 400);
  };

  const limparBusca = () => {
    clearTimeout(buscaTimeout.current);
    setTextoBusca("");
    setSearchParam("");
  };

  const aguardando = useMemo(
    () =>
      fila
        .filter((t) => t.status === "pending" && !t.contact?.isKnown)
        .sort((a, b) => new Date(ticketDate(a)) - new Date(ticketDate(b))),
    [fila]
  );
  const maisAntigo = aguardando[0];
  const esperaMaisAntiga = maisAntigo ? formatWaitingTime(ticketDate(maisAntigo), agora) : null;

  const atenderProximo = async () => {
    if (!maisAntigo) return;
    setAtendendo(true);
    try {
      await api.put(`/tickets/${maisAntigo.id}`, { status: "open", userId: user?.id });
      history.push(`/tickets/${maisAntigo.id}`);
      setAba("myTickets");
    } catch (err) {
      toastError(err);
    }
    setAtendendo(false);
  };

  const extraAtiva = ABAS_EXTRAS.find((a) => a.valor === aba);
  const buscando = Boolean(searchParam);

  const filtrosComuns = {
    selectedQueueIds,
    selectedWhatsappIds,
    selectedTagIds,
    selectedUserIds,
  };

  const oculto = (valor) => (buscando || aba !== valor ? { display: "none" } : undefined);

  const Contador = ({ valor, apagado }) =>
    valor > 0 ? (
      <span className={`${classes.contador} ${apagado ? classes.contadorApagado : ""}`}>
        {valor > 99 ? "99+" : valor}
      </span>
    ) : null;

  return (
    <div className={classes.root}>
      <NewTicketModal modalOpen={newTicketModalOpen} onClose={() => setNewTicketModalOpen(false)} />

      <div className={classes.cabecalho}>
        <div className={classes.linhaTitulo}>
          <h1 className={classes.titulo}>Conversas</h1>
          <div>
            <Tooltip title="Filtrar por número, etiqueta, fila ou atendente">
              <IconButton onClick={(e) => setFiltrosAnchor(e.currentTarget)} aria-label="Filtros">
                <Badge badgeContent={filtrosAtivos} color="primary">
                  <TuneIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title={i18n.t("ticketsManager.buttons.newTicket")}>
              <IconButton onClick={() => setNewTicketModalOpen(true)} aria-label="Nova conversa">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {aguardando.length > 0 && (
          <div className={classes.fila} role="status">
            <AccessTimeIcon className={classes.filaIcone} />
            <div className={classes.filaTexto}>
              <b>
                {aguardando.length === 1 ? "1 pessoa esperando" : `${aguardando.length} pessoas esperando`}
              </b>
              {esperaMaisAntiga && <span>a mais antiga há {esperaMaisAntiga}</span>}
            </div>
            <Button
              variant="contained"
              size="small"
              endIcon={<ArrowForwardIcon />}
              onClick={atenderProximo}
              disabled={atendendo}
            >
              Atender
            </Button>
          </div>
        )}

        <label className={classes.busca}>
          <SearchIcon fontSize="small" />
          <InputBase
            className={classes.buscaInput}
            placeholder={i18n.t("tickets.search.placeholder")}
            value={textoBusca}
            onChange={handleSearch}
            inputProps={{ "aria-label": "Buscar conversas" }}
          />
          {textoBusca && (
            <IconButton size="small" onClick={limparBusca} aria-label="Limpar busca">
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </label>

        {!buscando && (
          <div className={classes.segmentos} role="tablist">
            {ABAS_PRINCIPAIS.map(({ valor, rotulo }) => (
              <ButtonBase
                key={valor}
                role="tab"
                aria-selected={aba === valor}
                className={`${classes.segmento} ${aba === valor ? classes.segmentoAtivo : ""}`}
                onClick={() => setAba(valor)}
              >
                {rotulo}
                {valor === "waiting" && <Contador valor={contagens.waiting} />}
              </ButtonBase>
            ))}
            <ButtonBase
              role="tab"
              aria-selected={Boolean(extraAtiva)}
              aria-haspopup="menu"
              className={`${classes.segmento} ${extraAtiva ? classes.segmentoAtivo : ""}`}
              onClick={(e) => setMaisAnchor(e.currentTarget)}
            >
              {extraAtiva ? extraAtiva.rotulo : "Mais"}
              <ExpandMoreIcon fontSize="small" />
            </ButtonBase>
          </div>
        )}
      </div>

      <Menu anchorEl={maisAnchor} open={Boolean(maisAnchor)} onClose={() => setMaisAnchor(null)}>
        {ABAS_EXTRAS.map(({ valor, rotulo, descricao }) => (
          <MenuItem
            key={valor}
            selected={aba === valor}
            onClick={() => {
              setAba(valor);
              setMaisAnchor(null);
            }}
          >
            <ListItemText primary={rotulo} secondary={descricao} />
            {valor === "known" && <Contador valor={contagens.known} apagado />}
          </MenuItem>
        ))}
      </Menu>

      <Popover
        open={Boolean(filtrosAnchor)}
        anchorEl={filtrosAnchor}
        onClose={() => setFiltrosAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: classes.painelFiltros } }}
      >
        <span className={classes.painelTitulo}>Filtros</span>
        <TicketsWhatsappSelect
          style={{ width: "100%", marginTop: 0 }}
          selectedWhatsappIds={selectedWhatsappIds}
          onChange={(values) => setSelectedWhatsappIds(values)}
        />
        <TicketsTagSelect
          style={{ width: "100%", marginTop: 0 }}
          selectedTagIds={selectedTagIds}
          onChange={(values) => setSelectedTagIds(values)}
        />
        <TicketsQueueSelect
          style={{ width: "100%", marginTop: 0 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={(values) => setSelectedQueueIds(values)}
        />
        <Can permission="tickets:viewAll">
          <TicketsUserSelect
            style={{ width: "100%", marginTop: 0 }}
            selectedUserIds={selectedUserIds}
            onChange={(values) => setSelectedUserIds(values)}
          />
        </Can>
        <Can
          role={user.profile}
          perform="tickets-manager:showall"
          yes={() => (
            <FormControlLabel
              className={classes.switchFiltro}
              label={i18n.t("tickets.buttons.showAll")}
              control={
                <Switch
                  size="small"
                  checked={showAllTickets}
                  onChange={() => setShowAllTickets((prevState) => !prevState)}
                  name="showAllTickets"
                />
              }
            />
          )}
          no={() =>
            isEnabled("allowAgentSeeAllTickets") ? (
              <FormControlLabel
                className={classes.switchFiltro}
                label={i18n.t("tickets.buttons.showAll")}
                control={
                  <Switch
                    size="small"
                    checked={showAllTickets}
                    onChange={() => setShowAllTickets((prevState) => !prevState)}
                    name="showAllTickets"
                  />
                }
              />
            ) : null
          }
        />
        {filtrosAtivos > 0 && (
          <Button size="small" variant="outlined" onClick={limparFiltros} sx={{ alignSelf: "flex-start" }}>
            {i18n.t("ticketsManager.buttons.clearFilters")}
          </Button>
        )}
      </Popover>

      <div className={classes.listas}>
        <TicketsList
          tab="myTickets"
          groups="exclude"
          showAll={false}
          {...filtrosComuns}
          updateCount={contar("myTickets")}
          style={oculto("myTickets")}
        />
        <TicketsList
          tab="waiting"
          groups="exclude"
          showAll={true}
          {...filtrosComuns}
          updateCount={contar("waiting")}
          updateTickets={setFila}
          style={oculto("waiting")}
        />
        <TicketsList
          tab="attending"
          groups="exclude"
          showAll={showAllTickets}
          {...filtrosComuns}
          updateCount={contar("attending")}
          style={oculto("attending")}
        />
        <TicketsList
          tab="known"
          groups="exclude"
          showAll={true}
          {...filtrosComuns}
          updateCount={contar("known")}
          style={oculto("known")}
        />
        {!buscando && aba === "groups" && (
          <TicketsList tab="groups" showAll={true} {...filtrosComuns} updateCount={contar("groups")} />
        )}
        {!buscando && aba === "closed" && <TicketsList status="closed" showAll={true} {...filtrosComuns} />}
        {buscando && <TicketsList searchParam={searchParam} showAll={true} {...filtrosComuns} />}
      </div>
    </div>
  );
};

export default TicketsManager;
