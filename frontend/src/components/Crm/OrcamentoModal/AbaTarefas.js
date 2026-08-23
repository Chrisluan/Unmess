import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/DeleteOutline";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  /**
   * Tipos como botões, e não como lista suspensa.
   *
   * A escolha do tipo é a primeira decisão ao registrar algo, e um seletor
   * fechado esconde justamente as opções que ensinam o que se registra ali.
   */
  tipos: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 1,
    background: theme.palette.divider,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    overflow: "hidden",
    marginBottom: 12,
  },

  tipo: {
    background: theme.palette.background.paper,
    border: "none",
    padding: "11px 8px",
    font: "inherit",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    color: theme.palette.text.primary,
    borderBottom: "3px solid transparent",
    transition: "background .12s",
    "&:hover": { background: theme.palette.action.hover },
  },

  tipoAtivo: { borderBottomColor: "currentColor" },

  compositor: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    padding: 12,
    marginBottom: 20,
  },

  acoesCompositor: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    flexWrap: "wrap",
  },

  historico: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
    marginBottom: 10,
  },

  registro: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 0,
    marginBottom: 8,
    overflow: "hidden",
  },

  registroTopo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: theme.palette.action.hover,
  },

  registroTitulo: { fontSize: 13, fontWeight: 700 },
  registroMeta: { fontSize: 11, color: theme.palette.text.secondary },
  registroCorpo: { padding: "10px 12px", fontSize: 13, whiteSpace: "pre-wrap" },
  concluida: { textDecoration: "line-through", opacity: 0.6 },
  vazio: { padding: "22px 0", textAlign: "center" },
}));

const AbaTarefas = ({ deal, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("crm:edit");

  const [tipos, setTipos] = useState([]);
  const [tipoEscolhido, setTipoEscolhido] = useState("contato");
  const [texto, setTexto] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    api
      .get("/tipos-de-tarefa")
      .then(({ data }) => ativo && setTipos(data.tipos || []))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  const criar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/deals/${deal.id}/activities`, {
        type: "task",
        taskKind: tipoEscolhido,
        body: texto.trim(),
        dueAt: vencimento || null,
      });
      setTexto("");
      setVencimento("");
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (atividade) => {
    try {
      await api.put(`/deal-activities/${atividade.id}`, {
        done: !atividade.doneAt,
      });
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    }
  };

  const excluir = async (atividade) => {
    if (!window.confirm("Excluir este registro?")) return;
    try {
      await api.delete(`/deal-activities/${atividade.id}`);
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    }
  };

  const registros = deal.activities || [];
  const rotuloDoTipo = (id) => tipos.find((t) => t.id === id);

  return (
    <>
      {podeEditar && (
        <>
          <div className={classes.tipos}>
            {tipos.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${classes.tipo} ${
                  tipoEscolhido === t.id ? classes.tipoAtivo : ""
                }`}
                style={{ color: tipoEscolhido === t.id ? t.cor : undefined }}
                onClick={() => setTipoEscolhido(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={classes.compositor}>
            <TextField
              fullWidth
              multiline
              rows={3}
              variant="standard"
              placeholder="Digite aqui o que precisa ser feito…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />

            <div className={classes.acoesCompositor}>
              <TextField
                type="date"
                size="small"
                variant="outlined"
                label="Prazo"
                InputLabelProps={{ shrink: true }}
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <Button
                  size="small"
                  onClick={() => {
                    setTexto("");
                    setVencimento("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={criar}
                  disabled={salvando || !texto.trim()}
                >
                  Criar tarefa
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className={classes.historico}>Histórico</div>

      {registros.length === 0 ? (
        <div className={classes.vazio}>
          <Typography variant="body2" color="textSecondary">
            Nada registrado neste orçamento ainda.
          </Typography>
        </div>
      ) : (
        registros.map((r) => {
          const tipo = rotuloDoTipo(r.taskKind);
          const ehTarefa = r.type === "task";
          const concluida = Boolean(r.doneAt);

          return (
            <div key={r.id} className={classes.registro}>
              <div className={classes.registroTopo}>
                {ehTarefa && (
                  <Checkbox
                    size="small"
                    checked={concluida}
                    disabled={!podeEditar}
                    onChange={() => alternar(r)}
                    style={{ padding: 0 }}
                  />
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    className={`${classes.registroTitulo} ${
                      concluida ? classes.concluida : ""
                    }`}
                    style={{ color: tipo?.cor }}
                  >
                    {tipo?.label || (ehTarefa ? "Tarefa" : "Anotação")}
                  </div>
                  <div className={classes.registroMeta}>
                    {r.createdAt &&
                      format(parseISO(r.createdAt), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    {r.user ? ` por ${r.user.name}` : ""}
                    {r.dueAt
                      ? ` · prazo ${format(parseISO(r.dueAt), "dd/MM/yyyy")}`
                      : ""}
                  </div>
                </div>

                {podeEditar && ["note", "task"].includes(r.type) && (
                  <IconButton size="small" onClick={() => excluir(r)} title="Excluir">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                )}
              </div>

              {r.body && <div className={classes.registroCorpo}>{r.body}</div>}
            </div>
          );
        })
      )}
    </>
  );
};

export default AbaTarefas;
