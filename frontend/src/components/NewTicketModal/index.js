import React, { useState, useEffect, useContext } from "react";
import { useHistory } from "react-router-dom";

import TextField from "@mui/material/TextField";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import Autocomplete, {
	createFilterOptions,
} from '@mui/material/Autocomplete';
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import Janela, { SecaoDaJanela } from "../Janela";
import ContactModal from "../ContactModal";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

const filter = createFilterOptions({
	trim: true,
});

const NewTicketModal = ({ modalOpen, onClose }) => {
	const history = useHistory();

	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	// Separado da busca: com um estado só, o botão "Iniciar" girava enquanto
	// a lista de contatos carregava.
	const [salvando, setSalvando] = useState(false);
	const [searchParam, setSearchParam] = useState("");
	const [selectedContact, setSelectedContact] = useState(null);
	const [newContact, setNewContact] = useState({});
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const { user } = useContext(AuthContext);
	const { whatsApps } = useContext(WhatsAppsContext);
	const [selectedWhatsappId, setSelectedWhatsappId] = useState("");

	// Só faz sentido enviar por conexão ativa.
	const connectedWhatsapps = (whatsApps || []).filter(
		w => w.status === "CONNECTED"
	);

	// Pré-seleciona: conexão preferencial do usuário → padrão da empresa →
	// primeira conectada. O atendente ainda pode trocar antes de abrir o chat.
	useEffect(() => {
		if (!modalOpen || connectedWhatsapps.length === 0) return;

		const preferred =
			connectedWhatsapps.find(w => w.id === user?.whatsappId) ||
			connectedWhatsapps.find(w => w.isDefault) ||
			connectedWhatsapps[0];

		setSelectedWhatsappId(prev => prev || preferred.id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [modalOpen, whatsApps]);

	useEffect(() => {
		if (!modalOpen || searchParam.length < 3) {
			setLoading(false);
			return;
		}
		setLoading(true);
		const delayDebounceFn = setTimeout(() => {
			const fetchContacts = async () => {
				try {
					const { data } = await api.get("contacts", {
						params: { searchParam },
					});
					setOptions(data.contacts);
					setLoading(false);
				} catch (err) {
					setLoading(false);
					toastError(err);
				}
			};

			fetchContacts();
		}, 500);
		return () => clearTimeout(delayDebounceFn);
	}, [searchParam, modalOpen]);

	const handleClose = () => {
		onClose();
		setSearchParam("");
		setSelectedContact(null);
	};

	const handleSaveTicket = async contactId => {
		if (!contactId) return;
		setSalvando(true);
		try {
			const { data: ticket } = await api.post("/tickets", {
				contactId: contactId,
				userId: user.id,
				status: "open",
				whatsappId: selectedWhatsappId || undefined,
			});
			history.push(`/tickets/${ticket.id}`);
		} catch (err) {
			toastError(err);
		}
		setSalvando(false);
		handleClose();
	};

	const handleSelectOption = (e, newValue) => {
		if (newValue?.number) {
			setSelectedContact(newValue);
		} else if (newValue?.name) {
			setNewContact({ name: newValue.name });
			setContactModalOpen(true);
		}
	};

	const handleCloseContactModal = () => {
		setContactModalOpen(false);
	};

	const handleAddNewContactTicket = contact => {
		handleSaveTicket(contact.id);
	};

	const createAddContactOption = (filterOptions, params) => {
		const filtered = filter(filterOptions, params);

		if (params.inputValue !== "" && !loading && searchParam.length >= 3) {
			filtered.push({
				name: `${params.inputValue}`,
			});
		}

		return filtered;
	};

	// A partir do MUI v5 a assinatura é (props, option): o primeiro argumento
	// traz os atributos do <li>. Recebendo só um parâmetro, o código lia .name
	// do objeto de props e exibia "Adicionar undefined".
	const renderOption = (props, option) => {
		const { key, ...rest } = props;
		return (
			<li key={option.id ?? option.name} {...rest}>
				{option.number
					? `${option.name} - ${option.number}`
					: `${i18n.t("newTicketModal.add")} ${option.name}`}
			</li>
		);
	};

	const renderOptionLabel = option => {
		if (option.number) {
			return `${option.name} - ${option.number}`;
		} else {
			return `${option.name}`;
		}
	};

	return (
		<>
			<ContactModal
				open={contactModalOpen}
				initialValues={newContact}
				onClose={handleCloseContactModal}
				onSave={handleAddNewContactTicket}
			></ContactModal>
			<Janela
				open={modalOpen}
				onClose={handleClose}
				icone={<ChatBubbleOutlineIcon />}
				titulo={i18n.t("newTicketModal.title")}
				subtitulo="Busque o contato pelo nome ou número. Se ele não existir, dá para cadastrar aqui mesmo."
				tamanho="xs"
				rotuloCancelar={i18n.t("newTicketModal.buttons.cancel")}
				rotuloConfirmar={i18n.t("newTicketModal.buttons.ok")}
				onConfirmar={() => handleSaveTicket(selectedContact.id)}
				confirmarDesabilitado={!selectedContact || !selectedWhatsappId}
				carregando={salvando}
			>
				<SecaoDaJanela rotulo="Contato">
					<Autocomplete
						options={options}
						loading={loading}
						fullWidth
						clearOnBlur
						autoHighlight
						freeSolo
						clearOnEscape
						getOptionLabel={renderOptionLabel}
						renderOption={renderOption}
						filterOptions={createAddContactOption}
						onChange={(e, newValue) => handleSelectOption(e, newValue)}
						renderInput={params => (
							<TextField
								{...params}
								placeholder={i18n.t("newTicketModal.fieldLabel")}
								variant="outlined"
								size="small"
								autoFocus
								onChange={e => setSearchParam(e.target.value)}
								onKeyPress={e => {
									if (loading || salvando || !selectedContact) return;
									else if (e.key === "Enter") {
										handleSaveTicket(selectedContact.id);
									}
								}}
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
				</SecaoDaJanela>
				{/* Com um número só, escolher é ruído: ele já vem marcado. */}
				{connectedWhatsapps.length !== 1 && (
					<SecaoDaJanela rotulo={i18n.t("newTicketModal.connection")}>
						<FormControl variant="outlined" size="small" fullWidth>
							<Select
								value={selectedWhatsappId}
								onChange={e => setSelectedWhatsappId(e.target.value)}
								displayEmpty
							>
								{connectedWhatsapps.map(whatsApp => (
									<MenuItem key={whatsApp.id} value={whatsApp.id}>
										{whatsApp.name}
									</MenuItem>
								))}
							</Select>
							<FormHelperText error={connectedWhatsapps.length === 0}>
								{connectedWhatsapps.length === 0
									? i18n.t("newTicketModal.noConnection")
									: i18n.t("newTicketModal.connectionHelper")}
							</FormHelperText>
						</FormControl>
					</SecaoDaJanela>
				)}
			</Janela>
		</>
	);
};

export default NewTicketModal;
