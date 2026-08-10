import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Checkbox,
  Collapse,
  IconButton,
  InputBase,
  Chip,
  Tooltip,
  Divider,
} from "@mui/material";
import makeStyles from '@mui/styles/makeStyles';
import {
  ExpandMore,
  ExpandLess,
  CheckBox,
  CheckBoxOutlineBlank,
  IndeterminateCheckBox,
  Search,
} from "@mui/icons-material";
import { PERMISSION_MODULES } from "../../constants/permissions";

const useStyles = makeStyles((theme) => ({
  root: { width: "100%" },

  searchBox: {
    display: "flex",
    alignItems: "center",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    padding: "4px 12px",
    marginBottom: theme.spacing(2),
    backgroundColor: theme.palette.background.paper,
  },
  searchInput: { flex: 1, fontSize: 14 },

  moduleCard: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(1),
    overflow: "hidden",
  },
  moduleHeader: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    cursor: "pointer",
    backgroundColor: theme.palette.grey[50],
    userSelect: "none",
    "&:hover": { backgroundColor: theme.palette.grey[100] },
  },
  moduleLabel: { flex: 1, fontWeight: 600, fontSize: 14 },
  moduleCount: { marginRight: theme.spacing(1) },

  permRow: {
    display: "flex",
    alignItems: "center",
    padding: "4px 12px 4px 16px",
    "&:hover": { backgroundColor: theme.palette.action.hover },
  },
  permLabel: { flex: 1, fontSize: 13, color: theme.palette.text.secondary },

  // Chips de estado do override (herdado / permitido / negado)
  chipInherited: {
    fontSize: 10,
    height: 20,
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.text.secondary,
  },
  chipAllow: {
    fontSize: 10,
    height: 20,
    backgroundColor: "#e8f5e9",
    color: "#2e7d32",
  },
  chipDeny: {
    fontSize: 10,
    height: 20,
    backgroundColor: "#fce4ec",
    color: "#c62828",
  },
}));

/**
 * PermissionMatrix — componente reutilizável para gerenciar permissões.
 *
 * Modo grupo (mode="group"):
 *   - selectedPermissions: string[] de permissões ativas
 *   - onChange(newPermissions: string[])
 *
 * Modo override de usuário (mode="user"):
 *   - selectedPermissions: string[] do grupo base (herdadas, read-only reference)
 *   - overrides: { allow: string[], deny: string[] }
 *   - onOverrideChange({ allow, deny })
 *   - Exibe estado herdado + badge de override
 */
