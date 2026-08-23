import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";

import RoleEditor from "../RoleEditor";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import usePermissions from "../../../hooks/usePermissions";
import { comDependencias } from "../../../helpers/permissoes";

const useStyles = makeStyles((theme) => ({
  identidade: {
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  modelos: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    alignItems: "center",
  },
  aviso: {
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  rodapeContagem: {
    marginRight: "auto",
    fontSize: 13,
    color: theme.palette.text.secondary,
  },
  progresso: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const vazio = { name: "", description: "", permissions: [] };

/**
 * Criar ou editar um cargo.
 *
 * Começar do zero em sessenta e três caixas é o pior jeito de montar um
 * cargo, então a criação oferece modelos prontos — Atendente, Vendedor,
 * Financeiro, Gerente. Escolher um preenche o editor e pronto: dali em diante
 * é um cargo comum da empresa, sem vínculo com o modelo. Nada que a gente
 * mude no modelo depois vai alterar cargos que já existem.
 */
const RoleModal = ({ open, onClose, roleId, catalogo, onSaved }) => {
  const classes = useStyles();
  const { permissions: minhasPermissoes, isSuper } = usePermissions();

  const [form, setForm] = useState(vazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modeloAplicado, setModeloAplicado] = useState(null);

  const editando = !!roleId;

  /**
   * O que este cargo não pode receber, porque quem edita também não tem.
   *
   * O servidor recusa de qualquer jeito — é a regra de "ninguém dá o que não
   * tem". Mostrar travado aqui evita a alternativa: marcar, salvar e levar um
   * erro sem entender qual das caixas causou.
   */
  const foraDoAlcance = useMemo(() => {
    if (isSuper) return [];
    const minhas = new Set(minhasPermissoes);
    return Array.from(catalogo.indice.keys()).filter((id) => !minhas.has(id));
  }, [catalogo.indice, minhasPermissoes, isSuper]);

  useEffect(() => {
    if (!open) return;
    setModeloAplicado(null);

    if (!roleId) {
      setForm(vazio);
      return;
    }

    (async () => {
      setCarregando(true);
      try {
        const { data } = await api.get(`/access/roles/${roleId}`);
        setForm({
          name: data.name ?? "",
          description: data.description ?? "",
          permissions: data.permissions ?? [],
        });
      } catch (err) {
        toastError(err);
        onClose();
      } finally {
        setCarregando(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roleId]);

  const aplicarModelo = (modelo) => {
    setModeloAplicado(modelo.slug);
    setForm((atual) => ({
      ...atual,
      name: atual.name || modelo.nome,
      description: atual.description || modelo.descricao,
      permissions: comDependencias(modelo.permissions, catalogo.indice).filter(
        (id) => !foraDoAlcance.includes(id)
      ),
    }));
  };

  const salvar = async () => {
    if (form.name.trim().length < 2) {
      toast.error("Dê um nome ao cargo.");
      return;
    }

    setSalvando(true);
    try {
      const corpo = {
        name: form.name.trim(),
        description: form.description.trim(),
        permissions: form.permissions,
      };

      if (editando) {
        await api.put(`/access/roles/${roleId}`, corpo);
        toast.success("Cargo atualizado.");
      } else {
        await api.post("/access/roles", corpo);
        toast.success("Cargo criado.");
      }

      onSaved?.();
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>{editando ? "Editar cargo" : "Novo cargo"}</DialogTitle>

      <DialogContent dividers>
        {carregando ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box className={classes.identidade}>
              <TextField
                label="Nome do cargo"
                value={form.name}
                onChange={(e) =>
                  setForm((atual) => ({ ...atual, name: e.target.value }))
                }
                variant="outlined"
                size="small"
                fullWidth
                autoFocus
              />
              <TextField
                label="Para quem é este cargo"
                placeholder="Uma frase que ajude quem for atribuí-lo depois"
                value={form.description}
                onChange={(e) =>
                  setForm((atual) => ({ ...atual, description: e.target.value }))
                }
                variant="outlined"
                size="small"
                fullWidth
                multiline
                minRows={2}
              />

              {!editando && catalogo.modelos.length > 0 && (
                <Box>
                  <Typography className={classes.aviso} gutterBottom>
                    Começar de um modelo pronto (você ajusta depois):
                  </Typography>
                  <Box className={classes.modelos}>
                    {catalogo.modelos.map((modelo) => (
                      <Chip
                        key={modelo.slug}
                        label={modelo.nome}
                        onClick={() => aplicarModelo(modelo)}
                        color={
                          modeloAplicado === modelo.slug ? "primary" : "default"
                        }
                        variant={
                          modeloAplicado === modelo.slug ? "filled" : "outlined"
                        }
                        size="small"
                        title={modelo.descricao}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>

            <RoleEditor
              catalogo={catalogo}
              selecionadas={form.permissions}
              foraDoAlcance={foraDoAlcance}
              onChange={(permissions) =>
                setForm((atual) => ({ ...atual, permissions }))
              }
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Typography className={classes.rodapeContagem}>
          {form.permissions.length} permissão(ões) neste cargo
        </Typography>
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
            Salvar cargo
          </Button>
          {salvando && <CircularProgress size={24} className={classes.progresso} />}
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default RoleModal;
