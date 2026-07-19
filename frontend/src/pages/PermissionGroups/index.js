import React, { useEffect, useReducer, useState } from "react";

import openSocket from "../../services/socket-io";

import {
	Button,
	IconButton,
	makeStyles,
	Paper,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableRow,
} from "@material-ui/core";
import { DeleteOutline, Edit } from "@material-ui/icons";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";
import PermissionGroupModal from "../../components/PermissionGroupModal";

import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},
}));

const reducer = (state, action) => {
	if (action.type === "LOAD") {
		const groups = action.payload;
		const newGroups = [];

		groups.forEach(group => {
			const idx = state.findIndex(g => g.id === group.id);
			if (idx !== -1) {
				state[idx] = group;
			} else {
				newGroups.push(group);
			}
		});

		return [...state, ...newGroups];
	}

	if (action.type === "UPDATE") {
		const group = action.payload;
		const idx = state.findIndex(g => g.id === group.id);

		if (idx !== -1) {
			state[idx] = group;
			return [...state];
		}
		return [group, ...state];
	}

	if (action.type === "DELETE") {
		const groupId = action.payload;
		const idx = state.findIndex(g => g.id === groupId);
		if (idx !== -1) state.splice(idx, 1);
		return [...state];
	}

	if (action.type === "RESET") {
		return [];
	}
};

const PermissionGroups = () => {
	const classes = useStyles();

	const [groups, dispatch] = useReducer(reducer, []);
	const [loading, setLoading] = useState(false);
	const [modalOpen, setModalOpen] = useState(false);
	const [selectedGroup, setSelectedGroup] = useState(null);
	const [confirmModalOpen, setConfirmModalOpen] = useState(false);

	useEffect(() => {
		(async () => {
			setLoading(true);
			try {
				const { data } = await api.get("/permission-groups");
				dispatch({ type: "LOAD", payload: data });
				setLoading(false);
			} catch (err) {
				toastError(err);
				setLoading(false);
			}
		})();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		socket.on("permissionGroup", data => {
			if (data.action === "update" || data.action === "create") {
				dispatch({ type: "UPDATE", payload: data.permissionGroup });
			}
			if (data.action === "delete") {
				dispatch({ type: "DELETE", payload: +data.permissionGroupId });
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleOpenModal = () => {
		setSelectedGroup(null);
		setModalOpen(true);
	};

	const handleCloseModal = () => {
		setSelectedGroup(null);
		setModalOpen(false);
	};

	const handleEdit = group => {
		setSelectedGroup(group);
		setModalOpen(true);
	};

	const handleDelete = async groupId => {
		try {
			await api.delete(`/permission-groups/${groupId}`);
			toast.success(i18n.t("permissionGroups.toasts.deleted"));
		} catch (err) {
			toastError(err);
		}
		setSelectedGroup(null);
	};

	return (
		<MainContainer>
			<ConfirmationModal
				title={
					selectedGroup &&
					`${i18n.t("permissionGroups.confirmationModal.deleteTitle")} ${
						selectedGroup.name
					}?`
				}
				open={confirmModalOpen}
				onClose={() => setConfirmModalOpen(false)}
				onConfirm={() => handleDelete(selectedGroup.id)}
			>
				{i18n.t("permissionGroups.confirmationModal.deleteMessage")}
			</ConfirmationModal>
			<PermissionGroupModal
				open={modalOpen}
				onClose={handleCloseModal}
				permissionGroupId={selectedGroup?.id}
			/>
			<MainHeader>
				<Title>{i18n.t("permissionGroups.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Button variant="contained" color="primary" onClick={handleOpenModal}>
						{i18n.t("permissionGroups.buttons.add")}
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>
			<Paper className={classes.mainPaper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell align="center">
								{i18n.t("permissionGroups.table.name")}
							</TableCell>
							<TableCell align="center">
								{i18n.t("permissionGroups.table.actions")}
							</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						<>
							{groups.map(group => (
								<TableRow key={group.id}>
									<TableCell align="center">{group.name}</TableCell>
									<TableCell align="center">
										<IconButton size="small" onClick={() => handleEdit(group)}>
											<Edit />
										</IconButton>
										<IconButton
											size="small"
											onClick={() => {
												setSelectedGroup(group);
												setConfirmModalOpen(true);
											}}
										>
											<DeleteOutline />
										</IconButton>
									</TableCell>
								</TableRow>
							))}
							{loading && <TableRowSkeleton columns={2} />}
						</>
					</TableBody>
				</Table>
			</Paper>
		</MainContainer>
	);
};

export default PermissionGroups;
