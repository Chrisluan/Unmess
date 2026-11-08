import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";

import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { Badge } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import usePermissions from "../hooks/usePermissions";
import { MODULOS, SECOES } from "./modulos";

const useStyles = makeStyles(theme => ({
  /**
   * Item de navegação.
   *
   * Ocupa a largura inteira da barra, sem margem lateral nem canto: a lista
   * lida como uma coluna contínua, e não como uma pilha de pastilhas soltas.
   * A barra de 3px à esquerda fica transparente aqui e ganha cor no item
   * ativo -- reservar o espaço desde já evita que o texto ande um pouco para
   * o lado toda vez que se troca de tela.
   */
  item: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 13,
    color: theme.palette.text.secondary,
    borderLeft: "3px solid transparent",
    "&:hover": {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary
    }
  },

  /**
   * Onde a pessoa está.
   *
   * A marcação é a barra azul na borda, e não um bloco de fundo colorido: com
   * canto reto, o bloco encostaria nas divisórias e viraria mais uma faixa
   * entre outras. A barra na margem é inequívoca e não disputa com o texto.
   */
  ativo: {
    backgroundColor: theme.palette.action.selected,
    borderLeftColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
    "& $icone": { color: theme.palette.primary.main },
    "&:hover": {
      backgroundColor: theme.palette.action.focus,
      color: theme.palette.primary.main
    }
  },

  icone: {
    minWidth: 38,
    color: "inherit"
  },

  texto: {
    "& .MuiTypography-root": {
      fontSize: "0.9rem",
      fontWeight: 500
    }
  },

  textoAtivo: {
    "& .MuiTypography-root": { fontWeight: 700 }
  },

  subheader: {
    lineHeight: "28px",
    paddingLeft: 16,
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    backgroundColor: "transparent"
  },

  // A divisória atravessa a barra inteira: recuada, ela desenharia um degrau
  // contra a borda reta da lateral.
  divisor: {
    margin: theme.spacing(1, 0, 0.5)
  },

  /**
   * A linha inteira, com a estrela por cima.
   *
   * A estrela precisa de um <ListItem> em volta porque um botão não pode
   * conter outro botão: o `secondaryAction` do MUI existe justamente para
   * isso, e desenha a ação fora do alvo de clique do link.
   */
  linha: {
    display: "block",
    padding: 0
  },

  /**
   * A estrela só aparece quando a pessoa está mirando a linha.
   *
   * Doze estrelas acesas o tempo todo competiriam com o item ativo, que é a
   * única coisa que a barra precisa destacar. `focus-within` entra junto do
   * hover para quem navega pelo teclado não perder a ação — sem ele a estrela
   * receberia o foco invisível.
   */
  estrela: {
    opacity: 0,
    padding: 4,
    marginRight: 2,
    color: theme.palette.text.secondary,
    transition: theme.transitions.create("opacity", { duration: 120 }),
    "$linha:hover &, $linha:focus-within &": { opacity: 1 },
    "&:hover": { color: theme.palette.warning.main }
  },

  // Favorito é estado, não passagem do mouse: fica visível sempre.
  estrelaAcesa: {
    opacity: 1,
    color: theme.palette.warning.main
  },

  // Espaço para a estrela não cobrir o fim de um rótulo comprido.
  textoComEstrela: {
    paddingRight: 28
  }
}));

/**
 * Item de navegação.
 *
 * Usa ListItemButton porque o prop `button` do ListItem foi removido no MUI
 * v6 — mantê-lo deixava o item sem hover, foco nem ripple.
 *
 * Com a barra recolhida só o ícone aparece, então o rótulo vira tooltip: sem
 * isso a navegação fechada é adivinhação. A estrela também some: não há
 * largura para ela, e favoritar é uma decisão que se toma com a barra aberta.
 */
