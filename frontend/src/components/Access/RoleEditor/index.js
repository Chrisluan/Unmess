import React, { useMemo, useState } from "react";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  InputBase,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import * as Icones from "@mui/icons-material";
import {
  ExpandLess,
  ExpandMore,
  Search,
  InfoOutlined,
} from "@mui/icons-material";

import {
  comDependencias,
  nivelDoModulo,
  permissoesDoNivel,
  semDependentes,
  ROTULO_DO_NIVEL,
} from "../../../helpers/permissoes";

const useStyles = makeStyles((theme) => ({
  busca: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: "6px 12px",
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  },
  buscaInput: { flex: 1, fontSize: 14 },

  modulo: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    overflow: "hidden",
  },
  cabecalho: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.25, 1.5),
    backgroundColor: theme.palette.action.hover,
  },
  identidade: { flex: 1, minWidth: 0 },
  nome: { fontWeight: 600, fontSize: 14, lineHeight: 1.3 },
  resumo: {
    fontSize: 12,
    color: theme.palette.text.secondary,
    display: "block",
  },
  icone: { color: theme.palette.text.secondary, display: "flex" },

  niveis: { flexShrink: 0 },
  botaoNivel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "none",
    padding: "3px 10px",
    lineHeight: 1.4,
  },

  detalhe: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: theme.spacing(0.75, 1.5),
    fontSize: 12,
    color: theme.palette.text.secondary,
    cursor: "pointer",
    userSelect: "none",
    "&:hover": { color: theme.palette.text.primary },
  },

  acao: {
    display: "flex",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    padding: theme.spacing(0.75, 1.5, 0.75, 2),
    "&:hover": { backgroundColor: theme.palette.action.hover },
  },
  acaoTexto: { flex: 1, minWidth: 0 },
  acaoNome: { fontSize: 13, lineHeight: 1.4 },
  acaoDescricao: {
    fontSize: 11.5,
    color: theme.palette.text.secondary,
    lineHeight: 1.4,
  },
  selo: {
    fontSize: 10,
    height: 18,
    fontWeight: 700,
  },
}));

const CORES_DO_NIVEL = {
  ver: "default",
  operar: "primary",
  gerenciar: "warning",
};

/**
 * Editor do que um cargo libera.
 *
 * A versão anterior era uma lista de caixas de seleção — oito por módulo,
 * sessenta e três no total, todas com o mesmo peso visual e nenhuma
 * explicação. Marcar as certas exigia saber de cor quais permissões o sistema
 * exige juntas, e nada avisava quando o conjunto não fazia sentido.
 *
 * Aqui a pergunta principal é uma só por módulo: quanto esta pessoa mexe
 * nisto? Sem acesso, só ver, ver e operar, ou controle total. Quase todo
 * cargo real é um desses quatro. Quem precisa de um recorte diferente abre o
 * ajuste fino e marca ação por ação — e aí cada uma vem com a frase que diz o
 * que ela permite de verdade e o que custa concedê-la.
 */
