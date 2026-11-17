import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";

const toastError = err => {
	const errorMsg = err.response?.data?.message || err.response?.data?.error;
	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
			});
		} else {
			toast.error(errorMsg, {
				toastId: errorMsg,
			});
		}
	} else if (!err.response && err.message) {
		// Erro que não veio de uma resposta HTTP -- popup bloqueado, rede fora,
		// arquivo grande demais. A mensagem local é a única explicação que existe,
		// e engoli-la deixava o usuário com "An error occurred!" sem saber o motivo.
		toast.error(err.message, { toastId: err.message });
	} else {
		toast.error(i18n.t("errors.generic"));
	}
};

export default toastError;