function ListItemLink({
  icon,
  primary,
  to,
  recolhida,
  favorito,
  onAlternarFavorito
}) {
  const classes = useStyles();
  const { pathname } = useLocation();

  // "/" só casa exato; as demais casam por prefixo para a rota filha manter
  // o item do menu aceso.
  const ativo =
    to === "/" ? pathname === "/" : pathname.toLowerCase().startsWith(to.toLowerCase());

  const renderLink = React.useMemo(() => {
    const Link = React.forwardRef((itemProps, ref) => (
      <RouterLink to={to} ref={ref} {...itemProps} />
    ));
    // Sem displayName o componente aparece como "ForwardRef" no React
    // DevTools e no aviso do lint — e são doze deles na barra.
    Link.displayName = `NavLink(${to})`;
    return Link;
  }, [to]);

  const botao = (
    <ListItemButton
      component={renderLink}
      selected={ativo}
      className={`${classes.item} ${ativo ? classes.ativo : ""}`}
    >
      {icon ? <ListItemIcon className={classes.icone}>{icon}</ListItemIcon> : null}
      <ListItemText
        primary={primary}
        className={`${classes.texto} ${ativo ? classes.textoAtivo : ""} ${
          onAlternarFavorito ? classes.textoComEstrela : ""
        }`}
      />
    </ListItemButton>
  );

  if (recolhida) {
    return (
      <Tooltip title={primary} placement="right" arrow>
        <span>{botao}</span>
      </Tooltip>
    );
  }

  if (!onAlternarFavorito) return botao;

  const rotuloEstrela = favorito
    ? i18n.t("mainDrawer.favorites.remove")
    : i18n.t("mainDrawer.favorites.add");

  return (
    <ListItem
      className={classes.linha}
      disablePadding
      secondaryAction={
        <Tooltip title={rotuloEstrela} placement="right" arrow>
          <IconButton
            size="small"
            edge="end"
            aria-label={`${rotuloEstrela}: ${primary}`}
            aria-pressed={favorito}
            className={`${classes.estrela} ${favorito ? classes.estrelaAcesa : ""}`}
            onClick={onAlternarFavorito}
          >
            {favorito ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      }
    >
      {botao}
    </ListItem>
  );
}

const MainListItems = ({ drawerClose, recolhida = false }) => {
  const classes = useStyles();
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user, favoritos, alternarFavorito } = useContext(AuthContext);
  const { can, canAny } = usePermissions();
  const [connectionWarning, setConnectionWarning] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offline = whatsApps.filter((w) =>
          ["qrcode", "PAIRING", "DISCONNECTED", "TIMEOUT", "OPENING"].includes(w.status)
        );
        setConnectionWarning(offline.length > 0);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [whatsApps]);

  // O super só passa a ver a operação depois de entrar em alguma empresa.
  const foraDeEmpresa = user?.profile === "super" && !user?.companyId;
  const ehSuper = user?.profile === "super";

  /**
   * O que esta pessoa alcança.
   *
   * Não existe mais atalho de administrador: o cargo de Administrador tem
   * todas as permissões e passa por aqui pelo caminho normal, como todo
   * mundo. Enquanto havia um atalho, um cargo com `queues:view` não fazia o
   * item Setores aparecer — a seção inteira era mostrada por "é admin?", e
   * quem não fosse admin não a via, por mais permissões que tivesse.
   */
  const alcanca = (modulo) => {
    if (modulo.superOnly) return ehSuper;
    if (foraDeEmpresa) return false;
    if (modulo.permissoes) return canAny(modulo.permissoes);
    if (modulo.permissao) return can(modulo.permissao);
    return true;
  };

  const visiveis = MODULOS.filter(alcanca);

  /**
   * Favorito tira o módulo da seção de origem em vez de duplicá-lo.
   *
   * Numa barra de doze linhas, repetir "Conversas" em Favoritos e em Operação
   * lê como defeito, não como atalho — e o que os favoritos existem para
   * fazer é encurtar a barra, não alongá-la. A estrela acesa continua ali
   * dentro de Favoritos, então desfazer é o mesmo gesto que fez.
   */
  const listaDeFavoritos = Array.isArray(favoritos) ? favoritos : [];
  const ehFavorito = (chave) => listaDeFavoritos.includes(chave);

  // Na ordem em que a pessoa favoritou, não na ordem do registro: os
  // favoritos são a lista dela.
  const favoritados = listaDeFavoritos
    .map((chave) => visiveis.find((m) => m.chave === chave))
    .filter(Boolean);

  // Com a barra recolhida o título de seção não cabe; a linha divisória
  // sozinha já separa os grupos.
  const Secao = ({ children, primeira }) => {
    if (recolhida) return primeira ? null : <Divider className={classes.divisor} />;
    return (
      <>
        {!primeira && <Divider className={classes.divisor} />}
        <ListSubheader disableSticky className={classes.subheader}>
          {children}
        </ListSubheader>
      </>
    );
  };

  const renderizar = (modulo) => {
    const { Icone } = modulo;
    const comAlerta = modulo.alerta === "conexoes" && connectionWarning;

    return (
      <ListItemLink
        key={modulo.chave}
        to={modulo.to}
        primary={i18n.t(modulo.rotulo)}
        icon={
          comAlerta ? (
            <Badge badgeContent="!" color="error">
              <Icone />
            </Badge>
          ) : (
            <Icone />
          )
        }
        recolhida={recolhida}
        favorito={ehFavorito(modulo.chave)}
        // Sem a barra aberta não há onde desenhar a estrela.
        onAlternarFavorito={
          recolhida
            ? undefined
            : (e) => {
                // O clique acontece dentro da linha do link, e o container
                // fecha a gaveta em qualquer clique: sem parar a propagação,
                // favoritar navegaria para o módulo e fecharia o menu.
                e.preventDefault();
                e.stopPropagation();
                alternarFavorito(modulo.chave);
              }
        }
      />
    );
  };

  /**
   * As seções, na ordem do registro, já sem as que ficaram vazias.
   *
   * Um bloco inteiro sem nenhum item permitido não pode deixar o título e a
   * divisória sozinhos na barra — era o que acontecia quando a condição da
   * seção e a dos itens dentro dela eram escritas separadamente e uma delas
   * saía de sincronia.
   */
  const blocos = SECOES.map((secao) => ({
    ...secao,
    itens: visiveis.filter(
      (m) => m.secao === secao.chave && !ehFavorito(m.chave)
    )
  })).filter((secao) => secao.itens.length > 0);

  if (favoritados.length > 0) {
    blocos.unshift({
      chave: "favorites",
      rotulo: "mainDrawer.sections.favorites",
      itens: favoritados
    });
  }

  return (
    <div onClick={drawerClose}>
      {blocos.map((bloco, i) => (
        <React.Fragment key={bloco.chave}>
          <Secao primeira={i === 0}>{i18n.t(bloco.rotulo)}</Secao>
          {bloco.itens.map(renderizar)}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MainListItems;
