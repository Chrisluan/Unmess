import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import makeStyles from '@mui/styles/makeStyles';

import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Autocomplete, {
	createFilterOptions,
} from '@mui/material/Autocomplete';
import CircularProgress from "@mui/material/CircularProgress";
import ClearIcon from "@mui/icons-material/Clear";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import { useTheme } from "@mui/material/styles";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import ButtonWithSpinner from "../ButtonWithSpinner";
import toastError from "../../errors/toastError";
import useQueues from "../../hooks/useQueues";
import useWhatsApps from "../../hooks/useWhatsApps";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../Can";

const useStyles = makeStyles((theme) => ({
  maxWidth: {
    width: "100%",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 20,
  },
  currentInfo: {
    marginBottom: 4,
  },

  ajuda: {
    marginBottom: theme.spacing(2),
  },

  presenca: {
    width: 8,
    height: 8,
    borderRadius: 0,
    display: "inline-block",
    flexShrink: 0,
  },

  offline: {
    fontSize: "0.75rem",
    color: theme.palette.text.secondary,
  },
}));

const filterOptions = createFilterOptions({
	trim: true,
});

const TransferTicketModal = ({ modalOpen, onClose, ticketid, ticketWhatsappId, currentQueueId, currentUserId }) => {
	const history = useHistory();
	const [options, setOptions] = useState([]);
	const [queues, setQueues] = useState([]);
	const [allQueues, setAllQueues] = useState([]);
	const [loading, setLoading] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [selectedUser, setSelectedUser] = useState(null);
	const [selectedQueue, setSelectedQueue] = useState(currentQueueId || '');
	const [selectedWhatsapp, setSelectedWhatsapp] = useState(ticketWhatsappId);
	const classes = useStyles();
	const theme = useTheme();
	const { findAll: findAllQueues } = useQueues();
	const { loadingWhatsapps, whatsApps } = useWhatsApps();

	const { user: loggedInUser } = useContext(AuthContext);

	useEffect(() => {
		const loadQueues = async () => {
			const list = await findAllQueues();
			setAllQueues(list);
			setQueues(list);
		}
		loadQueues();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		setSelectedQueue(currentQueueId || '');
		setSelectedUser(null);
	}, [currentQueueId, modalOpen]);

	useEffect(() => {
		if (!modalOpen || searchParam.length < 3) {
			setLoading(false);
			return;
		}
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchUsers = async () => {
				try {
					const { data } = await api.get("/users/", {
						params: { searchParam },
					});
					setOptions(data.users);
					setLoading(false);
				} catch (err) {
					setLoading(false);
					toastError(err);
				}
			};

			fetchUsers();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, modalOpen]);

	const handleClose = () => {
		onClose();
		setSearchParam("");
		setSelectedUser(null);
	};

	// Remove só o atendente: o ticket volta a ficar sem dono, mas mantém o
	// setor (ou cai no setor padrão se não tiver nenhum), status "pending".
	const handleRemoveUser = async () => {
		if (!ticketid) return;
		setLoading(true);
		try {
			await api.put(`/tickets/${ticketid}`, {
				removeUser: true,
				status: 'pending',
				isTransfer: true,
			});
			setLoading(false);
			history.push(`/tickets`);
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	// Remove só o setor: se não sobrar setor nenhum, o backend aplica o
	// setor padrão automaticamente (nunca fica órfão).
	const handleRemoveQueue = async () => {
		if (!ticketid) return;
		setLoading(true);
		try {
			await api.put(`/tickets/${ticketid}`, {
				removeQueue: true,
				isTransfer: true,
			});
			setLoading(false);
			history.push(`/tickets`);
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	const handleSaveTicket = async e => {
		e.preventDefault();
		if (!ticketid) return;
		setLoading(true);
		try {
			let data = { isTransfer: true };

			if (selectedUser) {
				data.userId = selectedUser.id;
				data.status = 'open';
			}

			if (selectedQueue) {
				data.queueId = selectedQueue;

				if (!selectedUser) {
					data.status = 'pending';
					data.removeUser = true;
				}
			} else if (currentQueueId) {
				// Select foi esvaziado explicitamente: remove a fila de
				// verdade (o backend aplica o setor padrão se não sobrar
				// nenhuma).
				data.removeQueue = true;
				if (!selectedUser) {
					data.status = 'pending';
					data.removeUser = true;
				}
			}

			if(selectedWhatsapp) {
				data.whatsappId = selectedWhatsapp;
			}

			await api.put(`/tickets/${ticketid}`, data);

			setLoading(false);
			history.push(`/tickets`);
		} catch (err) {
			setLoading(false);
			toastError(err);
		}
	};

	return (
		<Dialog
			open={modalOpen}
			onClose={handleClose}
			maxWidth="sm"
			fullWidth
			scroll="paper"
		>
			<form onSubmit={handleSaveTicket}>
				<DialogTitle id="form-dialog-title">
					{i18n.t("transferTicketModal.title")}
				</DialogTitle>
				<DialogContent dividers>
					{/* O que cada campo faz não era óbvio: dá para transferir só
					    de atendente, só de setor, ou os dois — e o resultado
					    muda conforme o que se preenche. */}
					<Typography variant="body2" color="textSecondary" className={classes.ajuda}>
						{i18n.t("transferTicketModal.helper")}
					</Typography>
					<div className={classes.fieldRow}>
						<Autocomplete
							className={classes.maxWidth}
							getOptionLabel={option => `${option.name}`}
							value={selectedUser}
							onChange={(e, newValue) => {
								setSelectedUser(newValue);
								if (newValue != null && Array.isArray(newValue.queues)) {
									setQueues(newValue.queues);
								} else {
									setQueues(allQueues);
								}
							}}
							options={options}
							filterOptions={filterOptions}
							renderOption={(props, option) => {
								// (props, option) desde o MUI v5 — com um parâmetro só, o
								// indicador de online e o nome saíam indefinidos.
								const { key, ...rest } = props;
								return (
									<li
										key={option.id ?? option.name}
										{...rest}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 8,
										}}
									>
										<span
											className={classes.presenca}
											style={{
												backgroundColor: option.online
													? theme.palette.success.main
													: theme.palette.text.disabled,
											}}
										/>
										{option.name}
										{!option.online && (
											<em className={classes.offline}>
												{i18n.t("users.table.offline")}
											</em>
										)}
									</li>
								);
							}}
							freeSolo
							autoHighlight
							noOptionsText={i18n.t("transferTicketModal.noOptions")}
							loading={loading}
							renderInput={params => (
								<TextField
									{...params}
									label={i18n.t("transferTicketModal.fieldLabel")}
									variant="outlined"
									autoFocus
									onChange={e => setSearchParam(e.target.value)}
									InputProps={{
										...params.InputProps,
										endAdornment: (
											<React.Fragment>
												{loading ? (
													<CircularProgress color="inherit" size={20} />
												) : null}
												{params.InputProps.endAdornment}
											</React.Fragment>
										),
									}}
								/>
							)}
						/>
						{currentUserId && (
							<Tooltip title={i18n.t("transferTicketModal.buttons.removeUser")} arrow>
								<span>
									<IconButton
										size="small"
										aria-label={i18n.t("transferTicketModal.buttons.removeUser")}
										onClick={handleRemoveUser}
										disabled={loading}
									>
										<ClearIcon fontSize="small" />
									</IconButton>
								</span>
							</Tooltip>
						)}
					</div>
					<div className={classes.fieldRow}>
						<FormControl variant="outlined" className={classes.maxWidth}>
							<InputLabel>{i18n.t("transferTicketModal.fieldQueueLabel")}</InputLabel>
							<Select
								value={selectedQueue}
								onChange={(e) => setSelectedQueue(e.target.value)}
								label={i18n.t("transferTicketModal.fieldQueuePlaceholder")}
							>
								<MenuItem value={""}>
									<em>{i18n.t("transferTicketModal.noQueue")}</em>
								</MenuItem>
								{queues.map((queue) => (
									<MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>
								))}
							</Select>
						</FormControl>
						{currentQueueId && (
							<Tooltip title={i18n.t("transferTicketModal.buttons.removeQueue")} arrow>
								<span>
									<IconButton
										size="small"
										aria-label={i18n.t("transferTicketModal.buttons.removeQueue")}
										onClick={handleRemoveQueue}
										disabled={loading}
									>
										<ClearIcon fontSize="small" />
									</IconButton>
								</span>
							</Tooltip>
						)}
					</div>
					<Typography variant="caption" color="textSecondary" className={classes.currentInfo}>
						{i18n.t("transferTicketModal.removeQueueHelp")}
					</Typography>
					{/* Trocar a conversa de número é decisão de quem cuida das
					    conexões, não de quem atende: o cliente passa a receber
					    mensagem de outro WhatsApp da empresa. */}
					<Can permission="connections:view">
						{!loadingWhatsapps && (
							<FormControl variant="outlined" className={classes.maxWidth} style={{ marginTop: 20 }}>
								<InputLabel>{i18n.t("transferTicketModal.fieldConnectionLabel")}</InputLabel>
								<Select
									value={selectedWhatsapp}
									onChange={(e) => setSelectedWhatsapp(e.target.value)}
									label={i18n.t("transferTicketModal.fieldConnectionPlaceholder")}
								>
									{whatsApps.map((whasapp) => (
										<MenuItem key={whasapp.id} value={whasapp.id}>{whasapp.name}</MenuItem>
									))}
								</Select>
							</FormControl>
						)}
					</Can>
				</DialogContent>
				<DialogActions>
					<Button
						onClick={handleClose}
						color="secondary"
						disabled={loading}
						variant="outlined"
					>
						{i18n.t("transferTicketModal.buttons.cancel")}
					</Button>
					<ButtonWithSpinner
						variant="contained"
						type="submit"
						color="primary"
						loading={loading}
						disabled={!selectedUser && !selectedQueue && !currentQueueId}
					>
						{i18n.t("transferTicketModal.buttons.ok")}
					</ButtonWithSpinner>
				</DialogActions>
			</form>
		</Dialog>
	);
};

export default TransferTicketModal;
