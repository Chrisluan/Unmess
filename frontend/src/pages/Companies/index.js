import React, { useCallback, useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { toast } from "react-toastify";

import makeStyles from "@mui/styles/makeStyles";
import {
	Button,
	IconButton,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
	Tooltip,
	Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import LoginIcon from "@mui/icons-material/Login";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

import CompanyModal from "../../components/CompanyModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import EmptyState from "../../components/EmptyState";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import SearchField from "../../components/SearchField";
import Title from "../../components/Title";
import SituacaoEmpresa from "../CompanyDetail/SituacaoEmpresa";
import useEntrarNaEmpresa from "../CompanyDetail/useEntrarNaEmpresa";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		margin: theme.spacing(0, 2, 2),
		padding: theme.spacing(0.5),
		overflowY: "auto",
		overflowX: "auto",
		border: `1px solid ${theme.palette.divider}`,
		...theme.scrollbarStyles,
	},

	filtros: {
		padding: theme.spacing(0, 2, 1.5),
	},

	tabela: { minWidth: 860 },

	linha: {
		cursor: "pointer",
		"&:hover": { backgroundColor: theme.palette.action.hover },
	},

	nome: { fontWeight: 600 },

	numero: { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },

	// Empresa devendo é a única linha da lista que pede providência hoje.
	vencidas: {
		color: theme.palette.error.main,
		fontWeight: 700,
		whiteSpace: "nowrap",
	},

	semDivida: { color: theme.palette.text.disabled },
}));

const moeda = valor =>
	Number(valor || 0).toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});

const PLANOS = { basic: "Básico", pro: "Profissional", enterprise: "Enterprise" };

const SITUACOES = [
	{ valor: "", rotulo: "Todas" },
	{ valor: "active", rotulo: "Ativas" },
	{ valor: "overdue", rotulo: "Devendo" },
	{ valor: "suspended", rotulo: "Suspensas" },
	{ valor: "canceled", rotulo: "Canceladas" },
];

/**
 * Painel de empresas assinantes.
 *
 * Era uma tabela de cadastro: nome, CNPJ, e-mail, plano e situação, com
 * editar e excluir. Servia para inserir empresa, e não para administrar
 * assinantes — não dizia quantas pessoas usam cada uma, se alguém está
 * devendo, nem levava a lugar nenhum.
 *
 * Agora cada linha é uma porta: leva à ficha da empresa, onde estão usuários,
 * cobrança e acesso. As colunas viraram as perguntas que se faz varrendo a
 * lista — quem está devendo, quem parou de usar, quanto cada uma paga — e o
 * filtro de cima recorta exatamente por elas.
 */
