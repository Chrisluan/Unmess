import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import Select from "@material-ui/core/Select";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import { makeStyles } from "@material-ui/core";

import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import Autocomplete, {
	createFilterOptions,
} from "@material-ui/lab/Autocomplete";
import CircularProgress from "@material-ui/core/CircularProgress";
import ClearIcon from "@material-ui/icons/Clear";
import IconButton from "@material-ui/core/IconButton";
import Typography from "@material-ui/core/Typography";

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
		<Dialog open={modalOpen} onClose={handleClose} maxWidth="lg" scroll="paper">
			<form onSubmit={handleSaveTicket}>
				<DialogTitle id="form-dialog-title">
					{i18n.t("transferTicketModal.title")}
				</DialogTitle>
				<DialogContent dividers>
					<div className={classes.fieldRow}>
						<Autocomplete
							style={{ width: 300 }}
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
							<IconButton
								size="small"
								title={i18n.t("transferTicketModal.buttons.removeUser")}
								onClick={handleRemoveUser}
								disabled={loading}
							>
								<ClearIcon fontSize="small" />
							</IconButton>
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
								<MenuItem value={''}>&nbsp;</MenuItem>
								{queues.map((queue) => (
									<MenuItem key={queue.id} value={queue.id}>{queue.name}</MenuItem>
								))}
							</Select>
						</FormControl>
						{currentQueueId && (
							<IconButton
								size="small"
								title={i18n.t("transferTicketModal.buttons.removeQueue")}
								onClick={handleRemoveQueue}
								disabled={loading}
							>
								<ClearIcon fontSize="small" />
							</IconButton>
						)}
					</div>
					<Typography variant="caption" color="textSecondary" className={classes.currentInfo}>
						{i18n.t("transferTicketModal.removeQueueHelp")}
					</Typography>
					<Can
						role={loggedInUser.profile}
						perform="ticket-options:transferWhatsapp"
						yes={() => (!loadingWhatsapps && 
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
					/>
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
