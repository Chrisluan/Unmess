import React, { useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import { format, parseISO } from "date-fns";

import makeStyles from '@mui/styles/makeStyles';
import {
	Button,
	TableBody,
	TableRow,
	TableCell,
	IconButton,
	Table,
	TableHead,
	Paper,
	Tooltip,
	Typography,
	CircularProgress,
} from "@mui/material";
import {
	Edit,
	CheckCircle,
	SignalCellularConnectedNoInternet2Bar,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	DeleteOutline,
	ErrorOutline,
	Add,
} from "@mui/icons-material";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import TableEmpty from "../../components/EmptyState/TableEmpty";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import { Can } from "../../components/Can";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles(theme => ({
  /**
   * Painel de conteúdo das telas de listagem.
   *
   * Ganhou borda e margem: o Paper deixou de ter sombra no tema novo, e sem
   * nenhuma das duas a tabela ficava solta no meio da página, encostada nas
   * bordas da janela sem nada dizendo onde ela começa.
   */
  cabecalhoEmbutido: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },

  textoCabecalho: {
    minWidth: 0,
    maxWidth: 640,
  },

  mainPaper: {
    flex: 1,
    margin: theme.spacing(0, 2, 2),
    padding: theme.spacing(0.5),
    // "auto" e não "scroll": a barra vazia desenhava uma faixa cinza fixa na
    // direita de toda listagem, inclusive nas que cabem na tela.
    overflowY: "auto",
    // Sem isto a tabela larga estoura o painel e rola a página inteira.
    overflowX: "auto",
    border: `1px solid ${theme.palette.divider}`,
    ...theme.scrollbarStyles,
  },
	customTableCell: {
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
	},
	tooltip: {
		backgroundColor: "#f5f5f9",
		color: "rgba(0, 0, 0, 0.87)",
		fontSize: theme.typography.pxToRem(14),
		border: "1px solid #dadde9",
		maxWidth: 450,
	},
	tooltipPopper: {
		textAlign: "center",
	},
	buttonProgress: {
		color: theme.palette.primary.main,
	},
}));

const CustomToolTip = ({ title, content, children }) => {
	const classes = useStyles();

	return (
		<Tooltip
			arrow
			classes={{
				tooltip: classes.tooltip,
				popper: classes.tooltipPopper,
			}}
			title={
				<React.Fragment>
					<Typography gutterBottom color="inherit">
						{title}
					</Typography>
					{content && <Typography>{content}</Typography>}
				</React.Fragment>
			}
		>
			{children}
		</Tooltip>
	);
};

/**
 * Conexões. Renderizada como aba dentro de Configurações (embedded) — o modo
 * página inteira é mantido para não quebrar links antigos.
 */
