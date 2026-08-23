import React from "react";

import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

/**
 * Campo de busca das telas de listagem.
 *
 * Existia copiado em sete telas, cada uma com uma diferença pequena: numa o
 * ícone era `color: "gray"` fixo (invisível no modo escuro), noutra o
 * placeholder vinha da chave de i18n de outro módulo, e nenhuma tinha rótulo
 * acessível nem forma de limpar a busca sem apagar caractere por caractere.
 *
 * O botão de limpar só aparece com texto digitado: um "x" permanente num
 * campo vazio é ruído, e some justamente quando não faz nada.
 */
const SearchField = ({
  value,
  onChange,
  onClear,
  placeholder = "Pesquisar...",
  ...rest
}) => (
  <TextField
    size="small"
    variant="outlined"
    type="search"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    inputProps={{ "aria-label": placeholder }}
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon fontSize="small" color="disabled" />
        </InputAdornment>
      ),
      endAdornment: value ? (
        <InputAdornment position="end">
          <IconButton
            size="small"
            aria-label="Limpar busca"
            onClick={() =>
              onClear ? onClear() : onChange({ target: { value: "" } })
            }
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </InputAdornment>
      ) : null,
    }}
    {...rest}
  />
);

export default SearchField;
