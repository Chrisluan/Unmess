import api from "../services/api";

/**
 * Abre a ordem de serviço em aba nova.
 *
 * A página vem da API, que exige o token no cabeçalho. Um `window.open` na URL
 * do backend não carrega cabeçalho nenhum -- o backend respondia
 * `{"error":"ERR_SESSION_EXPIRED"}` em vez do documento, e era isso que
 * aparecia na aba ao emitir.
 *
 * A janela abre vazia **antes** da chamada: depois de um `await` o navegador
 * trata o `window.open` como popup não solicitado e bloqueia. O HTML chega
 * autenticado e vira um blob, para a aba ter uma URL própria -- o
 * "Imprimir / Salvar PDF" do documento depende disso.
 */
const abrirOrdemDeServico = async (dealId) => {
  const janela = window.open("", "_blank", "noopener");

  if (!janela) {
    throw new Error(
      "O navegador bloqueou a janela da ordem de serviço. Libere os pop-ups deste endereço e tente de novo."
    );
  }

  janela.document.write(
    "<p style='font:14px system-ui;padding:24px'>Gerando ordem de serviço...</p>"
  );

  try {
    const { data } = await api.get(`/deals/${dealId}/ordem-servico`, {
      responseType: "text",
    });

    const url = URL.createObjectURL(
      new Blob([data], { type: "text/html;charset=utf-8" })
    );

    janela.location.replace(url);

    // Só depois de a aba assumir o blob é que ele pode ser liberado; revogar na
    // hora deixaria a janela em branco.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    janela.close();
    throw err;
  }
};

export default abrirOrdemDeServico;
