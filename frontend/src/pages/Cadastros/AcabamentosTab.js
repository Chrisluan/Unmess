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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/Block";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import Janela from "../../components/Janela";
import { BASES_DE_ACABAMENTO, moeda, rotuloDaBase } from "../../components/Crm/calculoItem";

const useStyles = makeStyles((theme) => ({
  barra: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  espacador: { flex: 1 },
  ajuda: { fontSize: 13, color: theme.palette.text.secondary, maxWidth: 720 },
  ajudaCampo: { fontSize: 12, color: theme.palette.text.secondary, marginTop: -6 },
  inativo: { opacity: 0.55 },
  num: { fontVariantNumeric: "tabular-nums" },
  form: { display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 },
  linha: { display: "flex", gap: 12, flexWrap: "wrap" },
}));

const VAZIO = {
  name: "",
  base: "perimetro",
  cost: 0,
  minCost: 0,
  priceMode: "calculado",
  price: 0,
  minPrice: 0,
};

const unidadeDaBase = (base) =>
  ({ area: "m²", perimetro: "m", linear: "m", unidade: "peça", fixo: "item" }[base] || "");

/**
 * Acabamentos: ilhós, bainha, laminação, refile, instalação.
 *
 * Entram no item do orçamento por cima do material, cada um cobrado pela sua
 * base (área, contorno, comprimento, peça ou valor fixo). O preço vem do custo
 * pelo markup da empresa, ou é digitado.
 */
const AcabamentosTab = () => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("products:manage");
  const verCusto = can("products:viewCost");

  const [acabamentos, setAcabamentos] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get("/acabamentos", {
        params: { includeInactive: mostrarInativos ? "true" : "false" },
      });
      setAcabamentos(data.acabamentos || []);
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
        base: editando.base,
        priceMode: editando.priceMode,
        price: Number(editando.price) || 0,
        minPrice: Number(editando.minPrice) || 0,
        active: editando.active !== false,
      };
      // Quem não vê custo recebeu null; mandar zero apagaria o custo real.
      if (verCusto) {
        dados.cost = Number(editando.cost) || 0;
        dados.minCost = Number(editando.minCost) || 0;
      }
      if (editando.id) await api.put(`/acabamentos/${editando.id}`, dados);
      else await api.post("/acabamentos", dados);
      setEditando(null);
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const desativar = async (a) => {
    try {
      await api.delete(`/acabamentos/${a.id}`);
      await carregar();
    } catch (err) {
      toastError(err);
    }
  };

  const mudar = (campo, valor) => setEditando((a) => ({ ...a, [campo]: valor }));
  const calculado = editando?.priceMode === "calculado";
  const fixo = editando?.base === "fixo";

  return (
    <>
      <div className={classes.barra}>
        <Typography className={classes.ajuda}>
          Serviços que se somam ao produto no orçamento. Cada um é cobrado pela
          sua base — por m², por metro de contorno, por metro linear, por peça
          ou um valor fixo no item — com um mínimo para peças pequenas.
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
            Acabamento
          </Button>
        )}
      </div>

      <Paper variant="outlined" style={{ overflowX: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Acabamento</TableCell>
              <TableCell>Cobrado</TableCell>
              {verCusto && <TableCell align="right">Custo</TableCell>}
              <TableCell align="right">Preço</TableCell>
              <TableCell align="right">Mínimo</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {acabamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" style={{ padding: 32, opacity: 0.7 }}>
                  Nenhum acabamento cadastrado.
                </TableCell>
              </TableRow>
            )}
            {acabamentos.map((a) => (
              <TableRow key={a.id} className={a.active === false ? classes.inativo : undefined}>
                <TableCell>
                  {a.name}
                  {a.active === false ? " (desativado)" : ""}
                </TableCell>
                <TableCell>{rotuloDaBase(a.base)}</TableCell>
                {verCusto && (
                  <TableCell align="right" className={classes.num}>
                    {moeda(a.cost)}
                  </TableCell>
                )}
                <TableCell align="right" className={classes.num}>
                  {moeda(a.price)}
                  {a.base !== "fixo" ? ` / ${unidadeDaBase(a.base)}` : ""}
                  {a.priceMode === "calculado" ? " · calc." : ""}
                </TableCell>
                <TableCell align="right" className={classes.num}>
                  {a.base === "fixo" || !Number(a.minPrice) ? "—" : moeda(a.minPrice)}
                </TableCell>
                <TableCell align="right" style={{ whiteSpace: "nowrap" }}>
                  {podeEditar && (
                    <>
                      <IconButton
                        size="small"
                        aria-label="Editar"
                        onClick={() => setEditando({ ...a, _reativavel: a.active === false })}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      {a.active !== false && (
                        <IconButton size="small" aria-label="Desativar" onClick={() => desativar(a)}>
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
        titulo={editando?.id ? "Editar acabamento" : "Novo acabamento"}
        subtitulo="Orçamentos já feitos guardam o preço do dia: mudar aqui vale daqui para a frente."
        icone={<LayersOutlinedIcon />}
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
              placeholder="Ilhós a cada 50 cm"
            />
            <TextField
              select
              label="Cobrado"
              size="small"
              value={editando.base}
              onChange={(e) => mudar("base", e.target.value)}
            >
              {BASES_DE_ACABAMENTO.map((b) => (
                <MenuItem key={b.valor} value={b.valor}>
                  {b.rotulo}
                </MenuItem>
              ))}
            </TextField>

            {verCusto && (
              <div className={classes.linha}>
                <TextField
                  label={fixo ? "Custo" : `Custo por ${unidadeDaBase(editando.base)}`}
                  type="number"
                  size="small"
                  style={{ flex: 1, minWidth: 140 }}
                  value={editando.cost ?? ""}
                  onChange={(e) => mudar("cost", e.target.value)}
                  inputProps={{ min: 0, step: "0.0001" }}
                />
                {!fixo && (
                  <TextField
                    label="Custo mínimo no item"
                    type="number"
                    size="small"
                    style={{ flex: 1, minWidth: 140 }}
                    value={editando.minCost ?? ""}
                    onChange={(e) => mudar("minCost", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }}
                  />
                )}
              </div>
            )}

            <ToggleButtonGroup
              exclusive
              size="small"
              value={editando.priceMode}
              onChange={(_e, v) => v && mudar("priceMode", v)}
            >
              <ToggleButton value="calculado">Preço pelo markup</ToggleButton>
              <ToggleButton value="manual">Preço digitado</ToggleButton>
            </ToggleButtonGroup>

            {calculado ? (
              <span className={classes.ajudaCampo}>
                O preço e o mínimo saem do custo pelo markup da empresa (Ajustes),
                e acompanham quando ele muda.
              </span>
            ) : (
              <div className={classes.linha}>
                <TextField
                  label={fixo ? "Preço" : `Preço por ${unidadeDaBase(editando.base)}`}
                  type="number"
                  size="small"
                  style={{ flex: 1, minWidth: 140 }}
                  value={editando.price}
                  onChange={(e) => mudar("price", e.target.value)}
                  inputProps={{ min: 0, step: "0.0001" }}
                />
                {!fixo && (
                  <TextField
                    label="Mínimo no item"
                    type="number"
                    size="small"
                    style={{ flex: 1, minWidth: 140 }}
                    value={editando.minPrice}
                    onChange={(e) => mudar("minPrice", e.target.value)}
                    inputProps={{ min: 0, step: "0.01" }}
                  />
                )}
              </div>
            )}

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

export default AcabamentosTab;
