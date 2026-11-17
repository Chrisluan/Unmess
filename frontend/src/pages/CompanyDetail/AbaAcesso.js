import React, { useState } from "react";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

const useStyles = makeStyles((theme) => ({
  tituloSecao: {
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(1),
  },

  situacaoAtual: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },

  linhaAcoes: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(2),
  },

  apoio: {
    color: theme.palette.text.secondary,
    display: "block",
    marginTop: 4,
    maxWidth: 620,
  },
}));

const MOTIVOS = [
  "Fatura em atraso",
  "Contrato encerrado",
  "Solicitação do cliente",
  "Uso indevido",
];

const dataHora = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

/**
 * Corta e devolve o acesso da empresa inteira.
 *
 * Até agora o campo `status` existia e ninguém o consultava: dava para marcar
 * "Suspensa" e todos continuavam entrando. Agora o login e a renovação de
 * token verificam, então este botão desliga a empresa de verdade — e por isso
 * passa por confirmação, pede motivo e diz quantas sessões vai derrubar.
 *
 * O motivo não é burocracia: ele aparece na tela de login de quem foi
 * bloqueado. Sem ele, a pessoa só vê "acesso suspenso" e liga para o suporte
 * para descobrir o que já poderia estar escrito ali.
 */
const AbaAcesso = ({ company, onSalvo }) => {
  const classes = useStyles();

  const bloqueada = company.status !== "active";
  const [dialogo, setDialogo] = useState(null);
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [encerrarSessoes, setEncerrarSessoes] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const aplicar = async (status) => {
    setEnviando(true);
    try {
      await api.put(`/companies/${company.id}/access`, {
        status,
        reason: status === "active" ? undefined : motivo,
        encerrarSessoes,
      });
      toast.success(
        status === "active"
          ? "Acesso liberado."
          : "Acesso suspenso. Quem estava logado cai na próxima renovação."
      );
      setDialogo(null);
      onSalvo?.();
    } catch (err) {
      toastError(err);
    } finally {
      setEnviando(false);
    }
  };

  const abrirBloqueio = (status) => {
    setMotivo(MOTIVOS[0]);
    setEncerrarSessoes(true);
    setDialogo(status);
  };

  return (
    <>
      <Typography component="h2" className={classes.tituloSecao}>
        Situação do acesso
      </Typography>
      <Divider />

      <div className={classes.situacaoAtual}>
        {bloqueada ? (
          <Alert severity="error" icon={<LockOutlinedIcon />}>
            <strong>
              {company.status === "canceled" ? "Cancelada" : "Suspensa"}
            </strong>
            {company.statusReason ? ` — ${company.statusReason}` : ""}
            {dataHora(company.statusChangedAt)
              ? ` · desde ${dataHora(company.statusChangedAt)}`
              : ""}
            <Typography variant="caption" display="block">
              Ninguém desta empresa consegue entrar. O super continua podendo
              acessá-la pelo botão “Entrar na empresa”.
            </Typography>
          </Alert>
        ) : (
          <Alert severity="success" icon={<LockOpenOutlinedIcon />}>
            <strong>Ativa</strong> — os usuários desta empresa entram
            normalmente.
            {dataHora(company.statusChangedAt)
              ? ` Última mudança em ${dataHora(company.statusChangedAt)}.`
              : ""}
          </Alert>
        )}
      </div>

      <div className={classes.linhaAcoes}>
        {bloqueada ? (
          <ButtonWithSpinner
            variant="contained"
            color="primary"
            startIcon={<LockOpenOutlinedIcon />}
            loading={enviando}
            onClick={() => aplicar("active")}
          >
            Liberar acesso
          </ButtonWithSpinner>
        ) : (
          <>
            <Button
              variant="contained"
              color="error"
              startIcon={<LockOutlinedIcon />}
              onClick={() => abrirBloqueio("suspended")}
            >
              Suspender acesso
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => abrirBloqueio("canceled")}
            >
              Cancelar contrato
            </Button>
          </>
        )}
      </div>

      <Typography variant="caption" className={classes.apoio}>
        Suspender é temporário e costuma ser por falta de pagamento; cancelar
        marca o fim do contrato. Os dois impedem o acesso da mesma forma — a
        diferença é o que fica registrado. Nenhum dos dois apaga dado nenhum.
      </Typography>

      <Dialog
        open={Boolean(dialogo)}
        onClose={() => setDialogo(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialogo === "canceled" ? "Cancelar contrato" : "Suspender acesso"} —{" "}
          {company.name}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" gutterBottom>
            Todos os usuários desta empresa deixam de conseguir entrar. As
            conversas, os contatos e o histórico continuam intactos.
          </Typography>

          <TextField
            select
            fullWidth
            size="small"
            variant="outlined"
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            style={{ marginTop: 12 }}
            helperText="Aparece na tela de login de quem for barrado."
          >
            {MOTIVOS.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>

          <FormControlLabel
            style={{ marginTop: 8 }}
            control={
              <Switch
                color="primary"
                checked={encerrarSessoes}
                onChange={(e) => setEncerrarSessoes(e.target.checked)}
              />
            }
            label="Derrubar quem já está logado"
          />
          <Typography variant="caption" className={classes.apoio}>
            Desligado, quem está com o sistema aberto continua trabalhando até
            a sessão renovar sozinha.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogo(null)}>
            Voltar
          </Button>
          <ButtonWithSpinner
            variant="contained"
            color="error"
            loading={enviando}
            onClick={() => aplicar(dialogo)}
          >
            {dialogo === "canceled" ? "Cancelar contrato" : "Suspender acesso"}
          </ButtonWithSpinner>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AbaAcesso;
