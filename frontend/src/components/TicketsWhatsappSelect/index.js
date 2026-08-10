import React, { useContext } from "react";

import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { Checkbox, ListItemText, Tooltip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";

import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { i18n } from "../../translate/i18n";

/**
 * Filtro de conexão (número de WhatsApp) do painel de atendimento.
 * Nenhum selecionado = todas as conexões.
 */
const TicketsWhatsappSelect = ({
  selectedWhatsappIds = [],
  onChange,
  style,
}) => {
  const { whatsApps } = useContext(WhatsAppsContext);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const renderValue = () => {
    if (!selectedWhatsappIds || selectedWhatsappIds.length === 0) {
      return i18n.t("ticketsWhatsappSelect.allConnections");
    }
    if (selectedWhatsappIds.length === 1) {
      const found = whatsApps?.find((w) => w.id === selectedWhatsappIds[0]);
      return found ? found.name : i18n.t("ticketsWhatsappSelect.placeholder");
    }
    return i18n.t("ticketsWhatsappSelect.multiple", {
      count: selectedWhatsappIds.length,
    });
  };

  return (
    <div style={{ width: 150, marginTop: -4, ...style }}>
      <Tooltip title={i18n.t("ticketsWhatsappSelect.tooltip")}>
        <FormControl fullWidth margin="dense">
          <Select
            multiple
            displayEmpty
            variant="outlined"
            value={selectedWhatsappIds}
            onChange={handleChange}
            MenuProps={{
              anchorOrigin: { vertical: "bottom", horizontal: "left" },
              transformOrigin: { vertical: "top", horizontal: "left" },
              getContentAnchorEl: null,
            }}
            renderValue={renderValue}
          >
            {whatsApps?.length > 0 &&
              whatsApps.map((whatsApp) => (
                <MenuItem dense key={whatsApp.id} value={whatsApp.id}>
                  <Checkbox
                    size="small"
                    color="primary"
                    checked={selectedWhatsappIds.indexOf(whatsApp.id) > -1}
                  />
                  <FiberManualRecordIcon
                    fontSize="small"
                    style={{
                      marginRight: 6,
                      color:
                        whatsApp.status === "CONNECTED" ? "#2ecc71" : "#e74c3c",
                    }}
                  />
                  <ListItemText
                    primary={whatsApp.name}
                    secondary={
                      whatsApp.status === "CONNECTED"
                        ? null
                        : i18n.t("ticketsWhatsappSelect.disconnected")
                    }
                  />
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Tooltip>
    </div>
  );
};

export default TicketsWhatsappSelect;
