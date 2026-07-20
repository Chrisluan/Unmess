import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Typography,
  Divider,
  makeStyles,
} from "@material-ui/core";
import { green } from "@material-ui/core/colors";

import PermissionMatrix from "../PermissionMatrix";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  btnWrapper: { position: "relative" },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  sectionTitle: {
    fontWeight: 600,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
    color: theme.palette.text.secondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
}));

const Schema = Yup.object().shape({
  name: Yup.string().min(2, "Muito curto").max(100, "Muito longo").required("Obrigatório"),
});

const PermissionGroupModal = ({ open, onClose, permissionGroupId }) => {
  const classes = useStyles();

  const [group, setGroup] = useState({ name: "" });
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    if (!permissionGroupId) return;

    (async () => {
      try {
        const { data } = await api.get(`/permission-groups/${permissionGroupId}`);
        setGroup({ name: data.name });
        setSelectedPermissions(JSON.parse(data.permissions || "[]"));
      } catch (err) {
        toastError(err);
      }
    })();

    return () => {
      setGroup({ name: "" });
      setSelectedPermissions([]);
    };
  }, [permissionGroupId, open]);

  const handleClose = () => {
    onClose();
    setGroup({ name: "" });
    setSelectedPermissions([]);
  };

  const handleSave = async (values) => {
    try {
      const payload = { ...values, permissions: selectedPermissions };
      if (permissionGroupId) {
        await api.put(`/permission-groups/${permissionGroupId}`, payload);
      } else {
        await api.post("/permission-groups", payload);
      }
      toast.success("Grupo salvo com sucesso");
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>
        {permissionGroupId ? "Editar Grupo de Permissão" : "Novo Grupo de Permissão"}
      </DialogTitle>

      <Formik
        initialValues={group}
        enableReinitialize
        validationSchema={Schema}
        onSubmit={(values, actions) => {
          setTimeout(() => {
            handleSave(values);
            actions.setSubmitting(false);
          }, 300);
        }}
      >
        {({ touched, errors, isSubmitting }) => (
          <Form>
            <DialogContent dividers>
              <Field
                as={TextField}
                label="Nome do grupo"
                autoFocus
                name="name"
                error={touched.name && Boolean(errors.name)}
                helperText={touched.name && errors.name}
                variant="outlined"
                margin="dense"
                fullWidth
              />

              <Typography className={classes.sectionTitle}>
                Permissões do grupo
              </Typography>
              <Divider style={{ marginBottom: 12 }} />

              <PermissionMatrix
                mode="group"
                selectedPermissions={selectedPermissions}
                onChange={setSelectedPermissions}
              />
            </DialogContent>

            <DialogActions>
              <Button onClick={handleClose} color="secondary" variant="outlined" disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                color="primary"
                variant="contained"
                disabled={isSubmitting}
                className={classes.btnWrapper}
              >
                {permissionGroupId ? "Salvar" : "Criar"}
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

export default PermissionGroupModal;
