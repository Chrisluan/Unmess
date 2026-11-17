import React from "react";
import PropTypes from "prop-types";

import {
  Box,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Switch,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";

const useStyles = makeStyles((theme) => ({
  raiz: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
  },

  dimensao: {
    border: `1px solid ${theme.palette.divider}`,
    display: "flex",
    flexDirection: "column",
  },

  cabecalho: {
    padding: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.palette.divider}`,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(2),
  },

  titulo: { display: "flex", flexDirection: "column", gap: 2 },

  itens: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.5, 2),
    padding: theme.spacing(1, 1.5),
  },

  aviso: {
    padding: theme.spacing(1.5),
    color: theme.palette.text.secondary,
  },

  // Alcance vazio é o estado que faz a tela abrir em branco. Ele precisa
  // saltar aos olhos de quem está configurando, não ser descoberto depois.
  alerta: {
    color: theme.palette.warning.main,
    fontWeight: 600,
  },

  herdado: {
    color: theme.palette.text.secondary,
    fontStyle: "italic",
  },

  centro: { display: "flex", justifyContent: "center", padding: 24 },
}));

/**
 * Sobre quais coisas as permissões valem.
 *
 * Duas modalidades, porque escopo mora em dois lugares:
 *
 *   modo="cargo"    define o padrão — "todos" ou uma lista.
 *   modo="pessoa"   ajusta por cima do cargo — cada item vira um dos três
 *                   estados: como no cargo, liberado à parte, bloqueado à
 *                   parte.
 *
 * A modalidade da pessoa mostra o que vem do cargo já marcado e em itálico:
 * sem isso, uma lista de caixinhas vazias sugere "esta pessoa não alcança
 * nada", quando na verdade ela alcança tudo que o cargo dela alcança.
 */
const EscopoEditor = ({
  dimensoes,
  opcoes,
  carregando,
  modo,
  valor,
  escoposDoCargo,
  onChange,
}) => {
  const classes = useStyles();

  if (carregando) {
    return (
      <div className={classes.centro}>
        <CircularProgress size={28} />
      </div>
    );
  }

  if (!dimensoes || dimensoes.length === 0) {
    return (
      <Typography variant="body2" className={classes.aviso}>
        Não há nada para restringir aqui — ou porque nenhum módulo com alcance
        configurável está no seu acesso, ou porque a empresa ainda não tem
        quadros, contas nem conexões cadastrados.
      </Typography>
    );
  }

  const doCargo = (chave) => escoposDoCargo?.[chave] ?? {};

  /** No modo cargo: "todos", ou a lista marcada. */
  const alterarCargo = (chave, mudanca) => {
    onChange({ ...valor, [chave]: { ...(valor[chave] ?? {}), ...mudanca } });
  };

  /** No modo pessoa: allow/deny por item. */
  const alterarPessoa = (chave, id, estado) => {
    const atual = valor[chave] ?? {};
    const allow = (atual.allow ?? []).filter((i) => i !== id);
    const deny = (atual.deny ?? []).filter((i) => i !== id);

    if (estado === "allow") allow.push(id);
    if (estado === "deny") deny.push(id);

    onChange({ ...valor, [chave]: { allow, deny } });
  };

  const estadoNaPessoa = (chave, id) => {
    const atual = valor[chave] ?? {};
    if ((atual.deny ?? []).includes(id)) return "deny";
    if ((atual.allow ?? []).includes(id)) return "allow";
    return "herdado";
  };

  const vemDoCargo = (chave, id) => {
    const base = doCargo(chave);
    return base.todos === true || (base.ids ?? []).includes(id);
  };

  return (
    <div className={classes.raiz}>
      {dimensoes.map((dimensao) => {
        const lista = opcoes[dimensao.chave] ?? [];
        const atual = valor[dimensao.chave] ?? {};
        const irrestrito = modo === "cargo" && atual.todos === true;
        const marcados = atual.ids ?? [];

        const semAlcance =
          modo === "cargo" && !irrestrito && marcados.length === 0;

        return (
          <div key={dimensao.chave} className={classes.dimensao}>
            <div className={classes.cabecalho}>
              <div className={classes.titulo}>
                <Typography variant="subtitle2">{dimensao.label}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {dimensao.descricao}
                </Typography>
                {semAlcance && (
                  <Typography variant="caption" className={classes.alerta}>
                    Sem nada marcado, este cargo não alcança nenhum item — a
                    tela abre vazia para quem o ocupa.
                  </Typography>
                )}
              </div>

              {modo === "cargo" && (
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={irrestrito}
                      onChange={(e) =>
                        alterarCargo(dimensao.chave, {
                          todos: e.target.checked,
                        })
                      }
                    />
                  }
                  label={
                    <Typography variant="caption">
                      Todos, inclusive os futuros
                    </Typography>
                  }
                />
              )}
            </div>

            {lista.length === 0 ? (
              <Typography variant="body2" className={classes.aviso}>
                Nada cadastrado ainda.
              </Typography>
            ) : irrestrito ? (
              <Typography variant="body2" className={classes.aviso}>
                Este cargo acompanha todos os itens desta lista, inclusive os
                que forem criados depois.
              </Typography>
            ) : (
              <div className={classes.itens}>
                {lista.map((item) =>
                  modo === "cargo" ? (
                    <FormControlLabel
                      key={item.id}
                      control={
                        <Checkbox
                          size="small"
                          checked={marcados.includes(item.id)}
                          onChange={(e) =>
                            alterarCargo(dimensao.chave, {
                              ids: e.target.checked
                                ? [...marcados, item.id]
                                : marcados.filter((i) => i !== item.id),
                            })
                          }
                        />
                      }
                      label={<Typography variant="body2">{item.nome}</Typography>}
                    />
                  ) : (
                    <Chip
                      key={item.id}
                      size="small"
                      label={
                        <span>
                          {item.nome}
                          {estadoNaPessoa(dimensao.chave, item.id) ===
                            "herdado" && (
                            <span className={classes.herdado}>
                              {vemDoCargo(dimensao.chave, item.id)
                                ? " · do cargo"
                                : " · fora do cargo"}
                            </span>
                          )}
                        </span>
                      }
                      /**
                       * Um clique percorre os três estados na ordem em que se
                       * costuma precisar deles: herdado → liberado →
                       * bloqueado → herdado. Três controles separados por item
                       * multiplicariam a tela por três para dizer a mesma
                       * coisa.
                       */
                      onClick={() => {
                        const estado = estadoNaPessoa(dimensao.chave, item.id);
                        const proximo =
                          estado === "herdado"
                            ? "allow"
                            : estado === "allow"
                            ? "deny"
                            : "herdado";
                        alterarPessoa(dimensao.chave, item.id, proximo);
                      }}
                      color={
                        estadoNaPessoa(dimensao.chave, item.id) === "allow"
                          ? "primary"
                          : estadoNaPessoa(dimensao.chave, item.id) === "deny"
                          ? "error"
                          : "default"
                      }
                      variant={
                        estadoNaPessoa(dimensao.chave, item.id) === "herdado"
                          ? "outlined"
                          : "filled"
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {modo === "pessoa" && (
        <Box>
          <Typography variant="caption" color="textSecondary">
            Clique num item para alternar entre herdar do cargo, liberar só
            para esta pessoa e bloquear só para esta pessoa. Bloquear vence
            liberar.
          </Typography>
        </Box>
      )}
    </div>
  );
};

EscopoEditor.propTypes = {
  dimensoes: PropTypes.array,
  opcoes: PropTypes.object,
  carregando: PropTypes.bool,
  modo: PropTypes.oneOf(["cargo", "pessoa"]).isRequired,
  valor: PropTypes.object.isRequired,
  /** Só no modo pessoa: o escopo do cargo, para mostrar o que é herdado. */
  escoposDoCargo: PropTypes.object,
  onChange: PropTypes.func.isRequired,
};

export default EscopoEditor;
