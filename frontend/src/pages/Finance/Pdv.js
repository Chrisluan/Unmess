import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import EmptyState from "../../components/EmptyState";
import usePermissions from "../../hooks/usePermissions";

import Shell from "./Shell";

const useStyles = makeStyles((theme) => ({
  centro: { display: "flex", justifyContent: "center", padding: 48 },

  abertura: {
    maxWidth: 460,
    margin: "48px auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    border: `1px solid ${theme.palette.divider}`,
  },

  resumo: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(3),
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    background: theme.palette.action.hover,
    alignItems: "center",
  },

  bloco: { display: "flex", flexDirection: "column" },

  rotulo: {
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
  },

  numero: {
    fontSize: "1.05rem",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },

  acoesTopo: { marginLeft: "auto", display: "flex", gap: theme.spacing(1) },

  /**
   * Carrinho à esquerda, histórico do turno à direita. Numa tela estreita
   * empilha — o balcão às vezes é um notebook de 13 polegadas de lado.
   */
  corpo: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    alignItems: "start",
    [theme.breakpoints.down("md")]: { gridTemplateColumns: "1fr" },
  },

  painel: {
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
  },

  tituloPainel: {
    padding: theme.spacing(1, 1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    fontSize: "0.8rem",
    fontWeight: 700,
  },

  busca: { padding: theme.spacing(1.5) },

  linha: {
    display: "grid",
    gridTemplateColumns: "1fr 90px 110px 110px 40px",
    gap: theme.spacing(1),
    alignItems: "center",
    padding: theme.spacing(0.75, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  nomeItem: { overflow: "hidden", textOverflow: "ellipsis" },

  dinheiro: {
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    textAlign: "right",
  },

  fechamento: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    alignItems: "flex-end",
    padding: theme.spacing(1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
  },

  total: {
    marginLeft: "auto",
    fontSize: "1.4rem",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
  },

  listaCurta: {
    display: "flex",
    flexDirection: "column",
    maxHeight: 360,
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },

  itemLista: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5),
    borderTop: `1px solid ${theme.palette.divider}`,
    fontSize: "0.85rem",
  },

  vazio: {
    padding: theme.spacing(3),
    textAlign: "center",
    color: theme.palette.text.secondary,
    fontSize: "0.85rem",
  },

  saida: { color: theme.palette.error.main },
  entrada: { color: theme.palette.success.main },

  campos: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    paddingTop: theme.spacing(1),
    minWidth: 360,
  },
}));

const moeda = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const FORMAS = [
  { valor: "cash", rotulo: "Dinheiro" },
  { valor: "pix", rotulo: "PIX" },
  { valor: "debit", rotulo: "Cartão de débito" },
  { valor: "credit", rotulo: "Cartão de crédito" },
  { valor: "transfer", rotulo: "Transferência" },
  { valor: "other", rotulo: "Outros" },
];

const hora = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/**
 * PDV — frente de caixa.
 *
 * A venda de balcão não passa pelo funil de propósito: quem entra pedindo dois
 * adesivos não tem cotação, aprovação nem produção, e forçá-lo pelo CRM
 * encheria o quadro de cards que nascem e morrem no mesmo minuto.
 *
 * A tela tem dois estados, e só dois. Sem turno aberto, ela pergunta uma coisa
 * só: qual caixa e com quanto. Com turno aberto, ela é o balcão — buscar,
 * somar, cobrar — com a conferência da gaveta sempre visível no topo, que é o
 * número pelo qual alguém vai responder no fim do dia.
 */
