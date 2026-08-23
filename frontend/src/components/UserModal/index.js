import React, { useState, useEffect } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  CircularProgress,
  Select,
  InputLabel,
  MenuItem,
  FormControl,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Visibility, VisibilityOff, Security } from "@mui/icons-material";
import makeStyles from '@mui/styles/makeStyles';

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { Can } from "../Can";
import usePermissions from "../../hooks/usePermissions";
import useAccessCatalog from "../../hooks/useAccessCatalog";
import useWhatsApps from "../../hooks/useWhatsApps";
import UserAccessModal from "../Access/UserAccessModal";

const useStyles = makeStyles((theme) => ({
  root: { display: "flex", flexWrap: "wrap" },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": { marginRight: theme.spacing(1) },
  },
  btnWrapper: { position: "relative" },
  buttonProgress: {
    color: theme.palette.primary.main,
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: { margin: theme.spacing(1), minWidth: 120 },
  // Resumo do cargo na edição: informa e leva para onde se muda, em vez de
  // repetir aqui um seletor que a rota de usuários não aceita mais.
  linhaCargo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    fontSize: 13.5,
  },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").max(50, "Too Long!").required("Required"),
  password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email").required("Required"),
});

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();
  /**
   * O campo "profile" saiu daqui.
   *
   * Ele oferecia admin, atendente, vendedor, produção, instalação e
   * financeiro — e nenhum desses valores era consultado em lugar nenhum do
   * sistema, exceto "admin", que liberava tudo. Escolher "vendedor" dava a
   * impressão de restringir e não restringia nada. Quem responde a essa
   * pergunta agora é o cargo, logo abaixo.
   */
  const initialState = {
    name: "",
    email: "",
    password: "",
    maxSimultaneousTickets: 0,
  };

  const { can } = usePermissions();
  const catalogo = useAccessCatalog();

  const [user, setUser] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappId, setWhatsappId] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [cargos, setCargos] = useState([]);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const { loading, whatsApps } = useWhatsApps();

  const podeAtribuirCargo = can("roles:assign");

  useEffect(() => {
    if (!podeAtribuirCargo) return;
    (async () => {
      try {
        const { data } = await api.get("/access/roles");
        setCargos(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, [podeAtribuirCargo]);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser((prev) => ({ ...prev, ...data }));
        setSelectedQueueIds(data.queues?.map((q) => q.id) ?? []);
        setWhatsappId(data.whatsappId || "");
        setRoleId(data.roleId || "");
      } catch (err) {
        toastError(err);
      }
    };
    fetchUser();
  }, [userId, open]);

  const handleClose = () => {
    onClose();
    setUser(initialState);
  };

  const handleSaveUser = async (values) => {
    const userData = {
      ...values,
      maxSimultaneousTickets: Number(values.maxSimultaneousTickets) || 0,
      whatsappId,
      queueIds: selectedQueueIds,
    };
    try {
      if (userId) {
        // Cargo e permissões não viajam neste pedido: têm rota própria, com
        // permissão própria. Quando iam juntos, quem podia editar um usuário
        // podia se promover a administrador no mesmo salvamento.
        await api.put(`/users/${userId}`, userData);
      } else {
        await api.post("/users", { ...userData, roleId: roleId || null });
      }
      toast.success(i18n.t("userModal.success"));
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  const nomeDoCargo = cargos.find((c) => c.id === roleId)?.name;

  return (
    <div className={classes.root}>
      {userId && accessModalOpen && !catalogo.carregando && (
        <UserAccessModal
          open
          onClose={() => setAccessModalOpen(false)}
          userId={userId}
          userName={user.name}
          catalogo={catalogo}
        />
      )}

      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth scroll="paper">
        <DialogTitle id="form-dialog-title">
          {userId ? i18n.t("userModal.title.edit") : i18n.t("userModal.title.add")}
        </DialogTitle>
        <Formik
          initialValues={user}
          enableReinitialize={true}
          validationSchema={UserSchema}
          onSubmit={(values, actions) => {
            setTimeout(() => {
              handleSaveUser(values);
              actions.setSubmitting(false);
            }, 400);
          }}
        >
          {({ touched, errors, isSubmitting }) => (
            <Form>
              <DialogContent dividers>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.name")}
                    autoFocus
                    name="name"
                    error={touched.name && Boolean(errors.name)}
                    helperText={touched.name && errors.name}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                  <Field
                    as={TextField}
                    name="password"
                    variant="outlined"
                    margin="dense"
                    label={i18n.t("userModal.form.password")}
                    error={touched.password && Boolean(errors.password)}
                    helperText={touched.password && errors.password}
                    type={showPassword ? "text" : "password"}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((e) => !e)}
                            aria-label={
                              showPassword
                                ? i18n.t("userModal.form.hidePassword")
                                : i18n.t("userModal.form.showPassword")
                            }
                            size="large"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                  />
                </div>
                <div className={classes.multFieldLine}>
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.email")}
                    name="email"
                    error={touched.email && Boolean(errors.email)}
                    helperText={touched.email && errors.email}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </div>

                {/*
                  O cargo.

                  No cadastro é um seletor: a pessoa já entra sabendo o que
                  pode fazer. Na edição vira um resumo com botão, porque
                  mudar acesso é uma rota à parte — e é lá que ficam as
                  exceções individuais e a prévia do resultado.
                */}
                {podeAtribuirCargo && !userId && (
                  <FormControl variant="outlined" margin="dense" fullWidth>
                    <InputLabel>Cargo</InputLabel>
                    <Select
                      value={roleId}
                      onChange={(e) => setRoleId(e.target.value)}
                      label="Cargo"
                    >
                      <MenuItem value="">
                        <em>Sem cargo — define depois</em>
                      </MenuItem>
                      {cargos.map((cargo) => (
                        <MenuItem key={cargo.id} value={cargo.id}>
                          {cargo.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {podeAtribuirCargo && userId && (
                  <Box className={classes.linhaCargo}>
                    <span>
                      Cargo: <strong>{nomeDoCargo ?? "sem cargo"}</strong>
                    </span>
                    <Button
                      size="small"
                      startIcon={<Security />}
                      onClick={() => setAccessModalOpen(true)}
                    >
                      Gerenciar acesso
                    </Button>
                  </Box>
                )}
                {/* Filas, conexão e teto de atendimentos são dados de
                    trabalho, não de acesso: pedem "editar usuários". */}
                <Can permission="users:edit">
                  <QueueSelect
                    selectedQueueIds={selectedQueueIds}
                    onChange={(values) => setSelectedQueueIds(values)}
                  />
                </Can>

                <Can permission="users:edit">
                  {!loading && (
                    <FormControl variant="outlined" margin="dense" fullWidth>
                      <InputLabel>{i18n.t("userModal.form.whatsapp")}</InputLabel>
                      <Field
                        as={Select}
                        value={whatsappId}
                        onChange={(e) => setWhatsappId(e.target.value)}
                        label={i18n.t("userModal.form.whatsapp")}
                      >
                        <MenuItem value="">
                          <em>{i18n.t("userModal.form.noWhatsapp")}</em>
                        </MenuItem>
                        {whatsApps.map((whatsapp) => (
                          <MenuItem key={whatsapp.id} value={whatsapp.id}>
                            {whatsapp.name}
                          </MenuItem>
                        ))}
                      </Field>
                    </FormControl>
                  )}
                </Can>

                <Can permission="users:edit">
                  <Field
                    as={TextField}
                    label={i18n.t("userModal.form.maxSimultaneousTickets")}
                    name="maxSimultaneousTickets"
                    type="number"
                    inputProps={{ min: 0 }}
                    helperText={i18n.t(
                      "userModal.form.maxSimultaneousTicketsHelper"
                    )}
                    variant="outlined"
                    margin="dense"
                    fullWidth
                  />
                </Can>
              </DialogContent>

              <DialogActions>
                <Button
                  onClick={handleClose}
                  color="secondary"
                  disabled={isSubmitting}
                  variant="outlined"
                >
                  {i18n.t("userModal.buttons.cancel")}
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  disabled={isSubmitting}
                  variant="contained"
                  className={classes.btnWrapper}
                >
                  {userId
                    ? i18n.t("userModal.buttons.okEdit")
                    : i18n.t("userModal.buttons.okAdd")}
                  {isSubmitting && (
                    <CircularProgress size={24} className={classes.buttonProgress} />
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

export default UserModal;
