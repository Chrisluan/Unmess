/**
 * Painel Unmess — tela principal.
 *
 * Duas decisões que explicam o formato do código:
 *
 *   1. Os cards são criados uma vez e depois só têm os valores atualizados.
 *      Recriar o HTML a cada 3 segundos faria o botão perder o foco no meio de
 *      um clique e o texto selecionado sumir enquanto se lê um erro.
 *   2. Nada de innerHTML com dado vindo do servidor. Todo texto entra por
 *      textContent, então nome de serviço ou linha de log não viram markup.
 */

const INTERVALO_MS = 3000;

const elementos = {
  maquina: document.getElementById("maquina"),
  atualizado: document.getElementById("atualizado"),
  metricas: document.getElementById("metricas"),
  servicos: document.getElementById("servicos"),
  rodape: document.getElementById("rodape"),
  aviso: document.getElementById("aviso"),
  sair: document.getElementById("sair"),
  arquivoLog: document.getElementById("arquivo-log"),
  atualizarLog: document.getElementById("atualizar-log"),
  seguirLog: document.getElementById("seguir-log"),
  conteudoLog: document.getElementById("conteudo-log"),
  modal: document.getElementById("modal"),
  modalTitulo: document.getElementById("modal-titulo"),
  modalTexto: document.getElementById("modal-texto"),
  modalCampo: document.getElementById("modal-campo"),
  modalConfirmar: document.getElementById("modal-confirmar")
};

const cards = new Map(); // id do serviço -> referências dos nós do card
let ocupado = false; // uma ação de serviço em andamento trava as demais
let semElevacao = false; // painel sem Administrador: botões não têm o que fazer
let avisouElevacao = false;
let timerAviso = null;

// ------------------------------------------------------------ formatadores

