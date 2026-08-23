/**
 * Faixa de avisos do unmess.
 *
 * Um arquivo só, sem dependência, carregado pelo `index.html` do sistema. Ele
 * mostra no topo da tela tudo que o sistema precisa dizer para quem está
 * usando — atualização programada, manutenção em andamento, versão nova no ar,
 * recado de configuração, promoção — e, quando o usuário permite, repete a
 * mesma coisa como notificação do navegador.
 *
 * Por que é um script solto e não um componente React: ele precisa continuar
 * funcionando exatamente quando o sistema não está. O aviso mais importante que
 * ele dá — "o sistema vai cair em 5 minutos" — acontece no momento em que o
 * bundle está sendo trocado. Um componente dentro do bundle desapareceria junto.
 *
 * A fonte é o arquivo `/avisos.json`, gravado pelo UPU na mesma pasta que o
 * frontend serve. Sem porta nova, sem CORS, sem certificado.
 */
(function () {
  "use strict";

  if (window.__avisosUnmess) return;
  window.__avisosUnmess = true;

  var FEED = "/avisos.json";
  var CHAVE_DISPENSADOS = "unmess.avisos.dispensados";
  var CHAVE_NOTIFICADOS = "unmess.avisos.notificados";

  // Devagar quando não há nada acontecendo, rápido quando há hora marcada
  // chegando: o usuário precisa ver a contagem andar.
  var INTERVALO_CALMO = 60000;
  var INTERVALO_ATENTO = 15000;

  var estado = { avisos: [], versao: null, api: null, chaveVapid: null };
  var elemento = null;
  var temporizador = null;

  // ------------------------------------------------------------- utilidades

  function ler(chave) {
    try {
      return JSON.parse(localStorage.getItem(chave) || "[]");
    } catch (e) {
      return [];
    }
  }

  function gravar(chave, lista) {
    try {
      // Só os 50 últimos: a lista cresceria para sempre num navegador que fica
      // meses aberto no balcão.
      localStorage.setItem(chave, JSON.stringify(lista.slice(-50)));
    } catch (e) {
      /* modo anônimo, ou armazenamento cheio */
    }
  }

  function faltaPara(quando) {
    var minutos = Math.round((new Date(quando) - new Date()) / 60000);
    if (minutos <= 0) return "agora";
    if (minutos === 1) return "em 1 minuto";
    if (minutos < 60) return "em " + minutos + " minutos";

    var horas = Math.floor(minutos / 60);
    return "em " + horas + (horas === 1 ? " hora" : " horas");
  }

  // ------------------------------------------------------------------ estilo

  function garantirEstilo() {
    if (document.getElementById("avisos-unmess-estilo")) return;

    var estilo = document.createElement("style");
    estilo.id = "avisos-unmess-estilo";
    estilo.textContent = [
      "#avisos-unmess{position:fixed;top:0;left:0;right:0;z-index:2147483000;",
      "font:14px/1.45 'Segoe UI',system-ui,sans-serif;pointer-events:none}",
      "#avisos-unmess .aviso{display:flex;gap:12px;align-items:flex-start;",
      "padding:10px 16px;color:#fff;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.18)}",
      "#avisos-unmess .informacao{background:#2f5fd0}",
      "#avisos-unmess .sucesso{background:#1a7f52}",
      "#avisos-unmess .atencao{background:#9a6300}",
      "#avisos-unmess .critico{background:#b3261e}",
      "#avisos-unmess .corpo{flex:1;min-width:0}",
      "#avisos-unmess .titulo{font-weight:600}",
      "#avisos-unmess .mensagem{opacity:.95}",
      "#avisos-unmess .quando{opacity:.9;font-variant-numeric:tabular-nums}",
      "#avisos-unmess ul{margin:6px 0 0;padding-left:18px;opacity:.95}",
      "#avisos-unmess li{margin:2px 0}",
      "#avisos-unmess a{color:#fff;text-decoration:underline}",
      "#avisos-unmess button{background:transparent;border:1px solid rgba(255,255,255,.5);",
      "color:#fff;border-radius:6px;padding:3px 9px;cursor:pointer;font:inherit;white-space:nowrap}",
      "#avisos-unmess button:hover{background:rgba(255,255,255,.15)}",
      "@media print{#avisos-unmess{display:none}}"
    ].join("");

    document.head.appendChild(estilo);
  }

  // ---------------------------------------------------------------- desenho

  function desenhar() {
    garantirEstilo();

    if (!elemento) {
      elemento = document.createElement("div");
      elemento.id = "avisos-unmess";
      document.body.appendChild(elemento);
    }

    var dispensados = ler(CHAVE_DISPENSADOS);

    var visiveis = estado.avisos.filter(function (aviso) {
      if (aviso.dispensavel && dispensados.indexOf(aviso.id) >= 0) return false;
      if (aviso.expiraEm && new Date(aviso.expiraEm) <= new Date()) return false;
      return true;
    });

    if (visiveis.length === 0) {
      elemento.innerHTML = "";
      return;
    }

    // Um de cada vez, o mais grave primeiro. Empilhar quatro faixas tomaria
    // meia tela de quem está atendendo.
    var ordem = { critico: 0, atencao: 1, sucesso: 2, informacao: 3 };
    visiveis.sort(function (a, b) {
      return (ordem[a.severidade] || 9) - (ordem[b.severidade] || 9);
    });

    var aviso = visiveis[0];

    var caixa = document.createElement("div");
    caixa.className = "aviso " + (aviso.severidade || "informacao");

    var corpo = document.createElement("div");
    corpo.className = "corpo";

    var titulo = document.createElement("div");
    titulo.className = "titulo";
    titulo.textContent = aviso.titulo || "";
    corpo.appendChild(titulo);

    var mensagem = document.createElement("div");
    mensagem.className = "mensagem";
    mensagem.textContent = aviso.mensagem || "";
    corpo.appendChild(mensagem);

    if (aviso.aconteceEm) {
      var quando = document.createElement("div");
      quando.className = "quando";
      quando.textContent = "Começa " + faltaPara(aviso.aconteceEm) + ".";
      corpo.appendChild(quando);
    }

    if (aviso.detalhes && aviso.detalhes.length) {
      var lista = document.createElement("ul");
      aviso.detalhes.slice(0, 6).forEach(function (item) {
        var linha = document.createElement("li");
        linha.textContent = item;
        lista.appendChild(linha);
      });
      corpo.appendChild(lista);
    }

    if (aviso.link) {
      var link = document.createElement("a");
      link.href = aviso.link;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = aviso.rotuloDoLink || "Saiba mais";
      corpo.appendChild(link);
    }

    caixa.appendChild(corpo);

    if (aviso.dispensavel) {
      var fechar = document.createElement("button");
      fechar.type = "button";
      fechar.textContent = "Entendi";
      fechar.onclick = function () {
        var atuais = ler(CHAVE_DISPENSADOS);
        atuais.push(aviso.id);
        gravar(CHAVE_DISPENSADOS, atuais);
        desenhar();
      };
      caixa.appendChild(fechar);
    } else if ("Notification" in window && Notification.permission === "default") {
      // O teste é `in window`, e não `Notification &&`: em webview sem a API, a
      // segunda forma lança ReferenceError e derruba o desenho da faixa
      // inteira — justamente no aviso que não dá para dispensar.
      // Aproveita o único gesto que a pessoa vai dar nesta faixa para pedir a
      // permissão: navegador nenhum aceita o pedido sem clique.
      var permitir = document.createElement("button");
      permitir.type = "button";
      permitir.textContent = "Avisar no navegador";
      permitir.onclick = pedirPermissao;
      caixa.appendChild(permitir);
    }

    elemento.innerHTML = "";
    elemento.appendChild(caixa);
  }

  // --------------------------------------------------- notificação na hora

  /**
   * Notificação do navegador com a aba aberta.
   *
   * Não depende de push nem de servidor: assim que o feed traz um aviso que
   * este navegador ainda não mostrou, ele aparece. É o caminho que funciona em
   * qualquer instalação, inclusive sem o encaminhamento `/upu`.
   */
  function notificarNovos() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    var jaMostrados = ler(CHAVE_NOTIFICADOS);

    estado.avisos.forEach(function (aviso) {
      if (!aviso.notificarNavegador) return;
      if (jaMostrados.indexOf(aviso.id) >= 0) return;

      jaMostrados.push(aviso.id);

      try {
        new Notification(aviso.titulo || "Unmess", {
          body: aviso.mensagem || "",
          tag: aviso.id,
          icon: "/android-chrome-192x192.png"
        });
      } catch (e) {
        /* alguns navegadores exigem o service worker; o push cobre esse caso */
      }
    });

    gravar(CHAVE_NOTIFICADOS, jaMostrados);
  }

  function pedirPermissao() {
    if (!("Notification" in window)) return;

    Notification.requestPermission().then(function (resposta) {
      if (resposta === "granted") {
        notificarNovos();
        inscreverPush();
      }
      desenhar();
    });
  }

  // ------------------------------------------------------------------- push

  function base64UrlParaBytes(texto) {
    var normalizado = (texto + "===").slice(0, texto.length + (4 - (texto.length % 4)) % 4)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    var cru = atob(normalizado);
    var bytes = new Uint8Array(cru.length);
    for (var i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
    return bytes;
  }

  /**
   * Inscreve o navegador para receber aviso com a aba fechada.
   *
   * Depende de o UPU estar alcançável pela mesma origem (o `/upu` encaminhado
   * pelo servidor do frontend). Quando não está, a função desiste em silêncio:
   * a faixa e a notificação com a aba aberta continuam funcionando, e não há
   * nada que o usuário pudesse fazer a respeito.
   */
  function inscreverPush() {
    if (!estado.api || !estado.chaveVapid) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission !== "granted") return;

    // Escopo próprio: o sistema já registra o service worker do PWA na raiz, e
    // dois registros no mesmo escopo se substituem.
    navigator.serviceWorker
      .register("/aviso-sw/aviso-sw.js", { scope: "/aviso-sw/" })
      .then(function (registro) {
        return registro.pushManager.getSubscription().then(function (existente) {
          if (existente) return existente;

          return registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlParaBytes(estado.chaveVapid)
          });
        });
      })
      .then(function (inscricao) {
        var dados = inscricao.toJSON();

        return fetch(estado.api + "/inscrever", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: dados.endpoint,
            p256dh: dados.keys.p256dh,
            auth: dados.keys.auth
          })
        });
      })
      .catch(function () {
        /* sem encaminhamento configurado, ou permissão revogada no meio */
      });
  }

  // ------------------------------------------------------------------ ciclo

  function buscar() {
    // `cache: no-store` porque o arquivo muda no minuto exato em que importa, e
    // um cache de 5 minutos aqui é o aviso de manutenção chegando tarde.
    fetch(FEED + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (resposta) {
        return resposta.ok ? resposta.json() : null;
      })
      .then(function (feed) {
        if (!feed) return;

        estado.avisos = feed.avisos || [];
        estado.versao = feed.versaoNoAr || null;
        estado.api = feed.apiPublica || null;
        estado.chaveVapid = feed.chaveVapid || null;

        window.unmessVersao = estado.versao;

        desenhar();
        notificarNovos();
        inscreverPush();
        reagendar();
      })
      .catch(function () {
        // Feed fora do ar (build em andamento, por exemplo). Mantém na tela o
        // que já estava e tenta de novo.
        reagendar();
      });
  }

  function reagendar() {
    if (temporizador) clearTimeout(temporizador);

    var proximo = INTERVALO_CALMO;

    estado.avisos.forEach(function (aviso) {
      if (!aviso.aconteceEm) return;
      var minutos = (new Date(aviso.aconteceEm) - new Date()) / 60000;
      if (minutos > -5 && minutos < 60) proximo = INTERVALO_ATENTO;
    });

    temporizador = setTimeout(buscar, proximo);
  }

  function comecar() {
    buscar();

    // Voltar para a aba é o momento em que a pessoa quer ver o estado atual, e
    // não o de dez minutos atrás.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) buscar();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", comecar);
  } else {
    comecar();
  }
})();
