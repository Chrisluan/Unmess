import React, { useState, useEffect, useCallback, useMemo } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Badge from "@mui/material/Badge";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsIcon from "@mui/icons-material/PaymentsOutlined";
import AccountBalanceIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import TuneIcon from "@mui/icons-material/Tune";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import usePermissions from "../../hooks/usePermissions";

import AbaReceber from "./AbaReceber";
import AbaPagar from "./AbaPagar";
import AbaCaixa from "./AbaCaixa";
import AbaCadastros from "./AbaCadastros";

const useStyles = makeStyles((theme) => ({
  abas: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 44,
  },
  aba: { minHeight: 44 },
  corpo: {
    flex: 1,
    margin: theme.spacing(0, 2, 2),
    border: `1px solid ${theme.palette.divider}`,
    overflowY: "auto",
    // Sem isto a tabela larga estoura o painel e rola a página inteira.
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },
}));

/**
 * Financeiro.
 *
 * Quatro perguntas, quatro abas: o que tenho a receber, o que tenho a pagar,
 * como está o caixa, e como a empresa está configurada. A ordem é a da
 * urgência — quem abre esta tela quase sempre quer saber quem está devendo.
 *
 * Os cadastros de apoio (condições, contas, categorias, fornecedores) são
 * carregados aqui e distribuídos: as abas precisam dos mesmos seletores, e
 * cada uma buscando o seu faria a mesma requisição quatro vezes.
 *
 * As abas vêm de uma lista, e não de índices soltos: com permissões diferentes
 * escondendo abas diferentes, comparar `aba === 2` só acerta por coincidência.
 */
const Finance = () => {
  const classes = useStyles();
  const { can } = usePermissions();

  const [aba, setAba] = useState(0);
  const [cadastros, setCadastros] = useState({
    paymentTerms: [],
    accounts: [],
    categories: [],
    suppliers: [],
  });
  // Quantas vendas faturadas ainda não viraram cobrança — vira selo na aba.
  const [pendentes, setPendentes] = useState(0);

  const carregarCadastros = useCallback(async () => {
    try {
      const { data } = await api.get("/finance/cadastros");
      setCadastros(data);
    } catch (err) {
      toastError(err);
    }
  }, []);

  useEffect(() => {
    carregarCadastros();
  }, [carregarCadastros]);

  const abas = useMemo(() => {
    const lista = [
      {
        chave: "receber",
        rotulo: "A receber",
        icone: <ReceiptLongIcon fontSize="small" />,
        selo: pendentes,
        conteudo: (
          <AbaReceber cadastros={cadastros} onPendentesChange={setPendentes} />
        ),
      },
      {
        chave: "pagar",
        rotulo: "A pagar",
        icone: <PaymentsIcon fontSize="small" />,
        conteudo: <AbaPagar cadastros={cadastros} onSalvo={carregarCadastros} />,
      },
    ];

    if (can("finance:cashflow")) {
      lista.push({
        chave: "caixa",
        rotulo: "Caixa",
        icone: <AccountBalanceIcon fontSize="small" />,
        conteudo: <AbaCaixa />,
      });
    }

    if (can("finance:manage")) {
      lista.push({
        chave: "config",
        rotulo: "Configuração",
        icone: <TuneIcon fontSize="small" />,
        conteudo: (
          <AbaCadastros cadastros={cadastros} onSalvo={carregarCadastros} />
        ),
      });
    }

    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros, pendentes, carregarCadastros]);

  const atual = abas[aba] || abas[0];

  return (
    <MainContainer>
      <MainHeader>
        <Title>Financeiro</Title>
      </MainHeader>

      <Tabs
        value={Math.min(aba, abas.length - 1)}
        onChange={(_e, novo) => setAba(novo)}
        className={classes.abas}
        variant="scrollable"
        scrollButtons="auto"
      >
        {abas.map((a) => (
          <Tab
            key={a.chave}
            className={classes.aba}
            icon={a.icone}
            iconPosition="start"
            label={
              a.selo ? (
                <Badge badgeContent={a.selo} color="error">
                  <span style={{ paddingRight: 12 }}>{a.rotulo}</span>
                </Badge>
              ) : (
                a.rotulo
              )
            }
          />
        ))}
      </Tabs>

      <Paper square variant="outlined" className={classes.corpo}>
        {atual?.conteudo}
      </Paper>
    </MainContainer>
  );
};

export default Finance;
