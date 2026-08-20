import React, { useState, useEffect, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import Popper from "@mui/material/Popper";
import Paper from "@mui/material/Paper";

import api from "../../../services/api";

const useStyles = makeStyles((theme) => ({
  lista: {
    maxHeight: 240,
    overflowY: "auto",
    minWidth: 280,
    zIndex: 1400,
  },

  opcao: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "7px 10px",
    cursor: "pointer",
    borderBottom: `1px solid ${theme.palette.divider}`,
    "&:hover": { background: theme.palette.action.hover },
  },

  marcada: { background: theme.palette.action.selected },
  nome: { fontSize: 13, fontWeight: 500 },
  detalhe: { fontSize: 11, color: theme.palette.text.secondary },
  preco: {
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  vazio: { padding: "10px 12px", fontSize: 12.5, color: theme.palette.text.secondary },
}));

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Campo de descrição do item com busca no catálogo.
 *
 * É o mesmo campo de texto de sempre: quem digita um serviço avulso continua
 * digitando e nada muda. A diferença é que, ao escrever, aparecem os produtos
 * cadastrados — e escolher um preenche unidade e preço de uma vez.
 *
 * Não vira um seletor obrigatório de propósito: nem toda linha de orçamento
 * merece cadastro, e forçar o catálogo faria as pessoas cadastrarem lixo só
 * para conseguir orçar.
 */
const SeletorProduto = ({ valor, onChange, onEscolherProduto, disabled }) => {
  const classes = useStyles();

  const campo = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [destaque, setDestaque] = useState(0);

  useEffect(() => {
    const termo = (valor || "").trim();
    if (!aberto || termo.length < 2) {
      setProdutos([]);
      return undefined;
    }

    let ativo = true;
    // Espera a digitação parar: sem isto seria uma consulta por tecla.
    const relogio = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", { params: { searchParam: termo } });
        if (ativo) {
          setProdutos(data.products || []);
          setDestaque(0);
        }
      } catch {
        // Catálogo indisponível não pode impedir de digitar o item à mão.
      }
    }, 300);

    return () => {
      ativo = false;
      clearTimeout(relogio);
    };
  }, [valor, aberto]);

  const escolher = (produto) => {
    onEscolherProduto(produto);
    setAberto(false);
    setProdutos([]);
  };

  const aoTeclar = (e) => {
    if (!produtos.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setDestaque((d) => Math.min(d + 1, produtos.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDestaque((d) => Math.max(d - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(produtos[destaque]);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  };

  return (
    <>
      <TextField
        inputRef={campo}
        size="small"
        variant="standard"
        placeholder="Descrição ou produto"
        value={valor || ""}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        // O atraso deixa o clique na lista acontecer antes de ela fechar.
        onBlur={() => setTimeout(() => setAberto(false), 180)}
        onKeyDown={aoTeclar}
        fullWidth
      />

      <Popper
        open={aberto && produtos.length > 0}
        anchorEl={campo.current}
        placement="bottom-start"
        style={{ zIndex: 1400 }}
      >
        <Paper className={classes.lista} elevation={4}>
          {produtos.map((p, i) => (
            <div
              key={p.id}
              className={`${classes.opcao} ${i === destaque ? classes.marcada : ""}`}
              onMouseDown={() => escolher(p)}
              onMouseEnter={() => setDestaque(i)}
            >
              <div style={{ minWidth: 0 }}>
                <div className={classes.nome}>{p.name}</div>
                <div className={classes.detalhe}>
                  {p.code ? `${p.code} · ` : ""}
                  por {p.unit}
                  {p.category ? ` · ${p.category}` : ""}
                </div>
              </div>
              <span className={classes.preco}>{moeda(p.price)}</span>
            </div>
          ))}
        </Paper>
      </Popper>
    </>
  );
};

export default SeletorProduto;
