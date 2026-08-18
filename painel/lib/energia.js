/**
 * Consumo de energia e custo estimados.
 *
 * ATENÇÃO AO QUE ISTO É: uma estimativa, não uma medição. Esta máquina é um
 * notebook Positivo sem bateria instalada e com um i3-3110M; não há sensor de
 * energia acessível -- sem bateria não há taxa de descarga para ler, e os
 * contadores internos da CPU (RAPL) exigem driver em modo kernel. O número na
 * tela sai de um modelo, e por isso a interface o rotula como estimativa.
 *
 * O modelo é o mais simples que ainda diz algo útil: potência varia
 * linearmente entre o consumo em repouso e o consumo em carga total, conforme
 * o uso de CPU.
 *
 *     P = ociosa + (máxima - ociosa) x usoCpu
 *
 * Os dois extremos são configuráveis justamente porque são chute informado: o
 * jeito de torná-los reais é medir a tomada com um wattímetro por alguns
 * minutos, em repouso e sob carga, e escrever os valores aqui.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ARQUIVO = path.join(__dirname, "..", "energia.json");

const PADROES = {
  // Copel, classe residencial B1, reajuste de 20,51% vigente a partir de
  // 24/06/2026. É a tarifa de aplicação (TUSD+TE): NÃO inclui ICMS, PIS/COFINS
  // nem bandeira tarifária, então a conta real sai acima disto. Para acertar,
  // divida o valor total de uma fatura pelo consumo em kWh dela e use aqui.
  tarifaReais: 0.768,

  // Notebook com i3-3110M (TDP de 35 W). Em repouso, a máquina inteira -- CPU,
  // placa, memória, disco e tela -- fica perto de 15 W; com os quatro fios de
  // execução saturados, perto de 45 W.
  potenciaOciosaW: 15,
  potenciaMaximaW: 45,

  kwhAcumulado: 0,
  // Quanto tempo de fato foi observado. Sem isto o total mentiria por omissão:
  // o painel roda sob demanda, então há períodos em que ninguém estava medindo
  // e o consumo daquelas horas simplesmente não existe na conta.
  segundosObservados: 0,
  desde: null
};

const INTERVALO_AMOSTRA_MS = 30000;

let estadoAtual = null;
let ultimaAmostraCpu = null; // { ocioso, total }
let ultimoMomento = null;
let potenciaAtualW = null;
let cronometro = null;

// ------------------------------------------------------------------ persistência

const carregar = () => {
  if (estadoAtual) return estadoAtual;

  try {
    const bruto = fs.readFileSync(ARQUIVO, "utf8").replace(/^\uFEFF/, "");
    estadoAtual = { ...PADROES, ...JSON.parse(bruto) };
  } catch {
    estadoAtual = { ...PADROES, desde: new Date().toISOString() };
  }

  if (!estadoAtual.desde) estadoAtual.desde = new Date().toISOString();
  return estadoAtual;
};

const salvar = () => {
  if (!estadoAtual) return;
  try {
    fs.writeFileSync(
      ARQUIVO,
      JSON.stringify({ ...estadoAtual, atualizadoEm: new Date().toISOString() }, null, 2)
    );
  } catch (erro) {
    console.error(`[painel] não consegui gravar o acumulado de energia: ${erro.message}`);
  }
};

// ------------------------------------------------------------------ medição

/**
 * Uso de CPU entre esta chamada e a anterior.
 *
 * Precisa do próprio par de amostras, separado do usado em metricas.js: as duas
 * leituras acontecem em ritmos diferentes, e compartilhar o estado faria uma
 * roubar o intervalo da outra, zerando as duas.
 */
const usoCpu = () => {
  const atual = os.cpus().reduce(
    (soma, nucleo) => {
      const { user, nice, sys, idle, irq } = nucleo.times;
      soma.ocioso += idle;
      soma.total += user + nice + sys + idle + irq;
      return soma;
    },
    { ocioso: 0, total: 0 }
  );

  const anterior = ultimaAmostraCpu;
  ultimaAmostraCpu = atual;

  if (!anterior) return null;

  const deltaTotal = atual.total - anterior.total;
  if (deltaTotal <= 0) return null;

  return Math.max(0, Math.min(1, 1 - (atual.ocioso - anterior.ocioso) / deltaTotal));
};

