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
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/Block";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import EmptyState from "../../components/EmptyState";
import SearchField from "../../components/SearchField";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import ConfirmationModal from "../../components/ConfirmationModal";
import ProdutoModal from "../../components/ProdutoModal";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  area: {
    flex: 1,
    padding: theme.spacing(1),
    overflowY: "auto",
    // Sem isto a tabela larga estoura o painel e rola a página inteira.
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },

  numero: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },

  // A margem colore sozinha: abaixo de 20% costuma ser prejuízo depois do
  // desconto que o vendedor dá, e isso precisa saltar aos olhos na lista.
  margemBoa: { color: theme.palette.success.main, fontWeight: 700 },
  margemBaixa: { color: theme.palette.error.main, fontWeight: 700 },

  inativo: { opacity: 0.5 },
  vazio: { padding: theme.spacing(6), textAlign: "center" },
  busca: { width: 260 },
}));

const MODOS = {
  unit: "Unidade",
  area: "m²",
  linear: "Metro",
};

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/**
 * Catálogo de produtos e serviços.
 *
 * É aqui que se decide como cada produto é cobrado — por peça, metro quadrado
 * ou metro linear — e qual o mínimo. O orçamento lê isso ao escolher o produto,
 * então errar aqui contamina todo pedido feito daqui para a frente.
 */
const Products = () => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeGerenciar = can("products:manage");

  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [emEdicao, setEmEdicao] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [paraDesativar, setParaDesativar] = useState(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/products", {
        params: {
          searchParam: busca || undefined,
          includeInactive: mostrarInativos ? "true" : undefined,
        },
      });
      setProdutos(data.products || []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [busca, mostrarInativos]);

  useEffect(() => {
    // Espera a digitação parar: sem isto seria uma consulta por tecla.
    const relogio = setTimeout(buscar, busca ? 350 : 0);
    return () => clearTimeout(relogio);
  }, [buscar, busca]);

  const abrirNovo = () => {
    setEmEdicao(null);
    setModalAberto(true);
  };

  const abrirEdicao = (produto) => {
    setEmEdicao(produto);
    setModalAberto(true);
  };

  const desativar = async () => {
    if (!paraDesativar) return;
    try {
      await api.delete(`/products/${paraDesativar.id}`);
      await buscar();
    } catch (err) {
      toastError(err);
    } finally {
      setParaDesativar(null);
    }
  };

  const margemDe = (p) => {
    if (!p.price) return null;
    return Number((((p.price - p.cost) / p.price) * 100).toFixed(1));
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={`Desativar ${paraDesativar?.name || ""}?`}
        open={Boolean(paraDesativar)}
        onClose={() => setParaDesativar(null)}
        confirmLabel="Desativar produto"
        onConfirm={desativar}
      >
        O produto deixa de aparecer ao montar orçamentos. Os orçamentos antigos
        que o usam continuam intactos — por isso ele é desativado, e não
        excluído.
      </ConfirmationModal>

      <ProdutoModal
        open={modalAberto}
        produto={emEdicao}
        onClose={() => setModalAberto(false)}
        onSalvo={buscar}
      />

      <MainHeader>
        <Title>Produtos</Title>
        <MainHeaderButtonsWrapper>
          <SearchField
            className={classes.busca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onClear={() => setBusca("")}
            placeholder="Buscar por nome ou código"
          />

          {/* "Inativos" sozinho não dizia se ligar mostrava ou escondia. */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={mostrarInativos}
                onChange={(e) => setMostrarInativos(e.target.checked)}
              />
            }
            label={
              <span style={{ fontSize: 13 }}>Mostrar produtos inativos</span>
            }
          />

          {podeGerenciar && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={abrirNovo}
            >
              Novo produto
            </Button>
          )}
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.area} variant="outlined">
        {carregando && produtos.length === 0 ? (
          <div className={classes.vazio}>
            <CircularProgress />
          </div>
        ) : produtos.length === 0 ? (
          <EmptyState
            icon={busca ? SearchOffIcon : Inventory2OutlinedIcon}
            title={
              busca ? "Nada encontrado" : "Nenhum produto cadastrado"
            }
            description={
              busca
                ? "Nenhum produto com esse nome ou código."
                : "Cadastre o que você vende para montar orçamentos sem digitar tudo de novo a cada pedido."
            }
            action={
              !busca &&
              podeGerenciar && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={abrirNovo}
                >
                  Novo produto
                </Button>
              )
            }
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Produto</TableCell>
                <TableCell>Categoria</TableCell>
                <TableCell>Cobrança</TableCell>
                <TableCell align="right">Preço</TableCell>
                <TableCell align="right">Custo</TableCell>
                <TableCell align="right">Margem</TableCell>
                <TableCell align="right">Mínimo</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {produtos.map((p) => {
                const margem = margemDe(p);

                return (
                  <TableRow
                    key={p.id}
                    hover
                    className={p.active === false ? classes.inativo : ""}
                  >
                    <TableCell>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {(p.code || p.active === false) && (
                        <div style={{ fontSize: 11, opacity: 0.7 }}>
                          {p.code}
                          {p.active === false ? " · inativo" : ""}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {p.category ? (
                        <Chip size="small" label={p.category} variant="outlined" />
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell>
                      {MODOS[p.pricingMode] || MODOS.unit}
                      <span style={{ fontSize: 11, opacity: 0.7 }}> / {p.unit}</span>
                    </TableCell>

                    <TableCell align="right" className={classes.numero}>
                      {moeda(p.price)}
                    </TableCell>

                    <TableCell align="right" className={classes.numero}>
                      {p.cost ? moeda(p.cost) : "—"}
                    </TableCell>

                    <TableCell align="right" className={classes.numero}>
                      {margem === null || !p.cost ? (
                        "—"
                      ) : (
                        <span
                          className={
                            margem < 20 ? classes.margemBaixa : classes.margemBoa
                          }
                        >
                          {margem}%
                        </span>
                      )}
                    </TableCell>

                    <TableCell align="right" className={classes.numero}>
                      {p.pricingMode === "unit" || !p.minMeasure
                        ? "—"
                        : `${Number(p.minMeasure).toLocaleString("pt-BR")} ${
                            p.pricingMode === "area" ? "m²" : "m"
                          }`}
                    </TableCell>

                    <TableCell align="center">
                      {podeGerenciar && (
                        <>
                          <IconButton size="small" onClick={() => abrirEdicao(p)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          {p.active !== false && (
                            <IconButton
                              size="small"
                              onClick={() => setParaDesativar(p)}
                              title="Desativar"
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </MainContainer>
  );
};

export default Products;
