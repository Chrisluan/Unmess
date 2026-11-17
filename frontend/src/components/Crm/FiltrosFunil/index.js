import React, { useEffect, useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Popover from "@mui/material/Popover";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Badge from "@mui/material/Badge";
import FilterListIcon from "@mui/icons-material/FilterList";

import api from "../../../services/api";

const useStyles = makeStyles((theme) => ({
  painel: {
    width: 340,
    maxWidth: "92vw",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  cabecalho: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
    borderBottom: `1px solid ${theme.palette.divider}`,
    paddingBottom: 8,
  },

  tituloPainel: {
    fontWeight: 700,
    fontSize: "0.9rem",
  },

  titulo: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },

  grupo: { display: "flex", flexDirection: "column", gap: 6 },
  linha: { display: "flex", gap: 8 },
  etiquetas: { display: "flex", flexWrap: "wrap", gap: 5 },
  rodape: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: `1px solid ${theme.palette.divider}`,
    paddingTop: 10,
  },
}));

const ATALHOS = [
  { chave: "atrasadas", rotulo: "Atrasadas" },
  { chave: "followUpHoje", rotulo: "Follow-up hoje" },
  { chave: "semResponsavel", rotulo: "Sem responsável" },
];

const PRIORIDADES = [
  { id: "urgent", rotulo: "Urgente" },
  { id: "high", rotulo: "Alta" },
  { id: "normal", rotulo: "Normal" },
  { id: "low", rotulo: "Baixa" },
];

const ATENDIMENTO = [
  { id: "open", rotulo: "Em atendimento" },
  { id: "waiting_customer", rotulo: "Aguardando cliente" },
  { id: "waiting_team", rotulo: "Aguardando equipe" },
  { id: "closed", rotulo: "Encerrado" },
];

/**
 * Filtros do funil.
 *
 * Fica num painel, e não espalhado na barra: são treze critérios combináveis, e
 * deixá-los sempre visíveis ocuparia mais espaço que o próprio quadro. O botão
 * mostra quantos estão ativos, para ninguém estranhar um Kanban "vazio" sem
 * perceber que há filtro ligado.
 *
 * Nada é aplicado enquanto o painel está aberto: o quadro só recarrega quando a
 * pessoa termina de escolher, o que evita uma consulta por clique.
 */
