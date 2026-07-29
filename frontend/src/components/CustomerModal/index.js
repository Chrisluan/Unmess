import React, { useState, useEffect, useRef } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import MenuItem from "@material-ui/core/MenuItem";
import Dialog from "@material-ui/core/Dialog";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import { i18n } from "../../translate/i18n";

import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  root: {
    display: "flex",
    flexWrap: "wrap",
  },
  textField: {
    marginRight: theme.spacing(1),
    flex: 1,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const CustomerSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, "Too Short!")
    .max(120, "Too Long!")
    .required("Required"),
  email: Yup.string().email("Invalid email"),
  personType: Yup.string().oneOf(["PF", "PJ"]),
  status: Yup.string().oneOf(["lead", "active", "inactive"]),
});

const initialState = {
  name: "",
  tradeName: "",
  personType: "PJ",
  document: "",
  stateRegistration: "",
  email: "",
  phone: "",
  whatsapp: "",
  zipCode: "",
  street: "",
  addressNumber: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  segment: "",
  origin: "",
  status: "lead",
  notes: "",
};

const CustomerModal = ({ open, onClose, customerId, onSave }) => {
  const classes = useStyles();
  const isMounted = useRef(true);

  const [customer, setCustomer] = useState(initialState);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!customerId) {
        setCustomer(initialState);
        return;
      }

      try {
        const { data } = await api.get(`/customers/${customerId}`);
        if (isMounted.current) {
          setCustomer((prevState) => ({ ...prevState, ...data }));
        }
      } catch (err) {
        toastError(err);
      }
    };

    fetchCustomer();
  }, [customerId, open]);

  const handleClose = () => {
    onClose();
    setCustomer(initialState);
  };

  const handleSaveCustomer = async (values) => {
    try {
      if (customerId) {
        await api.put(`/customers/${customerId}`, values);
        handleClose();
      } else {
        const { data } = await api.post("/customers", values);
        if (onSave) {
          onSave(data);
        }
        handleClose();
      }
      toast.success(i18n.t("customerModal.success"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className={classes.root}>
      <Dialog open={open} onClose={handleClose} maxWidth="md" scroll="paper">
        <DialogTitle id="form-dialog-title">
          {customerId
            ? `${i18n.t("customerModal.title.edit")}`
            : `${i18n.t("customerModal.title.add")}`}
        </DialogTitle>
        <Formik
          initialValues={customer}
          enableReinitialize={true}
          validationSchema={CustomerSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveCustomer(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <Typography variant="subtitle1" gutterBottom>
                  {i18n.t("customerModal.form.mainInfo")}
                </Typography>
                <div>
                  <Field
                    as={TextField}
                    select
                    label={i18n.t("customerModal.form.personType")}
                    name="personType"
                    variant="outlined"
                    margin="dense"
                    style={{ minWidth: 140, marginRight: 8 }}
                  >
                    <MenuItem value="PJ">
                      {i18n.t("customerModal.form.personTypePJ")}
                    </MenuItem>
                    <MenuItem value="PF">
                      {i18n.t("customerModal.form.personTypePF")}
                    </MenuItem>
                  </Field>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.document")}
                    name="document"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.stateRegistration")}
                    name="stateRegistration"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.name")}
                    name="name"
                    autoFocus
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.tradeName")}
                    name="tradeName"
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.phone")}
                    name="phone"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.whatsapp")}
                    name="whatsapp"
                    placeholder="5513912344321"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                </div>

                <Typography
                  style={{ marginBottom: 8, marginTop: 16 }}
                  variant="subtitle1"
                >
                  {i18n.t("customerModal.form.addressInfo")}
                </Typography>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.zipCode")}
                    name="zipCode"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.street")}
                    name="street"
                    variant="outlined"
                    margin="dense"
                    style={{ flex: 2 }}
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.addressNumber")}
                    name="addressNumber"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.complement")}
                    name="complement"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.neighborhood")}
                    name="neighborhood"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.city")}
                    name="city"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.state")}
                    name="state"
                    variant="outlined"
                    margin="dense"
                    style={{ minWidth: 80 }}
                  />
                </div>

                <Typography
                  style={{ marginBottom: 8, marginTop: 16 }}
                  variant="subtitle1"
                >
                  {i18n.t("customerModal.form.crmInfo")}
                </Typography>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.segment")}
                    name="segment"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.origin")}
                    name="origin"
                    variant="outlined"
                    margin="dense"
                    className={classes.textField}
                  />
                  <Field
                    as={TextField}
                    select
                    label={i18n.t("customerModal.form.status")}
                    name="status"
                    variant="outlined"
                    margin="dense"
                    style={{ minWidth: 140 }}
                  >
                    <MenuItem value="lead">
                      {i18n.t("customers.status.lead")}
                    </MenuItem>
                    <MenuItem value="active">
                      {i18n.t("customers.status.active")}
                    </MenuItem>
                    <MenuItem value="inactive">
                      {i18n.t("customers.status.inactive")}
                    </MenuItem>
                  </Field>
                </div>
                <div>
                  <Field
                    as={TextField}
                    label={i18n.t("customerModal.form.notes")}
                    name="notes"
                    multiline
                    rows={3}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("customerModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {customerId
                    ? `${i18n.t("customerModal.buttons.okEdit")}`
                    : `${i18n.t("customerModal.buttons.okAdd")}`}
                  {isSubmitting && (
                    <CircularProgress
                      size={24}
                      className={classes.buttonProgress}
                    />
                  )}
                </Button>
              </DialogActions>
            </Form>
          )}
        </Formik>
      </Dialog>
    </div>
  );
};

export default CustomerModal;