const Connections = ({ embedded = false }) => {
	const classes = useStyles();
	const { can } = usePermissions();

	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [qrModalOpen, setQrModalOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const confirmationModalInitialState = {
		action: "",
		title: "",
		message: "",
		whatsAppId: "",
		open: false,
	};
	const [confirmModalInfo, setConfirmModalInfo] = useState(
		confirmationModalInitialState
	);

	const handleStartWhatsAppSession = async whatsAppId => {
		try {
			await api.post(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRequestNewQrCode = async whatsAppId => {
		try {
			await api.put(`/whatsappsession/${whatsAppId}`);
		} catch (err) {
			toastError(err);
		}
	};

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleOpenQrModal = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setQrModalOpen(true);
	};

	const handleCloseQrModal = useCallback(() => {
		setSelectedWhatsApp(null);
		setQrModalOpen(false);
	}, [setQrModalOpen, setSelectedWhatsApp]);

	const handleEditWhatsApp = whatsApp => {
		setSelectedWhatsApp(whatsApp);
		setWhatsAppModalOpen(true);
	};

	const handleOpenConfirmationModal = (action, whatsAppId) => {
		if (action === "disconnect") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.disconnectTitle"),
				message: i18n.t("connections.confirmationModal.disconnectMessage"),
				confirmLabel: i18n.t("connections.confirmationModal.disconnectConfirm"),
				whatsAppId: whatsAppId,
			});
		}

		if (action === "delete") {
			setConfirmModalInfo({
				action: action,
				title: i18n.t("connections.confirmationModal.deleteTitle"),
				confirmLabel: i18n.t("connections.confirmationModal.deleteConfirm"),
				message: i18n.t("connections.confirmationModal.deleteMessage"),
				whatsAppId: whatsAppId,
			});
		}
		setConfirmModalOpen(true);
	};

	const handleSubmitConfirmationModal = async () => {
		if (confirmModalInfo.action === "disconnect") {
			try {
				await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
			} catch (err) {
				toastError(err);
			}
		}

		if (confirmModalInfo.action === "delete") {
			try {
				await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
				toast.success(i18n.t("connections.toasts.deleted"));
			} catch (err) {
				toastError(err);
			}
		}

		setConfirmModalInfo(confirmationModalInitialState);
	};

	const renderActionButtons = whatsApp => {
		/**
		 * Ler o QR, religar e desconectar são a mesma permissão: quem faz
		 * qualquer uma das três decide se a empresa está no ar. Sem ela,
		 * a linha mostra só o status — e não botões que respondem 403.
		 */
		if (!can("connections:session")) return null;

		return (
            <>
                {whatsApp.status === "qrcode" && (
					<Button
						size="small"
						variant="contained"
						color="primary"
						onClick={() => handleOpenQrModal(whatsApp)}
					>
						{i18n.t("connections.buttons.qrcode")}
					</Button>
				)}
                {(whatsApp.status === "DISCONNECTED" ||
					whatsApp.status === "DUPLICATED") && (
					<>
						<Button
							size="small"
							variant="outlined"
							color="primary"
							onClick={() => handleStartWhatsAppSession(whatsApp.id)}
						>
							{i18n.t("connections.buttons.tryAgain")}
						</Button>{" "}
						<Button
							size="small"
							variant="outlined"
							color="secondary"
							onClick={() => handleRequestNewQrCode(whatsApp.id)}
						>
							{i18n.t("connections.buttons.newQr")}
						</Button>
					</>
				)}
                {(whatsApp.status === "CONNECTED" ||
					whatsApp.status === "PAIRING" ||
					whatsApp.status === "TIMEOUT") && (
					<Button
						size="small"
						variant="outlined"
						color="secondary"
						onClick={() => {
							handleOpenConfirmationModal("disconnect", whatsApp.id);
						}}
					>
						{i18n.t("connections.buttons.disconnect")}
					</Button>
				)}
                {whatsApp.status === "OPENING" && (
					<Button size="small" variant="outlined" disabled>
						{i18n.t("connections.buttons.connecting")}
					</Button>
				)}
            </>
        );
	};

	const renderStatusToolTips = whatsApp => {
		return (
			<div className={classes.customTableCell}>
				{whatsApp.status === "DISCONNECTED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.disconnected.title")}
						content={i18n.t("connections.toolTips.disconnected.content")}
					>
						<SignalCellularConnectedNoInternet0Bar color="secondary" />
					</CustomToolTip>
				)}
				{whatsApp.status === "OPENING" && (
					<CircularProgress size={24} className={classes.buttonProgress} />
				)}
				{whatsApp.status === "qrcode" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.qrcode.title")}
						content={i18n.t("connections.toolTips.qrcode.content")}
					>
						<CropFree />
					</CustomToolTip>
				)}
				{whatsApp.status === "CONNECTED" && (
					<CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
						<SignalCellular4Bar color="success" />
					</CustomToolTip>
				)}
				{(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.timeout.title")}
						content={i18n.t("connections.toolTips.timeout.content")}
					>
						<SignalCellularConnectedNoInternet2Bar color="secondary" />
					</CustomToolTip>
				)}
				{whatsApp.status === "DUPLICATED" && (
					<CustomToolTip
						title={i18n.t("connections.toolTips.duplicated.title")}
						content={i18n.t("connections.toolTips.duplicated.content")}
					>
						<ErrorOutline color="secondary" />
					</CustomToolTip>
				)}
			</div>
		);
	};

	const Wrapper = embedded ? React.Fragment : MainContainer;

	return (
		<Wrapper>
			<ConfirmationModal
				title={confirmModalInfo.title}
				open={confirmModalOpen}
				onClose={setConfirmModalOpen}
				danger={confirmModalInfo.action === "delete"}
				confirmLabel={confirmModalInfo.confirmLabel}
				onConfirm={handleSubmitConfirmationModal}
			>
				{confirmModalInfo.message}
			</ConfirmationModal>
			<QrcodeModal
				open={qrModalOpen}
				onClose={handleCloseQrModal}
				whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id}
			/>
			<WhatsAppModal
				open={whatsAppModalOpen}
				onClose={handleCloseWhatsAppModal}
				whatsAppId={!qrModalOpen && selectedWhatsApp?.id}
			/>
			{embedded ? (
				<div className={classes.cabecalhoEmbutido}>
					<div className={classes.textoCabecalho}>
						<Typography variant="h6">
							{i18n.t("connections.title")}
						</Typography>
						<Typography variant="body2" color="textSecondary">
							{i18n.t("connections.description")}
						</Typography>
					</div>
					<Can permission="connections:create">
						<Button
							variant="contained"
							color="primary"
							startIcon={<Add />}
							onClick={handleOpenWhatsAppModal}
						>
							{i18n.t("connections.buttons.add")}
						</Button>
					</Can>
				</div>
			) : (
				<MainHeader>
					<Title>{i18n.t("connections.title")}</Title>
					<MainHeaderButtonsWrapper>
						<Can permission="connections:create">
							<Button
								variant="contained"
								color="primary"
								startIcon={<Add />}
								onClick={handleOpenWhatsAppModal}
							>
								{i18n.t("connections.buttons.add")}
							</Button>
						</Can>
					</MainHeaderButtonsWrapper>
				</MainHeader>
			)}
			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>{i18n.t("connections.table.name")}</TableCell>
							<TableCell>{i18n.t("connections.table.number")}</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.status")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.session")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.lastUpdate")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.default")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("connections.table.actions")}
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{loading ? (
							<TableRowSkeleton />
						) : (
							<>
								{whatsApps?.length === 0 && (
									<TableEmpty
										colSpan={7}
										icon={WhatsAppIcon}
										title={i18n.t("connections.empty.title")}
										description={i18n.t("connections.empty.message")}
										action={
											<Button
												variant="contained"
												color="primary"
												startIcon={<Add />}
												onClick={handleOpenWhatsAppModal}
											>
												{i18n.t("connections.buttons.add")}
											</Button>
										}
									/>
								)}
								{whatsApps?.length > 0 &&
									whatsApps.map(whatsApp => (
										<TableRow key={whatsApp.id}>
											<TableCell>{whatsApp.name}</TableCell>
											<TableCell>{whatsApp.number || "—"}</TableCell>
											<TableCell align="center">
												{renderStatusToolTips(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{renderActionButtons(whatsApp)}
											</TableCell>
											<TableCell align="center">
												{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}
											</TableCell>
											<TableCell align="center">
												{whatsApp.isDefault && (
													<div className={classes.customTableCell}>
														<CheckCircle color="success" />
													</div>
												)}
											</TableCell>
											<TableCell align="center">
												<Can permission="connections:edit">
													<Tooltip title={i18n.t("connections.actions.edit")} arrow>
														<IconButton
															size="small"
															aria-label={i18n.t("connections.actions.edit")}
															onClick={() => handleEditWhatsApp(whatsApp)}
														>
															<Edit />
														</IconButton>
													</Tooltip>
												</Can>

												<Can permission="connections:delete">
													<Tooltip title={i18n.t("connections.actions.delete")} arrow>
														<IconButton
															size="small"
															aria-label={i18n.t("connections.actions.delete")}
															onClick={() => {
																handleOpenConfirmationModal("delete", whatsApp.id);
															}}
														>
															<DeleteOutline />
														</IconButton>
													</Tooltip>
												</Can>
											</TableCell>
										</TableRow>
									))}
							</>
						)}
					</TableBody>
				</Table>
			</Paper>
		</Wrapper>
	);
};

export default Connections;