const Companies = () => {
	const classes = useStyles();
	const history = useHistory();
	const entrarNaEmpresa = useEntrarNaEmpresa();

	const [companies, setCompanies] = useState([]);
	const [loading, setLoading] = useState(true);
	const [busca, setBusca] = useState("");
	const [situacao, setSituacao] = useState("");

	const [companyModalOpen, setCompanyModalOpen] = useState(false);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);
	const [selectedCompany, setSelectedCompany] = useState(null);

	const carregar = useCallback(async () => {
		try {
			const { data } = await api.get("/companies", {
				params: { searchParam: busca, status: situacao || undefined },
			});
			setCompanies(data.companies || []);
		} catch (err) {
			toastError(err);
		} finally {
			setLoading(false);
		}
	}, [busca, situacao]);

	useEffect(() => {
		setLoading(true);
		const espera = setTimeout(carregar, 400);
		return () => clearTimeout(espera);
	}, [carregar]);

	useEffect(() => {
		const socket = openSocket();
		// A lista traz resumo calculado no servidor (usuários, faturas
		// vencidas); aplicar o evento sobre o item local perderia esses
		// campos, então recarrega.
		socket.on("company", () => carregar());
		return () => socket.disconnect();
	}, [carregar]);

	const handleDeleteCompany = async companyId => {
		try {
			await api.delete(`/companies/${companyId}`);
			toast.success(i18n.t("companies.toasts.deleted"));
			carregar();
		} catch (err) {
			toastError(err);
		}
		setSelectedCompany(null);
	};

	const abrirFicha = company => history.push(`/companies/${company.id}`);

	return (
		<MainContainer>
			<ConfirmationModal
				title={
					selectedCompany &&
					`${i18n.t("companies.confirmationModal.deleteTitle")} ${
						selectedCompany.name
					}?`
				}
				open={confirmModalOpen}
				onClose={() => {
					setConfirmModalOpen(false);
					setSelectedCompany(null);
				}}
				danger
				confirmLabel={i18n.t("companies.confirmDelete")}
				onConfirm={() => handleDeleteCompany(selectedCompany.id)}
			>
				{i18n.t("companies.confirmationModal.deleteMessage")}
			</ConfirmationModal>

			<CompanyModal
				open={companyModalOpen}
				onClose={() => {
					setCompanyModalOpen(false);
					setSelectedCompany(null);
					carregar();
				}}
				companyId={selectedCompany?.id}
			/>

			<MainHeader>
				<Title>{i18n.t("companies.title")}</Title>
				<MainHeaderButtonsWrapper>
					<SearchField
						value={busca}
						onChange={e => setBusca(e.target.value)}
						onClear={() => setBusca("")}
						placeholder="Buscar por nome, CNPJ ou e-mail"
					/>
					<Button
						variant="contained"
						color="primary"
						startIcon={<Add />}
						onClick={() => {
							setSelectedCompany(null);
							setCompanyModalOpen(true);
						}}
					>
						{i18n.t("companies.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>

			<div className={classes.filtros}>
				<ToggleButtonGroup
					exclusive
					size="small"
					value={situacao}
					onChange={(_e, valor) => setSituacao(valor ?? "")}
				>
					{SITUACOES.map(s => (
						<ToggleButton key={s.valor || "todas"} value={s.valor}>
							{s.rotulo}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</div>

			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small" className={classes.tabela}>
					<TableHead>
						<TableRow>
							<TableCell>Empresa</TableCell>
							<TableCell>Plano</TableCell>
							<TableCell align="right">Mensalidade</TableCell>
							<TableCell align="center">Usuários</TableCell>
							<TableCell align="center">Cobrança</TableCell>
							<TableCell>Acesso</TableCell>
							<TableCell align="right">Ações</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{!loading && companies.length === 0 && (
							<TableRow>
								<TableCell colSpan={7} style={{ borderBottom: "none" }}>
									<EmptyState
										icon={busca || situacao ? SearchOffIcon : BusinessOutlinedIcon}
										title={
											busca || situacao
												? "Nada encontrado"
												: i18n.t("companies.empty.title")
										}
										description={
											busca || situacao
												? "Nenhuma empresa com esse filtro."
												: i18n.t("companies.empty.message")
										}
										action={
											!busca &&
											!situacao && (
												<Button
													variant="contained"
													color="primary"
													startIcon={<Add />}
													onClick={() => setCompanyModalOpen(true)}
												>
													{i18n.t("companies.buttons.add")}
												</Button>
											)
										}
									/>
								</TableCell>
							</TableRow>
						)}

						{companies.map(company => (
							<TableRow
								key={company.id}
								hover
								className={classes.linha}
								onClick={() => abrirFicha(company)}
							>
								<TableCell>
									<div className={classes.nome}>{company.name}</div>
									<Typography variant="caption" color="textSecondary">
										{company.document || "sem CNPJ"}
									</Typography>
								</TableCell>
								<TableCell>{PLANOS[company.plan] || company.plan}</TableCell>
								<TableCell align="right" className={classes.numero}>
									{moeda(company.monthlyFee)}
								</TableCell>
								<TableCell align="center" className={classes.numero}>
									{company.resumo?.usuarios ?? "—"}
								</TableCell>
								<TableCell align="center">
									{company.resumo?.faturasVencidas > 0 ? (
										<span className={classes.vencidas}>
											{company.resumo.faturasVencidas} vencida(s)
										</span>
									) : (
										<span className={classes.semDivida}>em dia</span>
									)}
								</TableCell>
								<TableCell>
									<SituacaoEmpresa company={company} />
								</TableCell>
								<TableCell
									align="right"
									// A linha inteira abre a ficha; os botões daqui fazem
									// outra coisa e não podem disparar isso junto.
									onClick={e => e.stopPropagation()}
								>
									<Tooltip title="Entrar na empresa" arrow>
										<IconButton
											size="small"
											aria-label="Entrar na empresa"
											onClick={() => entrarNaEmpresa(company)}
										>
											<LoginIcon fontSize="small" />
										</IconButton>
									</Tooltip>
									<Tooltip title={i18n.t("companies.actions.delete")} arrow>
										<IconButton
											size="small"
											aria-label={i18n.t("companies.actions.delete")}
											onClick={() => {
												setSelectedCompany(company);
												setConfirmModalOpen(true);
											}}
										>
											<DeleteOutline fontSize="small" />
										</IconButton>
									</Tooltip>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Paper>
		</MainContainer>
	);
};

export default Companies;
