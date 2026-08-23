import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import {
  AddCircleOutline,
  BlockOutlined,
  CheckCircleOutline,
} from "@mui/icons-material";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import { comDependencias, semDependentes } from "../../../helpers/permissoes";

const useStyles = makeStyles((theme) => ({
  bloco: { marginBottom: theme.spacing(2.5) },
  tituloBloco: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: theme.palette.text.secondary,
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: theme.spacing(0.5),
  },
  explicacao: {
    fontSize: 12.5,
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
    display: "block",
  },
  listaExcecoes: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(0.75),
    marginTop: theme.spacing(1),
  },
  vazio: {
    fontSize: 12.5,
    color: theme.palette.text.disabled,
    fontStyle: "italic",
    marginTop: theme.spacing(1),
    display: "block",
  },
  resultado: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    maxHeight: 160,
    overflowY: "auto",
    padding: theme.spacing(1),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  progresso: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

/**
 * O acesso de uma pessoa: o cargo dela, mais as exceções.
 *
 * A tela anterior era uma matriz de sessenta e três caixas em que cada uma
 * tinha quatro estados — herdado do grupo, liberado à parte, bloqueado à
 * parte, e nada — espremidos num controle que só sabe representar dois. Ficar
 * "indeterminado" queria dizer "bloqueado", o que ninguém adivinha.
 *
 * Aqui o cargo é uma escolha só, e as exceções são duas listas com nome:
 * o que foi liberado além do cargo e o que foi bloqueado apesar dele.
 * Normalmente as duas estão vazias — que é como deve ser: exceção demais é
 * sinal de que falta um cargo.
 */
const UserAccessModal = ({
  open,
  onClose,
  userId,
  userName,
  catalogo,
  onSaved,
  /**
   * Quando informado, a tela opera pelo painel da plataforma: os cargos e o
   * salvamento passam pelas rotas de `/companies/:id`, que só o super alcança
   * — ele não pertence à empresa e não tem contexto de inquilino.
   *
   * É a mesma tela nos dois casos de propósito. Manter uma segunda versão
   * para o super garantiria que uma das duas ficasse para trás.
   */
  companyId = null,
  /** Acesso já conhecido da listagem, no modo painel da plataforma. */
  acessoInicial = null,
}) => {
  const classes = useStyles();
  const { permissions: minhasPermissoes, isSuper } = usePermissions();
  const noPainelDaPlataforma = !!companyId;

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [cargos, setCargos] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [excecoes, setExcecoes] = useState({ allow: [], deny: [] });

  const { indice, rotuloDaPermissao, descricaoDaPermissao } = catalogo;

  useEffect(() => {
    if (!open || !userId) return;

    (async () => {
      setCarregando(true);
      try {
        const lista = await api.get(
          noPainelDaPlataforma
            ? `/companies/${companyId}/roles`
            : "/access/roles"
        );
        setCargos(lista.data ?? []);

        if (noPainelDaPlataforma) {
          setRoleId(acessoInicial?.roleId ?? "");
          setExcecoes({
            allow: acessoInicial?.exceptions?.allow ?? [],
            deny: acessoInicial?.exceptions?.deny ?? [],
          });
          return;
        }

        const { data } = await api.get(`/access/users/${userId}`);
        setRoleId(data.role?.id ?? "");
        setExcecoes({
          allow: data.exceptions?.allow ?? [],
          deny: data.exceptions?.deny ?? [],
        });
      } catch (err) {
        toastError(err);
        onClose();
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  const cargoEscolhido = cargos.find((c) => c.id === roleId) ?? null;
  const permissoesDoCargo = cargoEscolhido?.permissions ?? [];

  /**
   * O resultado da conta, calculado do mesmo jeito que o servidor calcula:
   * cargo + liberadas − bloqueadas, com as dependências acompanhando.
   *
   * A pessoa que administra vê o resultado antes de salvar. Sem isso, a
   * única forma de saber o efeito de uma exceção era salvar e perguntar a
   * quem foi afetado.
   */
  const resultado = useMemo(() => {
    let final = comDependencias([...permissoesDoCargo, ...excecoes.allow], indice);
    excecoes.deny.forEach((id) => {
      final = semDependentes(final, id, indice);
    });
    return final;
  }, [permissoesDoCargo, excecoes, indice]);

  /** Só se concede o que se tem — a mesma regra que o servidor aplica. */
  const podeConceder = (id) =>
    isSuper || noPainelDaPlataforma || minhasPermissoes.includes(id);

  const opcoesParaLiberar = useMemo(
    () =>
      Array.from(indice.keys()).filter(
        (id) =>
          !permissoesDoCargo.includes(id) &&
          !excecoes.allow.includes(id) &&
          podeConceder(id)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indice, permissoesDoCargo, excecoes.allow, minhasPermissoes, isSuper]
  );

  const opcoesParaBloquear = useMemo(
    () =>
      comDependencias([...permissoesDoCargo, ...excecoes.allow], indice).filter(
        (id) => !excecoes.deny.includes(id)
      ),
    [permissoesDoCargo, excecoes, indice]
  );

  const salvar = async () => {
    setSalvando(true);
    try {
      const rota = noPainelDaPlataforma
        ? `/companies/${companyId}/users/${userId}`
        : `/access/users/${userId}`;

      await api.put(rota, {
        roleId: roleId === "" ? null : roleId,
        exceptions: excecoes,
      });
      toast.success("Acesso atualizado.");
      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const totalExcecoes = excecoes.allow.length + excecoes.deny.length;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>Acesso de {userName}</DialogTitle>

      <DialogContent dividers>
        {carregando ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ── Cargo ────────────────────────────────────────────────── */}
            <Box className={classes.bloco}>
              <Typography className={classes.tituloBloco}>Cargo</Typography>
              <Typography className={classes.explicacao}>
                O cargo responde a maior parte da pergunta. Mudá-lo aqui muda o
                acesso desta pessoa; mudar o cargo em si muda o de todo mundo
                que o tem.
              </Typography>

              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>Cargo</InputLabel>
                <Select
                  value={roleId}
                  label="Cargo"
                  onChange={(e) => setRoleId(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Sem cargo — não acessa nada</em>
                  </MenuItem>
                  {cargos.map((cargo) => (
                    <MenuItem key={cargo.id} value={cargo.id}>
                      {cargo.name}
                      {cargo.isSystem && " (do sistema)"}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {cargoEscolhido?.description && (
                <Typography className={classes.explicacao} style={{ marginTop: 8 }}>
                  {cargoEscolhido.description}
                </Typography>
              )}

              {roleId === "" && (
                <Alert severity="warning" style={{ marginTop: 8 }}>
                  Sem cargo, esta pessoa consegue entrar no sistema e não vê
                  tela nenhuma.
                </Alert>
              )}
            </Box>

            <Divider />

            {/* ── Liberado além do cargo ───────────────────────────────── */}
            <Box className={classes.bloco} style={{ marginTop: 20 }}>
              <Typography className={classes.tituloBloco}>
                <CheckCircleOutline fontSize="small" color="success" />
                Liberado só para esta pessoa
              </Typography>
              <Typography className={classes.explicacao}>
                Uma permissão a mais, sem mexer no cargo. Se estiver
                acrescentando a mesma coisa para várias pessoas, o certo é um
                cargo novo.
              </Typography>

              <Autocomplete
                options={opcoesParaLiberar}
                getOptionLabel={rotuloDaPermissao}
                value={null}
                blurOnSelect
                onChange={(_e, id) => {
                  if (!id) return;
                  setExcecoes((atual) => ({
                    allow: Array.from(new Set([...atual.allow, id])),
                    deny: atual.deny.filter((d) => d !== id),
                  }));
                }}
                renderOption={(props, id) => (
                  <li {...props} key={id}>
                    <Box>
                      <Typography variant="body2">{rotuloDaPermissao(id)}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {descricaoDaPermissao(id)}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    variant="outlined"
                    placeholder="Buscar permissão para liberar…"
                  />
                )}
              />

              {excecoes.allow.length === 0 ? (
                <Typography className={classes.vazio}>
                  Nada além do cargo.
                </Typography>
              ) : (
                <Box className={classes.listaExcecoes}>
                  {excecoes.allow.map((id) => (
                    <Chip
                      key={id}
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<AddCircleOutline />}
                      label={rotuloDaPermissao(id)}
                      onDelete={() =>
                        setExcecoes((atual) => ({
                          ...atual,
                          allow: atual.allow.filter((p) => p !== id),
                        }))
                      }
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* ── Bloqueado apesar do cargo ────────────────────────────── */}
            <Box className={classes.bloco}>
              <Typography className={classes.tituloBloco}>
                <BlockOutlined fontSize="small" color="error" />
                Bloqueado só para esta pessoa
              </Typography>
              <Typography className={classes.explicacao}>
                Tira uma permissão que o cargo dá. O que dependia dela sai
                junto — bloquear “ver conversas” fecha o módulo inteiro.
              </Typography>

              <Autocomplete
                options={opcoesParaBloquear}
                getOptionLabel={rotuloDaPermissao}
                value={null}
                blurOnSelect
                onChange={(_e, id) => {
                  if (!id) return;
                  setExcecoes((atual) => ({
                    allow: atual.allow.filter((a) => a !== id),
                    deny: Array.from(new Set([...atual.deny, id])),
                  }));
                }}
                renderOption={(props, id) => (
                  <li {...props} key={id}>
                    <Box>
                      <Typography variant="body2">{rotuloDaPermissao(id)}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {descricaoDaPermissao(id)}
                      </Typography>
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    variant="outlined"
                    placeholder="Buscar permissão para bloquear…"
                  />
                )}
              />

              {excecoes.deny.length === 0 ? (
                <Typography className={classes.vazio}>
                  Nada bloqueado.
                </Typography>
              ) : (
                <Box className={classes.listaExcecoes}>
                  {excecoes.deny.map((id) => (
                    <Chip
                      key={id}
                      size="small"
                      color="error"
                      variant="outlined"
                      icon={<BlockOutlined />}
                      label={rotuloDaPermissao(id)}
                      onDelete={() =>
                        setExcecoes((atual) => ({
                          ...atual,
                          deny: atual.deny.filter((p) => p !== id),
                        }))
                      }
                    />
                  ))}
                </Box>
              )}
            </Box>

            <Divider />

            {/* ── O resultado ──────────────────────────────────────────── */}
            <Box className={classes.bloco} style={{ marginTop: 20 }}>
              <Typography className={classes.tituloBloco}>
                No fim das contas, esta pessoa pode
              </Typography>
              <Box className={classes.resultado}>
                {resultado.length === 0 ? (
                  <Typography className={classes.vazio}>
                    Nada. Ela entra e não vê tela nenhuma.
                  </Typography>
                ) : (
                  resultado.map((id) => (
                    <Chip
                      key={id}
                      size="small"
                      variant="outlined"
                      label={rotuloDaPermissao(id)}
                      color={
                        excecoes.allow.includes(id) ? "success" : "default"
                      }
                    />
                  ))
                )}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        {totalExcecoes > 0 && (
          <Button
            onClick={() => setExcecoes({ allow: [], deny: [] })}
            color="secondary"
            size="small"
            style={{ marginRight: "auto" }}
          >
            Deixar só o cargo
          </Button>
        )}
        <Button onClick={onClose} color="secondary" variant="outlined" disabled={salvando}>
          Cancelar
        </Button>
        <Box position="relative">
          <Button
            onClick={salvar}
            color="primary"
            variant="contained"
            disabled={salvando || carregando}
          >
            Salvar acesso
          </Button>
          {salvando && <CircularProgress size={24} className={classes.progresso} />}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default UserAccessModal;
