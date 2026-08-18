#!/usr/bin/env node
/**
 * Painel de operação do Unmess.
 *
 * Uma tela só para o que hoje exige RDP e linha de comando: quanto a máquina
 * está aguentando, se cada serviço está de pé, e os botões de ligar, desligar e
 * reiniciar backend, frontend e banco separadamente.
 *
 * Sem dependências: só a biblioteca padrão do Node. Um painel que existe para
 * consertar a produção não pode ter um `npm install` entre ele e o conserto.
 *
 * Uso:
 *   node server.js                  sobe o painel
 *   node server.js --definir-senha  lê a senha do stdin e grava config.json
 */
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const auth = require("./lib/auth");
const energia = require("./lib/energia");
const logs = require("./lib/logs");
const metricas = require("./lib/metricas");
const servicos = require("./lib/servicos");

const PORTA = Number(process.env.PAINEL_PORT) || 8090;
const ENDERECO = process.env.PAINEL_HOST || "0.0.0.0";
const PUBLICO = path.join(__dirname, "public");
const CERTS = path.join(__dirname, "..", "certs");
const AUDITORIA = path.join(__dirname, "auditoria.log");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// ---------------------------------------------------------------- utilidades

const responderJson = (res, status, corpo) => {
  const dados = JSON.stringify(corpo);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(dados),
    "Cache-Control": "no-store"
  });
  res.end(dados);
};

/** IPv4 mapeado em IPv6 (::ffff:192.168.0.5) vira o IPv4 puro. */
const ipDoPedido = req =>
  String(req.socket.remoteAddress || "").replace(/^::ffff:/, "") || "desconhecido";

const lerCookie = (req, nome) => {
  const cabecalho = req.headers.cookie;
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
};

/**
 * Corpo JSON com teto de tamanho. Sem o teto, um POST de 2 GB numa máquina que
 * já divide 8 GB com a produção derruba o painel junto.
 */
const lerCorpo = (req, maximo = 8 * 1024) =>
  new Promise((resolve, reject) => {
    let bruto = "";
    req.on("data", pedaco => {
      bruto += pedaco;
      if (bruto.length > maximo) {
        reject(new Error("Corpo grande demais."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!bruto) return resolve({});
      try {
        resolve(JSON.parse(bruto));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });
    req.on("error", reject);
  });

/**
 * Registro permanente de quem mexeu em quê.
 *
 * A sessão vive só na memória, então sem este arquivo não sobraria nenhum
 * rastro de quem parou a produção às três da tarde.
 */
const auditar = (ip, mensagem) => {
  const linha = `${new Date().toISOString()} ${ip} ${mensagem}\n`;
  fs.appendFile(AUDITORIA, linha, erro => {
    if (erro) console.error(`[painel] falha ao gravar auditoria: ${erro.message}`);
  });
  console.log(`[painel] ${ip} ${mensagem}`);
};

const autenticado = req => auth.validarSessao(lerCookie(req, "painel_sessao"), ipDoPedido(req));

/**
 * O cabeçalho é a defesa contra CSRF: um formulário em outro site consegue
 * disparar um POST para cá com o cookie junto, mas não consegue adicionar um
 * cabeçalho personalizado sem passar pelo preflight de CORS — que este servidor
 * nunca responde.
 */
const temCabecalhoPainel = req => req.headers["x-painel"] === "1";

// -------------------------------------------------------------------- rotas

const servirArquivo = (res, arquivo) => {
  const caminho = path.join(PUBLICO, arquivo);

  // path.join resolve `..`; conferir que o resultado continua dentro de public/
  // é o que impede servir qualquer arquivo do disco.
  if (!caminho.startsWith(PUBLICO)) {
    res.writeHead(403).end("Proibido");
    return;
  }

  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Não encontrado");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(caminho)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      // O painel não embute nada de terceiros; travar aqui evita que um XSS
      // futuro consiga chamar um script de fora.
      "Content-Security-Policy":
        "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'self'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin"
    });
    res.end(conteudo);
  });
};

const rotaLogin = async (req, res) => {
  const ip = ipDoPedido(req);
  const bloqueio = auth.bloqueioRestante(ip);

  if (bloqueio > 0) {
    auditar(ip, "login recusado (bloqueado por excesso de tentativas)");
    return responderJson(res, 429, {
      erro: `Muitas tentativas. Tente de novo em ${Math.ceil(bloqueio / 60000)} minuto(s).`
    });
  }

  const corpo = await lerCorpo(req);

  if (!auth.conferirSenha(corpo.senha || "")) {
    auth.registrarFalha(ip);
    auditar(ip, "login recusado (senha incorreta)");
    return responderJson(res, 401, { erro: "Senha incorreta." });
  }

  auth.limparFalhas(ip);
  const token = auth.criarSessao(ip);
  auditar(ip, "login aceito");

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Set-Cookie": [
      `painel_sessao=${token}`,
      "HttpOnly",
      "SameSite=Strict",
      "Path=/",
      `Max-Age=${Math.floor(auth.DURACAO_SESSAO_MS / 1000)}`,
      ...(usandoHttps ? ["Secure"] : [])
    ].join("; ")
  });
  res.end(JSON.stringify({ ok: true }));
};

