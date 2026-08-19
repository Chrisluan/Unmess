import React, { useState, useEffect, useCallback, useMemo } from "react";
import openSocket from "../../services/socket-io";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import CircularProgress from "@mui/material/CircularProgress";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import ViewKanbanOutlinedIcon from "@mui/icons-material/ViewKanbanOutlined";

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
import PipelineSummary from "../../components/Crm/PipelineSummary";
import DealModal from "../../components/DealModal";
import DealDetailsDrawer from "../../components/DealDetailsDrawer";
import PipelineStagesModal from "../../components/PipelineStagesModal";
import BoardsModal from "../../components/BoardsModal";
import LostReasonModal from "../../components/Crm/LostReasonModal";
import AvancarQuadroModal from "../../components/Crm/AvancarQuadroModal";
import useArrastarQuadro from "../../hooks/useArrastarQuadro";

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

  const [dragging, setDragging] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [pendenteDePerda, setPendenteDePerda] = useState(null);
  const [pendenteDeAvanco, setPendenteDeAvanco] = useState(null);

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

  const fetchDeals = useCallback(async () => {
    if (!activeBoardId) return;

    try {
      const { data } = await api.get("/deals", {
        params: {
          searchParam,
          boardId: activeBoardId,
          responsibleUserId: responsibleFilter || undefined,
          includeClosed: showClosed ? "true" : undefined,
        },
      });
      setDeals(data);
    } catch (err) {
      toastError(err);
    }
  }, [activeBoardId, searchParam, responsibleFilter, showClosed]);

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

  useEffect(() => {
    const socket = openSocket();

    socket.on("deal", (data) => {
      if (data.action === "create" || data.action === "update") {
        const deal = data.deal;

        setDeals((prev) => {
          const outros = prev.filter((d) => d.id !== deal.id);
          // Card que saiu do quadro (avançou) ou que pertence a outro quadro
          // não deve permanecer na tela atual.
          if (deal.status === "moved" || deal.boardId !== activeBoardId) {
            return outros;
          }
          return [...outros, deal];
        });
      }

      if (data.action === "delete") {
        setDeals((prev) => prev.filter((d) => d.id !== +data.dealId));
      }

      fetchSummary();
    });

    socket.on("board", () => {
      fetchBoards();
    });

    socket.on("pipelineStage", () => {
      fetchBoards();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchSummary, fetchBoards, activeBoardId]);

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
      if (data.advancedTo) {
        toast.success(
          i18n.t("crm.toasts.advanced", { board: data.nextBoardName })
        );
      } else if (data.deal?.status === "won") {
        toast.success(i18n.t("crm.toasts.billed"));
      }

      fetchDeals();
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
    if (stageDestino?.isFinal) {
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

      <DealDetailsDrawer
        dealId={detailsDealId}
        open={Boolean(detailsDealId)}
        onClose={() => setDetailsDealId(null)}
        onEdit={handleEditDeal}
        onDelete={handleDeleteDeal}
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
            <TextField
              placeholder={i18n.t("crm.searchPlaceholder")}
              type="search"
              size="small"
              value={searchParam}
              onChange={(e) => setSearchParam(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon style={{ color: "gray" }} />
                  </InputAdornment>
                ),
              }}
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

            <Can permission="crm:manageBoards">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ViewKanbanOutlinedIcon />}
                onClick={() => setBoardsModalOpen(true)}
              >
                {i18n.t("crm.buttons.boards")}
              </Button>
            </Can>

            <Can permission="crm:manageStages">
              <Button
                variant="outlined"
                color="primary"
                startIcon={<TuneIcon />}
                disabled={!activeBoard}
                onClick={() => setStagesModalOpen(true)}
              >
                {i18n.t("crm.buttons.stages")}
              </Button>
            </Can>

            <Can permission="crm:create">
              <Button
                variant="contained"
                color="primary"
                disabled={!activeBoard}
                onClick={() => handleNovoDeal(null)}
              >
                {i18n.t("crm.buttons.addDeal")}
              </Button>
            </Can>
          </div>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <PipelineSummary summary={summary} />

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
