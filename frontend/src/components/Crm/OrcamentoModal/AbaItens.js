import React, { useState, useEffect, useMemo, useRef } from "react";

import makeStyles from "@mui/styles/makeStyles";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import PrintIcon from "@mui/icons-material/Print";
import ContentCopyIcon from "@mui/icons-material/ContentCopyOutlined";
import NotesIcon from "@mui/icons-material/NotesOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import abrirOrdemDeServico from "../../../helpers/ordemDeServico";
import SeletorProduto from "../SeletorProduto";
import CatalogoProdutos from "../CatalogoProdutos";
import {
  MODOS_DE_COBRANCA,
  calcularLinha,
  descricaoDaMedida,
  itemDeProduto,
  itemVazio,
  moeda,
  totalDaLinha,
} from "../calculoItem";

/**
 * Uma grade só, declarada uma vez.
 *
 * Quando o cabeçalho e a linha traziam a mesma lista de colunas copiada, mexer
 * numa largura desalinhava a outra -- e o rótulo "Desconto" acabava em cima do
 * campo do preço.
 *
 * As larguras somam pouco menos do que a janela oferece: a descrição fica com
 * a sobra, que é a coluna onde a sobra faz diferença.
 */
const COLUNAS = "minmax(180px, 1fr) 110px 76px 56px 100px 96px 100px 84px";
const ESPACO_ENTRE_COLUNAS = 6;
const LARGURA_MINIMA = 820;

