import React, { useCallback, useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Badge from "@mui/material/Badge";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoginIcon from "@mui/icons-material/Login";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import SituacaoEmpresa from "./SituacaoEmpresa";
import AbaVisaoGeral from "./AbaVisaoGeral";
import AbaUsuarios from "./AbaUsuarios";
import AbaCobranca from "./AbaCobranca";
import AbaAcesso from "./AbaAcesso";
import useEntrarNaEmpresa from "./useEntrarNaEmpresa";

const useStyles = makeStyles((theme) => ({
  identificacao: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    minWidth: 0,
  },

  subtitulo: {
    color: theme.palette.text.secondary,
  },

  abas: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 44,
  },

  aba: { minHeight: 44 },

  corpo: {
    flex: 1,
    margin: theme.spacing(0, 2, 2),
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    overflowY: "auto",
    overflowX: "auto",
    ...theme.scrollbarStyles,
  },

  carregando: {
    display: "flex",
    justifyContent: "center",
    padding: theme.spacing(6),
  },
}));

/**
 * Ficha de uma empresa assinante.
 *
 * O painel do super era uma lista e um modal de cadastro: dava para criar,
 * renomear e excluir empresa, e nada mais. Tudo o que se faz com um assinante
 * de verdade — ver quem usa, cobrar, cortar o acesso — não existia em lugar
 * nenhum, ou existia como campo que ninguém lia (o `status`, que a tela
 * deixava mudar e o login ignorava).
 *
 * As quatro abas são as quatro perguntas que se faz sobre um cliente: quem é,
 * quem usa, se está pagando e se pode entrar. Editar usuários e configurações
 * continua acontecendo dentro da empresa, pelo atalho do topo — são as mesmas
 * telas que o admin dela usa, e manter uma segunda cópia aqui seria manter
 * dois lugares para a mesma coisa.
 */
const ABAS = [
  { chave: "geral", rotulo: "Visão geral" },
  { chave: "usuarios", rotulo: "Usuários" },
  { chave: "cobranca", rotulo: "Cobrança" },
  { chave: "acesso", rotulo: "Acesso" },
];

const CompanyDetail = () => {
  const classes = useStyles();
  const { companyId } = useParams();
  const history = useHistory();
  const location = useLocation();
  const entrarNaEmpresa = useEntrarNaEmpresa();

  const [company, setCompany] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [vencidas, setVencidas] = useState(0);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/companies/${companyId}`);
      setCompany(data);
    } catch (err) {
      toastError(err);
    } finally {
      setCarregando(false);
    }
  }, [companyId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A aba vive na URL: recarregar a página, voltar pelo histórico ou mandar o
  // link para alguém cai onde deveria, e não sempre na primeira aba.
  const daUrl = (location.hash || "").replace("#", "");
  const atual = ABAS.some((a) => a.chave === daUrl) ? daUrl : ABAS[0].chave;

  const trocarAba = (_e, chave) =>
    history.replace(`${location.pathname}#${chave}`);

  if (carregando) {
    return (
      <MainContainer>
        <div className={classes.carregando}>
          <CircularProgress />
        </div>
      </MainContainer>
    );
  }

  if (!company) {
    return (
      <MainContainer>
        <MainHeader>
          <Title>Empresa não encontrada</Title>
        </MainHeader>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <MainHeader>
        <div className={classes.identificacao}>
          <Button
            size="small"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={() => history.push("/companies")}
          >
            Empresas
          </Button>
          <div style={{ minWidth: 0 }}>
            <Title>{company.name}</Title>
            <Typography variant="caption" className={classes.subtitulo}>
              {company.document || "sem CNPJ"} · plano {company.plan}
            </Typography>
          </div>
          <SituacaoEmpresa company={company} />
        </div>

        <MainHeaderButtonsWrapper>
          {/* Editar usuários e configurações acontece dentro da empresa, com
              as telas que o admin dela já usa. */}
          <Button
            variant="contained"
            color="primary"
            startIcon={<LoginIcon />}
            onClick={() => entrarNaEmpresa(company)}
          >
            Entrar na empresa
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Tabs
        value={atual}
        onChange={trocarAba}
        className={classes.abas}
        variant="scrollable"
        scrollButtons="auto"
      >
        {ABAS.map((aba) => (
          <Tab
            key={aba.chave}
            value={aba.chave}
            className={classes.aba}
            label={
              aba.chave === "cobranca" && vencidas > 0 ? (
                <Badge badgeContent={vencidas} color="error">
                  <span style={{ paddingRight: 12 }}>{aba.rotulo}</span>
                </Badge>
              ) : (
                aba.rotulo
              )
            }
          />
        ))}
      </Tabs>

      <Paper square variant="outlined" className={classes.corpo}>
        {atual === "geral" && (
          <AbaVisaoGeral company={company} onSalvo={carregar} />
        )}
        {atual === "usuarios" && (
          <AbaUsuarios company={company} onEntrar={entrarNaEmpresa} />
        )}
        {atual === "cobranca" && (
          <AbaCobranca
            company={company}
            onMudou={carregar}
            onResumo={(r) => setVencidas(r?.vencidas || 0)}
          />
        )}
        {atual === "acesso" && (
          <AbaAcesso company={company} onSalvo={carregar} />
        )}
      </Paper>
    </MainContainer>
  );
};

export default CompanyDetail;
