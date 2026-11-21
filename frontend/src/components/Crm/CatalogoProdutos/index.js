import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import Dialog from "@mui/material/Dialog";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ClearIcon from "@mui/icons-material/Clear";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import CheckIcon from "@mui/icons-material/Check";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

import api from "../../../services/api";
import usePermissions from "../../../hooks/usePermissions";
import ProdutoModal from "../../ProdutoModal";
import { moeda, rotuloDoModo } from "../calculoItem";

const useStyles = makeStyles((theme) => ({
  /**
   * A janela tem altura própria e não cresce com a lista.
   *
   * Sem isso o catálogo de trezentos produtos esticava o diálogo além da tela
   * e a barra de busca -- que é por onde tudo começa -- saía de vista junto
   * com o rodapé.
   */
  janela: {
    display: "flex",
    flexDirection: "column",
    height: "min(640px, 90vh)",
  },

  janelaCheia: { display: "flex", flexDirection: "column" },

  topo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "10px 8px 10px 16px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  titulo: { fontSize: 15, fontWeight: 700 },

  busca: { padding: "12px 16px 8px" },

  // Rola na horizontal em vez de quebrar em três linhas: no celular as
  // categorias empurrariam a lista para fora da tela.
  categorias: {
    display: "flex",
    gap: 6,
    padding: "0 16px 10px",
    overflowX: "auto",
    scrollbarWidth: "none",
    "&::-webkit-scrollbar": { display: "none" },
  },

  categoria: { borderRadius: 0, flexShrink: 0 },

  lista: {
    flex: 1,
    overflowY: "auto",
    borderTop: `1px solid ${theme.palette.divider}`,
    ...theme.scrollbarStyles,
  },

  /**
   * Uma linha do catálogo.
   *
   * 56px de altura mínima é o alvo de toque confortável: a lista anterior
   * tinha 7px de espaçamento e, no dedo, acertar era sorte.
   */
  linha: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 56,
    padding: "8px 16px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    cursor: "pointer",
    color: theme.palette.text.primary,
    "&:hover": { background: theme.palette.action.hover },
  },

  linhaEscolhida: {
    background: theme.palette.action.selected,
    // A barra na margem marca o escolhido sem depender de cor de fundo, que
    // se confunde com o hover no modo escuro.
    boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
  },

  marca: {
    width: 22,
    height: 22,
    flexShrink: 0,
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "transparent",
  },

  marcaAtiva: {
    borderColor: theme.palette.primary.main,
    background: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
  },

  dados: { flex: 1, minWidth: 0 },
  nome: { fontSize: 14, fontWeight: 600, lineHeight: 1.3 },

  detalhe: {
    fontSize: 11.5,
    color: theme.palette.text.secondary,
    marginTop: 2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  preco: {
    fontSize: 14,
    fontWeight: 700,
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },

  precoUnidade: {
    display: "block",
    fontSize: 10.5,
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },

  // O contador fica na própria linha do produto: mandar para outra tela só
  // para dizer "quantos" dobraria os toques do lançamento mais comum.
  contador: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
    border: `1px solid ${theme.palette.divider}`,
  },

  botaoContador: { borderRadius: 0, padding: 4 },

  campoQuantidade: {
    width: 46,
    "& input": {
      textAlign: "center",
      fontSize: 13,
      fontWeight: 700,
      padding: "4px 0",
      fontVariantNumeric: "tabular-nums",
    },
  },

  estado: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "48px 24px",
    textAlign: "center",
    color: theme.palette.text.secondary,
  },

  rodape: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 16px",
    borderTop: `1px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
  },

  resumo: { fontSize: 12.5, color: theme.palette.text.secondary, lineHeight: 1.35 },
  resumoForte: { fontWeight: 700, color: theme.palette.text.primary },
}));

/**
 * Catálogo de produtos para lançar no orçamento.
 *
 * Substitui o autocompletar que só existia enquanto se digitava. Aquele modelo
 * assumia que quem lança já sabe o nome do produto de cor -- e, no celular,
 * que uma lista suspensa caberia sobre um campo espremido numa tabela de oito
 * colunas. Não cabia: no telefone o seletor simplesmente não aparecia.
 *
 * Aqui o catálogo é uma tela inteira: dá para procurar, filtrar por categoria,
 * folhear o que existe e marcar vários produtos com a quantidade de cada um
 * antes de voltar para o orçamento com tudo de uma vez.
 */
const CatalogoProdutos = ({
  open,
  onClose,
  onConfirmar,
  multiplo = true,
  termoInicial = "",
}) => {
  const classes = useStyles();
  const theme = useTheme();
  const telaPequena = useMediaQuery(theme.breakpoints.down("sm"));
  const { can } = usePermissions();

  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(false);
  const [escolhidos, setEscolhidos] = useState([]);
  const [cadastroAberto, setCadastroAberto] = useState(false);

  const campoBusca = useRef(null);

  useEffect(() => {
    if (!open) return;
    setTermo(termoInicial || "");
    setCategoria("");
    setEscolhidos([]);
  }, [open, termoInicial]);

  useEffect(() => {
    if (!open) return;
    api
      .get("/products/categories")
      .then(({ data }) => setCategorias(data.categories || []))
      .catch(() => setCategorias([]));
  }, [open]);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get("/products", {
        params: {
          ...(termo.trim() ? { searchParam: termo.trim() } : {}),
          ...(categoria ? { category: categoria } : {}),
        },
      });
      setProdutos(data.products || []);
      setErro(false);
    } catch {
      // Catálogo fora do ar não pode travar o orçamento: a aba de itens
      // continua aceitando descrição digitada à mão.
      setProdutos([]);
      setErro(true);
    } finally {
      setCarregando(false);
    }
  }, [termo, categoria]);

  useEffect(() => {
    if (!open) return undefined;
    // Espera a digitação parar: sem isto seria uma consulta por tecla.
    const relogio = setTimeout(buscar, termo ? 300 : 0);
    return () => clearTimeout(relogio);
  }, [open, buscar, termo]);

  /**
   * A quantidade é guardada como foi digitada, e só vira número no final.
   *
   * Normalizar a cada tecla impedia de apagar o campo para escrever outro
   * número: "1" apagado virava 0 na hora, e 0 desmarcava o produto -- então
   * digitar "0,5" desfazia a escolha no primeiro caractere.
   */
  const quantidadeDe = useCallback(
    (id) => escolhidos.find((e) => e.produto.id === id)?.quantidade ?? "",
    [escolhidos]
  );

  const estaEscolhido = useCallback(
    (id) => escolhidos.some((e) => e.produto.id === id),
    [escolhidos]
  );

  const comoNumero = (valor) => {
    // Vírgula é o separador decimal do teclado brasileiro; sem a troca,
    // "1,5" viraria NaN e a linha entraria com quantidade 1.
    const n = Number(String(valor).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const alternar = (produto) => {
    // Em modo simples a escolha é a própria confirmação: exigir um toque a
    // mais em "Adicionar" para trocar o produto de uma linha seria burocracia.
    if (!multiplo) {
      onConfirmar([{ produto, quantidade: 1 }]);
      onClose();
      return;
    }

    setEscolhidos((atual) =>
      atual.some((e) => e.produto.id === produto.id)
        ? atual.filter((e) => e.produto.id !== produto.id)
        : [...atual, { produto, quantidade: 1 }]
    );
  };

  const digitarQuantidade = (produto, texto) =>
    setEscolhidos((atual) =>
      atual.map((e) =>
        e.produto.id === produto.id ? { ...e, quantidade: texto } : e
      )
    );

  /**
   * Um passo no contador.
   *
   * Chegar a zero pelo botão de menos é o jeito de tirar o produto sem
   * procurar outro controle -- e é só aí que a linha sai da seleção.
   */
  const passo = (produto, delta) => {
    const nova = Math.round((comoNumero(quantidadeDe(produto.id)) + delta) * 1000) / 1000;

    setEscolhidos((atual) =>
      nova <= 0
        ? atual.filter((e) => e.produto.id !== produto.id)
        : atual.map((e) =>
            e.produto.id === produto.id ? { ...e, quantidade: nova } : e
          )
    );
  };

  const confirmar = () => {
    if (!escolhidos.length) return;
    // Campo em branco ou meio digitado vira uma peça: é o que a pessoa quis
    // dizer ao marcar o produto, e zero item lançado seria pior.
    onConfirmar(
      escolhidos.map((e) => ({
        produto: e.produto,
        quantidade: comoNumero(e.quantidade) || 1,
      }))
    );
    onClose();
  };

  // Produto por medida entra com o preço por m²/m, e a medida é preenchida na
  // linha do orçamento -- então o subtotal dele ainda não existe aqui.
  const temMedida = useMemo(
    () => escolhidos.some((e) => (e.produto.pricingMode || "unit") !== "unit"),
    [escolhidos]
  );

  const subtotal = useMemo(
    () =>
      escolhidos
        .filter((e) => (e.produto.pricingMode || "unit") === "unit")
        .reduce(
          (s, e) =>
            s +
            Number(e.produto.price || 0) *
              (Number(String(e.quantidade).replace(",", ".")) || 0),
          0
        ),
    [escolhidos]
  );

  const podeCadastrar = can("products:manage");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      // Tela cheia no celular: com margem, sobravam poucos centímetros de lista
      // entre o teclado e o rodapé.
      fullScreen={telaPequena}
      classes={{ paper: telaPequena ? classes.janelaCheia : classes.janela }}
    >
      <div className={classes.topo}>
        <span className={classes.titulo}>
          {multiplo ? "Adicionar do catálogo" : "Escolher produto"}
        </span>
        <IconButton size="small" onClick={onClose} aria-label="Fechar catálogo">
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>

      <div className={classes.busca}>
        <TextField
          inputRef={campoBusca}
          fullWidth
          size="small"
          placeholder="Buscar por nome ou código"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          // Teclado aberto de saída só no desktop: no celular ele cobriria a
          // lista antes de a pessoa ver o que existe.
          autoFocus={!telaPequena}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: termo ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setTermo("")}
                  aria-label="Limpar busca"
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </div>

      {categorias.length > 0 && (
        <div className={classes.categorias}>
          <Chip
            size="small"
            label="Todas"
            className={classes.categoria}
            color={categoria ? "default" : "primary"}
            variant={categoria ? "outlined" : "filled"}
            onClick={() => setCategoria("")}
          />
          {categorias.map((c) => (
            <Chip
              key={c}
              size="small"
              label={c}
              className={classes.categoria}
              color={categoria === c ? "primary" : "default"}
              variant={categoria === c ? "filled" : "outlined"}
              onClick={() => setCategoria(categoria === c ? "" : c)}
            />
          ))}
        </div>
      )}

      <div className={classes.lista}>
        {carregando && produtos.length === 0 ? (
          <div className={classes.estado}>
            <CircularProgress size={26} />
          </div>
        ) : erro ? (
          <div className={classes.estado}>
            <Typography variant="body2">
              Não foi possível carregar o catálogo.
            </Typography>
            <Button size="small" onClick={buscar}>
              Tentar de novo
            </Button>
          </div>
        ) : produtos.length === 0 ? (
          <div className={classes.estado}>
            <Inventory2OutlinedIcon fontSize="large" color="disabled" />
            <Typography variant="body2">
              {termo || categoria
                ? "Nenhum produto encontrado."
                : "O catálogo ainda está vazio."}
            </Typography>
            {/* Sair daqui para cadastrar e voltar depois era o caminho que
                fazia todo mundo desistir e digitar o item à mão. */}
            {podeCadastrar && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setCadastroAberto(true)}
              >
                Cadastrar {termo ? `"${termo}"` : "um produto"}
              </Button>
            )}
          </div>
        ) : (
          produtos.map((p) => {
            const quantidade = quantidadeDe(p.id);
            const escolhido = estaEscolhido(p.id);
            const modo = p.pricingMode || "unit";

            return (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                className={`${classes.linha} ${
                  escolhido ? classes.linhaEscolhida : ""
                }`}
                onClick={() => alternar(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    alternar(p);
                  }
                }}
              >
                {multiplo && (
                  <span
                    className={`${classes.marca} ${
                      escolhido ? classes.marcaAtiva : ""
                    }`}
                  >
                    <CheckIcon style={{ fontSize: 16 }} />
                  </span>
                )}

                <div className={classes.dados}>
                  <div className={classes.nome}>{p.name}</div>
                  <div className={classes.detalhe}>
                    {[
                      p.code,
                      p.category,
                      modo === "unit"
                        ? `por ${p.unit || "un"}`
                        : rotuloDoModo(modo),
                      modo !== "unit" && Number(p.minMeasure) > 0
                        ? `mín. ${Number(p.minMeasure).toLocaleString("pt-BR")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>

                {escolhido ? (
                  <div
                    className={classes.contador}
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <IconButton
                      size="small"
                      className={classes.botaoContador}
                      onClick={() => passo(p, -1)}
                      aria-label="Diminuir quantidade"
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <TextField
                      variant="standard"
                      className={classes.campoQuantidade}
                      value={quantidade}
                      onChange={(e) => digitarQuantidade(p, e.target.value)}
                      inputProps={{
                        inputMode: "decimal",
                        "aria-label": `Quantidade de ${p.name}`,
                      }}
                      InputProps={{ disableUnderline: true }}
                    />
                    <IconButton
                      size="small"
                      className={classes.botaoContador}
                      onClick={() => passo(p, 1)}
                      aria-label="Aumentar quantidade"
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </div>
                ) : (
                  <span className={classes.preco}>
                    {moeda(p.price)}
                    <span className={classes.precoUnidade}>
                      {modo === "area"
                        ? "por m²"
                        : modo === "linear"
                        ? "por m"
                        : `por ${p.unit || "un"}`}
                    </span>
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {multiplo && (
        <div className={classes.rodape}>
          <div className={classes.resumo}>
            {escolhidos.length === 0 ? (
              "Toque nos produtos para montar o pedido"
            ) : (
              <>
                <span className={classes.resumoForte}>
                  {escolhidos.length}{" "}
                  {escolhidos.length === 1 ? "produto" : "produtos"}
                </span>
                {subtotal > 0 && ` · ${moeda(subtotal)}`}
                {temMedida && (
                  <div>As medidas são preenchidas na linha do item.</div>
                )}
              </>
            )}
          </div>

          <Button
            variant="contained"
            onClick={confirmar}
            disabled={escolhidos.length === 0}
          >
            Adicionar
          </Button>
        </div>
      )}

      <ProdutoModal
        open={cadastroAberto}
        produto={termo ? { name: termo } : null}
        onClose={() => setCadastroAberto(false)}
        onSalvo={buscar}
      />
    </Dialog>
  );
};

export default CatalogoProdutos;
