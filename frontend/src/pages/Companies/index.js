import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
    Button,
    Chip,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from "@mui/material";

import makeStyles from '@mui/styles/makeStyles';

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";
import { DeleteOutline, Edit } from "@mui/icons-material";
import CompanyModal from "../../components/CompanyModal";
import { toast } from "react-toastify";
import ConfirmationModal from "../../components/ConfirmationModal";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD_COMPANIES") {
		const companies = action.payload;
		const newCompanies = [];

		companies.forEach(company => {
			const companyIndex = state.findIndex(c => c.id === company.id);
			if (companyIndex !== -1) {
				state[companyIndex] = company;
			} else {
				newCompanies.push(company);
			}
		});

		return [...state, ...newCompanies];
	}

	if (action.type === "UPDATE_COMPANIES") {
		const company = action.payload;
		const companyIndex = state.findIndex(c => c.id === company.id);

		if (companyIndex !== -1) {
			state[companyIndex] = company;
			return [...state];
		} else {
			return [company, ...state];
		}
	}

	if (action.type === "DELETE_COMPANY") {
		const companyId = action.payload;
		const companyIndex = state.findIndex(c => c.id === companyId);
		if (companyIndex !== -1) {
			state.splice(companyIndex, 1);
		}
		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

const statusColors = {
	active: "primary",
	suspended: "default",
	canceled: "secondary",
};

const Companies = () => {
	const classes = useStyles();

	const [companies, dispatch] = useReducer(reducer, []);
	const [loading, setLoading] = useState(false);

	const [companyModalOpen, setCompanyModalOpen] = useState(false);
	const [selectedCompany, setSelectedCompany] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const { data } = await api.get("/companies");
				dispatch({ type: "LOAD_COMPANIES", payload: data.companies });

				setLoading(false);
			} catch (err) {
				toastError(err);
				setLoading(false);
			}
		})();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("company", data => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE_COMPANIES", payload: data.company });
			}

			if (data.action === "delete") {
				dispatch({ type: "DELETE_COMPANY", payload: data.companyId });
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleOpenCompanyModal = () => {
		setCompanyModalOpen(true);
		setSelectedCompany(null);
	};

	const handleCloseCompanyModal = () => {
		setCompanyModalOpen(false);
		setSelectedCompany(null);
	};

	const handleEditCompany = company => {
		setSelectedCompany(company);
		setCompanyModalOpen(true);
	};

	const handleCloseConfirmationModal = () => {
		setConfirmModalOpen(false);
		setSelectedCompany(null);
	};

	const handleDeleteCompany = async companyId => {
		try {
			await api.delete(`/companies/${companyId}`);
			toast.success(i18n.t("companies.toasts.deleted"));
		} catch (err) {
			toastError(err);
		}
		setSelectedCompany(null);
	};

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
				onClose={handleCloseConfirmationModal}
				onConfirm={() => handleDeleteCompany(selectedCompany.id)}
			>
				{i18n.t("companies.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<CompanyModal
				open={companyModalOpen}
				onClose={handleCloseCompanyModal}
				companyId={selectedCompany?.id}
			/>
			<MainHeader>
				<Title>{i18n.t("companies.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenCompanyModal}
					>
						{i18n.t("companies.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell align="center">
								{i18n.t("companies.table.name")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("companies.table.document")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("companies.table.email")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("companies.table.plan")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("companies.table.status")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("companies.table.actions")}
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						<>
							{companies.map(company => (
								<TableRow key={company.id}>
									<TableCell align="center">{company.name}</TableCell>
									<TableCell align="center">{company.document}</TableCell>
									<TableCell align="center">{company.email}</TableCell>
									<TableCell align="center">{company.plan}</TableCell>
									<TableCell align="center">
										<Chip
											label={i18n.t(`companies.status.${company.status}`)}
											color={statusColors[company.status] || "default"}
											size="small"
										/>
									</TableCell>
									<TableCell align="center">
										<IconButton
											size="small"
											onClick={() => handleEditCompany(company)}
										>
											<Edit />
										</IconButton>

										<IconButton
											size="small"
											onClick={() => {
												setSelectedCompany(company);
												setConfirmModalOpen(true);
											}}
										>
											<DeleteOutline />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
							{loading && <TableRowSkeleton columns={6} />}
						</>
					</TableBody>
				</Table>
			</Paper>
		</MainContainer>
	);
};

export default Companies;
