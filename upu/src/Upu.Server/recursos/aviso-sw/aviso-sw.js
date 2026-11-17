/**
 * Service worker só para receber os avisos do UPU.
 *
 * Fica num escopo próprio (`/aviso-sw/`) porque o sistema já registra o service
 * worker do PWA na raiz, e dois registros no mesmo escopo se substituem — o
 * segundo a chegar desligaria o primeiro. Para receber push o escopo não
 * importa; basta existir um registro.
 *
 * Ele não intercepta requisição nenhuma, de propósito: não faz cache, não serve
 * arquivo, não tem opinião sobre a rede. Só sabe mostrar uma notificação e
 * abrir o sistema quando alguém clica nela.
 */

self.addEventListener("install", function () {
  // Assume o lugar sem esperar o navegador fechar todas as abas: um aviso que
  // só começa a funcionar na semana que vem não avisa nada.
  self.skipWaiting();
});

self.addEventListener("activate", function (evento) {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (evento) {
  var dados = {};

  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (e) {
    dados = { titulo: "Unmess", mensagem: evento.data ? evento.data.text() : "" };
  }

  var titulo = dados.titulo || "Unmess";

  var opcoes = {
    body: dados.mensagem || "",
    // A tag faz o navegador substituir a notificação anterior do mesmo aviso em
    // vez de empilhar cópias quando o push é reenviado.
    tag: dados.id || "unmess",
    renotify: false,
    icon: "/android-chrome-192x192.png",
    badge: "/favicon-32x32.png",
    data: { link: dados.link || "/" },
    // Manutenção não some sozinha da bandeja: quem estava longe da mesa precisa
    // encontrar o aviso ao voltar.
    requireInteraction: dados.severidade === "critico"
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", function (evento) {
  evento.notification.close();

  var destino = (evento.notification.data && evento.notification.data.link) || "/";

  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (abas) {
      // Se o sistema já está aberto em alguma aba, traz aquela para a frente em
      // vez de abrir a décima cópia.
      for (var i = 0; i < abas.length; i++) {
        if (abas[i].url.indexOf(self.location.origin) === 0 && "focus" in abas[i]) {
          return abas[i].focus();
        }
      }

      return self.clients.openWindow(destino);
    })
  );
});
