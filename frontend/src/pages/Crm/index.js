import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import TuneIcon from "@mui/icons-material/Tune";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CheckIcon from "@mui/icons-material/Check";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import SearchField from "../../components/SearchField";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import { Can } from "../../components/Can";
import usePermissions from "../../hooks/usePermissions";

import KanbanColumn from "../../components/Crm/KanbanColumn";
import DealModal from "../../components/DealModal";
import OrcamentoModal from "../../components/Crm/OrcamentoModal";
import PipelineStagesModal from "../../components/PipelineStagesModal";
import BoardsModal from "../../components/BoardsModal";
import LostReasonModal from "../../components/Crm/LostReasonModal";
import AvancarQuadroModal from "../../components/Crm/AvancarQuadroModal";
import IndicadoresFunil from "../../components/Crm/IndicadoresFunil";
import FiltrosFunil from "../../components/Crm/FiltrosFunil";
import useArrastarQuadro from "../../hooks/useArrastarQuadro";
import useAtualizacaoAutomatica from "../../hooks/useAtualizacaoAutomatica";

// Intervalos oferecidos para a atualização automática do quadro.
const INTERVALOS = [
  { valor: 10, rotulo: "A cada 10 segundos" },
  { valor: 30, rotulo: "A cada 30 segundos" },
  { valor: 60, rotulo: "A cada 1 minuto" },
  { valor: 300, rotulo: "A cada 5 minutos" },
];

const rotuloIntervalo = (segundos) =>
  segundos >= 60 ? `${Math.round(segundos / 60)} min` : `${segundos}s`;

const useStyles = makeStyles((theme) => ({
  abas: {
    minHeight: 40,
    marginBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  aba: {
    minHeight: 40,
    textTransform: "none",
    fontWeight: 600,
  },

  board: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1),
    overflowX: "auto",
    overflowY: "hidden",
    // O fundo do quadro é arrastável para navegar entre as colunas; o cursor
    // é o que faz alguém descobrir isso sem precisar contar.
    cursor: "grab",
    ...theme.scrollbarStyles,
  },

  vazio: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing(2),
    color: theme.palette.text.secondary,
  },

  filtros: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    flexWrap: "wrap",
  },
}));

/**
 * CRM em quadros encadeados.
 *
 * Cada quadro é um estágio do processo (Vendas, Produção, Expedição,
 * Financeiro). Ao arrastar um card para a coluna marcada como final, ele sai
 * daquele quadro e reaparece no início do seguinte — o backend arquiva o card
 * e cria outro, e a tela recebe os dois eventos pelo socket.
 *
 * O arrastar usa a API nativa do navegador em vez de uma biblioteca: o board
 * tem uma interação só (mover card) e uma dependência a mais pesaria mais que
 * o código que ela pouparia.
 */
