import React, { useState, useEffect } from "react";

import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import ThumbDownOffAltOutlinedIcon from "@mui/icons-material/ThumbDownOffAltOutlined";

import api from "../../../services/api";
import { i18n } from "../../../translate/i18n";
import Janela, { SecaoDaJanela } from "../../Janela";

/**
 * Pergunta o motivo quando um card vai parar numa coluna de perda.
 *
 * Vale para qualquer caminho: arrastar direto para a coluna de perda, ou cair
 * nela por transferência de outro quadro -- é o caso de "Encerrado" no
 * Financeiro, configurado para devolver o card a "Perdido" em Vendas. Antes
 * esse segundo caminho não perguntava nada, e a perda entrava muda no
 * relatório.
 *
 * A lista pronta existe porque motivo digitado vira relatório inútil: "caro",
 * "achou caro" e "preço alto" são a mesma coisa contada três vezes. O campo de
 * complemento fica junto, para o que não couber na categoria.
 *
 * O motivo é obrigatório -- o backend recusa a perda sem ele.
 */
const LostReasonModal = ({ open, dealTitle, onClose, onConfirm }) => {
  const [motivo, setMotivo] = useState("");
  const [detalhe, setDetalhe] = useState("");
  const [motivos, setMotivos] = useState([]);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setDetalhe("");
  }, [open]);

  // O catálogo vem do backend, que é quem valida: duas listas divergiriam.
  useEffect(() => {
    let ativo = true;
    api
      .get("/motivos-de-perda")
      .then(({ data }) => ativo && setMotivos(data.motivos || []))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, []);

  // "Outro" sem explicação não diz nada — aí o complemento passa a ser exigido.
  const precisaDetalhe = motivo === "outro";
  const podeConfirmar = motivo && (!precisaDetalhe || detalhe.trim());

  return (
    <Janela
      open={open}
      onClose={onClose}
      icone={<ThumbDownOffAltOutlinedIcon />}
      tom="atencao"
      tamanho="xs"
      titulo={i18n.t("crm.lostModal.title")}
      subtitulo={i18n.t("crm.lostModal.message", { title: dealTitle || "" })}
      rotuloCancelar={i18n.t("crm.buttons.cancel")}
      rotuloConfirmar={i18n.t("crm.lostModal.confirm")}
      onConfirmar={() => onConfirm(motivo, detalhe.trim())}
      confirmarDesabilitado={!podeConfirmar}
    >
      <SecaoDaJanela rotulo="Motivo">
        <TextField
          select
          fullWidth
          autoFocus
          size="small"
          variant="outlined"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="" disabled>
            <em>Selecione…</em>
          </MenuItem>
          {motivos.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>
      </SecaoDaJanela>

      <SecaoDaJanela rotulo={precisaDetalhe ? "Qual motivo?" : "Complemento (opcional)"}>
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          variant="outlined"
          placeholder="O que mais ajuda a entender essa perda"
          value={detalhe}
          onChange={(e) => setDetalhe(e.target.value)}
        />
      </SecaoDaJanela>
    </Janela>
  );
};

export default LostReasonModal;
