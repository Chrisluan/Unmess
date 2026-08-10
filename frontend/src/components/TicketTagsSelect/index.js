import React, { useCallback, useEffect, useState } from "react";

import Chip from "@mui/material/Chip";
import Autocomplete from '@mui/material/Autocomplete';
import TextField from "@mui/material/TextField";
import makeStyles from '@mui/styles/makeStyles';

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
	root: {
		padding: theme.spacing(1, 2),
	},
}));

/**
 * Etiquetas aplicadas ao chat. Salva na hora que muda — não tem botão de
 * confirmar porque etiquetar é ação de fluxo, não de formulário.
 */
const TicketTagsSelect = ({ ticket, disabled }) => {
	const classes = useStyles();
	const [available, setAvailable] = useState([]);
	const [selected, setSelected] = useState([]);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		setSelected(ticket?.tags ?? []);
	}, [ticket?.id, ticket?.tags]);

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
				tagIds: value.map(tag => tag.id),
			});
		} catch (err) {
			setSelected(previous);
			toastError(err);
		} finally {
			setSaving(false);
		}
	};

	if (available.length === 0 && selected.length === 0) return null;

	return (
        <div className={classes.root}>
            <Autocomplete
				multiple
				size="small"
				disabled={disabled || saving}
				options={available}
				value={selected}
				getOptionLabel={option => option.name}
				isOptionEqualToValue={(option, value) => option.id === value.id}
				onChange={handleChange}
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
				renderInput={params => (
					<TextField
						{...params}
						variant="outlined"
						placeholder={
							selected.length === 0 ? i18n.t("ticketTags.placeholder") : ""
						}
					/>
				)}
			/>
        </div>
    );
};

export default TicketTagsSelect;
