import React, { useCallback, useEffect, useRef, useState } from "react";

import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import makeStyles from "@mui/styles/makeStyles";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
	root: {
		display: "flex",
		alignItems: "center",
		flexWrap: "wrap",
		gap: theme.spacing(0.5),
		padding: theme.spacing(0.5, 1.5),
		borderBottom: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.palette.background.paper,
	},

	// O campo aberto ocupa a faixa inteira; fechado, sobra só o que existe.
	editor: {
		flex: 1,
		minWidth: 240,
	},

	adicionar: {
		color: theme.palette.text.secondary,
		fontWeight: 500,
	},
}));

/**
 * Etiquetas aplicadas à conversa.
 *
 * Era um campo de busca de largura inteira, montado abaixo do cabeçalho em
 * toda conversa aberta — inclusive nas que não têm etiqueta nenhuma, que é a
 * maioria. Uma faixa permanente de 48px na tela onde o conteúdo principal é
 * o histórico da conversa, gasta com uma ação secundária.
 *
 * Agora a faixa mostra o que existe: as etiquetas aplicadas, ou um botão
 * discreto quando não há nenhuma. O campo de busca só aparece enquanto se
 * está etiquetando, e some ao terminar.
 *
 * Salva na hora que muda — etiquetar é ação de fluxo, não de formulário —, e
 * o chip aparecendo na faixa é o retorno. Se o servidor recusar, a lista
 * volta ao que era e o erro aparece.
 */
const TicketTagsSelect = ({ ticket, disabled }) => {
	const classes = useStyles();
	const [available, setAvailable] = useState([]);
	const [selected, setSelected] = useState([]);
	const [saving, setSaving] = useState(false);
	const [editando, setEditando] = useState(false);
	const campoRef = useRef();

	useEffect(() => {
		setSelected(ticket?.tags ?? []);
	}, [ticket?.id, ticket?.tags]);

	// Trocar de conversa fecha o editor: a etiqueta pertence à conversa que
	// estava aberta, não à próxima.
	useEffect(() => {
		setEditando(false);
	}, [ticket?.id]);

	const fetchTags = useCallback(async () => {
		try {
			const { data } = await api.get("/tags");
			setAvailable(data || []);
		} catch {
			// Sem permissão de ver etiquetas: o componente simplesmente não
			// oferece opções, sem poluir a tela com erro.
			setAvailable([]);
		}
	}, []);

	useEffect(() => {
		fetchTags();
	}, [fetchTags]);

	const handleChange = async (_, value) => {
		const previous = selected;
		setSelected(value);
		setSaving(true);
		try {
			await api.put(`/tickets/${ticket.id}/tags`, {
				tagIds: value.map((tag) => tag.id),
			});
		} catch (err) {
			setSelected(previous);
			toastError(err);
		} finally {
			setSaving(false);
		}
	};

	const abrirEditor = () => {
		setEditando(true);
		// O foco entra no campo assim que ele existe, senão o clique abre a
		// caixa e obriga um segundo clique para digitar.
		setTimeout(() => campoRef.current?.focus(), 0);
	};

	// Sem etiquetas cadastradas e sem nenhuma aplicada, a faixa não tem o que
	// mostrar nem o que oferecer.
	if (available.length === 0 && selected.length === 0) return null;

	if (editando && !disabled) {
		return (
			<div className={classes.root}>
				<Autocomplete
					className={classes.editor}
					multiple
					openOnFocus
					size="small"
					disabled={saving}
					options={available}
					value={selected}
					getOptionLabel={(option) => option.name}
					isOptionEqualToValue={(option, value) => option.id === value.id}
					onChange={handleChange}
					onBlur={() => setEditando(false)}
					renderTags={(value, getTagProps) =>
						value.map((option, index) => (
							<Chip
								{...getTagProps({ index })}
								key={option.id}
								size="small"
								label={option.name}
								style={{ backgroundColor: option.color, color: "#fff" }}
							/>
						))
					}
					renderInput={(params) => (
						<TextField
							{...params}
							inputRef={campoRef}
							variant="outlined"
							placeholder={i18n.t("ticketTags.placeholder")}
						/>
					)}
				/>
				<Button size="small" onClick={() => setEditando(false)}>
					{i18n.t("ticketTags.done")}
				</Button>
			</div>
		);
	}

	return (
		<div className={classes.root}>
			{selected.map((tag) => (
				<Chip
					key={tag.id}
					size="small"
					label={tag.name}
					style={{ backgroundColor: tag.color, color: "#fff" }}
				/>
			))}

			{!disabled &&
				(selected.length === 0 ? (
					<Button
						size="small"
						className={classes.adicionar}
						startIcon={<LocalOfferOutlinedIcon fontSize="small" />}
						onClick={abrirEditor}
					>
						{i18n.t("ticketTags.add")}
					</Button>
				) : (
					<Tooltip title={i18n.t("ticketTags.edit")} arrow>
						<IconButton
							size="small"
							aria-label={i18n.t("ticketTags.edit")}
							onClick={abrirEditor}
						>
							<EditOutlinedIcon fontSize="small" />
						</IconButton>
					</Tooltip>
				))}
		</div>
	);
};

export default TicketTagsSelect;
