import React, { useCallback, useEffect, useState } from "react";

import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { Checkbox, ListItemText, Tooltip } from "@mui/material";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Filtro de etiquetas do painel. Nenhuma selecionada = todas as conversas.
 */
const TicketsTagSelect = ({ selectedTagIds = [], onChange, style }) => {
  const [tags, setTags] = useState([]);

  const fetchTags = useCallback(async () => {
    try {
      const { data } = await api.get("/tags");
      setTags(data || []);
    } catch {
      // Atendente sem permissão de etiquetas: o filtro some da tela.
      setTags([]);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  if (tags.length === 0) return null;

  const renderValue = () => {
    if (selectedTagIds.length === 0) return i18n.t("ticketsTagSelect.all");
    if (selectedTagIds.length === 1) {
      const found = tags.find((t) => t.id === selectedTagIds[0]);
      return found ? found.name : i18n.t("ticketsTagSelect.all");
    }
    return i18n.t("ticketsTagSelect.multiple", {
      count: selectedTagIds.length,
    });
  };

  return (
    <div style={{ width: 130, marginTop: -4, ...style }}>
      <Tooltip title={i18n.t("ticketsTagSelect.tooltip")}>
        <FormControl fullWidth margin="dense">
          <Select
            multiple
            displayEmpty
            variant="outlined"
            value={selectedTagIds}
            onChange={(e) => onChange(e.target.value)}
            MenuProps={{
              anchorOrigin: { vertical: "bottom", horizontal: "left" },
              transformOrigin: { vertical: "top", horizontal: "left" },
              getContentAnchorEl: null,
            }}
            renderValue={renderValue}
          >
            {tags.map((tag) => (
              <MenuItem dense key={tag.id} value={tag.id}>
                <Checkbox
                  size="small"
                  style={{ color: tag.color }}
                  checked={selectedTagIds.indexOf(tag.id) > -1}
                />
                <ListItemText primary={tag.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Tooltip>
    </div>
  );
};

export default TicketsTagSelect;