const Pdv = () => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [carregando, setCarregando] = useState(true);
  const [resumo, setResumo] = useState(null);
  const [caixas, setCaixas] = useState([]);
  const [contas, setContas] = useState([]);

  // Abertura
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [valorAbertura, setValorAbertura] = useState("0");

  // Carrinho
  const [itens, setItens] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [forma, setForma] = useState("cash");
  const [desconto, setDesconto] = useState("0");
  const [salvando, setSalvando] = useState(false);

  // Diálogos
  const [movimento, setMovimento] = useState(null);
  const [fechando, setFechando] = useState(false);
  const [contado, setContado] = useState("");
  const [observacao, setObservacao] = useState("");

  const podeDescontar = can("crm:discount");

  const campoBusca = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [atual, listaCaixas, cadastros] = await Promise.all([
        api.get("/pdv/atual"),
        api.get("/pdv/caixas"),
        api.get("/finance/cadastros"),
      ]);
      setResumo(atual.data?.session ? atual.data : null);
      setCaixas(listaCaixas.data?.accounts ?? []);
      setContas(cadastros.data?.accounts ?? []);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const buscarProdutos = useCallback(async (termo) => {
    setBuscando(true);
    try {
      const { data } = await api.get("/products", {
        params: { searchParam: termo },
      });
      setProdutos(data?.products ?? []);
    } catch {
      // Busca que falha vira lista vazia. Um toast a cada tecla seria pior do
      // que o autocompletar não encontrar nada.
      setProdutos([]);
    } finally {
      setBuscando(false);
    }
  }, []);

  const bruto = useMemo(
    () =>
      itens.reduce(
        (soma, i) => soma + Number(i.quantity || 0) * Number(i.unitPrice || 0),
        0
      ),
    [itens]
  );

  const abatimento = Math.min(Number(desconto) || 0, bruto);
  const total = Math.max(0, bruto - abatimento);

  const adicionar = (produto) => {
    if (!produto) return;

    setItens((atuais) => {
      // Bipar o mesmo produto duas vezes soma na linha, não cria outra: uma
      // lista com "Adesivo" repetido oito vezes é ilegível na hora de conferir.
      const existente = atuais.findIndex((i) => i.productId === produto.id);

      if (existente >= 0) {
        const copia = [...atuais];
        copia[existente] = {
          ...copia[existente],
          quantity: Number(copia[existente].quantity) + 1,
        };
        return copia;
      }

      return [
        ...atuais,
        {
          chave: `${produto.id}-${Date.now()}`,
          productId: produto.id,
          name: produto.name,
          quantity: 1,
          unitPrice: produto.price,
        },
      ];
    });

    campoBusca.current?.focus();
  };

  const mudarItem = (chave, campo, valor) => {
    setItens((atuais) =>
      atuais.map((i) => (i.chave === chave ? { ...i, [campo]: valor } : i))
    );
  };

  const abrirCaixa = async () => {
    if (!contaEscolhida) {
      toast.error("Escolha o caixa.");
      return;
    }

    setSalvando(true);
    try {
      await api.post("/pdv/abrir", {
        accountId: contaEscolhida,
        openingAmount: Number(valorAbertura) || 0,
      });
      toast.success("Caixa aberto.");
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const finalizar = async () => {
    if (itens.length === 0) {
      toast.error("Adicione ao menos um item.");
      return;
    }

    setSalvando(true);
    try {
      const { data } = await api.post(`/pdv/${resumo.session.id}/vendas`, {
        items: itens.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: Number(i.quantity) || 0,
          unitPrice: Number(i.unitPrice) || 0,
        })),
        method: forma,
        discount: abatimento,
      });

      toast.success(`Venda #${data.sale.number} registrada.`);
      setItens([]);
      setDesconto("0");
      await carregar();
      campoBusca.current?.focus();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const registrarMovimento = async () => {
    setSalvando(true);
    try {
      await api.post(`/pdv/${resumo.session.id}/movimentos`, {
        direction: movimento.direction,
        amount: Number(movimento.amount) || 0,
        reason: movimento.reason,
        counterAccountId: movimento.counterAccountId,
      });
      toast.success(
        movimento.direction === "out" ? "Sangria registrada." : "Suprimento registrado."
      );
      setMovimento(null);
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const fecharCaixa = async () => {
    setSalvando(true);
    try {
      const { data } = await api.put(`/pdv/${resumo.session.id}/fechar`, {
        closingAmount: Number(contado) || 0,
        notes: observacao,
      });

      const diferenca = data.session?.difference ?? 0;
      toast.success(
        diferenca === 0
          ? "Caixa fechado, sem diferença."
          : `Caixa fechado com ${diferenca > 0 ? "sobra" : "falta"} de ${moeda(
              Math.abs(diferenca)
            )}.`
      );

      setFechando(false);
      setContado("");
      setObservacao("");
      await carregar();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  // ── Estados da tela ───────────────────────────────────────────────────────

  if (carregando) {
    return (
      <Shell titulo="PDV">
        <div className={classes.centro}>
          <CircularProgress />
        </div>
      </Shell>
    );
  }

  if (!resumo) {
    return (
      <Shell
        titulo="PDV"
        descricao="Venda de balcão, sem passar pelo funil de vendas."
      >
        {caixas.length === 0 ? (
          <EmptyState
            icon={PointOfSaleOutlinedIcon}
            title="Nenhum caixa no seu acesso"
            description="A frente de caixa abre turno sobre contas do tipo Caixa. Peça a quem administra o sistema para cadastrar uma em Configuração financeira e incluir você no acesso a ela."
          />
        ) : (
          <div className={classes.abertura}>
            <Typography variant="h6">Abrir o caixa</Typography>
            <Typography variant="body2" color="textSecondary">
              O valor de abertura é o troco que já está na gaveta. É a partir
              dele que a conferência do fim do dia faz sentido.
            </Typography>

            <TextField
              select
              label="Caixa"
              size="small"
              value={contaEscolhida}
              onChange={(e) => setContaEscolhida(e.target.value)}
              fullWidth
            >
              {caixas.map((conta) => (
                <MenuItem key={conta.id} value={conta.id}>
                  {conta.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Valor de abertura"
              size="small"
              type="number"
              value={valorAbertura}
              onChange={(e) => setValorAbertura(e.target.value)}
              inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
              fullWidth
            />

            <Button
              variant="contained"
              color="primary"
              onClick={abrirCaixa}
              disabled={salvando}
            >
              Abrir caixa
            </Button>
          </div>
        )}
      </Shell>
    );
  }

  const { session, esperado, vendasEmEspecie, vendasPorOutrosMeios, sangrias, suprimentos } =
    resumo;

  return (
    <Shell
      titulo="PDV"
      descricao={`${session.account?.name || "Caixa"} — aberto por ${
        session.openedBy?.name || "—"
      } às ${hora(session.openedAt)}`}
    >
      <div className={classes.resumo}>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Esperado na gaveta</span>
          <span className={classes.numero}>{moeda(esperado)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Abertura</span>
          <span className={classes.numero}>{moeda(session.openingAmount)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Vendas em dinheiro</span>
          <span className={`${classes.numero} ${classes.entrada}`}>
            {moeda(vendasEmEspecie)}
          </span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Outros meios</span>
          <span className={classes.numero}>{moeda(vendasPorOutrosMeios)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Suprimentos</span>
          <span className={classes.numero}>{moeda(suprimentos)}</span>
        </div>
        <div className={classes.bloco}>
          <span className={classes.rotulo}>Sangrias</span>
          <span className={`${classes.numero} ${classes.saida}`}>
            {moeda(sangrias)}
          </span>
        </div>

        <div className={classes.acoesTopo}>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              setMovimento({
                direction: "in",
                amount: "",
                reason: "",
                counterAccountId: "",
              })
            }
          >
            Suprimento
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              setMovimento({
                direction: "out",
                amount: "",
                reason: "",
                counterAccountId: "",
              })
            }
          >
            Sangria
          </Button>
          <Button
            size="small"
            variant="contained"
            color="secondary"
            onClick={() => {
              setContado("");
              setFechando(true);
            }}
          >
            Fechar caixa
          </Button>
        </div>
      </div>

      <div className={classes.corpo}>
        {/* ── Carrinho ─────────────────────────────────────────────────── */}
        <div className={classes.painel}>
          <div className={classes.tituloPainel}>Venda</div>

          <div className={classes.busca}>
            <Autocomplete
              options={produtos}
              getOptionLabel={(o) => o.name || ""}
              loading={buscando}
              filterOptions={(x) => x}
              onInputChange={(_e, valor) => {
                if (valor.length >= 2) buscarProdutos(valor);
              }}
              onChange={(_e, produto) => adicionar(produto)}
              // Sem isto o campo guarda o último produto escolhido e a próxima
              // busca começa com ele escrito dentro.
              value={null}
              blurOnSelect
              renderInput={(params) => (
                <TextField
                  {...params}
                  inputRef={campoBusca}
                  size="small"
                  label="Buscar produto por nome ou código"
                  autoFocus
                />
              )}
            />
          </div>

          {itens.length === 0 ? (
            <div className={classes.vazio}>
              Nenhum item. Busque um produto acima para começar.
            </div>
          ) : (
            itens.map((item) => (
              <div key={item.chave} className={classes.linha}>
                <span className={classes.nomeItem}>{item.name}</span>
                <TextField
                  size="small"
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    mudarItem(item.chave, "quantity", e.target.value)
                  }
                  inputProps={{ min: 0, step: "0.001", inputMode: "decimal" }}
                />
                <TextField
                  size="small"
                  type="number"
                  value={item.unitPrice}
                  // O preço vem do catálogo e o servidor o reimpõe: editá-lo
                  // aqui não muda o que será cobrado. Fica travado para não
                  // prometer um desconto que não vai acontecer.
                  disabled
                  inputProps={{ step: "0.01" }}
                />
                <span className={classes.dinheiro}>
                  {moeda(
                    (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                  )}
                </span>
                <IconButton
                  size="small"
                  aria-label={`Remover ${item.name}`}
                  onClick={() =>
                    setItens((atuais) =>
                      atuais.filter((i) => i.chave !== item.chave)
                    )
                  }
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </div>
            ))
          )}

          <div className={classes.fechamento}>
            <TextField
              select
              size="small"
              label="Forma de pagamento"
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              style={{ minWidth: 180 }}
            >
              {FORMAS.map((f) => (
                <MenuItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              type="number"
              label="Desconto"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              disabled={!podeDescontar}
              title={
                podeDescontar
                  ? undefined
                  : "Você não tem permissão para dar desconto."
              }
              inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
              style={{ width: 140 }}
            />

            <span className={classes.total}>{moeda(total)}</span>

            <Button
              variant="contained"
              color="primary"
              onClick={finalizar}
              disabled={salvando || itens.length === 0}
            >
              Finalizar venda
            </Button>
          </div>
        </div>

        {/* ── O turno ──────────────────────────────────────────────────── */}
        <div className={classes.painel}>
          <div className={classes.tituloPainel}>Neste turno</div>

          <div className={classes.listaCurta}>
            {(resumo.sales || []).length === 0 &&
            (resumo.movements || []).length === 0 ? (
              <div className={classes.vazio}>Nada registrado ainda.</div>
            ) : (
              <>
                {(resumo.sales || []).map((venda) => (
                  <div key={`v${venda.id}`} className={classes.itemLista}>
                    <span>
                      #{venda.number} · {hora(venda.createdAt)}
                    </span>
                    <span className={classes.dinheiro}>
                      {moeda(venda.total)}
                    </span>
                  </div>
                ))}

                {(resumo.movements || []).map((mov) => (
                  <div key={`m${mov.id}`} className={classes.itemLista}>
                    <span
                      className={
                        mov.direction === "out" ? classes.saida : classes.entrada
                      }
                    >
                      {mov.direction === "out" ? "Sangria" : "Suprimento"} ·{" "}
                      {mov.reason}
                    </span>
                    <span className={classes.dinheiro}>{moeda(mov.amount)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Sangria e suprimento ─────────────────────────────────────────── */}
      <Dialog open={Boolean(movimento)} onClose={() => setMovimento(null)}>
        <DialogTitle>
          {movimento?.direction === "out" ? "Sangria" : "Suprimento"}
        </DialogTitle>
        <DialogContent>
          <div className={classes.campos}>
            <Typography variant="body2" color="textSecondary">
              {movimento?.direction === "out"
                ? "O dinheiro sai da gaveta e vai para outra conta — o cofre, o banco. Para pagar alguém, use contas a pagar: sangria é dinheiro que muda de lugar, não despesa."
                : "O dinheiro entra na gaveta vindo de outra conta da empresa."}
            </Typography>

            <TextField
              select
              size="small"
              label={
                movimento?.direction === "out" ? "Para onde vai" : "De onde vem"
              }
              value={movimento?.counterAccountId ?? ""}
              onChange={(e) =>
                setMovimento((m) => ({ ...m, counterAccountId: e.target.value }))
              }
              fullWidth
            >
              {contas
                .filter((c) => c.id !== session.accountId)
                .map((conta) => (
                  <MenuItem key={conta.id} value={conta.id}>
                    {conta.name}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              size="small"
              type="number"
              label="Valor"
              value={movimento?.amount ?? ""}
              onChange={(e) =>
                setMovimento((m) => ({ ...m, amount: e.target.value }))
              }
              inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
              fullWidth
            />

            <TextField
              size="small"
              label="Motivo"
              value={movimento?.reason ?? ""}
              onChange={(e) =>
                setMovimento((m) => ({ ...m, reason: e.target.value }))
              }
              fullWidth
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovimento(null)} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={registrarMovimento}
            variant="contained"
            color="primary"
            disabled={salvando}
          >
            Registrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Fechamento ───────────────────────────────────────────────────── */}
      <Dialog open={fechando} onClose={() => setFechando(false)}>
        <DialogTitle>Fechar o caixa</DialogTitle>
        <DialogContent>
          <div className={classes.campos}>
            <Typography variant="body2" color="textSecondary">
              Conte o dinheiro da gaveta e informe o valor. A diferença fica
              registrada como ela é — sobra e falta são normais, e apagá-las
              seria apagar justamente o que faz alguém procurar o erro.
            </Typography>

            <div className={classes.bloco}>
              <span className={classes.rotulo}>Esperado</span>
              <span className={classes.numero}>{moeda(esperado)}</span>
            </div>

            <TextField
              size="small"
              type="number"
              label="Contado na gaveta"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              inputProps={{ min: 0, step: "0.01", inputMode: "decimal" }}
              autoFocus
              fullWidth
            />

            {contado !== "" && (
              <Typography
                variant="body2"
                className={
                  Number(contado) - esperado < 0 ? classes.saida : classes.entrada
                }
              >
                {Number(contado) - esperado === 0
                  ? "Sem diferença."
                  : `${
                      Number(contado) - esperado > 0 ? "Sobra" : "Falta"
                    } de ${moeda(Math.abs(Number(contado) - esperado))}.`}
              </Typography>
            )}

            <Divider />

            <TextField
              size="small"
              label="Observação (opcional)"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFechando(false)} color="secondary">
            Cancelar
          </Button>
          <Button
            onClick={fecharCaixa}
            variant="contained"
            color="primary"
            disabled={salvando || contado === ""}
          >
            Fechar caixa
          </Button>
        </DialogActions>
      </Dialog>
    </Shell>
  );
};

export default Pdv;
