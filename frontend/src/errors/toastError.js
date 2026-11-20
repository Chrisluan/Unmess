import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { avisarConflito } from "../components/ConflitoDeConfiguracao";

const toastError = err => {
	const errorMsg = err.response?.data?.message || err.response?.data?.error;

	// Configuração recusada por deixar outra sem efeito: em vez de um aviso de
	// canto, abre a janela que lista o que falta e leva até onde se resolve.
	const problemas = err.response?.data?.detalhes?.problemas;
	if (errorMsg === "ERR_CONFIGURACAO_INCONSISTENTE" && Array.isArray(problemas)) {
		avisarConflito(problemas);
		return;
	}

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
