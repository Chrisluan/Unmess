import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { useHistory, useLocation } from "react-router-dom";

import makeStyles from "@mui/styles/makeStyles";
import Container from "@mui/material/Container";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Typography from "@mui/material/Typography";

import { i18n } from "../../translate/i18n";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(3, 4, 4),
  },

  cabecalho: {
    marginBottom: theme.spacing(2),
  },

  descricao: {
    maxWidth: 720,
    marginTop: theme.spacing(0.5),
  },

  abas: {
    borderBottom: `1px solid ${theme.palette.divider}`,
  },

  tabPanel: {
    paddingTop: theme.spacing(3),
  },

  // O <fieldset> entra só pelo efeito de desativar o que está dentro; sem
  // isto ele desenharia a moldura e o recuo próprios do elemento.
  painel: {
    border: 0,
    margin: 0,
    padding: 0,
    minWidth: 0,
  },

  avisoLeitura: {
    marginBottom: theme.spacing(2),
  },
}));

/**
 * Uma tela de administração dividida em abas.
 *
 * Nasceu dentro de Configurações e saiu de lá quando Cadastro apareceu com a
 * mesma necessidade: aba na URL, filtro por permissão e modo somente leitura.
 * Duplicar as três coisas garantiria que uma delas divergisse — e a que
 * divergisse seria a permissão.
 *
 * A aba escolhida vive no fragmento da URL (`/cadastros#etiquetas`), que é
 * onde o navegador já sabe guardar estado: recarregar, voltar pelo histórico
 * ou mandar o link para um colega continua caindo na mesma aba.
 *
 * Cada aba declara:
 *   chave       fragmento da URL e identidade da aba
 *   rotulo      texto do topo
 *   permissao   sem ela, a aba nem aparece
 *   editar      sem ela, a aba aparece desativada em vez de sumir
 *   selo        número em destaque no rótulo (0 ou ausente não desenha nada)
 *   montarSomenteAtiva  só renderiza quando aberta, para abas que abrem
 *                       socket ou disparam requisições ao montar
 */
const PaginaComAbas = ({ titulo, descricao, abas, maxWidth = "lg" }) => {
  const classes = useStyles();
  const history = useHistory();
  const location = useLocation();
  const { can, permissions } = usePermissions();

  /**
   * Uma tela destas reúne assuntos com donos diferentes. Cada aba pergunta
   * pela sua permissão, então quem entra vê exatamente as que lhe cabem — e
   * não uma fileira de abas que respondem 403 ao serem abertas.
   */
  const abasPermitidas = useMemo(
    () => abas.filter((aba) => !aba.permissao || can(aba.permissao)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abas, permissions]
  );

  const daUrl = (location.hash || "").replace("#", "");
  const atual = abasPermitidas.some((a) => a.chave === daUrl)
    ? daUrl
    : abasPermitidas[0]?.chave;

  const trocarAba = (_e, chave) => {
    history.replace(`${location.pathname}#${chave}`);
  };

  return (
    <div className={classes.root}>
      <Container maxWidth={maxWidth}>
        <div className={classes.cabecalho}>
          <Typography variant="h5">{titulo}</Typography>
          {descricao && (
            <Typography
              variant="body2"
              color="textSecondary"
              className={classes.descricao}
            >
              {descricao}
            </Typography>
          )}
        </div>

        <Tabs
          // Sem nenhuma aba permitida o MUI reclamaria de um value que não
          // existe entre as opções; `false` é como ele representa "nenhuma".
          value={atual ?? false}
          onChange={trocarAba}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          className={classes.abas}
        >
          {abasPermitidas.map((aba) => (
            <Tab
              key={aba.chave}
              value={aba.chave}
              label={
                aba.selo ? (
                  <Badge badgeContent={aba.selo} color="error">
                    <span style={{ paddingRight: 12 }}>{aba.rotulo}</span>
                  </Badge>
                ) : (
                  aba.rotulo
                )
              }
            />
          ))}
        </Tabs>

        {abasPermitidas.map((aba) => {
          /**
           * "Ver" promete leitura, e a promessa é cumprida com um
           * <fieldset disabled>: ele desativa todo controle de formulário que
           * estiver dentro, inclusive pelo teclado, e continua valendo para
           * abas que ainda não existem. A alternativa era desabilitar campo a
           * campo em cinco arquivos — e esquecer um deles na próxima aba nova.
           *
           * O servidor recusa a gravação de qualquer jeito; isto existe para a
           * pessoa não descobrir isso depois de preencher o formulário.
           */
          const soLeitura = aba.editar && !can(aba.editar);

          const conteudo = aba.montarSomenteAtiva
            ? atual === aba.chave && aba.conteudo
            : aba.conteudo;

          return (
            <Box
              key={aba.chave}
              className={classes.tabPanel}
              hidden={atual !== aba.chave}
              role="tabpanel"
            >
              {soLeitura && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  className={classes.avisoLeitura}
                >
                  {i18n.t("tabbedPage.readOnly")}
                </Typography>
              )}
              <fieldset disabled={soLeitura} className={classes.painel}>
                {conteudo}
              </fieldset>
            </Box>
          );
        })}
      </Container>
    </div>
  );
};

PaginaComAbas.propTypes = {
  titulo: PropTypes.node.isRequired,
  descricao: PropTypes.node,
  maxWidth: PropTypes.string,
  abas: PropTypes.arrayOf(
    PropTypes.shape({
      chave: PropTypes.string.isRequired,
      rotulo: PropTypes.node.isRequired,
      permissao: PropTypes.string,
      editar: PropTypes.string,
      selo: PropTypes.number,
      montarSomenteAtiva: PropTypes.bool,
      conteudo: PropTypes.node,
    })
  ).isRequired,
};

export default PaginaComAbas;
