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
 *
 * Sem `noopener` na lista de features: por especificação, `window.open` com
 * `noopener` devolve `null` mesmo quando a aba abre normalmente. Era isso que
 * disparava o aviso de popup bloqueado em toda emissão. O vínculo com a aba
 * nova é cortado depois, com `janela.opener = null`, que tem o mesmo efeito e
 * ainda deixa escrever nela.
 */
const abrirOrdemDeServico = async (dealId) => {
  const janela = window.open("", "_blank");

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

    try {
      janela.opener = null;
    } catch {
      // Navegador que não deixa mexer no opener depois de navegar. A aba já
      // está com o documento certo; não vale derrubar a emissão por isso.
    }

    // Só depois de a aba assumir o blob é que ele pode ser liberado; revogar na
    // hora deixaria a janela em branco.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    janela.close();
    throw err;
  }
};

export default abrirOrdemDeServico;
