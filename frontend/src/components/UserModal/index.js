import React, { useState, useEffect, useContext } from "react";

import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
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
import { green } from "@mui/material/colors";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";
import useWhatsApps from "../../hooks/useWhatsApps";
import UserPermissionsModal from "../UserPermissionsModal";

const useStyles = makeStyles((theme) => ({
  root: { display: "flex", flexWrap: "wrap" },
  multFieldLine: {
    display: "flex",
    "& > *:not(:last-child)": { marginRight: theme.spacing(1) },
  },
  btnWrapper: { position: "relative" },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  formControl: { margin: theme.spacing(1), minWidth: 120 },
}));

const UserSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").max(50, "Too Long!").required("Required"),
  password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
  email: Yup.string().email("Invalid email").required("Required"),
});

const UserModal = ({ open, onClose, userId }) => {
  const classes = useStyles();
  const initialState = {
    name: "",
    email: "",
    password: "",
    profile: "user",
    maxSimultaneousTickets: 0,
  };

  const { user: loggedInUser } = useContext(AuthContext);

  const [user, setUser] = useState(initialState);
  const [selectedQueueIds, setSelectedQueueIds] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [whatsappId, setWhatsappId] = useState(false);
  const [permissionGroupId, setPermissionGroupId] = useState("");
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const { loading, whatsApps } = useWhatsApps();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/permission-groups");
        setPermissionGroups(data);
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (!userId) return;
      try {
        const { data } = await api.get(`/users/${userId}`);
        setUser((prev) => ({ ...prev, ...data }));
        setSelectedQueueIds(data.queues?.map((q) => q.id) ?? []);
        setWhatsappId(data.whatsappId || "");
        setPermissionGroupId(data.permissionGroupId || "");
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
      permissionGroupId: permissionGroupId || null,
      queueIds: selectedQueueIds,
    };
    try {
      if (userId) {
        await api.put(`/users/${userId}`, userData);
      } else {
        await api.post("/users", userData);
      }
      toast.success(i18n.t("userModal.success"));
    } catch (err) {
      toastError(err);
    }
    handleClose();
  };

  const selectedGroupName = permissionGroups.find((g) => g.id === permissionGroupId)?.name;

  return (
    <div className={classes.root}>
      {/* Modal de permissões individuais */}
      {userId && (
        <UserPermissionsModal
          open={permissionsModalOpen}
          onClose={() => setPermissionsModalOpen(false)}
          userId={userId}
          userName={user.name}
          groupName={selectedGroupName}
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
                          <IconButton onClick={() => setShowPassword((e) => !e)} size="large">
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
                  <FormControl variant="outlined" className={classes.formControl} margin="dense">
                    <Can
                      role={loggedInUser.profile}
                      perform="user-modal:editProfile"
                      yes={() => (
                        <>
                          <InputLabel id="profile-selection-input-label">
                            {i18n.t("userModal.form.profile")}
                          </InputLabel>
                          <Field
                            as={Select}
                            label={i18n.t("userModal.form.profile")}
                            name="profile"
                            labelId="profile-selection-label"
                            id="profile-selection"
                            required
                          >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="user">User</MenuItem>
                            <MenuItem value="vendedor">{i18n.t("userModal.profiles.vendedor")}</MenuItem>
                            <MenuItem value="producao">{i18n.t("userModal.profiles.producao")}</MenuItem>
                            <MenuItem value="instalacao">{i18n.t("userModal.profiles.instalacao")}</MenuItem>
                            <MenuItem value="financeiro">{i18n.t("userModal.profiles.financeiro")}</MenuItem>
                          </Field>
                        </>
                      )}
                    />
                  </FormControl>
                  <Can
                    role={loggedInUser.profile}
                    perform="user-modal:editProfile"
                    yes={() => (
                      <FormControl variant="outlined" margin="dense" className={classes.formControl}>
                        <InputLabel>{i18n.t("userModal.form.permissionGroup")}</InputLabel>
                        <Select
                          value={permissionGroupId}
                          onChange={(e) => setPermissionGroupId(e.target.value)}
                          label={i18n.t("userModal.form.permissionGroup")}
                        >
                          <MenuItem value="">&nbsp;</MenuItem>
                          {permissionGroups.map((group) => (
                            <MenuItem key={group.id} value={group.id}>
                              {group.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                  />
                </div>
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQueues"
                  yes={() => (
                    <QueueSelect
                      selectedQueueIds={selectedQueueIds}
                      onChange={(values) => setSelectedQueueIds(values)}
                    />
                  )}
                />
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQueues"
                  yes={() =>
                    !loading && (
                      <FormControl variant="outlined" margin="dense" fullWidth>
                        <InputLabel>{i18n.t("userModal.form.whatsapp")}</InputLabel>
                        <Field
                          as={Select}
                          value={whatsappId}
                          onChange={(e) => setWhatsappId(e.target.value)}
                          label={i18n.t("userModal.form.whatsapp")}
                        >
                          <MenuItem value="">&nbsp;</MenuItem>
                          {whatsApps.map((whatsapp) => (
                            <MenuItem key={whatsapp.id} value={whatsapp.id}>
                              {whatsapp.name}
                            </MenuItem>
                          ))}
                        </Field>
                      </FormControl>
                    )
                  }
                />
                <Can
                  role={loggedInUser.profile}
                  perform="user-modal:editQueues"
                  yes={() => (
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
                  )}
                />
              </DialogContent>

              <DialogActions>
                {/* Botão de permissões individuais — apenas em edição */}
                {userId && (
                  <Can
                    role={loggedInUser.profile}
                    perform="user-modal:editProfile"
                    yes={() => (
                      <Tooltip title="Gerenciar permissões individuais deste usuário">
                        <Button
                          onClick={() => setPermissionsModalOpen(true)}
                          color="primary"
                          variant="outlined"
                          startIcon={<Security />}
                          style={{ marginRight: "auto" }}
                        >
                          Permissões
                        </Button>
                      </Tooltip>
                    )}
                  />
                )}

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
