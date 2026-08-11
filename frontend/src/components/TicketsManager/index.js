import React, { useContext, useEffect, useRef, useState } from "react";
import makeStyles from '@mui/styles/makeStyles';
import Paper from "@mui/material/Paper";
import SearchIcon from "@mui/icons-material/Search";
import InputBase from "@mui/material/InputBase";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Badge from "@mui/material/Badge";
import MoveToInboxIcon from "@mui/icons-material/MoveToInbox";
import CheckBoxIcon from "@mui/icons-material/CheckBox";
import GroupIcon from "@mui/icons-material/Group";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Popover from "@mui/material/Popover";
import AddIcon from "@mui/icons-material/Add";
import FilterListIcon from "@mui/icons-material/FilterList";
import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import TabPanel from "../TabPanel";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import TicketsWhatsappSelect from "../TicketsWhatsappSelect";
import TicketsTagSelect from "../TicketsTagSelect";
import TicketsUserSelect from "../TicketsUserSelect";
import { Button } from "@mui/material";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
  },
  tabsHeader: {
    flex: "none",
    backgroundColor: theme.palette.background.paper,
  },
  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: 8,
  },
  tab: {
    minWidth: 120,
    width: 120,
  },
  // Rótulo em uma linha só. Com "Aguardando atendimento" o texto quebrava e
  // era cortado pela altura da aba; o corte some com o nome curto, mas a
  // trava evita que volte se algum rótulo crescer de novo.
  abaCompacta: {
    minWidth: 0,
    padding: "10px 8px",
    fontSize: "0.82rem",
    whiteSpace: "nowrap",
  },
  ticketOptionsBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    background: theme.palette.background.paper,
    padding: theme.spacing(1),
  },
  espacador: {
    flex: 1,
  },
  painelFiltros: {
    width: 280,
    padding: theme.spacing(2),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.5),
  },
  switchFiltro: {
    marginLeft: 0,
  },
  limparFiltros: {
    alignSelf: "flex-start",
  },
  serachInputWrapper: {
    flex: 1,
    background: theme.palette.background.default,
    display: "flex",
    borderRadius: 40,
    padding: 4,
    marginRight: theme.spacing(1),
  },
  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center",
  },
  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30,
    color: theme.palette.text.primary, 
    backgroundColor: theme.palette.background.default,
  },
  badge: {
    right: "-10px",
  },
  show: {
    display: "block",
  },
  hide: {
    display: "none !important",
  },
}));

