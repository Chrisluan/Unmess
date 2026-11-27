import React, { useState, useEffect, useCallback, useContext } from "react";
import { useLocation } from "react-router-dom";
import openSocket from "../../services/socket-io";

import makeStyles from '@mui/styles/makeStyles';
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

import PaginaComAbas from "../../components/PaginaComAbas";
import GeneralTab from "./GeneralTab";
import BusinessHoursTab from "./BusinessHoursTab";
import Connections from "../Connections";
import BrandingTab from "./BrandingTab";
import TicketStatusesTab from "../Cadastros/TicketStatusesTab";
import TagsTab from "../Cadastros/TagsTab";
import AutoMessagesTab from "../Cadastros/AutoMessagesTab";
import SaudeTab from "./SaudeTab";
import DadosDaEmpresa from "./DadosDaEmpresa";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useHistory } from "react-router-dom";

import Title from "../../components/Title";
import { ABAS_CONFIGURACOES } from "../../layout/ajustesItens";

const SUBTITULOS = {
	geral: "Regras do atendimento e preferências da empresa.",
	conexoes: "Números de WhatsApp ligados ao Unmess.",
	horarios: "Quando a equipe atende e o que responder fora do horário.",
	status: "Motivos que o atendente escolhe ao resolver uma conversa.",
	etiquetas: "Etiquetas para organizar conversas e contatos.",
	mensagens: "Mensagens enviadas sozinhas em momentos do atendimento.",
	marca: "Nome, logo e os dados que saem nos documentos.",
	saude: "Configurações que deixam outras sem efeito, e onde resolver cada uma.",
};

const TITULOS = {
	geral: "settings.tabs.general",
	conexoes: "settings.tabs.connections",
	horarios: "settings.tabs.businessHours",
	status: "settings.tabs.ticketStatuses",
	etiquetas: "settings.tabs.tags",
	mensagens: "settings.tabs.autoMessages",
	marca: "settings.tabs.branding",
	saude: "settings.tabs.health",
};

const useStyles = makeStyles(theme => ({
	root: {
		padding: theme.spacing(3, 4, 4),
		maxWidth: 1200,
		width: "100%",
		[theme.breakpoints.down("sm")]: {
			padding: theme.spacing(2),
		},
	},
	cabecalho: {
		marginBottom: theme.spacing(3),
	},
	tabPanel: {},
}));

const Settings = () => {
	const classes = useStyles();
	const { whatsApps } = useContext(WhatsAppsContext);
	const { can } = usePermissions();
	const podeVerAjustes = can("settings:view");

	const [settings, setSettings] = useState([]);
	const [carregouAjustes, setCarregouAjustes] = useState(false);
	const [problemas, setProblemas] = useState([]);
	const [carregandoSaude, setCarregandoSaude] = useState(true);
	const history = useHistory();
	const { search } = useLocation();
	const abaPedida = new URLSearchParams(search).get("aba");
	const aba = ABAS_CONFIGURACOES.includes(abaPedida) ? abaPedida : "geral";
	const tab = ABAS_CONFIGURACOES.indexOf(aba);

	const fetchSettings = useCallback(async () => {
		// Esta tela também abre para quem só cuida das conexões; pedir as
		// configurações sem a permissão dava 403 e um aviso a cada visita.
		if (!podeVerAjustes) return;
		try {
			const { data } = await api.get("/settings");
			setSettings(data || []);
			setCarregouAjustes(true);
		} catch (err) {
			toastError(err);
		}
	}, [podeVerAjustes]);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	// Saúde da configuração: recarrega quando os ajustes mudam e a cada troca de
	// aba, porque a correção costuma ser feita em outra aba (motivos, horários).
	const fetchSaude = useCallback(async () => {
		if (!podeVerAjustes) return;
		try {
			const { data } = await api.get("/configuracao/saude");
			setProblemas(data?.problemas || []);
		} catch (err) {
			// O painel é auxiliar: falhar aqui não pode atrapalhar a tela.
		} finally {
			setCarregandoSaude(false);
		}
	}, [podeVerAjustes]);

	useEffect(() => {
		fetchSaude();
	}, [fetchSaude, settings, aba]);

	const bloqueios = problemas.filter((p) => p.severidade === "bloqueia");

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", (data) => {
			if (data.action === "update") {
				setSettings((prevState) => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex((s) => s.key === data.setting.key);
					if (settingIndex !== -1) {
						aux[settingIndex] = { ...aux[settingIndex], value: data.setting.value };
					} else {
						aux.push(data.setting);
					}
					return aux;
				});
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	// Nunca lança erro mesmo se a chave ainda não existir no banco para esta
	// empresa (ex: primeira vez que a tela é aberta, antes de qualquer save).
	const getSettingValue = (key) => {
		const setting = settings.find((s) => s.key === key);
		return setting ? setting.value : "";
	};

	return (
		<div className={classes.root}>
			<div className={classes.cabecalho}>
				<Title>{i18n.t(TITULOS[aba])}</Title>
				<Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
					{SUBTITULOS[aba]}
				</Typography>
			</div>
			{aba !== "saude" && bloqueios.length > 0 && (
				<Alert
					severity="warning"
					sx={{ mb: 3 }}
					action={
						<Button color="inherit" size="small" onClick={() => history.push("/Settings?aba=saude")}>
							Ver
						</Button>
					}
				>
					{bloqueios.length === 1
						? `Uma configuração está deixando outra sem efeito: ${bloqueios[0].titulo.toLowerCase()}.`
						: `${bloqueios.length} configurações estão deixando outras sem efeito.`}
				</Alert>
			)}
				<Box className={classes.tabPanel} hidden={tab !== 0}>
					<GeneralTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				</Box>
				{/* Conexões só monta quando a aba está ativa: a tela abre sockets e
				    dispara requests de sessão, não faz sentido rodar em background. */}
				<Box className={classes.tabPanel} hidden={tab !== 1}>
					{tab === 1 && can("connections:view") && <Connections embedded />}
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 2}>
					<BusinessHoursTab />
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 3}>
					{can("tickets:view") && <TicketStatusesTab />}
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 4}>
					{can("tags:view") && <TagsTab />}
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 5}>
					{/* Só monta depois dos ajustes carregados: os campos de texto
					    nasciam vazios e, ao perder o foco, gravavam vazio por cima
					    da mensagem salva. */}
					{carregouAjustes && <AutoMessagesTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>}
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 6}>
					<BrandingTab />
					{podeVerAjustes && <DadosDaEmpresa />}
				</Box>
				<Box className={classes.tabPanel} hidden={tab !== 7}>
					{podeVerAjustes && <SaudeTab problemas={problemas} carregando={carregandoSaude} />}
				</Box>
		</div>
	);
};

export default Settings;
