/**
 * Estado e controle dos serviços da instalação.
 *
 * Os três serviços são declarados aqui e em nenhum outro lugar: a API recebe um
 * `id` curto do navegador e o traduz por esta lista, de modo que nenhum nome de
 * serviço chegue ao PowerShell vindo da rede.
 */
const net = require("net");
const os = require("os");
const { executar, executarJson } = require("./powershell");

const SERVICOS = [
  {
    id: "backend",
    servico: "unmess-backend",
    rotulo: "API (backend)",
    descricao: "Node servindo a API e o WhatsApp. Parar aqui derruba o atendimento.",
    porta: 8080,
    prefixoLog: "unmess-backend",
    critico: false
  },
  {
    id: "frontend",
    servico: "unmess-frontend",
    rotulo: "Interface (frontend)",
    descricao: "Express entregando o build do React. Parar aqui só tira a tela do ar.",
    porta: 3333,
    prefixoLog: "unmess-frontend",
    critico: false
  },
  {
    id: "mysql",
    servico: "MySQL80",
    rotulo: "Banco de dados (MySQL)",
    descricao: "Escuta só em 127.0.0.1. Parar aqui derruba tudo que depende de dados.",
    porta: 3306,
    host: "127.0.0.1",
    prefixoLog: null,
    critico: true
  }
];

const porId = id => SERVICOS.find(s => s.id === id) || null;

const ACOES = {
  start: { cmdlet: "Start-Service", estadoAlvo: "Running", verbo: "iniciar" },
  stop: { cmdlet: "Stop-Service", estadoAlvo: "Stopped", verbo: "parar" },
  restart: { cmdlet: "Restart-Service", estadoAlvo: "Running", verbo: "reiniciar" }
};

// Última leitura de CPU acumulada por serviço, para transformar "segundos de
// CPU desde que o processo subiu" em "percentual agora".
const ultimaCpu = new Map(); // id -> { segundos, momento }

/**
 * Consulta os três serviços de uma vez.
 *
 * Uma chamada de PowerShell custa ~200ms de partida; fazer uma por serviço a
 * cada atualização de tela deixaria o painel pesado numa máquina de 4 vCPUs que
 * já está rodando a produção.
 *
 * O detalhe do NSSM: o processo do serviço é o nssm.exe, e o node de verdade é
 * filho dele. Somar pai e filhos é o que faz a memória bater com o Gerenciador
 * de Tarefas.
 */