const TicketsManager = () => {
  const classes = useStyles();
  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const [tabOpen, setTabOpen] = useState("myTickets");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const { isEnabled } = useContext(AttendanceSettingsContext);
  const [myTicketsCount, setMyTicketsCount] = useState(0);
  const [attendingCount, setAttendingCount] = useState(0);
  const [waitingCount, setWaitingCount] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  // Vazio = todas as conexões. Persistido para o atendente não precisar
  // reaplicar o filtro toda vez que abre o painel.
  const [selectedWhatsappIds, setSelectedWhatsappIds] = useState(() => {
    try {
      const saved = localStorage.getItem("ticketsWhatsappFilter");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [selectedTagIds, setSelectedTagIds] = useState([]);
  // Vazio = todos os atendentes. Só é oferecido a quem vê todas as conversas.
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [filtrosAnchor, setFiltrosAnchor] = useState(null);

  // Quantidade de filtros restringindo a lista. Vira o número no badge, para
  // o atendente perceber que está vendo um recorte mesmo com o painel fechado.
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
    localStorage.setItem(
      "ticketsWhatsappFilter",
      JSON.stringify(selectedWhatsappIds)
    );
  }, [selectedWhatsappIds]);

  useEffect(() => {
    if (user.profile.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
      setSearchParam("");
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(e) => setNewTicketModalOpen(false)}
      />
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"groups"}
            icon={
              <Badge
                className={classes.badge}
                badgeContent={groupsCount}
                color="primary"
              >
                <GroupIcon />
              </Badge>
            }
            label={i18n.t("tickets.tabs.groups.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          />
        </Tabs>
      </Paper>
      {/* Uma faixa só: ação principal à esquerda, filtros recolhidos à direita.
          Antes os três seletores dividiam a largura da lista com o botão e o
          switch, cada um espremido em 150px e truncando o próprio rótulo. */}
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setNewTicketModalOpen(true)}
            >
              {i18n.t("ticketsManager.buttons.newTicket")}
            </Button>

            <div className={classes.espacador} />

            <Badge
              badgeContent={filtrosAtivos}
              color="primary"
              overlap="circular"
            >
              <Button
                size="small"
                variant={filtrosAtivos ? "contained" : "outlined"}
                color={filtrosAtivos ? "primary" : "inherit"}
                startIcon={<FilterListIcon />}
                onClick={(e) => setFiltrosAnchor(e.currentTarget)}
              >
                {i18n.t("ticketsManager.buttons.filters")}
              </Button>
            </Badge>
          </>
        )}
      </Paper>

      <Popover
        open={Boolean(filtrosAnchor)}
        anchorEl={filtrosAnchor}
        onClose={() => setFiltrosAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: classes.painelFiltros } }}
      >
        {/* Aqui cada seletor ocupa a largura toda do painel, então o rótulo
            aparece inteiro. */}
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

        {/* Filtro por atendente: ferramenta de supervisão, só aparece para
            quem enxerga o atendimento inteiro. O backend valida a mesma
            permissão, então esconder aqui é conveniência, não a trava. */}
        <Can permission="tickets:viewAll">
          <TicketsUserSelect
            style={{ width: "100%", marginTop: 0 }}
            selectedUserIds={selectedUserIds}
            onChange={(values) => setSelectedUserIds(values)}
          />
        </Can>

        {/* O switch "Todos" fica disponível para admin ou, se a empresa
            liberou, para qualquer atendente. */}
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
                  color="primary"
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
                    color="primary"
                  />
                }
              />
            ) : null
          }
        />

        {filtrosAtivos > 0 && (
          <Button
            size="small"
            onClick={limparFiltros}
            className={classes.limparFiltros}
          >
            {i18n.t("ticketsManager.buttons.clearFilters")}
          </Button>
        )}
      </Popover>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={myTicketsCount}
                color="primary"
              >
                {i18n.t("ticketsList.myTicketsHeader")}
              </Badge>
            }
            className={classes.abaCompacta}
            value={"myTickets"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={attendingCount}
                color="primary"
              >
                {i18n.t("ticketsList.attendingHeader")}
              </Badge>
            }
            className={classes.abaCompacta}
            value={"attending"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={waitingCount}
                color="secondary"
              >
                {i18n.t("ticketsList.waitingHeader")}
              </Badge>
            }
            className={classes.abaCompacta}
            value={"waiting"}
          />
          {/* Conversas de pessoas conhecidas: já abertas, sem passar por fila
              nem exigir aceite. */}
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={knownCount}
                color="primary"
              >
                {i18n.t("ticketsList.knownHeader")}
              </Badge>
            }
            className={classes.abaCompacta}
            value={"known"}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            tab="myTickets"
            groups="exclude"
            showAll={false}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            selectedTagIds={selectedTagIds}
            selectedUserIds={selectedUserIds}
            updateCount={(val) => setMyTicketsCount(val)}
            style={applyPanelStyle("myTickets")}
          />
          <TicketsList
            tab="attending"
            groups="exclude"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            selectedTagIds={selectedTagIds}
            selectedUserIds={selectedUserIds}
            updateCount={(val) => setAttendingCount(val)}
            style={applyPanelStyle("attending")}
          />
          <TicketsList
            tab="waiting"
            groups="exclude"
            showAll={true}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            selectedTagIds={selectedTagIds}
            selectedUserIds={selectedUserIds}
            updateCount={(val) => setWaitingCount(val)}
            style={applyPanelStyle("waiting")}
          />
          <TicketsList
            tab="known"
            groups="exclude"
            showAll={true}
            selectedQueueIds={selectedQueueIds}
            selectedWhatsappIds={selectedWhatsappIds}
            selectedTagIds={selectedTagIds}
            selectedUserIds={selectedUserIds}
            updateCount={(val) => setKnownCount(val)}
            style={applyPanelStyle("known")}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="groups" className={classes.ticketsWrapper}>
        <TicketsList
          tab="groups"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedTagIds={selectedTagIds}
          selectedUserIds={selectedUserIds}
          updateCount={(val) => setGroupsCount(val)}
        />
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedTagIds={selectedTagIds}
          selectedUserIds={selectedUserIds}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          selectedWhatsappIds={selectedWhatsappIds}
          selectedTagIds={selectedTagIds}
          selectedUserIds={selectedUserIds}
        />
      </TabPanel>
    </Paper>
  );
};

export default TicketsManager;
