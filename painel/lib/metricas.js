/**
 * Métricas da máquina: CPU, memória, disco e rede.
 *
 * Nada aqui usa dependência externa. O `os` do Node resolve CPU e memória; só o
 * disco precisa descer ao PowerShell, e essa é justamente a leitura cara — daí
 * o cache.
 */
const os = require("os");
const { executarJson } = require("./powershell");

// Snapshot anterior dos contadores de CPU. O Windows não tem load average
// (os.loadavg() devolve [0,0,0] aqui), então o único jeito honesto de medir uso
// é comparar os tempos acumulados de cada núcleo entre duas leituras.
let cpuAnterior = null;

const lerContadoresCpu = () =>
  os.cpus().reduce(
    (soma, nucleo) => {
      const { user, nice, sys, idle, irq } = nucleo.times;
      soma.ocioso += idle;
      soma.total += user + nice + sys + idle + irq;
      return soma;
    },
    { ocioso: 0, total: 0 }
  );

const usoCpu = () => {
  const atual = lerContadoresCpu();
  const anterior = cpuAnterior;
  cpuAnterior = atual;

  // Primeira leitura desde que o painel subiu: não há intervalo para comparar.
  if (!anterior) return null;

  const deltaTotal = atual.total - anterior.total;
  const deltaOcioso = atual.ocioso - anterior.ocioso;
  if (deltaTotal <= 0) return null;

  const percentual = (1 - deltaOcioso / deltaTotal) * 100;
  return Math.max(0, Math.min(100, Number(percentual.toFixed(1))));
};

// O disco muda devagar e a consulta CIM custa caro perto do resto; 30s de cache
// mantêm o painel leve mesmo com a tela atualizando a cada 3 segundos.
const CACHE_DISCO_MS = 30000;
let cacheDisco = { momento: 0, dados: [] };

const usoDisco = async () => {
  if (Date.now() - cacheDisco.momento < CACHE_DISCO_MS) return cacheDisco.dados;

  const comando = `
    $ErrorActionPreference = 'SilentlyContinue'
    $discos = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object {
      [pscustomobject]@{
        unidade = $_.DeviceID
        rotulo  = $_.VolumeName
        total   = [long]$_.Size
        livre   = [long]$_.FreeSpace
      }
    }
    ConvertTo-Json -Compress -Depth 2 -InputObject @($discos)
  `;

  try {
    const dados = await executarJson(comando, { comoLista: true, timeout: 15000 });
    cacheDisco = { momento: Date.now(), dados };
    return dados;
  } catch {
    // Uma falha de leitura de disco não pode derrubar o painel inteiro: o que
    // importa de verdade (estado dos serviços) continua valendo.
    return cacheDisco.dados;
  }
};

/** IPv4 pelos quais o painel pode ser alcançado, para mostrar na tela. */
const enderecosLocais = () => {
  const enderecos = [];
  for (const [nome, interfaces] of Object.entries(os.networkInterfaces())) {
    for (const iface of interfaces || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        enderecos.push({ interface: nome, endereco: iface.address });
      }
    }
  }
  return enderecos;
};

const coletar = async () => {
  const total = os.totalmem();
  const livre = os.freemem();

  return {
    hostname: os.hostname(),
    plataforma: `${os.type()} ${os.release()}`,
    nucleos: os.cpus().length,
    modeloCpu: os.cpus()[0]?.model?.trim() || "desconhecido",
    uptimeSegundos: Math.floor(os.uptime()),
    cpu: usoCpu(),
    memoria: { total, livre, usado: total - livre, percentual: Number((((total - livre) / total) * 100).toFixed(1)) },
    discos: await usoDisco(),
    rede: enderecosLocais(),
    momento: new Date().toISOString()
  };
};

module.exports = { coletar };