const Crm = () => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [boards, setBoards] = useState([]);
  const [activeBoardId, setActiveBoardId] = useState(null);
  const [deals, setDeals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchParam, setSearchParam] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState("");
  // Por padrão o quadro esconde faturados e perdidos: o Kanban é sobre o que
  // ainda está em jogo. Os fechados continuam contados no resumo do topo.
  const [showClosed, setShowClosed] = useState(false);

  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState(null);
  const [novoDealStageId, setNovoDealStageId] = useState(null);
  const [detailsDealId, setDetailsDealId] = useState(null);
  const [stagesModalOpen, setStagesModalOpen] = useState(false);
  const [boardsModalOpen, setBoardsModalOpen] = useState(false);
  const [menuConfig, setMenuConfig] = useState(null);

  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [pendenteDePerda, setPendenteDePerda] = useState(null);
  const [pendenteDeAvanco, setPendenteDeAvanco] = useState(null);
  const [filtrosAvancados, setFiltrosAvancados] = useState({ ordenacao: "posicao" });

  /**
   * Abre a oportunidade indicada na URL.
   *
   * É como o chat manda alguém para cá: o atendente clica em "Ver no CRM" na
   * conversa e cai com o card já aberto, em vez de ter que procurá-lo no
   * meio das colunas.
   *
   * O parâmetro é limpo depois de usado: sem isso, fechar o card e recarregar
   * a página o abriria de novo, e voltar pelo histórico ficaria preso nele.
   */
  const location = useLocation();
  const navegacao = useHistory();

  useEffect(() => {
    const alvo = new URLSearchParams(location.search).get("deal");
    if (!alvo) return;

    setDetailsDealId(Number(alvo));
    navegacao.replace("/crm");
  }, [location.search, navegacao]);

  // Rolagem horizontal do quadro: arrastar o fundo, roda do mouse e rolagem
  // automática ao levar um card para perto da borda.
  const refQuadro = useArrastarQuadro(Boolean(dragging));

  const podeMover = can("crm:move");

  const activeBoard = useMemo(
    () => boards.find((board) => board.id === activeBoardId) || null,
    [boards, activeBoardId]
  );

  const stages = useMemo(
    () =>
      [...(activeBoard?.stages || [])].sort((a, b) => a.order - b.order),
    [activeBoard]
  );

  const fetchBoards = useCallback(async () => {
    try {
      const { data } = await api.get("/boards");
      setBoards(data);

      // Mantém o quadro aberto se ele ainda existir; senão cai no primeiro.
      setActiveBoardId((atual) => {
        if (atual && data.some((board) => board.id === atual)) return atual;
        return data[0]?.id || null;
      });

      return data;
    } catch (err) {
      toastError(err);
      return [];
    }
  }, []);

  /**
   * Busca as oportunidades com os filtros combinados.
   *
   * Usa o endpoint de busca, que resolve tudo em SQL: filtrar no navegador
   * exigiria trazer a base inteira para descartar quase tudo.
   */
  const fetchDeals = useCallback(async () => {
    if (!activeBoardId) return;

    try {
      const { data } = await api.get("/deals/buscar", {
        params: {
          ...filtrosAvancados,
          searchParam,
          boardId: activeBoardId,
          responsibleUserId:
            filtrosAvancados.responsibleUserId || responsibleFilter || undefined,
          includeClosed: showClosed ? "true" : undefined,
          tagIds: filtrosAvancados.tagIds?.length
            ? filtrosAvancados.tagIds.join(",")
            : undefined,
        },
      });
      setDeals(data.deals || []);
    } catch (err) {
      toastError(err);
    }
  }, [activeBoardId, searchParam, responsibleFilter, showClosed, filtrosAvancados]);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get("/deals/summary", {
        params: { responsibleUserId: responsibleFilter || undefined },
      });
      setSummary(data);
    } catch (err) {
      toastError(err);
    }
  }, [responsibleFilter]);

  useEffect(() => {
    const carregar = async () => {
      setLoading(true);
      await Promise.all([fetchBoards(), fetchSummary()]);
      setLoading(false);
    };
    carregar();
  }, [fetchBoards, fetchSummary]);

  // A busca tem debounce porque dispara a cada tecla; os demais filtros são
  // cliques e podem consultar de imediato.
  useEffect(() => {
    const timer = setTimeout(fetchDeals, searchParam ? 500 : 0);
    return () => clearTimeout(timer);
  }, [fetchDeals, searchParam]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users", { params: { pageNumber: 1 } });
        setUsers(data.users || []);
      } catch (err) {
        // Sem permissão de usuários o filtro por responsável simplesmente não
        // aparece — não é motivo para estourar erro na tela do CRM.
      }
    };
    if (can("crm:viewAll")) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Atualização por HTTP, no lugar do socket.
   *
   * O socket entrega mais rápido, mas depende de uma conexão viva o tempo
   * todo -- e pelo túnel, com a máquina em Wi-Fi, ela cai e volta sem avisar,
   * deixando o quadro parado no passado sem ninguém perceber.
   */
  const recarregarTudo = useCallback(async () => {
    await Promise.all([fetchDeals(), fetchSummary(), fetchBoards()]);
  }, [fetchDeals, fetchSummary, fetchBoards]);

  const atualizacao = useAtualizacaoAutomatica(recarregarTudo);


  // Cards agrupados por coluna, cada grupo já na ordem gravada.
  const dealsPorEtapa = useMemo(() => {
    const mapa = {};

    stages.forEach((stage) => {
      mapa[stage.id] = [];
    });

    deals.forEach((deal) => {
      if (!mapa[deal.stageId]) return;
      mapa[deal.stageId].push(deal);
    });

    Object.keys(mapa).forEach((stageId) => {
      mapa[stageId].sort((a, b) => a.order - b.order);
    });

    return mapa;
  }, [deals, stages]);

  const handleDragStart = (deal, fromIndex) => {
    setDragging({ deal, fromStageId: deal.stageId, fromIndex });
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDropTarget(null);
  };

  const moverDeal = async (
    dealId,
    stageId,
    order,
    lostReason,
    gerarProximo,
    lostReasonDetail
  ) => {
    // Guardado antes do movimento: um card já ganho continua sendo arrastado
    // dentro da coluna, e sem esta comparação o aviso de venda faturada
    // reapareceria a cada arrasto.
    const jaEraGanho = Boolean(deals.find((d) => d.id === dealId)?.wonAt);

    try {
      const { data } = await api.put(`/deals/${dealId}/move`, {
        stageId,
        order,
        lostReason,
        lostReasonDetail,
        gerarProximo,
      });

      // Coluna final: o card mudou de quadro. Avisar é essencial, senão ele
      // simplesmente some da tela e parece que foi apagado.
      // Voltar um card concluído é permitido; o aviso diz onde ficou a cópia,
      // para ninguém achar que o trabalho adiante sumiu junto.
      if (data.avisoCopia) {
        toast.info(
          `Este card já tem uma cópia em ${data.avisoCopia.boardName} (nº ${data.avisoCopia.dealId}).`,
          { autoClose: 8000 }
        );
      }

      if (data.advancedTo) {
        toast.success(
          i18n.t("crm.toasts.advanced", { board: data.nextBoardName })
        );
      } else if (!jaEraGanho && (data.deal?.wonAt || data.deal?.status === "won")) {
        toast.success(i18n.t("crm.toasts.billed"));
      }

      fetchDeals();
      // O faturamento muda no mesmo movimento que move o card. Recarregar só
      // os cards deixava o "Faturado" do cabeçalho parado no número antigo até
      // alguém recarregar a página.
      fetchSummary();
    } catch (err) {
      // A coluna de destino pode ser de perda em outro quadro -- só o backend
      // sabe disso, porque é ele que resolve o encaminhamento. Quando ele pede
      // o motivo, abrimos o mesmo diálogo do arrasto direto para a perda.
      if (err?.response?.data?.error === "ERR_LOST_REASON_REQUIRED") {
        const deal = deals.find((d) => d.id === dealId);
        setPendenteDePerda({ deal, stageId, order, gerarProximo });
        fetchDeals();
        return;
      }

      toastError(err);
      // Recarrega para desfazer o movimento otimista na tela.
      fetchDeals();
    }
  };

  const handleDrop = (stageId, dropIndex) => {
    if (!dragging || !podeMover) return;

    const { deal, fromStageId, fromIndex } = dragging;

    // O índice de soltura conta a lista com o card ainda no lugar. Ao mover
    // dentro da mesma coluna para baixo, tirar o card antes desloca tudo uma
    // posição — daí o desconto.
    const mesmaColuna = fromStageId === stageId;
    const posicaoFinal =
      mesmaColuna && dropIndex > fromIndex ? dropIndex - 1 : dropIndex;

    handleDragEnd();

    if (mesmaColuna && posicaoFinal === fromIndex) return;

    const stageDestino = stages.find((s) => s.id === stageId);

    // Perda sem motivo registrado vira um card mudo no histórico; pedimos o
    // texto antes de concluir o movimento.
    if (stageDestino?.type === "lost") {
      setPendenteDePerda({ deal, stageId, order: posicaoFinal });
      return;
    }

    // Coluna final conclui o quadro. Antes o avanço era automático e o card
    // sumia da tela; agora quem arrastou decide se aquilo vira trabalho no
    // quadro seguinte -- nem todo orçamento aprovado vira pedido.
    // A pergunta "gerar pedido?" só cabe saindo da venda: é ali que se decide
    // se um orçamento aprovado vira trabalho. Nos demais quadros a passagem é
    // a continuação do processo, e perguntar viraria só mais um clique.
    if (stageDestino?.isFinal && activeBoard?.isSalesFunnel) {
      setPendenteDeAvanco({ deal, stageId, order: posicaoFinal });
      return;
    }

    aplicarMovimentoOtimista(deal, stageId, posicaoFinal);
    moverDeal(deal.id, stageId, posicaoFinal);
  };

  // Atualiza a tela na hora do drop; o socket confirma logo depois com o
  // estado real. Sem isso o card "volta" por um instante e parece travado.
  const aplicarMovimentoOtimista = (deal, stageId, order) => {
    setDeals((prev) =>
      prev.map((d) => (d.id === deal.id ? { ...d, stageId, order } : d))
    );
  };

  const handleConfirmarPerda = async (lostReason, lostReasonDetail) => {
    const { deal, stageId, order, gerarProximo } = pendenteDePerda;
    setPendenteDePerda(null);
    aplicarMovimentoOtimista(deal, stageId, order);
    await moverDeal(
      deal.id,
      stageId,
      order,
      lostReason,
      gerarProximo,
      lostReasonDetail
    );
  };

  /**
   * Conclusão de quadro: seguir para o próximo ou parar aqui.
   *
   * Nos dois casos o card fica visível na coluna final, marcado como
   * concluído. O que muda é se nasce um card no quadro seguinte referenciando
   * este número.
   */
  const handleConfirmarAvanco = async (gerarProximo) => {
    const { deal, stageId, order } = pendenteDeAvanco;
    setPendenteDeAvanco(null);
    aplicarMovimentoOtimista(deal, stageId, order);
    await moverDeal(deal.id, stageId, order, undefined, gerarProximo);
  };

  const handleNovoDeal = (stageId) => {
    setEditingDealId(null);
    setNovoDealStageId(stageId || null);
    setDealModalOpen(true);
  };

  const handleEditDeal = (dealId) => {
    setEditingDealId(dealId);
    setNovoDealStageId(null);
    setDealModalOpen(true);
  };

  const handleDeleteDeal = async (dealId) => {
    try {
      await api.delete(`/deals/${dealId}`);
      toast.success(i18n.t("crm.toasts.dealDeleted"));
      setDetailsDealId(null);
      fetchDeals();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <DealModal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        dealId={editingDealId}
        stageId={novoDealStageId}
        boardId={activeBoardId}
        stages={stages}
        onSave={() => {
          fetchDeals();
          fetchSummary();
        }}
      />

      {/* A ficha do orçamento é uma janela com abas, e não mais um painel
          lateral: proposta, itens, tarefas e conversa não cabiam na largura de
          um drawer. */}
      <OrcamentoModal
        dealId={detailsDealId}
        open={Boolean(detailsDealId)}
        onClose={() => setDetailsDealId(null)}
        onSalvo={() => {
          fetchDeals();
          fetchSummary();
        }}
      />

      <PipelineStagesModal
        open={stagesModalOpen}
        onClose={() => setStagesModalOpen(false)}
        board={activeBoard}
        boards={boards}
        onChange={fetchBoards}
      />

      <BoardsModal
        open={boardsModalOpen}
        onClose={() => setBoardsModalOpen(false)}
        boards={boards}
        onChange={fetchBoards}
      />

      <AvancarQuadroModal
        open={Boolean(pendenteDeAvanco)}
        dealTitle={pendenteDeAvanco?.deal?.title}
        onClose={() => setPendenteDeAvanco(null)}
        onConfirm={handleConfirmarAvanco}
      />

      <LostReasonModal
        open={Boolean(pendenteDePerda)}
        dealTitle={pendenteDePerda?.deal?.title}
        onClose={() => setPendenteDePerda(null)}
        onConfirm={handleConfirmarPerda}
      />

      <MainHeader>
        <Title>{i18n.t("crm.title")}</Title>
        <MainHeaderButtonsWrapper>
          <div className={classes.filtros}>
            <FiltrosFunil
              filtros={filtrosAvancados}
              onAplicar={setFiltrosAvancados}
            />

            <TextField
              select
              size="small"
              variant="outlined"
              label="Ordenar"
              InputLabelProps={{ shrink: true }}
              SelectProps={{ native: true }}
              value={filtrosAvancados.ordenacao || "posicao"}
              onChange={(e) =>
                setFiltrosAvancados((a) => ({ ...a, ordenacao: e.target.value }))
              }
              style={{ width: 150 }}
            >
              <option value="posicao">Ordem do quadro</option>
              <option value="prioridade">Prioridade</option>
              <option value="followup">Próximo follow-up</option>
              <option value="interacao">Última interação</option>
              <option value="maior_valor">Maior valor</option>
              <option value="menor_valor">Menor valor</option>
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
            </TextField>

            <SearchField
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              onClear={() => setSearchParam("")}
              placeholder={i18n.t("crm.searchPlaceholder")}
            />

            {can("crm:viewAll") && users.length > 0 && (
              <TextField
                select
                size="small"
                label={i18n.t("crm.filters.responsible")}
                value={responsibleFilter}
                onChange={(e) => setResponsibleFilter(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <MenuItem value="">{i18n.t("crm.filters.all")}</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              select
              size="small"
              label={i18n.t("crm.filters.status")}
              value={showClosed ? "all" : "open"}
              onChange={(e) => setShowClosed(e.target.value === "all")}
              style={{ minWidth: 150 }}
            >
              <MenuItem value="open">{i18n.t("crm.filters.onlyOpen")}</MenuItem>
              <MenuItem value="all">{i18n.t("crm.filters.withClosed")}</MenuItem>
            </TextField>

            {/* Um menu só para o que configura o quadro e para a preferência
                de atualização: seis controles a menos disputando a faixa com
                os filtros que se usam a cada minuto. */}
            <Tooltip title="Configurar o quadro" arrow>
              <IconButton
                size="small"
                aria-label="Configurar o quadro"
                onClick={(e) => setMenuConfig(e.currentTarget)}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>

            <Menu
              anchorEl={menuConfig}
              open={Boolean(menuConfig)}
              onClose={() => setMenuConfig(null)}
            >
              <Can permission="crm:manageBoards">
                <MenuItem
                  onClick={() => {
                    setMenuConfig(null);
                    setBoardsModalOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <ViewKanbanOutlinedIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={i18n.t("crm.buttons.boards")} />
                </MenuItem>
              </Can>

              <Can permission="crm:manageStages">
                <MenuItem
                  disabled={!activeBoard}
                  onClick={() => {
                    setMenuConfig(null);
                    setStagesModalOpen(true);
                  }}
                >
                  <ListItemIcon>
                    <TuneIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={i18n.t("crm.buttons.stages")} />
                </MenuItem>
              </Can>

              <Divider />

              {/* O clique é sempre do item inteiro: o Switch é indicador, e
                  não um segundo alvo. Com onChange próprio, clicar nele
                  disparava a troca duas vezes — a dele e a do item por
                  propagação — e o estado voltava ao que era. */}
              <MenuItem onClick={atualizacao.alternar}>
                <ListItemIcon>
                  <AutorenewIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Atualizar sozinho"
                  secondary={
                    atualizacao.ligada
                      ? `A cada ${rotuloIntervalo(atualizacao.intervalo)}`
                      : "Desligado"
                  }
                />
                <Switch
                  edge="end"
                  size="small"
                  checked={atualizacao.ligada}
                  tabIndex={-1}
                  readOnly
                  inputProps={{ "aria-hidden": true }}
                  style={{ pointerEvents: "none" }}
                />
              </MenuItem>

              {/* Um item por intervalo, e não um select dentro do menu: o
                  Menu do MUI captura as setas do teclado para navegar entre
                  os itens, e um <select> nativo aqui dentro ficaria sem elas. */}
              {atualizacao.ligada &&
                INTERVALOS.map((op) => (
                  <MenuItem
                    key={op.valor}
                    selected={Number(atualizacao.intervalo) === op.valor}
                    onClick={() => atualizacao.mudarIntervalo(op.valor)}
                  >
                    <ListItemIcon>
                      {Number(atualizacao.intervalo) === op.valor && (
                        <CheckIcon fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText primary={op.rotulo} />
                  </MenuItem>
                ))}
            </Menu>

            <Can permission="crm:create">
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                disabled={!activeBoard}
                onClick={() => handleNovoDeal(null)}
              >
                {i18n.t("crm.buttons.addDeal")}
              </Button>
            </Can>
          </div>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      {boards.length > 0 && (
        <Tabs
          value={activeBoardId || false}
          onChange={(_, valor) => setActiveBoardId(valor)}
          variant="scrollable"
          scrollButtons="auto"
          className={classes.abas}
        >
          {boards.map((board, indice) => (
            <Tab
              key={board.id}
              value={board.id}
              className={classes.aba}
              // A numeração deixa explícito o caminho que o card percorre.
              label={`${indice + 1}. ${board.name}`}
              style={{ color: board.id === activeBoardId ? board.color : undefined }}
            />
          ))}
        </Tabs>
      )}

      {/* Indicadores antes das colunas: respondem antes de qualquer card --
          quanto tem no funil, quanto disso e realista, e o que pede atencao. */}
      {/* Amarrado ao resumo, e não à quantidade de cards: mover um card para a
          coluna de ganho muda o faturamento sem mudar quantos cards existem, e
          os indicadores ficavam no número antigo. */}
      <IndicadoresFunil
        boardId={activeBoardId}
        recarregar={summary}
        resumo={summary}
      />
      <Paper
        ref={refQuadro}
        className={classes.board}
        variant="outlined"
        elevation={0}
      >
        {loading ? (
          <div className={classes.vazio}>
            <CircularProgress />
          </div>
        ) : stages.length === 0 ? (
          <div className={classes.vazio}>
            <Typography>{i18n.t("crm.emptyStages")}</Typography>
            <Can permission="crm:manageStages">
              <Button
                variant="contained"
                color="primary"
                disabled={!activeBoard}
                onClick={() => setStagesModalOpen(true)}
              >
                {i18n.t("crm.buttons.stages")}
              </Button>
            </Can>
          </div>
        ) : (
          stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={dealsPorEtapa[stage.id] || []}
              noFunil={Boolean(activeBoard?.isSalesFunnel)}
              dragging={dragging}
              dropTarget={dropTarget}
              podeMover={podeMover}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOverCard={setDropTarget}
              onDrop={handleDrop}
              onCardClick={setDetailsDealId}
              onAddDeal={() => handleNovoDeal(stage.id)}
            />
          ))
        )}
      </Paper>
    </MainContainer>
  );
};

export default Crm;
