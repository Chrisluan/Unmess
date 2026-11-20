import React, { useContext, useEffect, useState } from "react";

import makeStyles from "@mui/styles/makeStyles";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { AttendanceSettingsContext } from "../../context/Settings/AttendanceSettingsContext";
import Janela, { SecaoDaJanela } from "../Janela";

const useStyles = makeStyles((theme) => {
  const c = theme.palette.unmess;
  return {
    opcoes: { display: "flex", flexWrap: "wrap", gap: 8 },
    opcao: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      padding: "7px 12px",
      borderRadius: 999,
      border: `1px solid ${c.linhaForte}`,
      background: c.superficie,
      color: c.texto,
      font: "inherit",
      fontSize: "0.8125rem",
      fontWeight: 600,
      cursor: "pointer",
      "&:hover": { background: c.superficie2 },
      "&:focus-visible": { outline: "none", boxShadow: c.foco },
    },
    marcada: {
      borderColor: c.primaria,
      background: c.primariaSuave,
      color: c.primariaSuaveTexto,
      "&:hover": { background: c.primariaSuave },
    },
    ponto: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  };
});

/**
 * Pergunta o motivo de encerramento antes de finalizar o chat.
 * Obrigatório ou não conforme Configurações › Geral › "Exigir status ao encerrar".
 *
 * O select escondia as opções atrás de um clique; com poucos motivos (o
 * normal), mostrá-los todos de uma vez é um clique a menos e se lê de relance.
 */
const CloseTicketModal = ({ open, onClose, onConfirm, loading }) => {
  const classes = useStyles();
  const { isEnabled } = useContext(AttendanceSettingsContext);
  const [statuses, setStatuses] = useState([]);
  const [selected, setSelected] = useState("");
  const [fetching, setFetching] = useState(false);

  const required = isEnabled("requireClosingStatus");

  useEffect(() => {
    if (!open) return;
    setSelected("");

    const fetchStatuses = async () => {
      setFetching(true);
      try {
        const { data } = await api.get("/ticket-statuses");
        setStatuses(Array.isArray(data) ? data : data?.ticketStatuses ?? []);
      } catch (err) {
        toastError(err);
      } finally {
        setFetching(false);
      }
    };

    fetchStatuses();
  }, [open]);

  return (
    <Janela
      open={open}
      onClose={onClose}
      icone={<CheckCircleOutlineIcon />}
      tom="sucesso"
      tamanho="xs"
      titulo={i18n.t("closeTicketModal.title")}
      subtitulo={
        required
          ? i18n.t("closeTicketModal.requiredHelper")
          : i18n.t("closeTicketModal.optionalHelper")
      }
      rotuloCancelar={i18n.t("closeTicketModal.buttons.cancel")}
      rotuloConfirmar={i18n.t("closeTicketModal.buttons.confirm")}
      onConfirmar={() => onConfirm(selected || null)}
      confirmarDesabilitado={required && !selected}
      carregando={loading}
    >
      <SecaoDaJanela rotulo={i18n.t("closeTicketModal.status")}>
        {fetching ? (
          <CircularProgress size={22} />
        ) : statuses.length === 0 ? (
          <Typography variant="body2" color={required ? "error" : "text.secondary"}>
            {i18n.t("closeTicketModal.noStatuses")}
          </Typography>
        ) : (
          <div className={classes.opcoes} role="radiogroup">
            {statuses.map((status) => {
              const marcada = selected === status.id;
              return (
                <button
                  key={status.id}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  className={`${classes.opcao} ${marcada ? classes.marcada : ""}`}
                  // Clicar de novo desmarca, quando o motivo é opcional.
                  onClick={() => setSelected(marcada && !required ? "" : status.id)}
                >
                  <span
                    className={classes.ponto}
                    style={{ background: status.color || "#bdc3c7" }}
                  />
                  {status.name}
                </button>
              );
            })}
          </div>
        )}
      </SecaoDaJanela>
    </Janela>
  );
};

export default CloseTicketModal;