const PermissionMatrix = ({
  mode = "group",                 // "group" | "user"
  selectedPermissions = [],       // permissões ativas (grupo) ou herdadas (user)
  overrides = { allow: [], deny: [] }, // somente mode="user"
  onChange,                       // somente mode="group"
  onOverrideChange,               // somente mode="user"
  readOnly = false,
}) => {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (key) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  const filteredModules = useMemo(() => {
    if (!search.trim()) return PERMISSION_MODULES;
    const q = search.toLowerCase();
    const result = {};
    Object.entries(PERMISSION_MODULES).forEach(([key, module]) => {
      const matchedPerms = Object.entries(module.permissions).filter(
        ([id, label]) =>
          label.toLowerCase().includes(q) || id.toLowerCase().includes(q)
      );
      if (matchedPerms.length > 0 || module.label.toLowerCase().includes(q)) {
        result[key] = {
          ...module,
          permissions: matchedPerms.length
            ? Object.fromEntries(matchedPerms)
            : module.permissions,
        };
      }
    });
    return result;
  }, [search]);

  // ── Lógica mode="group" ────────────────────────────────────────────────────
  const handleGroupToggle = (permId) => {
    if (readOnly) return;
    const next = selectedPermissions.includes(permId)
      ? selectedPermissions.filter((p) => p !== permId)
      : [...selectedPermissions, permId];
    onChange?.(next);
  };

  const handleGroupToggleModule = (modulePermIds) => {
    if (readOnly) return;
    const allSelected = modulePermIds.every((p) => selectedPermissions.includes(p));
    let next;
    if (allSelected) {
      next = selectedPermissions.filter((p) => !modulePermIds.includes(p));
    } else {
      const toAdd = modulePermIds.filter((p) => !selectedPermissions.includes(p));
      next = [...selectedPermissions, ...toAdd];
    }
    onChange?.(next);
  };

  // ── Lógica mode="user" ────────────────────────────────────────────────────
  const getEffectiveState = (permId) => {
    if (overrides.deny?.includes(permId)) return "denied";
    if (overrides.allow?.includes(permId)) return "allowed";
    if (selectedPermissions.includes(permId)) return "inherited";
    return "none";
  };

  const handleUserToggle = (permId) => {
    if (readOnly) return;
    const state = getEffectiveState(permId);
    const newAllow = [...(overrides.allow || [])];
    const newDeny = [...(overrides.deny || [])];

    if (state === "inherited") {
      // Herdada → negar override
      newDeny.push(permId);
    } else if (state === "denied") {
      // Negada → remover override (volta ao herdado)
      const idx = newDeny.indexOf(permId);
      if (idx >= 0) newDeny.splice(idx, 1);
    } else if (state === "allowed") {
      // Allow override → remover
      const idx = newAllow.indexOf(permId);
      if (idx >= 0) newAllow.splice(idx, 1);
    } else {
      // Sem permissão → allow override
      newAllow.push(permId);
    }

    onOverrideChange?.({ allow: newAllow, deny: newDeny });
  };

  const getCheckboxState = (permIds) => {
    if (mode === "group") {
      const selected = permIds.filter((p) => selectedPermissions.includes(p)).length;
      if (selected === 0) return "none";
      if (selected === permIds.length) return "all";
      return "partial";
    }
    // mode=user: considera effective
    const active = permIds.filter((p) => {
      const s = getEffectiveState(p);
      return s === "inherited" || s === "allowed";
    }).length;
    if (active === 0) return "none";
    if (active === permIds.length) return "all";
    return "partial";
  };

  return (
    <Box className={classes.root}>
      {/* Busca */}
      <Box className={classes.searchBox}>
        <Search style={{ color: "#aaa", marginRight: 8 }} fontSize="small" />
        <InputBase
          className={classes.searchInput}
          placeholder="Buscar permissão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      {/* Módulos */}
      {Object.entries(filteredModules).map(([moduleKey, module]) => {
        const modulePermIds = Object.keys(module.permissions);
        const checkState = getCheckboxState(modulePermIds);
        const isOpen = !collapsed[moduleKey];
        const activeCount = modulePermIds.filter((p) => {
          if (mode === "group") return selectedPermissions.includes(p);
          const s = getEffectiveState(p);
          return s === "inherited" || s === "allowed";
        }).length;

        return (
          <Box key={moduleKey} className={classes.moduleCard}>
            {/* Header do módulo */}
            <Box
              className={classes.moduleHeader}
              onClick={() => toggleCollapse(moduleKey)}
            >
              {!readOnly && mode === "group" && (
                <Checkbox
                  size="small"
                  checked={checkState === "all"}
                  indeterminate={checkState === "partial"}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGroupToggleModule(modulePermIds);
                  }}
                  style={{ padding: "0 8px 0 0" }}
                  color="primary"
                />
              )}
              <Typography className={classes.moduleLabel}>
                {module.label}
              </Typography>
              <Chip
                size="small"
                label={`${activeCount}/${modulePermIds.length}`}
                className={classes.moduleCount}
                color={activeCount > 0 ? "primary" : "default"}
                variant={activeCount > 0 ? "default" : "outlined"}
              />
              <IconButton size="small">
                {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            </Box>

            {/* Permissões */}
            <Collapse in={isOpen}>
              <Divider />
              {Object.entries(module.permissions).map(([permId, label]) => {
                if (mode === "group") {
                  const checked = selectedPermissions.includes(permId);
                  return (
                    <Box key={permId} className={classes.permRow}>
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() => handleGroupToggle(permId)}
                        disabled={readOnly}
                        color="primary"
                        style={{ padding: "2px 8px 2px 0" }}
                      />
                      <Typography className={classes.permLabel}>{label}</Typography>
                    </Box>
                  );
                }

                // mode=user: 4 estados com badges
                const state = getEffectiveState(permId);
                const isActive = state === "inherited" || state === "allowed";

                return (
                  <Box key={permId} className={classes.permRow}>
                    <Tooltip
                      title={
                        state === "inherited"
                          ? "Herdado do grupo — clique para negar"
                          : state === "allowed"
                          ? "Override: permitido — clique para remover"
                          : state === "denied"
                          ? "Override: negado — clique para remover"
                          : "Não concedido — clique para permitir"
                      }
                    >
                      <Checkbox
                        size="small"
                        checked={isActive}
                        indeterminate={state === "denied"}
                        onChange={() => handleUserToggle(permId)}
                        disabled={readOnly}
                        color="primary"
                        style={{ padding: "2px 8px 2px 0" }}
                      />
                    </Tooltip>
                    <Typography className={classes.permLabel}>{label}</Typography>
                    {state === "inherited" && (
                      <Chip label="Herdado" size="small" className={classes.chipInherited} />
                    )}
                    {state === "allowed" && (
                      <Chip label="✓ Override" size="small" className={classes.chipAllow} />
                    )}
                    {state === "denied" && (
                      <Chip label="✗ Negado" size="small" className={classes.chipDeny} />
                    )}
                  </Box>
                );
              })}
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
};

export default PermissionMatrix;