/**
 * Integra o consumo desde a amostra anterior.
 *
 * A energia é a área sob a curva de potência: potência média no intervalo
 * multiplicada pela duração. Como as amostras são frequentes e o consumo de um
 * servidor de atendimento varia devagar, tratar o intervalo como potência
 * constante erra pouco.
 */
const amostrar = () => {
  const estado = carregar();
  const uso = usoCpu();
  const agora = Date.now();

  if (uso === null) {
    ultimoMomento = agora;
    return;
  }

  const faixa = estado.potenciaMaximaW - estado.potenciaOciosaW;
  potenciaAtualW = Number((estado.potenciaOciosaW + faixa * uso).toFixed(1));

  if (ultimoMomento) {
    const horas = (agora - ultimoMomento) / 3600000;

    // Um salto grande significa máquina suspensa ou painel parado: contar esse
    // buraco como consumo contínuo inventaria energia que ninguém observou.
    if (horas > 0 && horas < 0.25) {
      estado.kwhAcumulado += (potenciaAtualW * horas) / 1000;
      estado.segundosObservados += (agora - ultimoMomento) / 1000;
      salvar();
    }
  }

  ultimoMomento = agora;
};

/** Começa a medir sozinho, sem depender de alguém com a tela aberta. */
const iniciar = () => {
  if (cronometro) return;
  carregar();
  amostrar(); // primeira leitura só planta a referência
  cronometro = setInterval(amostrar, INTERVALO_AMOSTRA_MS);
  cronometro.unref();
};

// ------------------------------------------------------------------ leitura

const estado = () => {
  const dados = carregar();
  const custo = dados.kwhAcumulado * dados.tarifaReais;

  // Projeção: o que esta potência custaria rodando o mês inteiro, que é o
  // regime real de um servidor de atendimento ligado 24 horas.
  const potenciaProjecao = potenciaAtualW ?? dados.potenciaOciosaW;
  const kwhMes = (potenciaProjecao * 24 * 30) / 1000;

  return {
    estimativa: true,
    potenciaW: potenciaAtualW,
    kwhAcumulado: Number(dados.kwhAcumulado.toFixed(4)),
    custoReais: Number(custo.toFixed(2)),
    tarifaReais: dados.tarifaReais,
    desde: dados.desde,
    horasObservadas: Number((dados.segundosObservados / 3600).toFixed(1)),
    projecao: {
      kwhMes: Number(kwhMes.toFixed(1)),
      custoMes: Number((kwhMes * dados.tarifaReais).toFixed(2)),
      custoDia: Number(((kwhMes / 30) * dados.tarifaReais).toFixed(2))
    },
    modelo: { potenciaOciosaW: dados.potenciaOciosaW, potenciaMaximaW: dados.potenciaMaximaW }
  };
};

/** Ajusta tarifa e modelo pela tela, sem precisar editar arquivo no servidor. */
const configurar = ({ tarifaReais, potenciaOciosaW, potenciaMaximaW }) => {
  const dados = carregar();

  const numero = (valor, minimo, maximo) => {
    const n = Number(valor);
    return Number.isFinite(n) && n >= minimo && n <= maximo ? n : null;
  };

  const tarifa = numero(tarifaReais, 0.01, 10);
  const ociosa = numero(potenciaOciosaW, 1, 2000);
  const maxima = numero(potenciaMaximaW, 1, 2000);

  if (tarifa === null) throw new Error("Tarifa inválida (use algo entre 0,01 e 10 reais por kWh).");
  if (ociosa === null || maxima === null) throw new Error("Potências inválidas.");
  if (maxima < ociosa) throw new Error("A potência em carga não pode ser menor que a de repouso.");

  dados.tarifaReais = tarifa;
  dados.potenciaOciosaW = ociosa;
  dados.potenciaMaximaW = maxima;
  salvar();

  return estado();
};

/** Zera o acumulado, para recomeçar a contagem a partir de agora. */
const zerar = () => {
  const dados = carregar();
  dados.kwhAcumulado = 0;
  dados.segundosObservados = 0;
  dados.desde = new Date().toISOString();
  salvar();
  return estado();
};

module.exports = { iniciar, estado, configurar, zerar };