const RoleEditor = ({
  catalogo,
  selecionadas = [],
  onChange,
  somenteLeitura = false,
  /**
   * Permissões que quem está editando não possui. Aparecem travadas, com o
   * motivo — o servidor recusa concedê-las de qualquer forma (ninguém dá o
   * que não tem), e uma caixa que aceita o clique e falha ao salvar é pior do
   * que uma caixa desabilitada.
   */
  foraDoAlcance = [],
}) => {
  const classes = useStyles();
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState({});

  const { listaDeModulos, indice } = catalogo;

  const alternarDetalhe = (chave) =>
    setAbertos((atual) => ({ ...atual, [chave]: !atual[chave] }));

  /**
   * A busca esconde ações, mas cada módulo carrega junto a versão inteira em
   * `completo`.
   *
   * O seletor de nível e o cálculo do que já está marcado precisam enxergar o
   * módulo todo. Se olhassem só o que sobrou do filtro, buscar "excluir" e
   * clicar em "Controle total" apagaria em silêncio todas as outras
   * permissões daquele módulo — as que a busca tinha acabado de ocultar.
   */
  const modulosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return listaDeModulos.map((m) => ({ ...m, completo: m }));

    return listaDeModulos
      .map((modulo) => {
        if (modulo.label.toLowerCase().includes(termo)) {
          return { ...modulo, completo: modulo };
        }

        const acoes = Object.fromEntries(
          Object.entries(modulo.acoes).filter(
            ([chave, acao]) =>
              acao.label.toLowerCase().includes(termo) ||
              acao.descricao.toLowerCase().includes(termo) ||
              `${modulo.chave}:${chave}`.toLowerCase().includes(termo)
          )
        );

        return Object.keys(acoes).length
          ? { ...modulo, acoes, completo: modulo }
          : null;
      })
      .filter(Boolean);
  }, [busca, listaDeModulos]);

  // Com a busca ativa, o ajuste fino abre sozinho: procurar uma permissão e
  // receber um módulo fechado não responde a pergunta de ninguém.
  const detalheAberto = (chave) => !!busca.trim() || !!abertos[chave];

  const aplicarNivel = (modulo, nivel) => {
    if (somenteLeitura) return;

    const doModulo = Object.keys(modulo.acoes).map(
      (acao) => `${modulo.chave}:${acao}`
    );

    // Tira tudo deste módulo e, com "nenhum", também o que dependia dele em
    // outros módulos — enviar figurinha depende de ver conversas.
    let proximas = selecionadas.filter((id) => !doModulo.includes(id));
    doModulo.forEach((id) => {
      proximas = semDependentes(proximas, id, indice);
    });

    if (nivel !== "nenhum") {
      proximas = comDependencias(
        [...proximas, ...permissoesDoNivel(modulo, nivel, indice)],
        indice
      );
    }

    onChange?.(proximas.filter((id) => !foraDoAlcance.includes(id)));
  };

  const alternarAcao = (id) => {
    if (somenteLeitura || foraDoAlcance.includes(id)) return;

    const proximas = selecionadas.includes(id)
      ? semDependentes(selecionadas, id, indice)
      : comDependencias([...selecionadas, id], indice);

    onChange?.(proximas.filter((p) => !foraDoAlcance.includes(p)));
  };

  const IconeDoModulo = ({ nome }) => {
    const Componente = Icones[nome] ?? Icones.CircleOutlined;
    return <Componente fontSize="small" />;
  };

  return (
    <Box>
      <Box className={classes.busca}>
        <Search color="disabled" fontSize="small" />
        <InputBase
          className={classes.buscaInput}
          placeholder="Buscar módulo ou permissão…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {busca && (
          <Typography variant="caption" color="textSecondary">
            {modulosVisiveis.length} módulo(s)
          </Typography>
        )}
      </Box>

      {modulosVisiveis.map((modulo) => {
        // Contagem e nível olham o módulo inteiro, não o recorte da busca.
        const doModulo = Object.keys(modulo.completo.acoes).map(
          (acao) => `${modulo.chave}:${acao}`
        );
        const ativas = doModulo.filter((id) => selecionadas.includes(id));
        const nivel = nivelDoModulo(modulo.completo, selecionadas, indice);
        const aberto = detalheAberto(modulo.chave);

        return (
          <Box key={modulo.chave} className={classes.modulo}>
            <Box className={classes.cabecalho}>
              <span className={classes.icone}>
                <IconeDoModulo nome={modulo.icone} />
              </span>

              <Box className={classes.identidade}>
                <Typography className={classes.nome}>{modulo.label}</Typography>
                <Typography component="span" className={classes.resumo}>
                  {nivel === "nenhum"
                    ? modulo.descricao
                    : `${ROTULO_DO_NIVEL[nivel]} · ${ativas.length} de ${doModulo.length}`}
                </Typography>
              </Box>

              <ToggleButtonGroup
                size="small"
                exclusive
                value={nivel}
                className={classes.niveis}
                onChange={(_e, valor) =>
                  valor && aplicarNivel(modulo.completo, valor)
                }
              >
                {["nenhum", "ver", "operar", "gerenciar"].map((opcao) => (
                  <ToggleButton
                    key={opcao}
                    value={opcao}
                    disabled={somenteLeitura}
                    className={classes.botaoNivel}
                  >
                    {ROTULO_DO_NIVEL[opcao]}
                  </ToggleButton>
                ))}
                {/* Só aparece quando o conjunto não bate com nenhum nível —
                    o seletor precisa dizer a verdade sobre o estado atual. */}
                {nivel === "personalizado" && (
                  <ToggleButton
                    value="personalizado"
                    disabled
                    className={classes.botaoNivel}
                  >
                    {ROTULO_DO_NIVEL.personalizado}
                  </ToggleButton>
                )}
              </ToggleButtonGroup>
            </Box>

            <Divider />

            <Box
              className={classes.detalhe}
              role="button"
              tabIndex={0}
              onClick={() => alternarDetalhe(modulo.chave)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  alternarDetalhe(modulo.chave);
                }
              }}
            >
              {aberto ? (
                <ExpandLess fontSize="small" />
              ) : (
                <ExpandMore fontSize="small" />
              )}
              {aberto ? "Fechar o ajuste fino" : "Ajuste fino"}
            </Box>

            <Collapse in={aberto}>
              <Divider />
              {Object.entries(modulo.acoes).map(([acaoChave, acao]) => {
                const id = `${modulo.chave}:${acaoChave}`;
                const marcada = selecionadas.includes(id);
                const travada = foraDoAlcance.includes(id);

                const linha = (
                  <Box key={id} className={classes.acao}>
                    <Switch
                      size="small"
                      checked={marcada}
                      disabled={somenteLeitura || travada}
                      onChange={() => alternarAcao(id)}
                      color="primary"
                    />
                    <Box className={classes.acaoTexto}>
                      <Typography className={classes.acaoNome}>
                        {acao.label}
                        {acao.nivel !== "ver" && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={ROTULO_DO_NIVEL[acao.nivel]}
                            color={CORES_DO_NIVEL[acao.nivel]}
                            className={classes.selo}
                            style={{ marginLeft: 8 }}
                          />
                        )}
                      </Typography>
                      <Typography className={classes.acaoDescricao}>
                        {acao.descricao}
                      </Typography>
                    </Box>
                  </Box>
                );

                if (!travada) return linha;

                return (
                  <Tooltip
                    key={id}
                    arrow
                    title="Você não tem esta permissão, então não pode concedê-la a outra pessoa."
                  >
                    <span>{linha}</span>
                  </Tooltip>
                );
              })}
            </Collapse>
          </Box>
        );
      })}

      {modulosVisiveis.length === 0 && (
        <Box display="flex" alignItems="center" gap={1} p={2}>
          <InfoOutlined fontSize="small" color="disabled" />
          <Typography variant="body2" color="textSecondary">
            Nenhum módulo ou permissão com “{busca}”.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RoleEditor;