const rotaAcao = async (req, res, id, acao) => {
  const ip = ipDoPedido(req);
  const definicao = servicos.porId(id);

  if (!definicao) return responderJson(res, 404, { erro: "Serviço desconhecido." });
  if (!servicos.ACOES[acao]) return responderJson(res, 400, { erro: "Ação desconhecida." });

  const corpo = await lerCorpo(req);

  // Segunda tranca nos serviços críticos: além de confirmar na tela, o cliente
  // precisa devolver o nome exato do serviço. Protege contra o clique errado e
  // contra um POST solto que só adivinhou a rota.
  if (definicao.critico && corpo.confirmacao !== definicao.servico) {
    return responderJson(res, 400, {
      erro: `Ação em serviço crítico exige confirmação com o nome "${definicao.servico}".`
    });
  }

  auditar(ip, `${acao} -> ${definicao.servico} (solicitado)`);

  try {
    const resultado = await servicos.executarAcao(id, acao);
    auditar(ip, `${acao} -> ${definicao.servico} (concluído: ${resultado.estado})`);
    return responderJson(res, 200, resultado);
  } catch (erro) {
    auditar(ip, `${acao} -> ${definicao.servico} (falhou: ${erro.message})`);
    return responderJson(res, 500, { erro: erro.message });
  }
};

const rotaEstado = async (req, res) => {
  // Promise.all: o estado dos serviços e as métricas da máquina não dependem um
  // do outro, e em série somariam a partida do PowerShell duas vezes.
  const [maquina, lista, elevado] = await Promise.all([
    metricas.coletar(),
    servicos.coletarEstado(),
    servicos.verificarElevacao()
  ]);
  return responderJson(res, 200, {
    maquina,
    servicos: lista,
    energia: energia.estado(),
    painel: { https: usandoHttps, elevado }
  });
};

// ------------------------------------------------------------------ servidor

let usandoHttps = false;

const tratar = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rota = url.pathname;
  const ip = ipDoPedido(req);

  try {
    // Login é a única rota pública. Tudo mais exige sessão válida.
    if (rota === "/api/login" && req.method === "POST") {
      if (!temCabecalhoPainel(req)) return responderJson(res, 400, { erro: "Pedido inválido." });
      return await rotaLogin(req, res);
    }

    if (rota === "/api/sessao" && req.method === "GET") {
      return responderJson(res, 200, { autenticado: autenticado(req) });
    }

    if (rota === "/entrar" || rota === "/entrar.html") return servirArquivo(res, "entrar.html");
    if (rota === "/estilo.css") return servirArquivo(res, "estilo.css");
    if (rota === "/entrar.js") return servirArquivo(res, "entrar.js");

    const temSessao = autenticado(req);

    if (rota === "/" || rota === "/index.html") {
      return servirArquivo(res, temSessao ? "index.html" : "entrar.html");
    }

    if (!temSessao) {
      if (rota.startsWith("/api/")) return responderJson(res, 401, { erro: "Sessão expirada." });
      return servirArquivo(res, "entrar.html");
    }

    // ---- daqui para baixo, sessão garantida ----

    if (rota === "/app.js") return servirArquivo(res, "app.js");

    if (rota === "/api/estado" && req.method === "GET") return await rotaEstado(req, res);

    if (rota === "/api/logs" && req.method === "GET") {
      const arquivo = url.searchParams.get("arquivo");
      if (!arquivo) return responderJson(res, 200, { arquivos: await logs.listar() });
      try {
        return responderJson(res, 200, await logs.ler(arquivo, url.searchParams.get("linhas")));
      } catch (erro) {
        return responderJson(res, 404, { erro: erro.message });
      }
    }

    if (rota === "/api/logout" && req.method === "POST") {
      auth.encerrarSessao(lerCookie(req, "painel_sessao"));
      auditar(ip, "logout");
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": "painel_sessao=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    // A tarifa muda (reajuste anual, bandeira, imposto) e a potência real só se
    // descobre medindo a tomada. Ajustar pela tela evita ter que abrir arquivo
    // no servidor a cada correção.
    if (rota === "/api/energia" && req.method === "POST") {
      if (!temCabecalhoPainel(req)) return responderJson(res, 400, { erro: "Pedido inválido." });
      try {
        const resultado = energia.configurar(await lerCorpo(req));
        auditar(ip, `energia reconfigurada (tarifa ${resultado.tarifaReais})`);
        return responderJson(res, 200, resultado);
      } catch (erro) {
        return responderJson(res, 400, { erro: erro.message });
      }
    }

    if (rota === "/api/energia/zerar" && req.method === "POST") {
      if (!temCabecalhoPainel(req)) return responderJson(res, 400, { erro: "Pedido inválido." });
      auditar(ip, "acumulado de energia zerado");
      return responderJson(res, 200, energia.zerar());
    }

    const acaoEmServico = rota.match(/^\/api\/servico\/([a-z0-9_-]+)\/(start|stop|restart)$/);
    if (acaoEmServico && req.method === "POST") {
      if (!temCabecalhoPainel(req)) return responderJson(res, 400, { erro: "Pedido inválido." });
      return await rotaAcao(req, res, acaoEmServico[1], acaoEmServico[2]);
    }

    if (rota.startsWith("/api/")) return responderJson(res, 404, { erro: "Rota não encontrada." });
    return servirArquivo(res, "entrar.html");
  } catch (erro) {
    console.error(`[painel] erro em ${rota}: ${erro.stack || erro.message}`);
    if (!res.headersSent) return responderJson(res, 500, { erro: erro.message });
    res.end();
  }
};

