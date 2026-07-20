import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
  makeStyles,
} from "@material-ui/core";
import { Security, Group, Person } from "@material-ui/icons";
import { green } from "@material-ui/core/colors";

import PermissionMatrix from "../PermissionMatrix";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  btnWrapper: { position: "relative" },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  header: {
    display: "flex",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
    flexWrap: "wrap",
  },
  infoChip: { fontWeight: 500 },
  sectionTitle: {
    fontWeight: 600,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  legend: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginBottom: theme.spacing(2),
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: theme.palette.text.secondary,
  },
  chipInherited: { fontSize: 10, height: 20, backgroundColor: theme.palette.grey[200] },
  chipAllow: { fontSize: 10, height: 20, backgroundColor: "#e8f5e9", color: "#2e7d32" },
  chipDeny: { fontSize: 10, height: 20, backgroundColor: "#fce4ec", color: "#c62828" },
}));

/**
 * Modal para gerenciar permissões individuais de um usuário.
 * Exibe permissões herdadas do grupo + overrides individuais (allow/deny).
 */
const UserPermissionsModal = ({ open, onClose, userId, userName, groupName }) => {
  const classes = useStyles();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupPermissions, setGroupPermissions] = useState([]);
  const [overrides, setOverrides] = useState({ allow: [], deny: [] });

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/permission-groups/user/${userId}`);
      setGroupPermissions(data.groupPermissions || []);
      setOverrides(data.overrides || { allow: [], deny: [] });
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleClose = () => {
    onClose();
    setGroupPermissions([]);
    setOverrides({ allow: [], deny: [] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/users/${userId}`, {
        customPermissions: overrides,
      });
      toast.success("Permissões individuais salvas");
      handleClose();
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setOverrides({ allow: [], deny: [] });
  };

  const totalOverrides = (overrides.allow?.length ?? 0) + (overrides.deny?.length ?? 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Security color="primary" />
          <span>Permissões — {userName}</span>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Informações de contexto */}
            <Box className={classes.header}>
              {groupName ? (
                <Chip
                  icon={<Group fontSize="small" />}
                  label={`Grupo: ${groupName}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                  className={classes.infoChip}
                />
              ) : (
                <Chip
                  label="Sem grupo de permissão"
                  size="small"
                  variant="outlined"
                  className={classes.infoChip}
                />
              )}
              {totalOverrides > 0 && (
                <Chip
                  icon={<Person fontSize="small" />}
                  label={`${totalOverrides} override${totalOverrides > 1 ? "s" : ""} individual${totalOverrides > 1 ? "is" : ""}`}
                  size="small"
                  color="secondary"
                  className={classes.infoChip}
                />
              )}
            </Box>

            {/* Legenda */}
            <Box className={classes.legend}>
              <Box className={classes.legendItem}>
                <Chip label="Herdado" size="small" className={classes.chipInherited} />
                <span>do grupo</span>
              </Box>
              <Box className={classes.legendItem}>
                <Chip label="✓ Override" size="small" className={classes.chipAllow} />
                <span>permitido individualmente</span>
              </Box>
              <Box className={classes.legendItem}>
                <Chip label="✗ Negado" size="small" className={classes.chipDeny} />
                <span>negado individualmente</span>
              </Box>
            </Box>

            <Divider style={{ marginBottom: 12 }} />

            <Typography className={classes.sectionTitle}>
              <Security fontSize="small" />
              Permissões efetivas
            </Typography>
            <Typography variant="caption" color="textSecondary" style={{ marginBottom: 8, display: "block" }}>
              Clique para criar ou remover overrides individuais. Permissões herdadas do grupo são marcadas automaticamente.
            </Typography>

            <PermissionMatrix
              mode="user"
              selectedPermissions={groupPermissions}
              overrides={overrides}
              onOverrideChange={setOverrides}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        {totalOverrides > 0 && (
          <Button onClick={handleReset} color="secondary" size="small" style={{ marginRight: "auto" }}>
            Remover todos os overrides
          </Button>
        )}
        <Button onClick={handleClose} color="secondary" variant="outlined" disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={saving || loading}
          className={classes.btnWrapper}
        >
          Salvar permissões
          {saving && <CircularProgress size={24} className={classes.buttonProgress} />}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserPermissionsModal;
