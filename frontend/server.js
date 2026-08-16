// Servidor de producao do frontend: entrega os arquivos do build e devolve o
// index.html para qualquer rota que nao seja arquivo, porque o roteamento e
// do lado do cliente -- sem isso, recarregar a pagina em /tickets/42 daria 404.
const express = require("express");
const fs = require("fs");
const path = require("path");

const build = path.join(__dirname, "build");
const porta = Number(process.env.FRONTEND_PORT) || 3333;

const app = express();

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
      }
    }
  })
);

// Middleware final em vez de app.get("/*"): o curinga solto mudou de sintaxe
// no Express 5 e derruba o servidor na subida. Registrado sem caminho,
// funciona igual nas duas versoes.
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  res.sendFile(path.join(build, "index.html"));
});

// 0.0.0.0 porque a mesma instalacao e alcancada de dois lados: pelo tunel,
// que chega por localhost, e pelos computadores do escritorio, pelo IP da
// rede local.
app.listen(porta, "0.0.0.0", () => {
  console.log(`Frontend servindo ${build} na porta ${porta}`);
});