/**
 * HTTPS quando o projeto já tem certificado; HTTP caso contrário.
 *
 * O painel escuta na rede local e pede senha — em HTTP puro essa senha trafega
 * em claro pelo escritório. Os certificados de `scripts/generate-certs.js`
 * cobrem o IP da LAN, então quando existem são aproveitados sem configuração.
 */
const criarServidor = () => {
  const cert = path.join(CERTS, "server.crt");
  const key = path.join(CERTS, "server.key");

  if (fs.existsSync(cert) && fs.existsSync(key)) {
    usandoHttps = true;
    return https.createServer({ cert: fs.readFileSync(cert), key: fs.readFileSync(key) }, tratar);
  }

  return http.createServer(tratar);
};

const subir = () => {
  if (!auth.existeConfig()) {
    console.error(
      "Nenhuma senha definida. Rode painel.ps1, que cria a senha na primeira execução."
    );
    process.exit(1);
  }

  // A medição roda no servidor, e não no navegador: assim o acumulado continua
  // crescendo enquanto o painel estiver de pé, mesmo sem ninguém com a tela
  // aberta.
  energia.iniciar();

  const servidor = criarServidor();
  const protocolo = usandoHttps ? "https" : "http";

  servidor.on("error", erro => {
    if (erro.code === "EADDRINUSE") {
      console.error(`A porta ${PORTA} já está em uso. Feche o outro painel ou use PAINEL_PORT.`);
      process.exit(1);
    }
    throw erro;
  });

  servidor.listen(PORTA, ENDERECO, () => {
    const enderecos = Object.values(require("os").networkInterfaces())
      .flat()
      .filter(i => i && i.family === "IPv4" && !i.internal)
      .map(i => `  ${protocolo}://${i.address}:${PORTA}`);

    console.log("");
    console.log("  Painel Unmess no ar");
    console.log(`  ${protocolo}://localhost:${PORTA}`);
    enderecos.forEach(e => console.log(e));
    if (!usandoHttps) {
      console.log("");
      console.log("  Atenção: sem HTTPS, a senha trafega em claro na rede local.");
      console.log("  Para ativar: node scripts/generate-certs.js");
    }
    console.log("");
    console.log("  Ctrl+C encerra o painel (não afeta os serviços).");
    console.log("");
  });

  // O NSSM e o Ctrl+C mandam sinais diferentes; fechar o socket nos dois evita
  // deixar a porta presa até o Windows reciclar.
  for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.on(sinal, () => {
      console.log("\n[painel] encerrando…");
      servidor.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 3000).unref();
    });
  }
};

/**
 * Lê a senha do stdin (o lançador PowerShell é quem pergunta ao usuário).
 *
 * O PowerShell 5.1 escreve um BOM (U+FEFF) antes do primeiro byte quando manda
 * texto para um processo nativo. Sem descartá-lo, a senha gravada ganha um
 * caractere invisível na frente e nunca mais confere com a que o operador
 * digita no navegador — falha silenciosa e impossível de adivinhar pela tela.
 */
const definirSenhaPorStdin = () => {
  let bruto = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", pedaco => (bruto += pedaco));
  process.stdin.on("end", () => {
    try {
      auth.definirSenha(bruto.replace(/^\uFEFF/, "").replace(/\r?\n$/, ""));
      console.log("Senha do painel definida.");
      process.exit(0);
    } catch (erro) {
      console.error(erro.message);
      process.exit(1);
    }
  });
};

if (process.argv.includes("--definir-senha")) definirSenhaPorStdin();
else subir();
