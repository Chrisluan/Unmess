import React, { useState, useEffect, useCallback } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/Block";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import Janela from "../../components/Janela";
import { moeda } from "../../components/Crm/calculoItem";

const useStyles = makeStyles((theme) => ({
  barra: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  espacador: { flex: 1 },
  ajuda: { fontSize: 13, color: theme.palette.text.secondary, maxWidth: 720 },
  inativo: { opacity: 0.55 },
  num: { fontVariantNumeric: "tabular-nums" },
  form: { display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 },
  linha: { display: "flex", gap: 12, flexWrap: "wrap" },
}));

export const UNIDADES_DE_INSUMO = [
  { valor: "m2", rotulo: "Metro quadrado (m²)" },
  { valor: "m", rotulo: "Metro (m)" },
  { valor: "un", rotulo: "Unidade (un)" },
  { valor: "kg", rotulo: "Quilo (kg)" },
  { valor: "l", rotulo: "Litro (l)" },
  { valor: "h", rotulo: "Hora (h) — mão de obra, máquina" },
];

const curto = (unidade) => (unidade === "m2" ? "m²" : unidade);

const VAZIO = { name: "", unit: "m2", cost: 0, wastePercent: 0 };

/**
 * Insumos: o que a empresa compra para produzir.
 *
 * É daqui que sai o custo dos produtos de preço calculado. Mudar o custo de
 * um insumo refaz na hora o preço de todo produto que o usa; orçamentos já
 * feitos não mudam (guardam o custo do dia).
 */
const InsumosTab = () => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("products:manage");

  const [insumos, setInsumos] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/insumos", {
        params: { includeInactive: mostrarInativos ? "true" : "false" },
      });
      setInsumos(data.insumos || []);
    } catch (err) {
      toastError(err);
    }
  }, [mostrarInativos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async () => {
    if (!editando?.name?.trim()) return;
    setSalvando(true);
    try {
      const dados = {
        name: editando.name.trim(),
        unit: editando.unit,
        cost: Number(editando.cost) || 0,
        wastePercent: Number(editando.wastePercent) || 0,
        active: editando.active !== false,
      };
      if (editando.id) await api.put(`/insumos/${editando.id}`, dados);
      else await api.post("/insumos", dados);
      setEditando(null);
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (insumo) => {
    try {
      await api.delete(`/insumos/${insumo.id}`);
      await carregar();
    } catch (err) {
      toastError(err);
    }
  };

  const mudar = (campo, valor) => setEditando((a) => ({ ...a, [campo]: valor }));
  const custoReal = (i) => (Number(i.cost) || 0) * (1 + (Number(i.wastePercent) || 0) / 100);

  return (
    <>
      <div className={classes.barra}>
        <Typography className={classes.ajuda}>
          O que você compra para produzir — lona, vinil, tinta, ilhós, hora de
          mão de obra. Os produtos de preço calculado somam o que consomem de
          cada insumo; mudar um custo aqui atualiza o preço deles na hora.
        </Typography>
        <span className={classes.espacador} />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={mostrarInativos}
              onChange={(e) => setMostrarInativos(e.target.checked)}
            />
          }
          label="Desativados"
        />
        {podeEditar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditando({ ...VAZIO })}>
            Insumo
          </Button>
        )}
      </div>

      <Paper variant="outlined" style={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Insumo</TableCell>
              <TableCell>Unidade</TableCell>
              <TableCell align="right">Custo</TableCell>
              <TableCell align="right">Perda</TableCell>
              <TableCell align="right">Custo com perda</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {insumos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" style={{ padding: 32, opacity: 0.7 }}>
                  Nenhum insumo cadastrado.
                </TableCell>
              </TableRow>
            )}
            {insumos.map((i) => (
              <TableRow key={i.id} className={i.active === false ? classes.inativo : undefined}>
                <TableCell>
                  {i.name}
                  {i.active === false ? " (desativado)" : ""}
                </TableCell>
                <TableCell>{curto(i.unit)}</TableCell>
                <TableCell align="right" className={classes.num}>
                  {moeda(i.cost)}
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {Number(i.wastePercent || 0).toLocaleString("pt-BR")}%
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {moeda(custoReal(i))} / {curto(i.unit)}
                </TableCell>
                <TableCell align="right" style={{ whiteSpace: "nowrap" }}>
                  {podeEditar && (
                    <>
                      <IconButton size="small" aria-label="Editar" onClick={() => setEditando({ ...i, _reativavel: i.active === false })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {i.active !== false && (
                        <IconButton size="small" aria-label="Desativar" onClick={() => desativar(i)}>
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Janela
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        titulo={editando?.id ? "Editar insumo" : "Novo insumo"}
        subtitulo="O custo de uma unidade, como você compra. A perda cobre refile, emenda e teste."
        icone={<ScienceOutlinedIcon />}
        rotuloConfirmar="Salvar"
        onConfirmar={salvar}
        carregando={salvando}
        confirmarDesabilitado={!editando?.name?.trim()}
      >
        {editando && (
          <div className={classes.form}>
            <TextField
              label="Nome"
              size="small"
              autoFocus
              value={editando.name}
              onChange={(e) => mudar("name", e.target.value)}
              placeholder="Lona 440g fosca"
            />
            <TextField
              select
              label="Unidade"
              size="small"
              value={editando.unit}
              onChange={(e) => mudar("unit", e.target.value)}
            >
              {UNIDADES_DE_INSUMO.map((u) => (
                <MenuItem key={u.valor} value={u.valor}>
                  {u.rotulo}
                </MenuItem>
              ))}
            </TextField>
            <div className={classes.linha}>
              <TextField
                label={`Custo por ${curto(editando.unit)}`}
                type="number"
                size="small"
                style={{ flex: 1, minWidth: 140 }}
                value={editando.cost}
                onChange={(e) => mudar("cost", e.target.value)}
                inputProps={{ min: 0, step: "0.0001" }}
              />
              <TextField
                label="Perda (%)"
                type="number"
                size="small"
                style={{ width: 130 }}
                value={editando.wastePercent}
                onChange={(e) => mudar("wastePercent", e.target.value)}
                inputProps={{ min: 0, max: 99, step: "0.1" }}
              />
            </div>
            {editando._reativavel && (
              <FormControlLabel
                control={
                  <Switch
                    checked={editando.active !== false}
                    onChange={(e) => mudar("active", e.target.checked)}
                  />
                }
                label="Ativo"
              />
            )}
          </div>
        )}
      </Janela>
    </>
  );
};

export default InsumosTab;
