import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete from "@mui/material/Autocomplete";
import CircularProgress from "@mui/material/CircularProgress";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  linha: {
    display: "flex",
    gap: theme.spacing(1),
  },
  campo: {
    flex: 1,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: theme.palette.primary.main,
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const DealSchema = Yup.object().shape({
  title: Yup.string()
    .min(2, i18n.t("crm.dealModal.validation.titleShort"))
    .max(120, i18n.t("crm.dealModal.validation.titleLong"))
    .required(i18n.t("crm.dealModal.validation.titleRequired")),
  value: Yup.number()
    .min(0, i18n.t("crm.dealModal.validation.valueNegative"))
    .typeError(i18n.t("crm.dealModal.validation.valueInvalid")),
});

const initialState = {
  title: "",
  value: "",
  expectedCloseAt: "",
  notes: "",
  stageId: "",
  responsibleUserId: "",
};

/**
 * Só a parte da data interessa: a previsão de fechamento é um dia, não um
 * horário, e o input type="date" espera YYYY-MM-DD.
 */
const paraInputDate = (valor) => (valor ? String(valor).slice(0, 10) : "");

const DealModal = ({ open, onClose, dealId, stageId, boardId, stages, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [deal, setDeal] = useState(initialState);
  const [customers, setCustomers] = useState([]);
  const [customerSelecionado, setCustomerSelecionado] = useState(null);
  const [users, setUsers] = useState([]);
  const [buscaCliente, setBuscaCliente] = useState("");

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/users", { params: { pageNumber: 1 } });
        if (isMounted.current) setUsers(data.users || []);
      } catch (err) {
        // Sem permissão de usuários o campo de responsável fica vazio; não é
        // motivo para bloquear a criação do negócio.
      }
    };

    fetchUsers();
  }, [open]);

  // Busca de clientes com debounce, alimentando o autocomplete.
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/customers", {
          params: { searchParam: buscaCliente, pageNumber: 1 },
        });
        if (isMounted.current) setCustomers(data.customers || []);
      } catch (err) {
        toastError(err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [buscaCliente, open]);

  useEffect(() => {
    if (!open) return;

    const fetchDeal = async () => {
      if (!dealId) {
        setDeal({ ...initialState, stageId: stageId || "" });
        setCustomerSelecionado(null);
        return;
      }

      try {
        const { data } = await api.get(`/deals/${dealId}`);
        if (!isMounted.current) return;

        setDeal({
          title: data.title || "",
          value: data.value ?? "",
          expectedCloseAt: paraInputDate(data.expectedCloseAt),
          notes: data.notes || "",
          stageId: data.stageId || "",
          responsibleUserId: data.responsibleUserId || "",
        });
        setCustomerSelecionado(data.customer || null);
      } catch (err) {
        toastError(err);
      }
    };

    fetchDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId, stageId, open]);

  const handleClose = () => {
    onClose();
    setDeal(initialState);
    setCustomerSelecionado(null);
    setBuscaCliente("");
  };

  const handleSave = async (values) => {
    const payload = {
      ...values,
      value: values.value === "" ? 0 : Number(values.value),
      // Campos vazios viram null para o backend não gravar string vazia em
      // coluna de data ou de chave estrangeira.
      expectedCloseAt: values.expectedCloseAt || null,
      responsibleUserId: values.responsibleUserId || null,
      stageId: values.stageId || null,
      // Sem coluna escolhida o backend usa a porta de entrada deste quadro.
      boardId: boardId || null,
      customerId: customerSelecionado?.id || null,
      // O contato do WhatsApp vem junto do cliente, quando houver, para o
      // negócio já nascer ligado à conversa.
      contactId: customerSelecionado?.contactId || null,
    };

    try {
      const { data } = dealId
        ? await api.put(`/deals/${dealId}`, payload)
        : await api.post("/deals", payload);

      toast.success(
        dealId
          ? i18n.t("crm.toasts.dealUpdated")
          : i18n.t("crm.toasts.dealCreated")
      );

      if (onSave) onSave(data);
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        {dealId
          ? i18n.t("crm.dealModal.title.edit")
          : i18n.t("crm.dealModal.title.add")}
      </DialogTitle>
      <Formik
        initialValues={deal}
        enableReinitialize
        validationSchema={DealSchema}
        onSubmit={(values, actions) => {
          handleSave(values).finally(() => actions.setSubmitting(false));
        }}
      >
        {({ touched, errors, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label={i18n.t("crm.dealModal.form.title")}
                name="title"
                autoFocus
                error={touched.title && Boolean(errors.title)}
                helperText={touched.title && errors.title}
                variant="outlined"
                margin="dense"
                fullWidth
              />

              <Autocomplete
                options={customers}
                value={customerSelecionado}
                getOptionLabel={(opcao) => opcao.tradeName || opcao.name || ""}
                isOptionEqualToValue={(opcao, valor) => opcao.id === valor.id}
                onChange={(_, valor) => setCustomerSelecionado(valor)}
                onInputChange={(_, valor) => setBuscaCliente(valor)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={i18n.t("crm.dealModal.form.customer")}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                )}
              />

              <div className={classes.linha}>
                <Field
                  as={TextField}
                  label={i18n.t("crm.dealModal.form.value")}
                  name="value"
                  type="number"
                  inputProps={{ step: "0.01", min: 0 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">R$</InputAdornment>
                    ),
                  }}
                  error={touched.value && Boolean(errors.value)}
                  helperText={touched.value && errors.value}
                  variant="outlined"
                  margin="dense"
                  className={classes.campo}
                />

                <Field
                  as={TextField}
                  label={i18n.t("crm.dealModal.form.expectedCloseAt")}
                  name="expectedCloseAt"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  variant="outlined"
                  margin="dense"
                  className={classes.campo}
                />
              </div>

              <div className={classes.linha}>
                <Field
                  as={TextField}
                  select
                  label={i18n.t("crm.dealModal.form.stage")}
                  name="stageId"
                  variant="outlined"
                  margin="dense"
                  className={classes.campo}
                >
                  {/* Colunas finais ficam de fora: criar um card já na saída
                      concluiria o quadro sem que nada tivesse sido feito. */}
                  {(stages || [])
                    .filter((stage) => !stage.isFinal)
                    .map((stage) => (
                      <MenuItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </MenuItem>
                    ))}
                </Field>

                <Field
                  as={TextField}
                  select
                  label={i18n.t("crm.dealModal.form.responsible")}
                  name="responsibleUserId"
                  variant="outlined"
                  margin="dense"
                  className={classes.campo}
                >
                  <MenuItem value="">
                    {i18n.t("crm.dealModal.form.noResponsible")}
                  </MenuItem>
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name}
                    </MenuItem>
                  ))}
                </Field>
              </div>

              <Field
                as={TextField}
                label={i18n.t("crm.dealModal.form.notes")}
                name="notes"
                multiline
                rows={3}
                variant="outlined"
                margin="dense"
                fullWidth
              />
            </DialogContent>

            <DialogActions>
              <Button
                onClick={handleClose}
                color="secondary"
                disabled={isSubmitting}
                variant="outlined"
              >
                {i18n.t("crm.buttons.cancel")}
              </Button>
              <Button
                type="submit"
                color="primary"
                disabled={isSubmitting}
                variant="contained"
                className={classes.btnWrapper}
              >
                {dealId
                  ? i18n.t("crm.buttons.save")
                  : i18n.t("crm.buttons.create")}
                {isSubmitting && (
                  <CircularProgress size={24} className={classes.buttonProgress} />
                )}
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
};

export default DealModal;
