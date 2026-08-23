/**
 * Painel do UPU.
 *
 * Sem framework, pelo mesmo motivo do painel de operação: esta tela precisa
 * abrir numa máquina que está com a CPU tomada por um build, e um bundle de
 * meio mega competindo com o `vite build` é exatamente o que não se quer no
 * momento em que se está olhando para o deploy.
 *
 * A tela tem uma regra: nada que mude a produção acontece sem passar pelo
 * formulário. Os botões de agendar e aplicar mandam o servidor validar de novo,
 * e o servidor recusa — o painel só mostra bonito o que o UPU já garante.
 */
(function () {
  "use strict";

  var estado = { releases: [], atual: null, configuracao: null, commits: [], branch: null };

  // ------------------------------------------------------------- utilidades

  function $(id) { return document.getElementById(id); }

  function pedir(url, opcoes) {
    opcoes = opcoes || {};

    if (opcoes.corpo !== undefined) {
      opcoes.method = opcoes.method || "POST";
      opcoes.headers = { "Content-Type": "application/json" };
      opcoes.body = JSON.stringify(opcoes.corpo);
      delete opcoes.corpo;
    }

    return fetch(url, opcoes).then(function (resposta) {
      if (resposta.status === 401) {
        location.href = "/entrar.html";
        throw new Error("sessão expirada");
      }

      return resposta.text().then(function (texto) {
        var corpo = texto ? JSON.parse(texto) : null;
        return { ok: resposta.ok, status: resposta.status, corpo: corpo };
      });
    });
  }

  function recado(texto, tipo) {
    var caixa = $("recado");
    caixa.textContent = texto || "";
    caixa.className = "recado " + (tipo || "");

    if (texto && tipo === "ok") {
      setTimeout(function () {
        if (caixa.textContent === texto) recado("");
      }, 6000);
    }
  }

  function hora(valor) {
    if (!valor) return "—";
    var d = new Date(valor);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }

  function selo(texto, tipo) {
    return '<span class="selo ' + tipo + '">' + texto + "</span>";
  }

  var SELO_POR_ESTADO = {
    rascunho: "neutro",
    agendada: "acento",
    avisando: "alerta",
    aplicando: "alerta",
    concluida: "ok",
    falhou: "erro",
    revertida: "alerta",
    cancelada: "neutro"
  };

  // ---------------------------------------------------------------- estado

  function carregarEstado() {
    return pedir("/api/estado").then(function (r) {
      if (!r.ok) return;

      var e = r.corpo;

      $("linha-versao").textContent = e.versaoNoAr
        ? "versão " + e.versaoNoAr + " no ar" +
          (e.releaseNoAr ? " — " + e.releaseNoAr.titulo : "")
        : "nenhuma versão registrada ainda";

      $("momento").textContent = new Date().toLocaleTimeString("pt-BR");

      var cartoes = e.servicos.map(function (s) {
        var situacao = s.respondendo
          ? selo("respondendo", "ok")
          : s.rodando
            ? selo("de pé, mas mudo", "alerta")
            : selo(s.estado, "erro");

        return '<div class="cartao"><div class="rotulo">' + s.rotulo +
          '</div><div class="valor">' + situacao +
          '</div><div class="discreta mono">' + s.servico +
          (s.porta ? " · porta " + s.porta : "") + "</div></div>";
      });

      if (e.emAndamento) {
        cartoes.unshift(
          '<div class="cartao"><div class="rotulo">Aplicando agora</div>' +
          '<div class="valor">' + e.emAndamento.versao + "</div>" +
          '<div class="discreta">' + e.emAndamento.titulo + "</div></div>");
      } else if (e.proximaAgendada) {
        cartoes.unshift(
          '<div class="cartao"><div class="rotulo">Próxima atualização</div>' +
          '<div class="valor">' + hora(e.proximaAgendada.janela) + "</div>" +
          '<div class="discreta">' + e.proximaAgendada.versao + " — " +
          e.proximaAgendada.titulo + "</div></div>");
      }

      $("cartoes").innerHTML = cartoes.join("");

      var git = e.git;
      if (git.erro) {
        $("linha-git").textContent = "git: " + git.erro;
      } else {
        var sujeira = git.pendentes && git.pendentes.length
          ? " · " + git.pendentes.length +
            " alteração(ões) não commitada(s) — a atualização vai se recusar a rodar"
          : "";

        $("linha-git").textContent =
          "branch " + git.branchAtual + " · " + git.resumo + sujeira;
      }

      $("estado-push").textContent = e.pushLigado
        ? e.inscritos + " navegador(es) inscrito(s) para notificação"
        : "notificação do navegador desligada (sem chave VAPID)";
    });
  }

  // ---------------------------------------------------------------- branch

  function verBranch() {
    $("branch").innerHTML = '<div class="item"><div class="corpo">consultando o GitHub…</div></div>';

    return pedir("/api/branch").then(function (r) {
      if (!r.ok) {
        $("branch").innerHTML =
          '<div class="item"><div class="corpo">' +
          (r.corpo && r.corpo.erro ? r.corpo.erro : "não consegui falar com o GitHub") +
          "</div></div>";
        return;
      }

      estado.branch = r.corpo;
      estado.commits = r.corpo.commits || [];

      if (r.corpo.atualizado) {
        $("branch").innerHTML =
          '<div class="item"><div class="corpo">A instalação já está no commit da ponta de ' +
          r.corpo.branch + ". Nada a aplicar.</div></div>";
        return;
      }

      var linhas = estado.commits.map(function (c) {
        return '<div class="item"><div class="corpo"><div class="titulo">' +
          c.assunto + '</div><div class="discreta mono">' + c.curto + " · " +
          c.autor + " · " + hora(c.data) + "</div></div></div>";
      });

      linhas.push(
        '<div class="item"><div class="corpo">' +
        estado.commits.length + " commit(s) esperando release." +
        '</div><div class="acoes"><button class="principal" id="preparar">' +
        "Preparar atualização</button></div></div>");

      $("branch").innerHTML = linhas.join("");

      var botao = $("preparar");
      if (botao) botao.onclick = function () { abrirFormulario(null); };
    });
  }

  // -------------------------------------------------------------- releases

  function carregarReleases() {
    return pedir("/api/releases").then(function (r) {
      if (!r.ok) return;

      estado.releases = r.corpo || [];

      if (estado.releases.length === 0) {
        $("releases").innerHTML =
          '<div class="item"><div class="corpo">Nenhuma atualização registrada ainda.</div></div>';
        return;
      }

      $("releases").innerHTML = estado.releases.map(function (release) {
        var tipoDoSelo = SELO_POR_ESTADO[release.estado] || "neutro";

        var falha = release.falha
          ? '<div class="discreta">' + release.falha + "</div>"
          : "";

        var quando = release.janela
          ? "programada para " + hora(release.janela)
          : release.concluidaEm
            ? "aplicada em " + hora(release.concluidaEm)
            : "criada em " + hora(release.criadaEm);

        return '<div class="item clicavel" data-id="' + release.id + '">' +
          '<div class="corpo"><div class="titulo">' +
          (release.versao || "sem versão") + " — " + (release.titulo || "sem título") +
          "</div>" +
          '<div class="discreta">' + quando +
          (release.responsavel ? " · " + release.responsavel : "") + "</div>" +
          falha + "</div>" +
          '<div class="acoes">' + selo(release.estado, tipoDoSelo) + "</div></div>";
      }).join("");

      Array.prototype.forEach.call($("releases").querySelectorAll(".item"), function (item) {
        item.onclick = function () {
          var id = item.getAttribute("data-id");
          var release = estado.releases.filter(function (r) { return r.id === id; })[0];
          if (release) abrirFormulario(release);
        };
      });
    });
  }

  // ------------------------------------------------------------ formulário

  function abrirFormulario(release) {
    estado.atual = release ? JSON.parse(JSON.stringify(release)) : null;

    var cfg = estado.configuracao || {};
    var r = estado.atual || {
      avisoPrevioMinutos: cfg.avisoPrevioPadraoMinutos || 30,
      commitAlvo: estado.branch ? estado.branch.commitRemoto : ""
    };

    $("area-formulario").hidden = false;
    $("titulo-formulario").textContent = estado.atual
      ? "Atualização " + (r.versao || "sem versão")
      : "Nova atualização";

    $("versao").value = r.versao || "";
    $("tipo").value = r.tipo || "";
    $("titulo").value = r.titulo || "";
    $("resumo").value = r.resumoParaUsuarios || "";
    $("alteracoes").value = (r.alteracoes || []).join("\n");
    $("impacto").value = r.impacto || "";
    $("duracao").value = r.duracaoEstimadaMinutos || "";
    $("responsavel").value = r.responsavel || "";
    $("plano").value = r.planoDeVolta || "";
    $("testado").checked = !!r.testadoEmDesenvolvimento;
    $("forcar").checked = !!r.forcar;
    $("aviso").value = r.avisoPrevioMinutos != null ? r.avisoPrevioMinutos : 30;

    $("janela").value = r.janela ? paraCampoLocal(r.janela) : "";

    preencherCommits(r.commitAlvo);
    ajustarDuracao();
    limparErros();

    var editavel = !estado.atual ||
      estado.atual.estado === "rascunho" ||
      estado.atual.estado === "agendada";

    $("salvar").disabled = !editavel;
    $("agendar").disabled = !editavel;
    $("aplicar").disabled = estado.atual && estado.atual.estado === "aplicando";

    $("cancelar-release").hidden = !(estado.atual &&
      (estado.atual.estado === "agendada" || estado.atual.estado === "avisando"));

    mostrarPassos();

    $("area-formulario").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function paraCampoLocal(iso) {
    var d = new Date(iso);
    var pad = function (n) { return String(n).padStart(2, "0"); };

    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function preencherCommits(escolhido) {
    var opcoes = [];

    if (estado.branch) {
      $("commit-atual").textContent =
        "no ar: " + (estado.branch.commitAtual || "").slice(0, 8) +
        " · ponta de " + estado.branch.branch + ": " +
        (estado.branch.commitRemoto || "").slice(0, 8);

      if (estado.branch.commitRemoto) {
        opcoes.push({
          valor: estado.branch.commitRemoto,
          texto: "ponta da branch — " + estado.branch.commitRemoto.slice(0, 8)
        });
      }
    } else {
      $("commit-atual").textContent =
        'clique em "Ver o que há de novo" para listar os commits';
    }

    estado.commits.forEach(function (c) {
      if (c.sha === (estado.branch && estado.branch.commitRemoto)) return;
      opcoes.push({ valor: c.sha, texto: c.curto + " — " + c.assunto });
    });

    if (escolhido && !opcoes.some(function (o) { return o.valor === escolhido; })) {
      opcoes.unshift({ valor: escolhido, texto: escolhido.slice(0, 8) + " (já escolhido)" });
    }

    $("commit").innerHTML = opcoes.length
      ? opcoes.map(function (o) {
          return '<option value="' + o.valor + '">' + o.texto + "</option>";
        }).join("")
      : '<option value="">nenhum commit listado</option>';

    if (escolhido) $("commit").value = escolhido;
  }

  function ajustarDuracao() {
    $("area-duracao").hidden = $("impacto").value !== "interrupcao";
  }

  function coletar() {
    var janela = $("janela").value;

    return {
      id: estado.atual ? estado.atual.id : null,
      versao: $("versao").value,
      titulo: $("titulo").value,
      tipo: $("tipo").value || null,
      resumoParaUsuarios: $("resumo").value,
      alteracoes: $("alteracoes").value.split("\n"),
      impacto: $("impacto").value || null,
      duracaoEstimadaMinutos: $("duracao").value ? Number($("duracao").value) : null,
      responsavel: $("responsavel").value,
      commitAlvo: $("commit").value,
      planoDeVolta: $("plano").value,
      testadoEmDesenvolvimento: $("testado").checked,
      forcar: $("forcar").checked,
      // O campo datetime-local devolve hora local sem fuso; deixar o navegador
      // montar o Date evita gravar 03:00 UTC quando se quis 03:00 daqui.
      janela: janela ? new Date(janela).toISOString() : null,
      avisoPrevioMinutos: Number($("aviso").value || 0),
      criadaPor: $("responsavel").value
    };
  }

  function limparErros() {
    Array.prototype.forEach.call(document.querySelectorAll(".campo"), function (campo) {
      campo.classList.remove("errado");
      var erro = campo.querySelector(".erro");
      if (erro) erro.remove();
    });
  }

  function marcarErros(erros) {
    limparErros();

    (erros || []).forEach(function (erro) {
      var campo = document.querySelector('[data-campo="' + erro.campo + '"]');
      if (!campo) return;

      campo.classList.add("errado");

      var linha = document.createElement("div");
      linha.className = "erro";
      linha.textContent = erro.mensagem;
      campo.appendChild(linha);
    });

    if (erros && erros.length) {
      recado("Faltam " + erros.length + " campo(s) obrigatório(s).", "erro");
      var primeiro = document.querySelector(".campo.errado");
      if (primeiro) primeiro.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function salvar() {
    return pedir("/api/releases", { corpo: coletar() }).then(function (r) {
      if (!r.ok) {
        recado((r.corpo && r.corpo.erro) || "não consegui salvar", "erro");
        return null;
      }

      estado.atual = r.corpo.release;
      marcarErros(r.corpo.erros);

      if (!r.corpo.erros.length) recado("Salvo. Os campos estão completos.", "ok");

      carregarReleases();
      return r.corpo;
    });
  }

  function mostrarPassos() {
    var antigo = document.getElementById("passos");
    if (antigo) antigo.remove();

    if (!estado.atual || !estado.atual.passos || !estado.atual.passos.length) return;

    var caixa = document.createElement("div");
    caixa.className = "passos";
    caixa.id = "passos";

    caixa.innerHTML = estado.atual.passos.map(function (passo) {
      var classe = passo.terminadoEm ? (passo.sucesso ? "ok" : "falhou") : "rodando";
      var marca = passo.terminadoEm ? (passo.sucesso ? "✓" : "✗") : "→";

      return '<div class="passo ' + classe + '"><span class="marca">' + marca +
        "</span><span>" + passo.nome + '</span><span class="detalhe">' +
        (passo.detalhe || "") + "</span></div>";
    }).join("");

    $("formulario").appendChild(caixa);
  }

  // ---------------------------------------------------------------- avisos

  function carregarAvisos() {
    return pedir("/api/avisos").then(function (r) {
      if (!r.ok) return;

      var avisos = r.corpo || [];

      if (avisos.length === 0) {
        $("avisos").innerHTML =
          '<div class="item"><div class="corpo">Nenhum aviso na tela dos usuários agora.</div></div>';
        return;
      }

      $("avisos").innerHTML = avisos.map(function (a) {
        return '<div class="item"><div class="corpo"><div class="titulo">' + a.titulo +
          '</div><div class="discreta">' + a.mensagem + "</div>" +
          '<div class="discreta mono">' + a.tipo + " · " + a.severidade +
          (a.expiraEm ? " · some em " + hora(a.expiraEm) : " · sem prazo") + "</div></div>" +
          '<div class="acoes"><button class="perigo" data-aviso="' + a.id +
          '">Tirar da tela</button></div></div>';
      }).join("");

      Array.prototype.forEach.call($("avisos").querySelectorAll("[data-aviso]"), function (botao) {
        botao.onclick = function () {
          pedir("/api/avisos/" + botao.getAttribute("data-aviso"), { method: "DELETE" })
            .then(carregarAvisos);
        };
      });
    });
  }

  /**
   * Formulário do aviso avulso, montado sob demanda.
   *
   * É o canal para tudo que não é atualização — promoção, recado de
   * configuração, manutenção que não passa pelo UPU — e cai no mesmo lugar da
   * tela do usuário, que é o ponto: um lugar só para olhar.
   */
  function abrirFormularioDeAviso() {
    var existente = document.getElementById("form-aviso");
    if (existente) { existente.remove(); return; }

    var form = document.createElement("form");
    form.className = "release";
    form.id = "form-aviso";

    form.innerHTML =
      '<div class="linha">' +
      '<div class="campo"><label>Tipo</label><select id="av-tipo">' +
      '<option value="geral">Geral</option>' +
      '<option value="promocional">Promocional</option>' +
      '<option value="configuracao">Configuração</option>' +
      '<option value="manutencao">Manutenção</option>' +
      '<option value="conversa">Conversa</option></select></div>' +
      '<div class="campo"><label>Severidade</label><select id="av-severidade">' +
      '<option value="informacao">Informação</option>' +
      '<option value="sucesso">Sucesso</option>' +
      '<option value="atencao">Atenção</option>' +
      '<option value="critico">Crítico</option></select></div></div>' +
      '<div class="campo"><label>Título</label><input type="text" id="av-titulo" /></div>' +
      '<div class="campo"><label>Mensagem</label><textarea id="av-mensagem"></textarea></div>' +
      '<div class="linha">' +
      '<div class="campo"><label>Some depois de (minutos)</label>' +
      '<input type="number" id="av-expira" min="0" placeholder="vazio = sem prazo" /></div>' +
      '<div class="campo"><label>Link (opcional)</label><input type="text" id="av-link" /></div></div>' +
      '<div class="campo"><label class="caixa-marcavel">' +
      '<input type="checkbox" id="av-dispensavel" checked /><span>O usuário pode fechar</span></label></div>' +
      '<div class="campo"><label class="caixa-marcavel">' +
      '<input type="checkbox" id="av-notificar" checked /><span>Também como notificação do navegador</span></label></div>' +
      '<div class="rodape-do-form"><button type="button" class="principal" id="av-publicar">Publicar</button>' +
      '<button type="button" class="discreto" id="av-fechar">Fechar</button></div>';

    $("avisos").parentNode.insertBefore(form, $("avisos"));

    $("av-fechar").onclick = function () { form.remove(); };

    $("av-publicar").onclick = function () {
      pedir("/api/avisos", {
        corpo: {
          tipo: $("av-tipo").value,
          severidade: $("av-severidade").value,
          titulo: $("av-titulo").value,
          mensagem: $("av-mensagem").value,
          link: $("av-link").value || null,
          dispensavel: $("av-dispensavel").checked,
          notificarNavegador: $("av-notificar").checked,
          expiraEmMinutos: $("av-expira").value ? Number($("av-expira").value) : null
        }
      }).then(function (r) {
        if (!r.ok) {
          recado((r.corpo && r.corpo.erro) || "não consegui publicar", "erro");
          return;
        }

        form.remove();
        recado("Aviso publicado na tela dos usuários.", "ok");
        carregarAvisos();
      });
    };
  }

  // ---------------------------------------------------------------- diário

  function ligarDiario() {
    var caixa = $("diario");

    var fonte = new EventSource("/api/diario/ao-vivo");

    fonte.onmessage = function (evento) {
      var linha = JSON.parse(evento.data);

      var classe = { "✓": "m-ok", "✗": "m-erro", "!": "m-alerta", "→": "m-passo" }[linha.marca] || "";

      var elemento = document.createElement("div");
      elemento.innerHTML =
        '<span class="hora">' +
        new Date(linha.momento).toLocaleTimeString("pt-BR") +
        '</span> <span class="' + classe + '">' + linha.marca + "</span> " +
        linha.texto.replace(/[<>]/g, "");

      var estavaNoFim = caixa.scrollTop + caixa.clientHeight >= caixa.scrollHeight - 30;
      caixa.appendChild(elemento);

      // Só acompanha o fim se a pessoa já estava lá: rolar para trás para ler
      // algo e ser puxado de volta a cada linha é a pior parte de um log ao vivo.
      if (estavaNoFim) caixa.scrollTop = caixa.scrollHeight;

      while (caixa.childElementCount > 500) caixa.removeChild(caixa.firstChild);

      // Enquanto um deploy roda, cada linha do diário é uma mudança possível no
      // estado da release aberta.
      if (estado.atual && (linha.marca === "✓" || linha.marca === "✗")) {
        atualizarReleaseAberta();
      }
    };

    fonte.onerror = function () {
      // O EventSource reconecta sozinho; se o UPU caiu de vez, o laço de estado
      // avisa antes.
    };
  }

  function atualizarReleaseAberta() {
    if (!estado.atual) return;

    pedir("/api/releases/" + estado.atual.id).then(function (r) {
      if (!r.ok) return;

      estado.atual = r.corpo;
      mostrarPassos();
      carregarReleases();
    });
  }

  // ---------------------------------------------------------- configuração

  function carregarConfiguracao() {
    return pedir("/api/configuracao").then(function (r) {
      if (!r.ok) return;

      estado.configuracao = r.corpo;
      var c = r.corpo;

      $("cfg-branch").value = c.branch || "";
      $("cfg-janela").value = c.janelaPadrao || "";
      $("cfg-aviso").value = c.avisoPrevioPadraoMinutos;
      $("cfg-vigia").value = c.intervaloDeVigiaMinutos;
      $("cfg-vigiar").checked = !!c.vigiarBranch;
      $("cfg-webhook").value = c.webhook || "";
      $("cfg-caminho").value = c.caminhoPublicoDoUpu || "";
      $("cfg-contato").value = c.contatoVapid || "";
    });
  }

  function salvarConfiguracao() {
    pedir("/api/configuracao", {
      method: "PUT",
      corpo: {
        branch: $("cfg-branch").value,
        janelaPadrao: $("cfg-janela").value,
        avisoPrevioPadraoMinutos: Number($("cfg-aviso").value || 0),
        intervaloDeVigiaMinutos: Number($("cfg-vigia").value || 10),
        vigiarBranch: $("cfg-vigiar").checked,
        webhook: $("cfg-webhook").value,
        caminhoPublicoDoUpu: $("cfg-caminho").value,
        contatoVapid: $("cfg-contato").value
      }
    }).then(function (r) {
      recado(r.ok ? "Configuração salva." : "não consegui salvar a configuração",
        r.ok ? "ok" : "erro");
      if (r.ok) carregarConfiguracao();
    });
  }

  // ------------------------------------------------------------------ ligar

  function ligar() {
    $("sair").onclick = function () {
      pedir("/api/sair", { method: "POST" }).then(function () {
        location.href = "/entrar.html";
      });
    };

    $("ver-branch").onclick = verBranch;
    $("nova-release").onclick = function () { abrirFormulario(null); };
    $("novo-aviso").onclick = abrirFormularioDeAviso;
    $("impacto").onchange = ajustarDuracao;
    $("fechar-formulario").onclick = function () {
      $("area-formulario").hidden = true;
      estado.atual = null;
    };

    $("salvar").onclick = salvar;

    $("agendar").onclick = function () {
      salvar().then(function (salvo) {
        if (!salvo || salvo.erros.length) return;

        pedir("/api/releases/" + salvo.release.id + "/agendar", { method: "POST" })
          .then(function (r) {
            if (!r.ok) {
              marcarErros(r.corpo && r.corpo.erros);
              if (r.corpo && r.corpo.erro) recado(r.corpo.erro, "erro");
              return;
            }

            estado.atual = r.corpo;
            recado("Agendada para " + hora(r.corpo.janela) +
              ". Os usuários serão avisados " + r.corpo.avisoPrevioMinutos +
              " minuto(s) antes.", "ok");
            carregarReleases();
            carregarEstado();
          });
      });
    };

    $("aplicar").onclick = function () {
      salvar().then(function (salvo) {
        if (!salvo) return;

        var pendentes = (salvo.erros || []).filter(function (e) {
          return e.campo !== "janela";
        });

        if (pendentes.length) { marcarErros(pendentes); return; }

        var release = salvo.release;

        if (!confirm(
          "Aplicar a versão " + release.versao + " em produção agora?\n\n" +
          "Os serviços afetados vão reiniciar. Se algo falhar, o UPU volta " +
          "para a versão anterior sozinho."
        )) return;

        pedir("/api/releases/" + release.id + "/aplicar", { method: "POST" })
          .then(function (r) {
            if (!r.ok) {
              marcarErros(r.corpo && r.corpo.erros);
              if (r.corpo && r.corpo.erro) recado(r.corpo.erro, "erro");
              return;
            }

            recado("Aplicando. Acompanhe pelo diário, aqui embaixo.", "ok");
          });
      });
    };

    $("cancelar-release").onclick = function () {
      if (!estado.atual) return;
      if (!confirm("Cancelar esta atualização e tirar o aviso da tela dos usuários?")) return;

      pedir("/api/releases/" + estado.atual.id + "/cancelar", { method: "POST" })
        .then(function (r) {
          if (!r.ok) {
            recado((r.corpo && r.corpo.erro) || "não consegui cancelar", "erro");
            return;
          }

          estado.atual = r.corpo;
          recado("Atualização cancelada.", "ok");
          carregarReleases();
          carregarAvisos();
          $("area-formulario").hidden = true;
        });
    };

    $("salvar-configuracao").onclick = salvarConfiguracao;

    carregarConfiguracao()
      .then(carregarEstado)
      .then(carregarReleases)
      .then(carregarAvisos)
      .then(ligarDiario);

    // Seis segundos: rápido o bastante para acompanhar um deploy, devagar o
    // bastante para não pesar numa máquina que está compilando.
    setInterval(carregarEstado, 6000);
    setInterval(carregarAvisos, 30000);
  }

  ligar();
})();
