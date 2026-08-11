import React, { useCallback, useEffect, useState } from "react";

import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { Checkbox, ListItemText, Tooltip } from "@mui/material";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";

/**
 * Filtro por atendente responsável. Nenhum selecionado = todos.
 *
 * Só faz sentido para quem supervisiona o atendimento, então o painel só
 * renderiza este seletor para quem tem "tickets:viewAll" — e o backend ignora
 * o parâmetro de quem não tem, para o filtro não virar caminho de leitura das
 * conversas alheias.
 */
const TicketsUserSelect = ({ selectedUserIds = [], onChange, style }) => {
  const [users, setUsers] = useState([]);

  const fetchUsers = useCallback(async () => {
    try {
      // A listagem de usuários é paginada de 20 em 20. Um filtro que só
      // enxergasse a primeira página esconderia atendentes sem avisar, então
      // aqui as páginas são percorridas até o fim (com trava de segurança).
      const encontrados = [];
      let pagina = 1;
      let temMais = true;

      while (temMais && pagina <= 10) {
        // eslint-disable-next-line no-await-in-loop
        const { data } = await api.get("/users/", {
          params: { pageNumber: pagina },
        });
        encontrados.push(...(data?.users || []));
        temMais = Boolean(data?.hasMore);
        pagina += 1;
      }

      encontrados.sort((a, b) => a.name.localeCompare(b.name));
      setUsers(encontrados);
    } catch {
      // Sem permissão de ver usuários: o filtro some da tela, como o de
      // etiquetas faz no mesmo caso.
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (users.length === 0) return null;

  const renderValue = () => {
    if (selectedUserIds.length === 0) return i18n.t("ticketsUserSelect.all");
    if (selectedUserIds.length === 1) {
      const found = users.find((u) => u.id === selectedUserIds[0]);
      return found ? found.name : i18n.t("ticketsUserSelect.all");
    }
    return i18n.t("ticketsUserSelect.multiple", {
      count: selectedUserIds.length,
    });
  };

  return (
    <div style={{ width: 150, marginTop: -4, ...style }}>
      <Tooltip title={i18n.t("ticketsUserSelect.tooltip")}>
        <FormControl fullWidth margin="dense">
          <Select
            multiple
            displayEmpty
            variant="outlined"
            value={selectedUserIds}
            onChange={(e) => onChange(e.target.value)}
            MenuProps={{
              anchorOrigin: { vertical: "bottom", horizontal: "left" },
              transformOrigin: { vertical: "top", horizontal: "left" },
              getContentAnchorEl: null,
            }}
            renderValue={renderValue}
          >
            {users.map((user) => (
              <MenuItem dense key={user.id} value={user.id}>
                <Checkbox
                  size="small"
                  color="primary"
                  checked={selectedUserIds.indexOf(user.id) > -1}
                />
                <ListItemText primary={user.name} secondary={user.email} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Tooltip>
    </div>
  );
};

export default TicketsUserSelect;