const coletarEstado = async () => {
  const nomes = SERVICOS.map(s => `'${s.servico}'`).join(",");

  const comando = `
    $ErrorActionPreference = 'SilentlyContinue'
    $dados = foreach ($nome in @(${nomes})) {
      $svc = Get-CimInstance Win32_Service -Filter "Name='$nome'"
      if (-not $svc) {
        [pscustomobject]@{ nome = $nome; instalado = $false }
        continue
      }
      $ram = 0; $cpu = 0; $inicio = $null; $processos = 0
      if ($svc.ProcessId -gt 0) {
        # Win32_Process em vez de Get-Process: os serviços rodam como SYSTEM, e
        # o Get-Process nega StartTime e CPU de processo de outro usuário
        # quando o painel não está elevado -- a tela ficaria sem uptime e sem
        # CPU justamente nas leituras que interessam.
        $alvos = @(Get-CimInstance Win32_Process -Filter "ProcessId=$($svc.ProcessId) OR ParentProcessId=$($svc.ProcessId)")
        foreach ($proc in $alvos) {
          $processos++
          $ram += [long]$proc.WorkingSetSize
          # Os tempos vêm em unidades de 100 nanossegundos.
          $cpu += ([double]$proc.KernelModeTime + [double]$proc.UserModeTime) / 1e7
          if ($proc.CreationDate -and (-not $inicio -or $proc.CreationDate -lt $inicio)) {
            $inicio = $proc.CreationDate
          }
        }
      }
      [pscustomobject]@{
        nome          = $nome
        instalado     = $true
        estado        = $svc.State
        inicializacao = $svc.StartMode
        processo      = [int]$svc.ProcessId
        processos     = $processos
        ram           = [long]$ram
        cpuSegundos   = [double]$cpu
        inicio        = $(if ($inicio) { $inicio.ToString('o') } else { $null })
      }
    }
    ConvertTo-Json -Compress -Depth 3 -InputObject @($dados)
  `;

  const linhas = await executarJson(comando, { comoLista: true, timeout: 15000 });
  const indice = new Map(linhas.map(l => [l.nome, l]));
  const agora = Date.now();

  return Promise.all(
    SERVICOS.map(async definicao => {
      const bruto = indice.get(definicao.servico) || { instalado: false };
      const rodando = bruto.estado === "Running";

      // Só faz sentido bater na porta se o serviço diz que está de pé; num
      // serviço parado o connect gastaria o timeout inteiro para nada.
      const porta = rodando
        ? await testarPorta(definicao.host || "127.0.0.1", definicao.porta)
        : { aberta: false, latenciaMs: null };

      return {
        id: definicao.id,
        servico: definicao.servico,
        rotulo: definicao.rotulo,
        descricao: definicao.descricao,
        porta: definicao.porta,
        critico: definicao.critico,
        temLog: Boolean(definicao.prefixoLog),
        instalado: bruto.instalado !== false,
        estado: bruto.estado || "Desconhecido",
        inicializacao: bruto.inicializacao || null,
        processo: bruto.processo || null,
        processos: bruto.processos || 0,
        ram: bruto.ram || 0,
        cpu: calcularCpu(definicao.id, bruto.cpuSegundos, agora, rodando),
        desde: bruto.inicio || null,
        portaAberta: porta.aberta,
        latenciaMs: porta.latenciaMs,
        // "Rodando mas com a porta fechada" é o estado que mais engana: o
        // serviço aparece verde no Windows enquanto o node subiu e morreu por
        // dentro, ou ainda está carregando.
        saudavel: rodando && porta.aberta
      };
    })
  );
};

/**
 * Percentual de CPU do serviço desde a leitura anterior.
 *
 * O PowerShell entrega tempo de CPU acumulado; a taxa é a diferença dividida
 * pelo tempo decorrido, e dividida de novo pelo número de núcleos para que
 * "100%" signifique a máquina inteira, e não um núcleo saturado.
 */
const calcularCpu = (id, segundos, agora, rodando) => {
  if (!rodando || typeof segundos !== "number") {
    ultimaCpu.delete(id);
    return null;
  }

  const anterior = ultimaCpu.get(id);
  ultimaCpu.set(id, { segundos, momento: agora });

  if (!anterior || agora <= anterior.momento) return null;

  // Processo reiniciado: o acumulado zerou e a subtração daria negativo.
  if (segundos < anterior.segundos) return null;

  const decorrido = (agora - anterior.momento) / 1000;
  const percentual = ((segundos - anterior.segundos) / decorrido / os.cpus().length) * 100;
  return Math.max(0, Math.min(100, Number(percentual.toFixed(1))));
};

/** Abre e fecha uma conexão TCP só para saber se alguém está atendendo. */
const testarPorta = (host, porta, timeout = 1500) =>
  new Promise(resolve => {
    const inicio = Date.now();
    const socket = new net.Socket();

    const encerrar = aberta => {
      socket.destroy();
      resolve({ aberta, latenciaMs: aberta ? Date.now() - inicio : null });
    };

    socket.setTimeout(timeout);
    socket.once("connect", () => encerrar(true));
    socket.once("timeout", () => encerrar(false));
    socket.once("error", () => encerrar(false));
    socket.connect(porta, host);
  });

/**
 * Executa a ação e espera o serviço chegar de fato no estado pedido.
 *
 * Sem a espera, o painel responderia "ok" enquanto o Windows ainda está
 * subindo o processo, e a tela piscaria de volta para "parado" no próximo
 * refresh — dando a impressão de que o botão não funcionou.
 */
