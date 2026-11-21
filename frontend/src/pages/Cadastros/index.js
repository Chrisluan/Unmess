import React, { useState, useEffect, useCallback, useMemo } from "react";
import openSocket from "../../services/socket-io";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import usePermissions from "../../hooks/usePermissions";

import PaginaComAbas from "../../components/PaginaComAbas";
import Products from "../Products";
import QuickAnswers from "../QuickAnswers";
import TagsTab from "./TagsTab";
import AutoMessagesTab from "./AutoMessagesTab";
import TicketStatusesTab from "./TicketStatusesTab";
import InsumosTab from "./InsumosTab";
import AcabamentosTab from "./AcabamentosTab";

/**
 * Cadastro.
 *
 * As listas que a empresa mantém para o sistema funcionar: o que ela vende,
 * o que ela responde de pronto, como ela classifica e como ela encerra.
 *
 * Estavam em três lugares diferentes — Produtos e Respostas rápidas tinham
 * item próprio no menu, Etiquetas, Mensagens automáticas e Status de
 * finalização eram abas perdidas dentro de Configurações — e a diferença
 * entre elas era histórica, não conceitual: todas são cadastro, nenhuma é
 * configuração de comportamento do sistema. Reuni-las aqui devolve a
 * Configurações o assunto que é dela e tira cinco linhas do menu lateral.
 *
 * Cada aba continua com a permissão que já tinha. Ninguém ganhou nem perdeu
 * acesso na mudança: quem só podia ver Etiquetas continua entrando aqui e
 * vendo apenas Etiquetas.
 */
const Cadastros = () => {
	// Mensagens automáticas gravam em /settings, então esta tela precisa da
	// mesma lista que Configurações carrega. É a única aba daqui que depende
	// dela — as outras quatro falam com endpoints próprios.
	const [settings, setSettings] = useState([]);
	const { can } = usePermissions();
	const podeVerAjustes = can("settings:view");

	const fetchSettings = useCallback(async () => {
		if (!podeVerAjustes) return;
		try {
			const { data } = await api.get("/settings");
			setSettings(data || []);
		} catch (err) {
			toastError(err);
		}
	}, [podeVerAjustes]);

	useEffect(() => {
		fetchSettings();
	}, [fetchSettings]);

	useEffect(() => {
		const socket = openSocket();

		socket.on("settings", (data) => {
			if (data.action === "update") {
				setSettings((prevState) => {
					const aux = [...prevState];
					const i = aux.findIndex((s) => s.key === data.setting.key);
					if (i !== -1) {
						aux[i] = { ...aux[i], value: data.setting.value };
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

	const abas = useMemo(
		() => [
			{
				chave: "produtos",
				permissao: "products:view",
				rotulo: i18n.t("cadastros.tabs.products"),
				// Produtos abre modais e busca paginada ao montar; fora da aba
				// ativa isso seria trabalho jogado fora a cada visita à tela.
				montarSomenteAtiva: true,
				conteudo: <Products embedded />,
			},
			{
				// Só custo: quem não vê custo não tem o que fazer aqui.
				chave: "insumos",
				permissao: "products:viewCost",
				editar: "products:manage",
				rotulo: "Insumos",
				montarSomenteAtiva: true,
				conteudo: <InsumosTab />,
			},
			{
				chave: "acabamentos",
				permissao: "products:view",
				editar: "products:manage",
				rotulo: "Acabamentos",
				montarSomenteAtiva: true,
				conteudo: <AcabamentosTab />,
			},
			{
				chave: "respostas-rapidas",
				permissao: "quickAnswers:view",
				rotulo: i18n.t("cadastros.tabs.quickAnswers"),
				montarSomenteAtiva: true,
				conteudo: <QuickAnswers embedded />,
			},
			{
				chave: "etiquetas",
				permissao: "tags:view",
				rotulo: i18n.t("cadastros.tabs.tags"),
				conteudo: <TagsTab />,
			},
			{
				chave: "mensagens-automaticas",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("cadastros.tabs.autoMessages"),
				conteudo: (
					<AutoMessagesTab
						getSettingValue={getSettingValue}
						onSettingSaved={fetchSettings}
					/>
				),
			},
			{
				chave: "status-de-finalizacao",
				permissao: "settings:view",
				editar: "settings:edit",
				rotulo: i18n.t("cadastros.tabs.ticketStatuses"),
				conteudo: <TicketStatusesTab />,
			},
		],
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[settings, fetchSettings]
	);

	return (
		<PaginaComAbas
			titulo={i18n.t("cadastros.title")}
			descricao={i18n.t("cadastros.description")}
			abas={abas}
			// Produtos tem tabela larga (custo, preço, margem, ações) e apertava
			// contra o "lg" que as outras abas usam.
			maxWidth="xl"
		/>
	);
};

export default Cadastros;
