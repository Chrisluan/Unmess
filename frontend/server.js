// Servidor de producao do frontend: entrega os arquivos do build e devolve o
// index.html para qualquer rota que nao seja arquivo, porque o roteamento e
// do lado do cliente -- sem isso, recarregar a pagina em /tickets/42 daria 404.
const express = require("express");
const path = require("path");

const build = path.join(__dirname, "build");
const porta = Number(process.env.FRONTEND_PORT) || 3333;

const app = express();

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
