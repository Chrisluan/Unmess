import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import makeStyles from "@mui/styles/makeStyles";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadIcon from "@mui/icons-material/CloudUpload";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { useBranding, APP_NAME } from "../../context/Branding";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

const TAMANHO_MAX = 2 * 1024 * 1024; // 2 MB
const TIPOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const useStyles = makeStyles(theme => ({
  paper: {
    padding: theme.spacing(3),
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2.5),
    maxWidth: 560
  },
  previewBox: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2)
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    objectFit: "contain",
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.default
  },
  semLogo: {
    width: 64,
    height: 64,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "1.6rem",
    fontWeight: 700,
    backgroundColor: theme.palette.primary.main
  },
  acoes: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  },
  dica: {
    color: theme.palette.text.secondary
  }
}));

/**
 * Identidade visual da empresa: nome e logo exibidos na barra lateral e no
 * topo. Fica salvo no banco, então vale para todos os atendentes.
 */
const BrandingTab = () => {
  const classes = useStyles();
  const { name, logo, refresh } = useBranding();
  const inputRef = useRef(null);

  const [nome, setNome] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [previewLocal, setPreviewLocal] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // O contexto devolve o nome do produto quando a empresa não tem nome
    // próprio; no campo isso apareceria como se já estivesse configurado.
    setNome(name === APP_NAME ? "" : name);
  }, [name]);

  // A prévia local é um object URL: precisa ser liberado para não vazar.
  useEffect(() => {
    if (!arquivo) {
      setPreviewLocal(null);
      return undefined;
    }
    const url = URL.createObjectURL(arquivo);
    setPreviewLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  const handleEscolher = e => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (!TIPOS.includes(f.type)) {
      toast.error(i18n.t("settings.branding.invalidType"));
      return;
    }
    if (f.size > TAMANHO_MAX) {
      toast.error(i18n.t("settings.branding.tooLarge"));
      return;
    }
    setArquivo(f);
  };

  const enviar = async (extra = {}) => {
    setSalvando(true);
    try {
      const form = new FormData();
      if (nome.trim()) form.append("name", nome.trim());
      if (arquivo) form.append("logo", arquivo);
      Object.entries(extra).forEach(([k, v]) => form.append(k, v));

      await api.put("/company/branding", form);
      await refresh();

      setArquivo(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(i18n.t("settings.branding.saved"));
    } catch (err) {
      toastError(err);
    } finally {
      setSalvando(false);
    }
  };

  const exibida = previewLocal || logo;

  return (
    <Paper className={classes.paper} variant="outlined">
      <div>
        <Typography variant="subtitle1">
          {i18n.t("settings.branding.title")}
        </Typography>
        <Typography variant="body2" className={classes.dica}>
          {i18n.t("settings.branding.description")}
        </Typography>
      </div>

      <TextField
        label={i18n.t("settings.branding.nameLabel")}
        placeholder={APP_NAME}
        value={nome}
        onChange={e => setNome(e.target.value)}
        variant="outlined"
        size="small"
        fullWidth
        helperText={i18n.t("settings.branding.nameHelp")}
      />

      <Box className={classes.previewBox}>
        {exibida ? (
          <img src={exibida} alt={nome || APP_NAME} className={classes.preview} />
        ) : (
          <div className={classes.semLogo}>
            {(nome || APP_NAME).charAt(0).toUpperCase()}
          </div>
        )}

        <div className={classes.acoes}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<UploadIcon />}
            onClick={() => inputRef.current?.click()}
          >
            {i18n.t("settings.branding.choose")}
          </Button>
          {logo && !arquivo && (
            <Button
              variant="outlined"
              size="small"
              color="secondary"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => enviar({ removeLogo: "true" })}
              disabled={salvando}
            >
              {i18n.t("settings.branding.remove")}
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={TIPOS.join(",")}
          hidden
          onChange={handleEscolher}
        />
      </Box>

      <Typography variant="caption" className={classes.dica}>
        {i18n.t("settings.branding.fileHelp")}
      </Typography>

      <Box>
        <ButtonWithSpinner
          variant="contained"
          color="primary"
          loading={salvando}
          onClick={() => enviar()}
        >
          {i18n.t("settings.branding.save")}
        </ButtonWithSpinner>
      </Box>
    </Paper>
  );
};

export default BrandingTab;
