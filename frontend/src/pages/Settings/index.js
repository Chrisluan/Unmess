import React, { useState, useEffect, useCallback, useContext, useMemo } from "react";
import openSocket from "../../services/socket-io";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";

import PaginaComAbas from "../../components/PaginaComAbas";
import GeneralTab from "./GeneralTab";
import BusinessHoursTab from "./BusinessHoursTab";
import Connections from "../Connections";
import BrandingTab from "./BrandingTab";

/**
 * Configurações.
 *
 * Aqui ficou o que é configuração da empresa: como o sistema se comporta
 * (Geral), por onde ele fala (Conexões), quando ele atende (Horário) e com
 * que cara ele aparece (Identidade visual).
 *
 * Etiquetas, Mensagens automáticas e Status de finalização saíram para o
 * módulo Cadastro. Eram listas que se cadastram e se mantêm no dia a dia, e
 * estavam aqui só porque esta tela foi o primeiro lugar com abas — o que
 * obrigava quem só queria criar uma etiqueta a entrar em Configurações.
 */
const Settings = () => {
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

	return (
		<PaginaComAbas
			titulo={i18n.t("settings.title")}
			descricao={i18n.t("settings.description")}
			abas={abas}
		/>
	);
};

export default Settings;