const FiltrosFunil = ({ filtros, onAplicar }) => {
  const classes = useStyles();

  const [ancora, setAncora] = useState(null);
  const [rascunho, setRascunho] = useState(filtros);
  const [usuarios, setUsuarios] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    if (!ancora) return;
    setRascunho(filtros);

    // Só busca ao abrir: carregar usuários e etiquetas junto com o quadro
    // atrasaria a tela por uma lista que talvez ninguém abra.
    api.get("/users", { params: { pageNumber: 1 } })
      .then(({ data }) => setUsuarios(data.users || []))
      .catch(() => {});
    api.get("/tags")
      .then(({ data }) => setTags(data.tags || data || []))
      .catch(() => {});
  }, [ancora, filtros]);

  const mudar = (campo, valor) =>
    setRascunho((atual) => ({ ...atual, [campo]: valor || undefined }));

  const alternarAtalho = (chave) =>
    setRascunho((atual) => ({ ...atual, [chave]: atual[chave] ? undefined : true }));

  const alternarTag = (id) =>
    setRascunho((atual) => {
      const atuais = atual.tagIds || [];
      const novas = atuais.includes(id)
        ? atuais.filter((t) => t !== id)
        : [...atuais, id];
      return { ...atual, tagIds: novas.length ? novas : undefined };
    });

  const ativos = Object.entries(filtros).filter(
    ([chave, valor]) =>
      valor !== undefined &&
      valor !== "" &&
      !["ordenacao", "searchParam", "boardId"].includes(chave)
  ).length;

  const aplicar = () => {
    onAplicar(rascunho);
    setAncora(null);
  };

  const limpar = () => {
    const vazio = { ordenacao: filtros.ordenacao, boardId: filtros.boardId };
    setRascunho(vazio);
    onAplicar(vazio);
    setAncora(null);
  };

  return (
    <>
      <Badge badgeContent={ativos} color="primary">
        <Button
          size="small"
          variant={ativos ? "contained" : "outlined"}
          startIcon={<FilterListIcon />}
          onClick={(e) => setAncora(e.currentTarget)}
        >
          Filtros
        </Button>
      </Badge>

      <Popover
        open={Boolean(ancora)}
        anchorEl={ancora}
        onClose={() => setAncora(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <div className={classes.painel}>
          <div className={classes.cabecalho}>
            <span className={classes.tituloPainel}>Filtrar oportunidades</span>
            {ativos > 0 && (
              <span className={classes.titulo}>{ativos} ativo(s)</span>
            )}
          </div>

          <div className={classes.grupo}>
            <span className={classes.titulo}>Atalhos</span>
            <div className={classes.etiquetas}>
              {ATALHOS.map((a) => (
                <Chip
                  key={a.chave}
                  size="small"
                  label={a.rotulo}
                  color={rascunho[a.chave] ? "primary" : "default"}
                  variant={rascunho[a.chave] ? "filled" : "outlined"}
                  onClick={() => alternarAtalho(a.chave)}
                />
              ))}
            </div>
          </div>

          <TextField
            select
            size="small"
            label="Responsável"
            SelectProps={{ native: true }}
            InputLabelProps={{ shrink: true }}
            value={rascunho.responsibleUserId || ""}
            onChange={(e) => mudar("responsibleUserId", e.target.value)}
            disabled={Boolean(rascunho.semResponsavel)}
          >
            <option value="">Qualquer</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </TextField>

          <div className={classes.linha}>
            <TextField
              select
              size="small"
              label="Prioridade"
              fullWidth
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              value={rascunho.priority || ""}
              onChange={(e) => mudar("priority", e.target.value)}
            >
              <option value="">Qualquer</option>
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>{p.rotulo}</option>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Andamento"
              fullWidth
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              value={rascunho.serviceStatus || ""}
              onChange={(e) => mudar("serviceStatus", e.target.value)}
            >
              <option value="">Qualquer</option>
              {ATENDIMENTO.map((a) => (
                <option key={a.id} value={a.id}>{a.rotulo}</option>
              ))}
            </TextField>
          </div>

          <TextField
            size="small"
            label="Origem"
            placeholder="Instagram, indicação…"
            InputLabelProps={{ shrink: true }}
            value={rascunho.origin || ""}
            onChange={(e) => mudar("origin", e.target.value)}
          />

          <div className={classes.linha}>
            <TextField
              size="small"
              type="number"
              label="Valor mínimo"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={rascunho.valorMinimo || ""}
              onChange={(e) => mudar("valorMinimo", e.target.value)}
            />
            <TextField
              size="small"
              type="number"
              label="Valor máximo"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={rascunho.valorMaximo || ""}
              onChange={(e) => mudar("valorMaximo", e.target.value)}
            />
          </div>

          <TextField
            size="small"
            type="number"
            label="Sem interação há (dias)"
            InputLabelProps={{ shrink: true }}
            value={rascunho.semInteracaoDias || ""}
            onChange={(e) => mudar("semInteracaoDias", e.target.value)}
          />

          {tags.length > 0 && (
            <div className={classes.grupo}>
              <span className={classes.titulo}>
                Etiquetas (precisa ter todas)
              </span>
              <div className={classes.etiquetas}>
                {tags.map((t) => {
                  const marcada = (rascunho.tagIds || []).includes(t.id);
                  return (
                    <Chip
                      key={t.id}
                      size="small"
                      label={t.name}
                      variant={marcada ? "filled" : "outlined"}
                      onClick={() => alternarTag(t.id)}
                      style={marcada ? { background: t.color, color: "#fff" } : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className={classes.rodape}>
            <Button size="small" disabled={ativos === 0} onClick={limpar}>
              Limpar filtros
            </Button>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={aplicar}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </Popover>
    </>
  );
};

export default FiltrosFunil;
