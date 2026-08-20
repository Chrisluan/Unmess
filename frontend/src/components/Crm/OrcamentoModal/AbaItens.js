import React, { useState, useEffect } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PrintIcon from "@mui/icons-material/Print";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import { getBackendUrl } from "../../../config";
import SeletorProduto from "../SeletorProduto";

const useStyles = makeStyles((theme) => ({
  barra: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 12,
  },

  cabecalho: {
    display: "grid",
    gridTemplateColumns: "1fr 74px 58px 104px 96px 104px 34px",
    gap: 8,
    padding: "0 4px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },

  linha: {
    display: "grid",
    gridTemplateColumns: "1fr 74px 58px 104px 96px 104px 34px",
    gap: 8,
    alignItems: "center",
    padding: "5px 4px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  total: {
    textAlign: "right",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontSize: 13.5,
    paddingRight: 6,
  },

  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTop: `2px solid ${theme.palette.divider}`,
  },

  somaFinal: { fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  vazio: { padding: "26px 0", textAlign: "center" },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const totalDaLinha = (item) =>
  Math.max(
    0,
    Number(item.quantity || 0) * Number(item.unitPrice || 0) -
      Number(item.discount || 0)
  );

/**
 * Itens do orçamento.
 *
 * A lista inteira é salva de uma vez, como o backend espera: editar várias
 * linhas e mandar uma chamada por linha deixaria o pedido pela metade se a
 * conexão caísse no meio.
 */
const AbaItens = ({ deal, onSalvo }) => {
  const classes = useStyles();
  const { can } = usePermissions();
  const podeEditar = can("crm:edit");

  const [itens, setItens] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setItens(
      (deal.items || []).map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "un",
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        productId: i.productId || null,
      }))
    );
  }, [deal]);

  const mudar = (indice, campo, valor) =>
    setItens((atual) =>
      atual.map((item, i) => (i === indice ? { ...item, [campo]: valor } : item))
    );

  /**
   * Produto escolhido preenche a linha.
   *
   * O preço é copiado, e não referenciado: o que o cliente aprova é o valor
   * daquele dia, e um reajuste no catálogo não pode reescrever orçamento já
   * fechado. O productId fica guardado só para saber o que foi vendido.
   */
  const escolherProduto = (indice, produto) =>
    setItens((atual) =>
      atual.map((item, i) =>
        i === indice
          ? {
              ...item,
              productId: produto.id,
              description: produto.name,
              unit: produto.unit || "un",
              unitPrice: produto.price,
            }
          : item
      )
    );

  const adicionar = () =>
    setItens((atual) => [
      ...atual,
      { description: "", quantity: 1, unit: "un", unitPrice: 0, discount: 0 },
    ]);

  const remover = (indice) =>
    setItens((atual) => atual.filter((_, i) => i !== indice));

  const soma = itens.reduce((s, i) => s + totalDaLinha(i), 0);

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/deals/${deal.id}/items`, {
        items: itens.filter((i) => i.description?.trim()),
      });
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className={classes.barra}>
        <Button
          size="small"
          startIcon={<PrintIcon />}
          onClick={() =>
            window.open(
              `${getBackendUrl()}/deals/${deal.id}/ordem-servico`,
              "_blank",
              "noopener"
            )
          }
        >
          Ordem de serviço
        </Button>
        {podeEditar && (
          <Button size="small" startIcon={<AddIcon />} onClick={adicionar}>
            Novo item
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <div className={classes.vazio}>
          <Typography variant="body2" color="textSecondary">
            Nenhum item neste orçamento. Adicione o que será cobrado.
          </Typography>
        </div>
      ) : (
        <>
          <div className={classes.cabecalho}>
            <span>Descrição</span>
            <span>Qtd.</span>
            <span>Un.</span>
            <span>Unitário</span>
            <span>Desconto</span>
            <span style={{ textAlign: "right" }}>Total</span>
            <span />
          </div>

          {itens.map((item, i) => (
            <div key={item.id || `novo-${i}`} className={classes.linha}>
              <SeletorProduto
                valor={item.description}
                disabled={!podeEditar}
                onChange={(v) => mudar(i, "description", v)}
                onEscolherProduto={(produto) => escolherProduto(i, produto)}
              />
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.quantity}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "quantity", e.target.value)}
                inputProps={{ min: 0, step: "0.001" }}
              />
              <TextField
                size="small"
                variant="standard"
                value={item.unit}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "unit", e.target.value)}
              />
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.unitPrice}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "unitPrice", e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
              />
              <TextField
                size="small"
                variant="standard"
                type="number"
                value={item.discount}
                disabled={!podeEditar}
                onChange={(e) => mudar(i, "discount", e.target.value)}
                inputProps={{ min: 0, step: "0.01" }}
              />
              <span className={classes.total}>{moeda(totalDaLinha(item))}</span>
              {podeEditar ? (
                <IconButton size="small" onClick={() => remover(i)} title="Remover">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ) : (
                <span />
              )}
            </div>
          ))}
        </>
      )}

      <div className={classes.rodape}>
        <Typography variant="body2" color="textSecondary">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
        </Typography>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className={classes.somaFinal}>{moeda(soma)}</span>
          {podeEditar && (
            <Button variant="contained" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar itens"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default AbaItens;