const bytes = valor => {
  if (!valor || valor < 0) return "—";
  const unidades = ["B", "KB", "MB", "GB", "TB"];
  let n = valor;
  let i = 0;
  while (n >= 1024 && i < unidades.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${unidades[i]}`;
};

const duracao = segundos => {
  if (segundos == null || segundos < 0) return "—";
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
};

const desdeISO = iso => (iso ? duracao((Date.now() - new Date(iso).getTime()) / 1000) : "—");

const hora = () =>
  new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const criar = (tag, classe, texto) => {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto != null) no.textContent = texto;
  return no;
};

const avisar = (mensagem, tipo = "") => {
  elementos.aviso.textContent = mensagem;
  elementos.aviso.className = `visivel ${tipo}`;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => {
    elementos.aviso.className = "";
  }, tipo === "erro" ? 12000 : 6000);
};

/** Faixas de cor das barras: verde até 75%, amarelo até 90%, vermelho acima. */
const classeBarra = percentual =>
  percentual >= 90 ? "barra critico" : percentual >= 75 ? "barra atencao" : "barra";

// ------------------------------------------------------------------- rede

const pedir = async (url, opcoes = {}) => {
  const resposta = await fetch(url, {
    ...opcoes,
    headers: { "Content-Type": "application/json", "X-Painel": "1", ...(opcoes.headers || {}) }
  });

  // Sessão expirada em qualquer chamada devolve para o login, senão a tela
  // ficaria mostrando dados congelados sem explicar o motivo.
  if (resposta.status === 401) {
    window.location.href = "/entrar";
    throw new Error("Sessão expirada.");
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || `Erro ${resposta.status}`);
  return dados;
};

// --------------------------------------------------------------- métricas

const desenharMetricas = maquina => {
  const cartoes = [
    {
      titulo: "CPU",
      valor: maquina.cpu == null ? "—" : `${maquina.cpu}%`,
      detalhe: `${maquina.nucleos} núcleos`,
      percentual: maquina.cpu
    },
    {
      titulo: "Memória",
      valor: `${maquina.memoria.percentual}%`,
      detalhe: `${bytes(maquina.memoria.usado)} de ${bytes(maquina.memoria.total)}`,
      percentual: maquina.memoria.percentual
    },
    ...maquina.discos.map(disco => {
      const usado = disco.total - disco.livre;
      const percentual = disco.total ? Number(((usado / disco.total) * 100).toFixed(1)) : 0;
      return {
        titulo: `Disco ${disco.unidade}`,
        valor: `${percentual}%`,
        detalhe: `${bytes(disco.livre)} livres de ${bytes(disco.total)}`,
        percentual
      };
    }),
    {
      titulo: "Ligada há",
      valor: duracao(maquina.uptimeSegundos),
      detalhe: maquina.plataforma,
      percentual: null
    }
  ];

  // A quantidade de cartões só muda se um disco for montado ou removido —
  // reconstruir nesse caso é mais simples do que sincronizar a lista.
  if (elementos.metricas.children.length !== cartoes.length) {
    elementos.metricas.textContent = "";
    cartoes.forEach(() => {
      const bloco = criar("div", "metrica");
      bloco.append(
        criar("div", "titulo"),
        criar("div", "valor"),
        criar("div", "detalhe"),
        (() => {
          const barra = criar("div", "barra");
          barra.append(criar("div"));
          return barra;
        })()
      );
      elementos.metricas.append(bloco);
    });
  }

  cartoes.forEach((cartao, i) => {
    const bloco = elementos.metricas.children[i];
    bloco.querySelector(".titulo").textContent = cartao.titulo;
    bloco.querySelector(".valor").textContent = cartao.valor;
    bloco.querySelector(".detalhe").textContent = cartao.detalhe;

    const barra = bloco.querySelector(".barra");
    if (cartao.percentual == null) {
      barra.style.display = "none";
    } else {
      barra.style.display = "";
      barra.className = classeBarra(cartao.percentual);
      barra.firstElementChild.style.width = `${cartao.percentual}%`;
    }
  });
};

// --------------------------------------------------------------- serviços

const montarCard = servico => {
  const raiz = criar("article", "servico");
  raiz.dataset.id = servico.id;

  const cabecalho = criar("div", "cabecalho");
  const esquerda = criar("div");
  esquerda.append(criar("h3", null, servico.rotulo), criar("div", "nome-servico", servico.servico));
  const selo = criar("span", "selo");
  cabecalho.append(esquerda, selo);

  const descricao = criar("p", "descricao", servico.descricao);

  const numeros = criar("div", "numeros");
  const campos = {};
  for (const [chave, rotulo] of [
    ["estado", "Estado"],
    ["porta", "Porta"],
    ["cpu", "CPU"],
    ["ram", "Memória"],
    ["desde", "No ar há"],
    ["inicializacao", "Inicialização"]
  ]) {
    const bloco = criar("div");
    bloco.append(criar("span", "rotulo", rotulo));
    const dado = criar("span", "dado", "—");
    bloco.append(dado);
    numeros.append(bloco);
    campos[chave] = dado;
  }

  const acoes = criar("div", "acoes");
  const botoes = {};
  for (const [acao, texto, classe] of [
    ["start", "Ligar", "primario"],
    ["restart", "Reiniciar", ""],
    ["stop", "Desligar", "perigo"]
  ]) {
    const botao = criar("button", classe, texto);
    botao.addEventListener("click", () => acionar(servico, acao));
    acoes.append(botao);
    botoes[acao] = botao;
  }

  raiz.append(cabecalho, descricao, numeros, acoes);
  elementos.servicos.append(raiz);

  cards.set(servico.id, { raiz, selo, campos, botoes, definicao: servico });
};

const atualizarCard = servico => {
  const card = cards.get(servico.id);
  if (!card) return;

  card.definicao = servico;

  const rodando = servico.estado === "Running";
  const saude = !rodando ? "parado" : servico.saudavel ? "ok" : "alerta";

  card.raiz.dataset.saude = saude;
  card.selo.className = `selo ${saude}`;
  card.selo.textContent = !servico.instalado
    ? "não instalado"
    : !rodando
      ? "parado"
      : servico.saudavel
        ? "no ar"
        : "porta fechada";

  card.campos.estado.textContent = servico.instalado ? servico.estado : "não instalado";
  card.campos.porta.textContent = servico.portaAberta
    ? `${servico.porta} · ${servico.latenciaMs} ms`
    : `${servico.porta} · fechada`;
  card.campos.cpu.textContent = servico.cpu == null ? "—" : `${servico.cpu}%`;
  card.campos.ram.textContent = servico.ram ? bytes(servico.ram) : "—";
  card.campos.desde.textContent = desdeISO(servico.desde);
  card.campos.inicializacao.textContent = servico.inicializacao || "—";

  // Botões seguem o estado real: não faz sentido oferecer "Ligar" no que já
  // está no ar, nem "Desligar" no que já está parado.
  const bloqueado = ocupado || semElevacao || !servico.instalado;
  card.botoes.start.disabled = bloqueado || rodando;
  card.botoes.stop.disabled = bloqueado || !rodando;
  card.botoes.restart.disabled = bloqueado || !rodando;
};

const desenharServicos = lista => {
  lista.forEach(servico => {
    if (!cards.has(servico.id)) montarCard(servico);
    atualizarCard(servico);
  });
};

const travarBotoes = travado => {
  ocupado = travado;
  cards.forEach(card => {
    Object.values(card.botoes).forEach(botao => {
      botao.disabled = travado || botao.disabled;
    });
  });
};

// ---------------------------------------------------------------- ações

const TEXTO_ACAO = { start: "Ligar", stop: "Desligar", restart: "Reiniciar" };

/**
 * Pergunta antes de agir. Serviço crítico exige digitar o nome exato — a mesma
 * confirmação que o servidor vai cobrar de novo no corpo do pedido.
 */
const confirmar = (servico, acao) =>
  new Promise(resolve => {
    const exigeTexto = servico.critico;

    elementos.modalTitulo.textContent = `${TEXTO_ACAO[acao]} ${servico.rotulo}?`;
    elementos.modalTexto.textContent = exigeTexto
      ? `${servico.descricao} Para confirmar, digite ${servico.servico}.`
      : servico.descricao;

    elementos.modalCampo.style.display = exigeTexto ? "" : "none";
    elementos.modalCampo.value = "";
    elementos.modalConfirmar.textContent = TEXTO_ACAO[acao];

    const aoFechar = () => {
      elementos.modal.removeEventListener("close", aoFechar);
      if (elementos.modal.returnValue !== "confirmar") return resolve(null);
      if (exigeTexto && elementos.modalCampo.value.trim() !== servico.servico) {
        avisar("Confirmação não confere com o nome do serviço.", "erro");
        return resolve(null);
      }
      resolve({ confirmacao: servico.servico });
    };

    elementos.modal.addEventListener("close", aoFechar);
    elementos.modal.showModal();
    if (exigeTexto) elementos.modalCampo.focus();
  });

const acionar = async (servico, acao) => {
  if (ocupado) return;

  // Ligar não derruba nada; só as ações que interrompem atendimento passam
  // pela confirmação.
  let extras = {};
  if (acao !== "start" || servico.critico) {
    const resposta = await confirmar(servico, acao);
    if (!resposta) return;
    extras = resposta;
  }

  travarBotoes(true);
  avisar(`${TEXTO_ACAO[acao]} ${servico.rotulo}… isso pode levar alguns segundos.`);

  try {
    const resultado = await pedir(`/api/servico/${servico.id}/${acao}`, {
      method: "POST",
      body: JSON.stringify(extras)
    });
    avisar(`${servico.rotulo}: ${resultado.estado}.`, "ok");
  } catch (erro) {
    avisar(erro.message, "erro");
  } finally {
    travarBotoes(false);
    await atualizar();
  }
};

// ------------------------------------------------------------------ logs

let logsCarregados = false;

const carregarListaLogs = async () => {
  try {
    const { arquivos } = await pedir("/api/logs");
    const selecionado = elementos.arquivoLog.value;

    elementos.arquivoLog.textContent = "";
    if (!arquivos.length) {
      elementos.arquivoLog.append(criar("option", null, "nenhum log com conteúdo"));
      elementos.conteudoLog.textContent = "Nenhum log disponível em C:\\unmess\\logs.";
      return;
    }

    arquivos.forEach(arquivo => {
      const opcao = criar(
        "option",
        null,
        `${arquivo.nome}${arquivo.erro ? "  (erros)" : ""} — ${bytes(arquivo.tamanho)}`
      );
      opcao.value = arquivo.nome;
      elementos.arquivoLog.append(opcao);
    });

    if (selecionado && arquivos.some(a => a.nome === selecionado)) {
      elementos.arquivoLog.value = selecionado;
    }

    if (!logsCarregados) {
      logsCarregados = true;
      await carregarLog();
    }
  } catch (erro) {
    elementos.conteudoLog.textContent = `Falha ao listar logs: ${erro.message}`;
  }
};

// Níveis do pino, que é o logger do backend.
const NIVEIS = { 10: "TRACE", 20: "DEBUG", 30: "INFO", 40: "AVISO", 50: "ERRO", 60: "FATAL" };

/**
 * O backend loga em JSON numa linha só. Cru, é uma parede de chaves e aspas
 * onde a mensagem — a única parte que importa às três da manhã — fica no fim.
 * Aqui vira "hora NÍVEL mensagem"; o que não for JSON do pino passa intacto.
 */
const formatarLinhaLog = linha => {
  if (!linha.startsWith("{")) return linha;

  let dados;
  try {
    dados = JSON.parse(linha);
  } catch {
    return linha;
  }

  if (typeof dados.time !== "number") return linha;

  const horario = new Date(dados.time).toLocaleTimeString("pt-BR", { hour12: false });
  const nivel = NIVEIS[dados.level] || String(dados.level ?? "");
  const texto = dados.msg ?? dados.message ?? "";
  const extra = dados.statusCode ? ` (HTTP ${dados.statusCode})` : "";

  return `${horario}  ${nivel.padEnd(5)}  ${texto}${extra}`;
};

const carregarLog = async () => {
  const arquivo = elementos.arquivoLog.value;
  if (!arquivo) return;

  try {
    const dados = await pedir(`/api/logs?arquivo=${encodeURIComponent(arquivo)}&linhas=300`);
    const grudadoNoFim =
      elementos.conteudoLog.scrollTop + elementos.conteudoLog.clientHeight >=
      elementos.conteudoLog.scrollHeight - 40;

    elementos.conteudoLog.textContent = dados.linhas.length
      ? dados.linhas.map(formatarLinhaLog).join("\n")
      : "(log vazio)";

    // Só rola sozinho se o operador já estava no fim; caso contrário ele está
    // lendo algo mais acima e não quer ser arrastado.
    if (elementos.seguirLog.checked && grudadoNoFim) {
      elementos.conteudoLog.scrollTop = elementos.conteudoLog.scrollHeight;
    }
  } catch (erro) {
    elementos.conteudoLog.textContent = `Falha ao ler o log: ${erro.message}`;
  }
};

// ------------------------------------------------------------------ ciclo

const atualizar = async () => {
  try {
    const { maquina, servicos, painel } = await pedir("/api/estado");

    // A elevação é lida antes de desenhar: é ela que decide se os botões nascem
    // habilitados. Invertida, a primeira tela vinha com tudo clicável mesmo sem
    // privilégio, e só o refresh seguinte corrigia.
    semElevacao = painel.elevado === false;

    desenharMetricas(maquina);
    desenharServicos(servicos);

    elementos.maquina.textContent = `${maquina.hostname} · ${maquina.modeloCpu}`;
    elementos.atualizado.textContent = `atualizado ${hora()}`;

    // Sem elevação a tela inteira funciona, menos os botões. Melhor dizer isso
    // de cara do que deixar descobrir no meio de uma queda.
    if (semElevacao && !avisouElevacao) {
      avisouElevacao = true;
      avisar(
        "O painel não está rodando como Administrador: monitoramento funciona, mas os botões vão falhar. Reabra o painel.ps1 num PowerShell elevado.",
        "erro"
      );
    }

    elementos.rodape.textContent = [
      painel.https
        ? "Conexão protegida por HTTPS."
        : "Conexão sem HTTPS: a senha trafega em claro na rede local. Gere os certificados com scripts/generate-certs.js.",
      semElevacao ? "Painel sem privilégios de Administrador — ações desabilitadas." : ""
    ]
      .filter(Boolean)
      .join(" ");
  } catch (erro) {
    elementos.atualizado.textContent = `sem resposta desde ${hora()}`;
    avisar(`Painel sem contato com o servidor: ${erro.message}`, "erro");
  }
};

const iniciar = async () => {
  elementos.sair.addEventListener("click", async () => {
    await pedir("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/entrar";
  });

  elementos.arquivoLog.addEventListener("change", carregarLog);
  elementos.atualizarLog.addEventListener("click", carregarLog);

  await atualizar();
  await carregarListaLogs();

  // Aba escondida não precisa de dados novos; parar o polling evita acordar o
  // PowerShell a cada 3 segundos numa tela que ninguém está olhando.
  setInterval(() => {
    if (document.visibilityState === "visible") atualizar();
  }, INTERVALO_MS);

  // Ao voltar para a aba, buscar na hora: esperar o próximo ciclo faria o
  // operador encarar por alguns segundos números que podem ser de ontem.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") atualizar();
  });

  setInterval(() => {
    if (document.visibilityState === "visible" && elementos.seguirLog.checked) carregarLog();
  }, 5000);

  setInterval(() => {
    if (document.visibilityState === "visible") carregarListaLogs();
  }, 60000);
};

iniciar();
