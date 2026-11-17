// Servidor de producao do frontend: entrega os arquivos do build e devolve o
// index.html para qualquer rota que nao seja arquivo, porque o roteamento e
// do lado do cliente -- sem isso, recarregar a pagina em /tickets/42 daria 404.
const compression = require("compression");
const express = require("express");
const fs = require("fs");
const http = require("http");
const path = require("path");

const build = path.join(__dirname, "build");
const porta = Number(process.env.FRONTEND_PORT) || 3333;

// O UPU escuta só em 127.0.0.1, e é assim que deve ser: ele reinicia serviços e
// troca o código da produção.
const upu = process.env.UPU_ENDERECO || "http://127.0.0.1:8091";

const app = express();

/**
 * Comprime o que sai daqui.
 *
 * A Cloudflare já entrega comprimido ao navegador, mas o trecho entre esta
 * máquina e ela passava sem compressão -- 1,7 MB de bundle subindo por um
 * Wi-Fi de 72 Mbps a cada revalidação de cache. Comprimir aqui corta isso
 * para perto de 400 KB.
 */
app.use(compression());

/**
 * Encaminha /upu/* para as rotas públicas do UPU.
 *
 * Existe por causa de uma regra do navegador, não por gosto de arquitetura: a
 * inscrição de notificação precisa sair da mesma origem que serviu a página.
 * Uma página em https falando com um http://127.0.0.1:8090 é bloqueada como
 * conteúdo misto, e o usuário não vê nem o erro.
 *
 * Só as rotas públicas passam por aqui (ler avisos, inscrever e cancelar
 * notificação). O painel do UPU, que agenda e aplica atualização, continua
 * alcançável apenas de dentro da máquina.
 *
 * A lista explícita abaixo é o que garante isso, e ela existe por um motivo
 * concreto: encaminhar "/upu/" + o resto do caminho deixava `/upu/../api/estado`
 * chegar à API do painel. A sessão barrava a chamada, mas a superfície não
 * deveria nem estar exposta.
 *
 * Sem o UPU instalado, a resposta é 503 e o widget desiste em silêncio: a faixa
 * de avisos continua funcionando pelo arquivo estático.
 */
const ROTAS_DO_UPU = new Set([
  "/avisos",
  "/versao",
  "/chave-vapid",
  "/inscrever",
  "/desinscrever"
]);

app.use("/upu", (req, res) => {
  // Sem a query e sem normalizar nada: o caminho tem que ser, literalmente, um
  // dos cinco.
  const rota = req.url.split("?")[0];

  if (!ROTAS_DO_UPU.has(rota)) return res.status(404).json({ erro: "rota inexistente" });

  const destino = new URL(upu);

  const requisicao = http.request(
    {
      host: destino.hostname,
      port: destino.port || 80,
      // O prefixo /upu é trocado por /publico: o caminho de fora é escolha
      // desta instalação, o de dentro é do UPU.
      path: "/publico" + rota,
      method: req.method,
      headers: { ...req.headers, host: destino.host },
      timeout: 10000
    },
    resposta => {
      res.writeHead(resposta.statusCode, resposta.headers);
      resposta.pipe(res);
    }
  );

  requisicao.on("timeout", () => requisicao.destroy());
  requisicao.on("error", () => {
    if (!res.headersSent) res.status(503).json({ erro: "UPU indisponível" });
  });

  req.pipe(requisicao);
});

// Endereço público em tempo de execução.
//
// Fica antes do static porque não existe arquivo em disco: o conteúdo sai do
// endereco-publico.json, que o scripts/tunel-publico.js reescreve toda vez que
// o túnel sobe com um endereço novo. Servir assim evita recompilar o frontend
// a cada troca -- as variáveis VITE_* só entram no bundle durante o build.
//
// Sem o arquivo (acesso só pela rede local), a resposta é um script vazio:
// window.ENV fica indefinido e o frontend deduz a API do host que serviu a
// página, que é o comportamento normal fora da internet.
app.get("/env.js", (req, res) => {
  let configuracao = null;

  try {
    const bruto = fs.readFileSync(path.join(__dirname, "endereco-publico.json"), "utf8");
    // O BOM é descartado antes do parse: o script gera o arquivo sem ele, mas
    // qualquer edição pelo PowerShell ou por editor do Windows o acrescenta, e
    // o JSON.parse falha com ele na frente. Sem esta linha, o endereço público
    // deixaria de valer em silêncio, sem erro em lugar nenhum.
    const dados = JSON.parse(bruto.replace(/^\uFEFF/, ""));
    // Só vale se os dois vierem juntos: o frontend compara o hostname da página
    // com APP_HOST para decidir usar API_URL, e um sem o outro não decide nada.
    if (dados.VITE_PUBLIC_APP_HOST && dados.VITE_PUBLIC_API_URL) configuracao = dados;
  } catch {
    // Arquivo ausente ou inválido: segue sem endereço público.
  }

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // O endereço do túnel muda; um cache aqui deixaria o navegador apontando
  // para um endereço morto até alguém limpar o cache na mão.
  res.setHeader("Cache-Control", "no-store");

  if (!configuracao) return res.end("/* sem endereco publico */\n");

  return res.end(`window.ENV = ${JSON.stringify(configuracao)};\n`);
});

app.use(
  express.static(build, {
    setHeaders: (res, arquivo) => {
      // Os bundles tem hash no nome e podem ser cacheados a vontade; o
      // index.html nao, senao depois de um build novo o navegador continua
      // pedindo um bundle que ja nao existe.
      if (arquivo.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
        return;
      }

      /**
       * Arquivo com hash no nome nunca muda de conteudo.
       *
       * O padrao do express.static e max-age=0, o que fazia o navegador e a
       * Cloudflare voltarem aqui a cada carga so para ouvir que nada mudou --
       * era o cf-cache-status REVALIDATED em toda visita, com o bundle inteiro
       * subindo pelo Wi-Fi. Com "immutable" eles nem perguntam, e um build novo
       * gera nomes novos, entao nao ha como servir versao velha por engano.
       */
      if (/[.-][0-9a-f]{8,}.[a-z0-9]+$/i.test(arquivo)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    }
  })
);

// Middleware final em vez de app.get("/*"): o curinga solto mudou de sintaxe
// no Express 5 e derruba o servidor na subida. Registrado sem caminho,
// funciona igual nas duas versoes.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  /**
   * O HTML nunca pode ser cacheado, aqui tambem.
   *
   * Este caminho nao passa pelo setHeaders do static, entao saia com o padrao
   * max-age=0 -- e a Cloudflare, vendo isso, aplicava cache proprio de quatro
   * horas. Depois de publicar uma versao nova, quem recebesse o HTML velho
   * pediria bundles que ja nao existem, e veria tela branca ate o cache expirar.
   */
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  res.sendFile(path.join(build, "index.html"));
});

// 0.0.0.0 porque a mesma instalacao e alcancada de dois lados: pelo tunel,
// que chega por localhost, e pelos computadores do escritorio, pelo IP da
// rede local.
app.listen(porta, "0.0.0.0", () => {
  console.log(`Frontend servindo ${build} na porta ${porta}`);
});
