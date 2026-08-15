// Tela de login. O cabeçalho X-Painel acompanha o POST porque o servidor
// recusa qualquer escrita sem ele — é a barreira contra CSRF.
const formulario = document.getElementById("formulario");
const campoSenha = document.getElementById("senha");
const aviso = document.getElementById("erro");
const botao = document.getElementById("botao");

formulario.addEventListener("submit", async evento => {
  evento.preventDefault();
  aviso.textContent = "";
  botao.disabled = true;
  botao.textContent = "Entrando…";

  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Painel": "1" },
      body: JSON.stringify({ senha: campoSenha.value })
    });

    const dados = await resposta.json().catch(() => ({}));

    if (resposta.ok) {
      window.location.href = "/";
      return;
    }

    aviso.textContent = dados.erro || "Não foi possível entrar.";
    campoSenha.value = "";
    campoSenha.focus();
  } catch (erro) {
    aviso.textContent = `Falha de conexão com o painel: ${erro.message}`;
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});
