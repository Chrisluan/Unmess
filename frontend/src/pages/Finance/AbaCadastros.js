import React, { useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  secao: {
    padding: theme.spacing(2),
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  titulo: {
    fontSize: "0.72rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
  },

  ajuda: {
    display: "block",
    marginBottom: theme.spacing(1.5),
    color: theme.palette.text.secondary,
  },

  linha: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 0",
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  nome: { flex: 1, fontWeight: 600, minWidth: 0 },

  detalhe: {
    fontSize: "0.78rem",
    color: theme.palette.text.secondary,
    whiteSpace: "nowrap",
  },

  inativo: { opacity: 0.5 },

  formulario: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "flex-start",
    marginTop: theme.spacing(1.5),
  },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const KINDS_CONTA = [
  { valor: "cash", texto: "Caixa" },
  { valor: "bank", texto: "Banco" },
  { valor: "card", texto: "Cartão" },
];

/** "[30,60,90]" vira "30/60/90 dias"; "[0]" vira "à vista". */
const descreverPrazos = (prazos) => {
  const lista = Array.isArray(prazos) ? prazos : [];
  if (!lista.length) return "—";
  if (lista.length === 1 && Number(lista[0]) === 0) return "à vista";
  return `${lista.join("/")} dias`;
};

/**
 * Os cadastros que o financeiro precisa para funcionar.
 *
 * Ficam numa aba, e não numa tela própria: são quatro listas curtas que se
 * mexem raramente, e cada uma como página separada faria o menu crescer
 * quatro itens que ninguém visita duas vezes por mês.
 */
const AbaCadastros = ({ cadastros, onSalvo }) => {
  const classes = useStyles();

  const [condicao, setCondicao] = useState({ name: "", prazos: "" });
  const [conta, setConta] = useState({ name: "", kind: "cash", openingBalance: "" });
  const [categoria, setCategoria] = useState({ name: "", kind: "income" });
  const [fornecedor, setFornecedor] = useState({ name: "", document: "", phone: "" });

  const salvar = async (url, corpo, limpar) => {
    try {
      await api.post(url, corpo);
      limpar();
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    }
  };

  const remover = async (url) => {
    try {
      await api.delete(url);
      if (onSalvo) await onSalvo();
    } catch (err) {
      toastError(err);
    }
  };

  const salvarCondicao = () => {
    // "30/60/90", "30, 60, 90" e "0" são todos aceitos: quem cadastra escreve
    // do jeito que fala, e exigir JSON aqui seria pedir para errar.
    const prazos = String(condicao.prazos)
      .split(/[^0-9]+/)
      .filter((p) => p !== "")
      .map(Number);

    if (!condicao.name.trim() || !prazos.length) return;

    salvar(
      "/finance/payment-terms",
      { name: condicao.name.trim(), dayOffsets: prazos },
      () => setCondicao({ name: "", prazos: "" })
    );
  };

  return (
    <>
      <div className={classes.secao}>
        <div className={classes.titulo}>Condições de pagamento</div>
        <Typography variant="caption" className={classes.ajuda}>
          Os prazos são os dias de vencimento contados do faturamento. "0" é à
          vista; "30/60/90" gera três parcelas. É o que permite a cobrança
          calcular os vencimentos sozinha.
        </Typography>

        {(cadastros?.paymentTerms || []).map((t) => (
          <div
            key={t.id}
            className={`${classes.linha} ${
              t.active === false ? classes.inativo : ""
            }`}
          >
            <span className={classes.nome}>{t.name}</span>
            <span className={classes.detalhe}>
              {descreverPrazos(t.dayOffsets)}
              {t.active === false ? " · inativa" : ""}
            </span>
            <Tooltip title="Remover" arrow>
              <IconButton
                size="small"
                onClick={() => remover(`/finance/payment-terms/${t.id}`)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}

        <div className={classes.formulario}>
          <TextField
            size="small"
            label="Nome"
            placeholder="30/60/90"
            value={condicao.name}
            onChange={(e) => setCondicao({ ...condicao, name: e.target.value })}
          />
          <TextField
            size="small"
            label="Prazos em dias"
            placeholder="30/60/90"
            value={condicao.prazos}
            onChange={(e) => setCondicao({ ...condicao, prazos: e.target.value })}
          />
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={salvarCondicao}
            disabled={!condicao.name.trim() || !condicao.prazos.trim()}
          >
            Adicionar
          </Button>
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.titulo}>Contas</div>
        <Typography variant="caption" className={classes.ajuda}>
          Onde o dinheiro fica. O saldo de abertura é o que já existia antes do
          sistema — sem ele, o caixa começaria em zero e ficaria errado para
          sempre pelo mesmo valor.
        </Typography>

        {(cadastros?.accounts || []).map((c) => (
          <div
            key={c.id}
            className={`${classes.linha} ${
              c.active === false ? classes.inativo : ""
            }`}
          >
            <span className={classes.nome}>{c.name}</span>
            <span className={classes.detalhe}>
              {KINDS_CONTA.find((k) => k.valor === c.kind)?.texto || c.kind}
              {" · abertura "}
              {moeda(c.openingBalance)}
              {c.active === false ? " · inativa" : ""}
            </span>
            <Tooltip title="Remover" arrow>
              <IconButton
                size="small"
                onClick={() => remover(`/finance/accounts/${c.id}`)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}

        <div className={classes.formulario}>
          <TextField
            size="small"
            label="Nome"
            placeholder="Caixa da loja"
            value={conta.name}
            onChange={(e) => setConta({ ...conta, name: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={conta.kind}
            onChange={(e) => setConta({ ...conta, kind: e.target.value })}
            style={{ minWidth: 120 }}
          >
            {KINDS_CONTA.map((k) => (
              <MenuItem key={k.valor} value={k.valor}>
                {k.texto}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Saldo de abertura"
            inputProps={{ step: "0.01" }}
            value={conta.openingBalance}
            onChange={(e) =>
              setConta({ ...conta, openingBalance: e.target.value })
            }
          />
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={!conta.name.trim()}
            onClick={() =>
              salvar(
                "/finance/accounts",
                {
                  name: conta.name.trim(),
                  kind: conta.kind,
                  openingBalance: Number(conta.openingBalance) || 0,
                },
                () => setConta({ name: "", kind: "cash", openingBalance: "" })
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.titulo}>Fornecedores</div>
        <Typography variant="caption" className={classes.ajuda}>
          Sem cadastro, "Gráfica Central" e "grafica central" são dois
          fornecedores para o sistema, e não há como saber quanto se gasta com
          cada um.
        </Typography>

        {(cadastros?.suppliers || []).map((f) => (
          <div
            key={f.id}
            className={`${classes.linha} ${
              f.active === false ? classes.inativo : ""
            }`}
          >
            <span className={classes.nome}>{f.name}</span>
            <span className={classes.detalhe}>
              {[f.document, f.phone].filter(Boolean).join(" · ") || "—"}
              {f.active === false ? " · inativo" : ""}
            </span>
            <Tooltip title="Remover" arrow>
              <IconButton
                size="small"
                onClick={() => remover(`/finance/suppliers/${f.id}`)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}

        <div className={classes.formulario}>
          <TextField
            size="small"
            label="Nome"
            placeholder="Gráfica Central"
            value={fornecedor.name}
            onChange={(e) => setFornecedor({ ...fornecedor, name: e.target.value })}
          />
          <TextField
            size="small"
            label="CNPJ / CPF"
            value={fornecedor.document}
            onChange={(e) =>
              setFornecedor({ ...fornecedor, document: e.target.value })
            }
          />
          <TextField
            size="small"
            label="Telefone"
            value={fornecedor.phone}
            onChange={(e) => setFornecedor({ ...fornecedor, phone: e.target.value })}
          />
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={!fornecedor.name.trim()}
            onClick={() =>
              salvar(
                "/finance/suppliers",
                {
                  name: fornecedor.name.trim(),
                  document: fornecedor.document || null,
                  phone: fornecedor.phone || null,
                },
                () => setFornecedor({ name: "", document: "", phone: "" })
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </div>

      <div className={classes.secao}>
        <div className={classes.titulo}>Categorias</div>
        <Typography variant="caption" className={classes.ajuda}>
          O que transforma "saiu 4.200 este mês" em "saiu 4.200, sendo 2.800 de
          lona e 900 de tinta".
        </Typography>

        {(cadastros?.categories || []).map((c) => (
          <div
            key={c.id}
            className={`${classes.linha} ${
              c.active === false ? classes.inativo : ""
            }`}
          >
            <span className={classes.nome}>{c.name}</span>
            <span className={classes.detalhe}>
              {c.kind === "income" ? "receita" : "despesa"}
              {c.active === false ? " · inativa" : ""}
            </span>
            <Tooltip title="Remover" arrow>
              <IconButton
                size="small"
                onClick={() => remover(`/finance/categories/${c.id}`)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}

        <div className={classes.formulario}>
          <TextField
            size="small"
            label="Nome"
            placeholder="Venda de impressos"
            value={categoria.name}
            onChange={(e) => setCategoria({ ...categoria, name: e.target.value })}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={categoria.kind}
            onChange={(e) => setCategoria({ ...categoria, kind: e.target.value })}
            style={{ minWidth: 130 }}
          >
            <MenuItem value="income">Receita</MenuItem>
            <MenuItem value="expense">Despesa</MenuItem>
          </TextField>
          <Button
            size="small"
            startIcon={<AddIcon />}
            disabled={!categoria.name.trim()}
            onClick={() =>
              salvar(
                "/finance/categories",
                { name: categoria.name.trim(), kind: categoria.kind },
                () => setCategoria({ name: "", kind: "income" })
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </div>
    </>
  );
};

export default AbaCadastros;