const useStyles = makeStyles((theme) => ({
  barra: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  // Empurra o que vem depois para a direita sem precisar de um bloco extra só
  // para isso.
  espacador: { flex: 1 },

  /**
   * No desktop a tabela rola dentro da própria caixa.
   *
   * A grade tem largura mínima porque colunas de dinheiro não podem encolher
   * até virar duas letras e um "..."; se a janela for estreita demais, é a
   * tabela que rola, e não o modal inteiro.
   */
  rolagem: {
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },

  tabela: { minWidth: LARGURA_MINIMA },

  cabecalho: {
    display: "grid",
    gridTemplateColumns: COLUNAS,
    gap: ESPACO_ENTRE_COLUNAS,
    padding: "0 4px 6px",
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: theme.palette.text.secondary,
  },

  linha: {
    display: "grid",
    gridTemplateColumns: COLUNAS,
    gap: ESPACO_ENTRE_COLUNAS,
    alignItems: "center",
    padding: "5px 4px",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  /**
   * Segunda linha, recuada: medidas e observação pertencem ao item de cima e
   * não podem competir com ele por atenção.
   *
   * Colunas de largura fixa, e não campos esticados: medida é número curto, e
   * um campo de 300px para escrever "1,2" sugere que ali cabe outra coisa.
   */
  detalhes: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, 150px)",
    alignItems: "end",
    gap: 12,
    padding: "6px 4px 12px 14px",
    borderBottom: `1px solid ${theme.palette.divider}`,
    borderLeft: `2px solid ${theme.palette.divider}`,
    marginLeft: 4,
  },

  // Ocupa a faixa inteira: a frase da medida e a observação são texto corrido,
  // e quebrar em coluna de 150px as tornaria ilegíveis.
  faixaDetalhe: { gridColumn: "1 / -1", maxWidth: 560 },

  resultadoMedida: {
    gridColumn: "1 / -1",
    fontSize: 12,
    color: theme.palette.text.secondary,
    fontVariantNumeric: "tabular-nums",
  },

  avisoMinimo: { color: theme.palette.warning.main, fontWeight: 700 },

  total: {
    textAlign: "right",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontSize: 13.5,
    paddingRight: 6,
  },

  // Os três botões precisam caber na última coluna sem empurrar o total: o
  // padrão do IconButton pequeno os deixava 20px mais largos que ela.
  acoesLinha: {
    display: "flex",
    justifyContent: "flex-end",
    "& .MuiIconButton-root": { padding: 3 },
  },

  /**
   * O mesmo item, no celular.
   *
   * A grade de oito colunas não tinha como caber em 360px: a descrição -- que
   * é a coluna que importa -- era espremida a nada e o seletor de produto
   * ficava inalcançável. Em cartão, cada campo tem rótulo e largura de dedo.
   */
  cartao: {
    border: `1px solid ${theme.palette.divider}`,
    marginBottom: 10,
    padding: "10px 12px 12px",
    background: theme.palette.background.paper,
  },

  cabecalhoCartao: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },

  numeroItem: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.palette.text.secondary,
    minWidth: 22,
  },

  camposCartao: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 10,
    marginTop: 10,
  },

  rodapeCartao: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  totalCartao: {
    fontSize: 16,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },

  medidasCartao: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
    gap: 10,
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px dashed ${theme.palette.divider}`,
  },

  legendaMedida: {
    gridColumn: "1 / -1",
    fontSize: 11.5,
    color: theme.palette.text.secondary,
    fontVariantNumeric: "tabular-nums",
  },

  /**
   * Rodapé grudado no pé da aba.
   *
   * O botão de salvar ficava depois da última linha: com quinze itens, salvar
   * exigia rolar até o fim, e quem não rolava fechava a janela perdendo tudo.
   */
  rodape: {
    position: "sticky",
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 14,
    padding: "10px 0",
    borderTop: `2px solid ${theme.palette.divider}`,
    background: theme.palette.background.paper,
    zIndex: 2,
  },

  contagem: { fontSize: 12.5, color: theme.palette.text.secondary },

  pendente: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.palette.warning.main,
  },

  somaFinal: {
    fontSize: 19,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },

  vazio: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "36px 16px",
    textAlign: "center",
    border: `1px dashed ${theme.palette.divider}`,
  },

  semDescricao: {
    fontSize: 11,
    fontWeight: 700,
    color: theme.palette.error.main,
  },
}));

/**
 * Chave estável por linha.
 *
 * Com o índice como chave, apagar a segunda de cinco linhas fazia o React
 * reaproveitar os campos da linha seguinte: o cursor pulava e o que estava
 * sendo digitado ia para o item errado. Item novo ganha um número de série que
 * vive só na tela.
 */
let sequencia = 0;
const comChave = (item) => ({
  ...item,
  _chave: item.id ? `i${item.id}` : `n${(sequencia += 1)}`,
});

/** O que de fato vai para o servidor -- sem o que é só da tela. */
const paraEnvio = (itens) =>
  itens
    .filter((i) => i.description?.trim())
    .map((item) => {
      const copia = { ...item };
      delete copia._chave;
      return copia;
    });

const numeroDoCampo = (valor) => (valor === 0 || valor ? valor : "");

/**
 * Itens do orçamento.
 *
 * A lista inteira é salva de uma vez, como o backend espera: editar várias
 * linhas e mandar uma chamada por linha deixaria o pedido pela metade se a
 * conexão caísse no meio.
 *
 * O lançamento tem dois caminhos, e essa é a mudança principal. "Do catálogo"
 * abre a lista de produtos, onde se marca vários com a quantidade de cada um e
 * volta com todos lançados. "Item avulso" cria a linha em branco para o que
 * não tem cadastro. Antes só existia o segundo -- o catálogo era um
 * autocompletar escondido dentro do campo de descrição, que no celular nunca
 * chegava a aparecer.
 */
const AbaItens = ({ deal, onSalvo, onPendencia }) => {
  const classes = useStyles();
  const theme = useTheme();
  // Abaixo de 900px a tabela vira lista de cartões.
  const compacto = useMediaQuery(theme.breakpoints.down("md"));
  const { can } = usePermissions();
  // Montar o orçamento é mexer na conta, e exige ver os valores.
  // Orçamento que virou pedido está congelado; card de produção edita os
  // itens do pedido, com permissão própria (ver BarraDoPedido).
  const papel = deal?.papel || "orcamento";
  const podeEditar =
    can("crm:editItems") &&
    papel !== "orcamento_aprovado" &&
    (papel !== "producao" || can("crm:editOrder"));
  const verValores = can("crm:viewValues");
  const podeEmitirOS = can("crm:issueOrder");

  /**
   * Desconto é permissão própria: monta-se a proposta pela tabela de preços
   * sem poder queimar margem.
   *
   * O campo fica desabilitado em vez de sumir. Sumindo, o vendedor não
   * entenderia por que o total não fecha com o que o cliente pediu; visível e
   * travado, ele sabe o que precisa pedir a quem coordena.
   */
  const podeDescontar = can("crm:discount");

  const [itens, setItens] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [expandidos, setExpandidos] = useState([]);

  // Retrato do que veio do servidor, para saber se há o que salvar.
  const gravado = useRef("[]");

  useEffect(() => {
    const carregados = (deal.items || []).map((i) =>
      comChave({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unit: i.unit || "un",
        unitPrice: i.unitPrice,
        discount: i.discount || 0,
        productId: i.productId || null,
        width: i.width || 0,
        height: i.height || 0,
        pricingMode: i.pricingMode || "unit",
        minMeasure: i.minMeasure || 0,
        notes: i.notes || "",
      })
    );

    setItens(carregados);
    setExpandidos([]);
    gravado.current = JSON.stringify(paraEnvio(carregados));
  }, [deal]);

  const alterado = useMemo(
    () => JSON.stringify(paraEnvio(itens)) !== gravado.current,
    [itens]
  );

  // A janela precisa saber para perguntar antes de fechar ou trocar de aba --
  // é ela que controla as duas saídas.
  useEffect(() => {
    if (!onPendencia) return undefined;
    onPendencia(alterado);
    return () => onPendencia(false);
  }, [alterado, onPendencia]);

  const mudar = (chave, campo, valor) =>
    setItens((atual) =>
      atual.map((item) =>
        item._chave === chave ? { ...item, [campo]: valor } : item
      )
    );

  /**
   * Produto escolhido preenche a linha.
   *
   * Só o que descreve o produto é sobrescrito. Quantidade, medidas, desconto e
   * observação já digitados ficam: quem diz "são 20 de 2x1" e só então procura
   * o produto no catálogo não quer digitar tudo de novo.
   */
  const escolherProduto = (chave, produto) =>
    setItens((atual) =>
      atual.map((item) => {
        if (item._chave !== chave) return item;

        const doCatalogo = itemDeProduto(produto, item.quantity);
        return {
          ...item,
          productId: doCatalogo.productId,
          description: doCatalogo.description,
          unit: doCatalogo.unit,
          unitPrice: doCatalogo.unitPrice,
          pricingMode: doCatalogo.pricingMode,
          minMeasure: doCatalogo.minMeasure,
        };
      })
    );

  const adicionarAvulso = () =>
    setItens((atual) => [...atual, comChave(itemVazio())]);

  /**
   * Volta do catálogo com tudo que foi marcado.
   *
   * Um produto que já está na lista soma na quantidade em vez de virar uma
   * segunda linha igual -- que é o que a pessoa quis dizer ao escolhê-lo de
   * novo, e o que evita a ordem de serviço saindo com o mesmo item repetido.
   */
  const adicionarDoCatalogo = (escolhas) =>
    setItens((atual) => {
      const resultado = [...atual];

      escolhas.forEach(({ produto, quantidade }) => {
        const existente = resultado.findIndex(
          (i) => i.productId === produto.id && (i.pricingMode || "unit") === "unit"
        );

        if (existente >= 0) {
          resultado[existente] = {
            ...resultado[existente],
            quantity: (Number(resultado[existente].quantity) || 0) + quantidade,
          };
        } else {
          resultado.push(comChave(itemDeProduto(produto, quantidade)));
        }
      });

      return resultado;
    });

  // Duplicar existe para o caso mais comum do ramo: mesmo produto, outra
  // medida. Recadastrar tudo à mão só para trocar a largura era a maior parte
  // do tempo gasto num orçamento de banner.
  const duplicar = (chave) =>
    setItens((atual) => {
      const indice = atual.findIndex((i) => i._chave === chave);
      if (indice < 0) return atual;
      const copia = comChave({ ...atual[indice], id: undefined });
      return [...atual.slice(0, indice + 1), copia, ...atual.slice(indice + 1)];
    });

  const remover = (chave) =>
    setItens((atual) => atual.filter((i) => i._chave !== chave));

  const alternarObservacao = (chave) =>
    setExpandidos((atual) =>
      atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave]
    );

  const soma = itens.reduce((s, i) => s + totalDaLinha(i), 0);
  const semDescricao = itens.filter((i) => !i.description?.trim()).length;

  const salvar = async () => {
    setSalvando(true);
    try {
      await api.put(`/deals/${deal.id}/items`, { items: paraEnvio(itens) });
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  /** Campo numérico: teclado numérico no celular e vírgula aceita. */
  const campoNumero = (chave, campo, valor, extras = {}) => (
    <TextField
      size="small"
      variant={compacto ? "outlined" : "standard"}
      type="number"
      value={numeroDoCampo(valor)}
      disabled={!podeEditar || (campo === "discount" && !podeDescontar)}
      title={
        campo === "discount" && !podeDescontar
          ? "Você não tem permissão para dar desconto."
          : undefined
      }
      onChange={(e) => mudar(chave, campo, e.target.value)}
      inputProps={{ min: 0, step: extras.step || "0.01", inputMode: "decimal" }}
      InputLabelProps={extras.label ? { shrink: true } : undefined}
      label={extras.label}
      fullWidth
    />
  );

  const seletorCobranca = (item) => (
    <TextField
      select
      size="small"
      variant={compacto ? "outlined" : "standard"}
      value={item.pricingMode || "unit"}
      disabled={!podeEditar}
      onChange={(e) => mudar(item._chave, "pricingMode", e.target.value)}
      label={compacto ? "Cobrança" : undefined}
      InputLabelProps={compacto ? { shrink: true } : undefined}
      fullWidth
    >
      {MODOS_DE_COBRANCA.map((m) => (
        <MenuItem key={m.valor} value={m.valor}>
          {m.rotulo}
        </MenuItem>
      ))}
    </TextField>
  );

  /** Largura, altura e mínimo -- só quando a cobrança as usa. */
  const camposDeMedida = (item) => {
    const modo = item.pricingMode || "unit";
    if (modo === "unit") return null;

    return (
      <>
        {campoNumero(item._chave, "width", item.width, {
          label: modo === "linear" ? "Comprimento (m)" : "Largura (m)",
          step: "0.001",
        })}
        {modo === "area" &&
          campoNumero(item._chave, "height", item.height, {
            label: "Altura (m)",
            step: "0.001",
          })}
        {campoNumero(item._chave, "minMeasure", item.minMeasure, {
          label: "Mínimo",
          step: "0.001",
        })}
      </>
    );
  };

  const campoObservacao = (item) => (
    <TextField
      size="small"
      variant={compacto ? "outlined" : "standard"}
      label="Observação do item"
      InputLabelProps={{ shrink: true }}
      placeholder="Sai impresso na ordem de serviço"
      value={item.notes || ""}
      disabled={!podeEditar}
      onChange={(e) => mudar(item._chave, "notes", e.target.value)}
      fullWidth
    />
  );

  const botoesDaLinha = (item) => (
    <>
      <Tooltip title="Observação" arrow>
        <IconButton
          size="small"
          onClick={() => alternarObservacao(item._chave)}
          aria-label="Observação do item"
          color={item.notes ? "primary" : "default"}
        >
          <NotesIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Duplicar" arrow>
        <IconButton
          size="small"
          onClick={() => duplicar(item._chave)}
          aria-label="Duplicar item"
        >
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Remover" arrow>
        <IconButton
          size="small"
          onClick={() => remover(item._chave)}
          aria-label="Remover item"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>
  );

  const linhaDesktop = (item) => {
    const conta = calcularLinha(item);
    const mostraDetalhes =
      (item.pricingMode || "unit") !== "unit" ||
      expandidos.includes(item._chave) ||
      Boolean(item.notes);

    return (
      <React.Fragment key={item._chave}>
        <div className={classes.linha}>
          <div>
            <SeletorProduto
              valor={item.description}
              disabled={!podeEditar}
              vinculado={Boolean(item.productId)}
              onChange={(v) => mudar(item._chave, "description", v)}
              onEscolherProduto={(produto) =>
                escolherProduto(item._chave, produto)
              }
            />
            {!item.description?.trim() && (
              <span className={classes.semDescricao}>
                sem descrição — não será salvo
              </span>
            )}
          </div>

          {seletorCobranca(item)}
          {campoNumero(item._chave, "quantity", item.quantity, { step: "0.001" })}

          <TextField
            size="small"
            variant="standard"
            value={item.unit || ""}
            disabled={!podeEditar}
            onChange={(e) => mudar(item._chave, "unit", e.target.value)}
            fullWidth
          />

          {campoNumero(item._chave, "unitPrice", item.unitPrice)}
          {campoNumero(item._chave, "discount", item.discount)}

          <span className={classes.total}>{moeda(verValores ? conta.total : null)}</span>

          <div className={classes.acoesLinha}>
            {podeEditar ? botoesDaLinha(item) : <span />}
          </div>
        </div>

        {mostraDetalhes && (
          <div className={classes.detalhes}>
            {camposDeMedida(item)}

            {(item.pricingMode || "unit") !== "unit" && (
              <span className={classes.resultadoMedida}>
                {descricaoDaMedida(item)}
                {conta.aplicouMinimo && (
                  <span className={classes.avisoMinimo}> ⚠</span>
                )}
              </span>
            )}

            {(expandidos.includes(item._chave) || item.notes) && (
              <div className={classes.faixaDetalhe}>{campoObservacao(item)}</div>
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  const cartaoCelular = (item, indice) => {
    const conta = calcularLinha(item);
    const modo = item.pricingMode || "unit";

    return (
      <div className={classes.cartao} key={item._chave}>
        <div className={classes.cabecalhoCartao}>
          <span className={classes.numeroItem}>{indice + 1}.</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SeletorProduto
              valor={item.description}
              disabled={!podeEditar}
              vinculado={Boolean(item.productId)}
              variant="standard"
              onChange={(v) => mudar(item._chave, "description", v)}
              onEscolherProduto={(produto) =>
                escolherProduto(item._chave, produto)
              }
            />
          </div>
        </div>

        {!item.description?.trim() && (
          <span className={classes.semDescricao}>
            sem descrição — não será salvo
          </span>
        )}

        <div className={classes.camposCartao}>
          {seletorCobranca(item)}
          {campoNumero(item._chave, "quantity", item.quantity, {
            label: "Quantidade",
            step: "0.001",
          })}
          <TextField
            size="small"
            variant="outlined"
            label="Unidade"
            InputLabelProps={{ shrink: true }}
            value={item.unit || ""}
            disabled={!podeEditar}
            onChange={(e) => mudar(item._chave, "unit", e.target.value)}
            fullWidth
          />
          {campoNumero(item._chave, "unitPrice", item.unitPrice, {
            label: modo === "area" ? "Preço por m²" : modo === "linear" ? "Preço por m" : "Preço unitário",
          })}
          {campoNumero(item._chave, "discount", item.discount, {
            label: "Desconto",
          })}
        </div>

        {modo !== "unit" && (
          <div className={classes.medidasCartao}>
            {camposDeMedida(item)}
            <span className={classes.legendaMedida}>
              {descricaoDaMedida(item)}
            </span>
          </div>
        )}

        {(expandidos.includes(item._chave) || item.notes) && (
          <div style={{ marginTop: 10 }}>{campoObservacao(item)}</div>
        )}

        <div className={classes.rodapeCartao}>
          <span className={classes.totalCartao}>{moeda(verValores ? conta.total : null)}</span>
          <div>{podeEditar && botoesDaLinha(item)}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className={classes.barra}>
        {podeEditar && (
          <>
            {/* O caminho principal é o catálogo -- por isso é o botão cheio.
                O avulso continua ali para o que não tem cadastro. */}
            <Button
              variant="contained"
              size="small"
              startIcon={<ShoppingCartOutlinedIcon />}
              onClick={() => setCatalogoAberto(true)}
            >
              Do catálogo
            </Button>
            <Button size="small" startIcon={<AddIcon />} onClick={adicionarAvulso}>
              Item avulso
            </Button>
          </>
        )}

        <span className={classes.espacador} />

        {podeEmitirOS && (
          <Button
            size="small"
            startIcon={<PrintIcon />}
            onClick={() => abrirOrdemDeServico(deal.id).catch(toastError)}
          >
            {compacto ? "OS" : "Ordem de serviço"}
          </Button>
        )}
      </div>

      {itens.length === 0 ? (
        <div className={classes.vazio}>
          <Inventory2OutlinedIcon fontSize="large" color="disabled" />
          <Typography variant="body2" color="textSecondary">
            Nenhum item neste orçamento. Comece pelo catálogo — o preço, a
            unidade e a forma de cobrança vêm preenchidos de lá.
          </Typography>
          {podeEditar && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <Button
                variant="contained"
                size="small"
                startIcon={<ShoppingCartOutlinedIcon />}
                onClick={() => setCatalogoAberto(true)}
              >
                Escolher produtos
              </Button>
              <Button size="small" startIcon={<AddIcon />} onClick={adicionarAvulso}>
                Item avulso
              </Button>
            </div>
          )}
        </div>
      ) : compacto ? (
        itens.map(cartaoCelular)
      ) : (
        <div className={classes.rolagem}>
          <div className={classes.tabela}>
            <div className={classes.cabecalho}>
              <span>Descrição</span>
              <span>Cobrança</span>
              <span>Qtd.</span>
              <span>Un.</span>
              <span>Unitário</span>
              <span>Desconto</span>
              <span style={{ textAlign: "right" }}>Total</span>
              <span />
            </div>

            {itens.map(linhaDesktop)}
          </div>
        </div>
      )}

      <div className={classes.rodape}>
        <div>
          <span className={classes.contagem}>
            {itens.length} {itens.length === 1 ? "item" : "itens"}
            {semDescricao > 0 &&
              ` · ${semDescricao} sem descrição`}
          </span>
          {alterado && (
            <div className={classes.pendente}>Alterações não salvas</div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className={classes.somaFinal}>{moeda(verValores ? soma : null)}</span>
          {podeEditar && (
            <Button
              variant="contained"
              onClick={salvar}
              // Sem alteração não há o que gravar, e o clique inútil ainda
              // recarregava a ficha inteira e piscava a tela.
              disabled={salvando || !alterado}
            >
              {salvando ? "Salvando…" : "Salvar itens"}
            </Button>
          )}
        </div>
      </div>

      <CatalogoProdutos
        open={catalogoAberto}
        onClose={() => setCatalogoAberto(false)}
        onConfirmar={adicionarDoCatalogo}
      />
    </>
  );
};

export default AbaItens;