const executarAcao = async (id, acao) => {
  const definicao = porId(id);
  if (!definicao) throw new Error("Serviço desconhecido.");

  const receita = ACOES[acao];
  if (!receita) throw new Error("Ação desconhecida.");

  // O MySQL leva bem mais tempo que os dois Node para subir e, principalmente,
  // para desligar limpo (flush do InnoDB).
  const espera = definicao.critico ? 120 : 45;

  // O try/catch é do lado do PowerShell de propósito: deixar o erro subir como
  // falha de processo faz o Windows formatá-lo para console — quebrado em
  // várias linhas, com rastro de pilha e a parte útil cortada no meio.
  // Capturando a exceção aqui, a mensagem chega inteira e em uma linha só.
  const comando = `
    $ErrorActionPreference = 'Stop'
    try {
      ${receita.cmdlet} -Name '${definicao.servico}'
      $svc = Get-Service -Name '${definicao.servico}'
      $svc.WaitForStatus('${receita.estadoAlvo}', (New-TimeSpan -Seconds ${espera}))
      ConvertTo-Json -Compress -InputObject @{ ok = $true; estado = $svc.Status.ToString() }
    } catch {
      ConvertTo-Json -Compress -InputObject @{ ok = $false; erro = $_.Exception.Message }
    }
  `;

  let resultado;
  try {
    resultado = await executarJson(comando, { timeout: (espera + 15) * 1000 });
  } catch (erro) {
    // Aqui só chega falha da própria chamada (timeout, PowerShell ausente).
    throw new Error(`Não consegui ${receita.verbo} ${definicao.rotulo}: ${limparErro(erro.message)}`);
  }

  if (!resultado || resultado.ok !== true) {
    throw new Error(
      `Não consegui ${receita.verbo} ${definicao.rotulo}: ${limparErro(resultado?.erro || "erro desconhecido")}`
    );
  }

  ultimaCpu.delete(id); // o acumulado de CPU do processo antigo não vale mais
  return { ok: true, estado: resultado.estado || receita.estadoAlvo };
};

/**
 * O PowerShell devolve o erro em várias linhas, com rastro de pilha, setas de
 * posição e o nome do cmdlet na frente; o painel mostra só a parte que diz o
 * que aconteceu.
 */
const limparErro = mensagem => {
  const texto = String(mensagem)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !/^\+|^At line|^No linha|^\s*~+\s*$/.test(l))
    .join(" ")
    .replace(/\s{2,}/g, " ");

  const semCmdlet = (texto || "erro desconhecido").replace(/^[A-Z][a-z]+-[A-Za-z]+\s*:\s*/, "");

  // Falta de privilégio chega em três roupagens diferentes — "acesso negado",
  // "access denied" e o "não é possível abrir o serviço" que o Windows devolve
  // quando o processo nem consegue abrir o handle. Todas querem dizer a mesma
  // coisa: o painel subiu sem elevação e nenhum botão vai funcionar.
  if (/nega\w*|denied|0x5\b|não é possível abrir o serviço|cannot open .* service/i.test(semCmdlet)) {
    return "acesso negado pelo Windows — o painel precisa ser iniciado como Administrador.";
  }

  return semCmdlet;
};

/**
 * O painel está rodando elevado?
 *
 * Sem elevação a tela funciona inteira — métricas, estado, logs — e só os
 * botões falham. Descobrir isso na subida permite avisar antes, em vez de
 * deixar o operador clicar em "Reiniciar" no meio de um problema e receber um
 * "acesso negado" que não explica nada.
 */
let elevado = null;

const verificarElevacao = async () => {
  if (elevado !== null) return elevado;
  try {
    const resposta = await executar(
      "ConvertTo-Json -Compress -InputObject @{ elevado = " +
        "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())" +
        ".IsInRole([Security.Principal.WindowsBuiltInRole]'Administrator') }",
      { timeout: 10000 }
    );
    elevado = JSON.parse(resposta.trim()).elevado === true;
  } catch {
    elevado = false;
  }
  return elevado;
};

module.exports = { SERVICOS, porId, coletarEstado, executarAcao, verificarElevacao, ACOES };
