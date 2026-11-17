import React from "react";

import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";

import EmptyState from "./index";

/**
 * Estado vazio dentro de uma tabela.
 *
 * O `colSpan` faz a mensagem ocupar a largura inteira em vez de ficar
 * espremida na primeira coluna, e a borda some para o bloco não parecer mais
 * uma linha de dado.
 */
const TableEmpty = ({ colSpan, ...rest }) => (
  <TableRow>
    <TableCell colSpan={colSpan} style={{ borderBottom: "none" }}>
      <EmptyState {...rest} />
    </TableCell>
  </TableRow>
);

export default TableEmpty;
