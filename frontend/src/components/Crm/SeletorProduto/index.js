import React, { useState, useEffect, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Popper from "@mui/material/Popper";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import SearchIcon from "@mui/icons-material/Search";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import api from "../../../services/api";
import CatalogoProdutos from "../CatalogoProdutos";
import { moeda } from "../calculoItem";

const useStyles = makeStyles((theme) => ({
  lista: {
    maxHeight: 260,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },

  opcao: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
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

  // Última linha da lista suspensa: o catálogo inteiro fica a um clique de
  // quem digitou e não achou o que queria pelo nome.
  rodapeLista: {
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    color: theme.palette.primary.main,
    "&:hover": { background: theme.palette.action.hover },
  },

  botaoCatalogo: { padding: 2 },

  // Marca discreta de que a linha veio do catálogo, e não de texto digitado:
  // é o que diferencia um item que soma no relatório de produtos de um avulso.
  marcaCatalogo: { color: theme.palette.primary.main, fontSize: 16 },
}));

/**
 * Campo de descrição do item, com o catálogo ao lado.
 *
 * Continua sendo um campo de texto: quem vende um serviço avulso digita e
 * segue: nem toda linha de orçamento merece cadastro, e forçar o catálogo faz
 * as pessoas cadastrarem lixo só para conseguir orçar.
 *
 * O que mudou é que o catálogo deixou de depender de a lista suspensa aparecer.
 * A busca enquanto se digita continua no desktop, onde funciona bem; no
 * celular ela era inalcançável -- lista flutuante, campo estreito e teclado na
 * frente --, e lá o botão abre o catálogo em tela cheia, que é a mesma coisa
 * feita com o dedo.
 */
const SeletorProduto = ({
  valor,
  onChange,
  onEscolherProduto,
  disabled,
  vinculado = false,
  autoFocus = false,
  placeholder = "Descrição ou produto",
  variant = "standard",
}) => {
  const classes = useStyles();
  const theme = useTheme();
  // A lista suspensa exige mouse e uma tela que caiba os dois. No toque o
  // caminho é o catálogo em tela cheia.
  const sugestoesInline = useMediaQuery(theme.breakpoints.up("md"));

  const campo = useRef(null);
  const [aberto, setAberto] = useState(false);
  const [produtos, setProdutos] = useState([]);
  const [destaque, setDestaque] = useState(0);
  const [catalogoAberto, setCatalogoAberto] = useState(false);

  useEffect(() => {
    const termo = (valor || "").trim();
    if (!sugestoesInline || !aberto || termo.length < 2) {
      setProdutos([]);
      return undefined;
    }

    let ativo = true;
    // Espera a digitação parar: sem isto seria uma consulta por tecla.
    const relogio = setTimeout(async () => {
      try {
        const { data } = await api.get("/products", {
          params: { searchParam: termo },
        });
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
  }, [valor, aberto, sugestoesInline]);

  const escolher = (produto) => {
    onEscolherProduto(produto);
    setAberto(false);
    setProdutos([]);
  };

  const abrirCatalogo = () => {
    setAberto(false);
    setCatalogoAberto(true);
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
        variant={variant}
        placeholder={placeholder}
        value={valor || ""}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        // O atraso deixa o clique na lista acontecer antes de ela fechar.
        onBlur={() => setTimeout(() => setAberto(false), 180)}
        onKeyDown={aoTeclar}
        fullWidth
        InputProps={{
          startAdornment: vinculado ? (
            <InputAdornment position="start">
              <Tooltip title="Item do catálogo" arrow>
                <Inventory2OutlinedIcon className={classes.marcaCatalogo} />
              </Tooltip>
            </InputAdornment>
          ) : null,
          endAdornment: disabled ? null : (
            <InputAdornment position="end">
              <Tooltip title="Buscar no catálogo" arrow>
                <IconButton
                  size="small"
                  className={classes.botaoCatalogo}
                  onClick={abrirCatalogo}
                  aria-label="Buscar no catálogo"
                >
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ),
        }}
      />

      <Popper
        open={sugestoesInline && aberto && produtos.length > 0}
        anchorEl={campo.current}
        placement="bottom-start"
        // Acima do diálogo do orçamento (1300), abaixo do toast.
        style={{
          zIndex: 1400,
          // Acompanha o campo: com largura fixa a lista estourava a coluna da
          // descrição em telas médias.
          width: Math.max(campo.current?.offsetWidth || 0, 280),
        }}
      >
        <Paper className={classes.lista} elevation={4}>
          {produtos.map((p, i) => (
            <div
              key={p.id}
              className={`${classes.opcao} ${
                i === destaque ? classes.marcada : ""
              }`}
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

          <div className={classes.rodapeLista} onMouseDown={abrirCatalogo}>
            Ver o catálogo completo
          </div>
        </Paper>
      </Popper>

      <CatalogoProdutos
        open={catalogoAberto}
        onClose={() => setCatalogoAberto(false)}
        multiplo={false}
        termoInicial={valor || ""}
        onConfirmar={([escolha]) => escolha && escolher(escolha.produto)}
      />
    </>
  );
};

export default SeletorProduto;
