import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import { useHistory, useLocation } from "react-router-dom";
import openSocket from "../../services/socket-io";

import makeStyles from "@mui/styles/makeStyles";
import Container from "@mui/material/Container";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import Badge from "@mui/material/Badge";
import Typography from "@mui/material/Typography";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import usePermissions from "../../hooks/usePermissions";

import GeneralTab from "./GeneralTab";
import BusinessHoursTab from "./BusinessHoursTab";
import TicketStatusesTab from "./TicketStatusesTab";
import AutoMessagesTab from "./AutoMessagesTab";
import Connections from "../Connections";
import TagsTab from "./TagsTab";
import BrandingTab from "./BrandingTab";

const useStyles = makeStyles((theme) => ({
	root: {
		padding: theme.spacing(3, 4, 4),
	},

	cabecalho: {
		marginBottom: theme.spacing(2),
	},

	descricao: {
		maxWidth: 720,
		marginTop: theme.spacing(0.5),
	},

	abas: {
		borderBottom: `1px solid ${theme.palette.divider}`,
	},

	tabPanel: {
		paddingTop: theme.spacing(3),
	},

	// O <fieldset> entra só pelo efeito de desativar o que está dentro; sem
	// isto ele desenharia a moldura e o recuo próprios do elemento.
	painel: {
		border: 0,
		margin: 0,
		padding: 0,
		minWidth: 0,
	},

	avisoLeitura: {
		marginBottom: theme.spacing(2),
	},
}));

/**
 * Configurações.
 *
 * As abas eram comparadas por índice numérico e viviam só na memória do
 * componente: recarregar a página, voltar pelo histórico ou mandar o link
 * para um colega sempre caía em "Geral". Agora a aba escolhida vive na URL
 * (`/settings#connections`), que é onde o navegador já sabe guardar estado.
 *
 * A lista também virou dados em vez de sete pares soltos de <Tab> e <Box>,
 * o que mantinha rótulo e conteúdo em lugares distantes do arquivo — bastava
 * inserir uma aba no meio para desalinhar todos os índices seguintes.
 */
const Settings = () => {
	const { can, permissions } = usePermissions();
	const classes = useStyles();
	const history = useHistory();
	const location = useLocation();
	const { whatsApps } = useContext(WhatsAppsContext);

	const [settings, setSettings] = useState([]);

	const fetchSettings = useCallback(async () => {
		try {
			const { data } = await api.get("/settings");
			setSettings(data || []);
		} catch (err) {
			toastError(err);
		}
	}, []);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

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

	// Número caído é a única coisa aqui que pede ação hoje: o selo repete na
	// aba o alerta que o menu lateral já mostra, para não obrigar a abrir uma
	// por uma até achar qual está com problema.
	const conexoesComProblema = (whatsApps || []).filter((w) =>
		["qrcode", "PAIRING", "DISCONNECTED", "TIMEOUT", "OPENING"].includes(w.status)
	).length;

	const abas = useMemo(
		() => [
			{
				chave: "general",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("settings.tabs.general"),
				conteudo: (
					<GeneralTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				),
			},
			{
				chave: "connections",
				permissao: "connections:view",
				rotulo: i18n.t("settings.tabs.connections"),
				selo: conexoesComProblema,
				// Conexões só monta quando a aba está ativa: a tela abre sockets
				// e dispara requests de sessão, não faz sentido rodar em segundo
				// plano.
				montarSomenteAtiva: true,
				conteudo: <Connections embedded />,
			},
			{
				chave: "business-hours",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("settings.tabs.businessHours"),
				conteudo: <BusinessHoursTab />,
			},
			{
				chave: "ticket-statuses",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("settings.tabs.ticketStatuses"),
				conteudo: <TicketStatusesTab />,
			},
			{
				chave: "tags",
				permissao: "tags:view",
				rotulo: i18n.t("settings.tabs.tags"),
				conteudo: <TagsTab />,
			},
			{
				chave: "auto-messages",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("settings.tabs.autoMessages"),
				conteudo: (
					<AutoMessagesTab
						settings={settings}
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				),
			},
			{
				chave: "branding",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("settings.tabs.branding"),
				conteudo: <BrandingTab />,
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[settings, conexoesComProblema, fetchSettings]
	);

	/**
	 * Configurações reúne assuntos com donos diferentes: Conexões é de quem
	 * cuida dos números, Etiquetas de quem organiza o atendimento, o resto de
	 * quem administra a empresa. Cada aba pergunta pela sua permissão, então
	 * quem entra aqui vê exatamente as que lhe cabem — e não uma fileira de
	 * abas que respondem 403 ao serem abertas.
	 */
	const abasPermitidas = useMemo(
		() => abas.filter((aba) => !aba.permissao || can(aba.permissao)),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[abas, permissions]
	);

	const daUrl = (location.hash || "").replace("#", "");
	const atual = abasPermitidas.some((a) => a.chave === daUrl)
		? daUrl
		: abasPermitidas[0]?.chave;

	const trocarAba = (_e, chave) => {
		history.replace(`${location.pathname}#${chave}`);
	};

	return (
		<div className={classes.root}>
			<Container maxWidth="lg">
				<div className={classes.cabecalho}>
					<Typography variant="h5">{i18n.t("settings.title")}</Typography>
					<Typography
						variant="body2"
						color="textSecondary"
						className={classes.descricao}
					>
						{i18n.t("settings.description")}
					</Typography>
				</div>

				<Tabs
					// Sem nenhuma aba permitida o MUI reclamaria de um value que não
					// existe entre as opções; `false` é como ele representa "nenhuma".
					value={atual ?? false}
					onChange={trocarAba}
					indicatorColor="primary"
					textColor="primary"
					variant="scrollable"
					scrollButtons="auto"
					className={classes.abas}
				>
					{abasPermitidas.map((aba) => (
						<Tab
							key={aba.chave}
							value={aba.chave}
							label={
								aba.selo ? (
									<Badge badgeContent={aba.selo} color="error">
										<span style={{ paddingRight: 12 }}>{aba.rotulo}</span>
									</Badge>
								) : (
									aba.rotulo
								)
							}
						/>
					))}
				</Tabs>

				{abasPermitidas.map((aba) => {
					/**
					 * "Ver as configurações" promete leitura, e a promessa é
					 * cumprida com um <fieldset disabled>: ele desativa todo
					 * controle de formulário que estiver dentro, inclusive pelo
					 * teclado, e continua valendo para abas que ainda não
					 * existem. A alternativa era desabilitar campo por campo em
					 * cinco arquivos — e esquecer um deles na próxima aba nova.
					 *
					 * O servidor recusa a gravação de qualquer jeito; isto
					 * existe para a pessoa não descobrir isso depois de
					 * preencher o formulário.
					 */
					const soLeitura = aba.editar && !can(aba.editar);

					const conteudo = aba.montarSomenteAtiva
						? atual === aba.chave && aba.conteudo
						: aba.conteudo;

					return (
						<Box
							key={aba.chave}
							className={classes.tabPanel}
							hidden={atual !== aba.chave}
							role="tabpanel"
						>
							{soLeitura && (
								<Typography
									variant="body2"
									color="textSecondary"
									className={classes.avisoLeitura}
								>
									Você tem acesso de leitura às configurações. Para
									alterá-las, peça a permissão de editar configurações.
								</Typography>
							)}
							<fieldset disabled={soLeitura} className={classes.painel}>
								{conteudo}
							</fieldset>
						</Box>
					);
				})}
			</Container>
		</div>
	);
};

export default Settings;
