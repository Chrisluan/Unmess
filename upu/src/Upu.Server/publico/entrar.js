/**
 * Portaria do UPU.
 *
 * Duas telas no mesmo lugar: definir a senha, na primeira execução da
 * instalação, e entrar em todas as outras. A diferença vem do servidor, não de
 * uma rota separada — assim não existe um caminho "definir senha" acessível
 * depois que já há uma.
 */
(function () {
  "use strict";

  var formulario = document.getElementById("formulario");
  var campoSenha = document.getElementById("senha");
  var rotulo = document.getElementById("rotulo-senha");
  var ajuda = document.getElementById("ajuda-senha");
  var recado = document.getElementById("recado");
  var enviar = document.getElementById("enviar");

  var primeiraVez = false;

  function mostrar(texto, tipo) {
    recado.textContent = texto || "";
    recado.className = "recado " + (tipo || "");
  }

  fetch("/api/situacao")
    .then(function (r) { return r.json(); })
    .then(function (situacao) {
      if (situacao.autenticado) {
        location.href = "/";
        return;
      }

      primeiraVez = !situacao.senhaDefinida;

      if (primeiraVez) {
        rotulo.textContent = "Crie a senha do painel";
        campoSenha.autocomplete = "new-password";
        enviar.textContent = "Definir senha";
        ajuda.textContent =
          "Pelo menos 8 caracteres. Ela protege o botão que troca a produção " +
          "inteira — trocá-la depois exige acesso ao arquivo de configuração na máquina.";
      }
    });

  formulario.addEventListener("submit", function (evento) {
    evento.preventDefault();

    var senha = campoSenha.value;
    if (!senha) return;

    enviar.disabled = true;
    mostrar("");

    fetch(primeiraVez ? "/api/definir-senha" : "/api/entrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: senha })
    })
      .then(function (resposta) {
        return resposta.json().then(function (corpo) {
          return { ok: resposta.ok, corpo: corpo };
        });
      })
      .then(function (resultado) {
        enviar.disabled = false;

        if (!resultado.ok) {
          mostrar(resultado.corpo.erro || "não deu certo", "erro");
          campoSenha.select();
          return;
        }

        if (primeiraVez) {
          // Definir a senha não entra: quem acabou de criar precisa usá-la uma
          // vez, o que confirma que foi digitada como se pretendia.
          primeiraVez = false;
          rotulo.textContent = "Senha";
          enviar.textContent = "Entrar";
          ajuda.textContent = "";
          campoSenha.value = "";
          campoSenha.focus();
          mostrar("Senha criada. Entre com ela.", "ok");
          return;
        }

        location.href = "/";
      })
      .catch(function () {
        enviar.disabled = false;
        mostrar("o UPU não respondeu", "erro");
      });
  });
})();
