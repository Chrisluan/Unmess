/**
 * Motor de áudio do rádio da equipe.
 *
 * ── O formato ───────────────────────────────────────────────────────────────
 *
 * Voz a 16 kHz, um canal, comprimida em μ-law (G.711): 8 bits por amostra,
 * 128 kbit/s enquanto alguém fala e zero no resto do tempo. É o formato da
 * telefonia, decodificado com uma tabela de 256 posições — nada de
 * biblioteca, nada de WebAssembly, funciona em qualquer navegador que tenha
 * Web Audio. Opus seria um terço disso, mas o MediaRecorder entrega Opus
 * dentro de contêiner WebM, em pedaços que não tocam sozinhos: seria preciso
 * um decodificador no cliente para algo que μ-law resolve com uma tabela.
 *
 * Pacotes de 40 ms (640 bytes). Menores aumentam o custo por pacote do
 * socket; maiores atrasam a fala.
 *
 * ── Captura ─────────────────────────────────────────────────────────────────
 *
 * Um AudioWorklet recebe o microfone na taxa da placa (44,1 ou 48 kHz), reduz
 * para 16 kHz tirando a média de cada janela — o que já serve de filtro
 * contra o serrilhado na faixa da voz —, codifica e entrega o pacote pronto.
 * O worklet só produz pacotes enquanto o botão está apertado.
 *
 * ── Reprodução ──────────────────────────────────────────────────────────────
 *
 * Cada pacote vira um AudioBuffer agendado logo depois do anterior. O
 * primeiro de uma fala espera ATRASO_INICIAL antes de tocar: é o colchão que
 * absorve a variação de chegada pela internet. Se a fila crescer demais (aba
 * em segundo plano, rede que soltou tudo de uma vez), os pacotes atrasados
 * são descartados para a voz voltar a ser "agora".
 */

export const TAXA = 16000;
const AMOSTRAS_POR_PACOTE = 640; // 40 ms
const ATRASO_INICIAL = 0.12;
const ATRASO_MAXIMO = 0.6;

// ── μ-law ───────────────────────────────────────────────────────────────────

const DECODIFICA = (() => {
  const tabela = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const u = ~i & 0xff;
    const sinal = u & 0x80;
    const expoente = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    let amostra = ((mantissa << 3) + 0x84) << expoente;
    amostra -= 0x84;
    tabela[i] = (sinal ? -amostra : amostra) / 32768;
  }
  return tabela;
})();

const CODIGO_DO_WORKLET = `
const BIAS = 0x84;
const CLIP = 32635;
function codificar(f) {
  let s = Math.max(-1, Math.min(1, f)) * 32767;
  s = s < 0 ? Math.ceil(s) : Math.floor(s);
  const sinal = s < 0 ? 0x80 : 0;
  if (sinal) s = -s;
  if (s > CLIP) s = CLIP;
  s += BIAS;
  let expoente = 7;
  for (let mascara = 0x4000; (s & mascara) === 0 && expoente > 0; expoente--, mascara >>= 1) {}
  const mantissa = (s >> (expoente + 3)) & 0x0f;
  return ~(sinal | (expoente << 4) | mantissa) & 0xff;
}
class CapturaDoRadio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ativo = false;
    this.razao = sampleRate / ${TAXA};
    this.posicao = 0;
    this.soma = 0;
    this.contagem = 0;
    this.pacote = new Uint8Array(${AMOSTRAS_POR_PACOTE});
    this.usado = 0;
    this.port.onmessage = (e) => {
      if (e.data === "ligar") { this.ativo = true; this.usado = 0; }
      if (e.data === "desligar") { this.descarregar(); this.ativo = false; }
    };
  }
  descarregar() {
    if (this.usado > 0) {
      const resto = this.pacote.slice(0, this.usado);
      this.port.postMessage(resto.buffer, [resto.buffer]);
      this.usado = 0;
    }
  }
  process(entradas) {
    const canal = entradas[0] && entradas[0][0];
    if (!canal || !this.ativo) return true;
    for (let i = 0; i < canal.length; i++) {
      const v = canal[i];
      this.soma += v;
      this.contagem++;
      this.posicao += 1;
      if (this.posicao >= this.razao) {
        this.posicao -= this.razao;
        const media = this.soma / this.contagem;
        this.soma = 0;
        this.contagem = 0;
        this.pacote[this.usado++] = codificar(media);
        if (this.usado === this.pacote.length) {
          const pronto = this.pacote;
          this.port.postMessage(pronto.buffer, [pronto.buffer]);
          this.pacote = new Uint8Array(${AMOSTRAS_POR_PACOTE});
          this.usado = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("captura-do-radio", CapturaDoRadio);
`;

// ── Contexto de áudio ───────────────────────────────────────────────────────

let contexto = null;
let saida = null; // volume geral
let entradaDaVoz = null; // onde a voz recebida entra (passa ou não pelo filtro)
let efeitoLigado = true;
let filtros = null;

const montarSaida = () => {
  saida = contexto.createGain();
  saida.connect(contexto.destination);

  // "Efeito rádio": a voz cortada na faixa do rádio de verdade (300 Hz a
  // 3,4 kHz) e um leve achatamento. Não melhora nada, só dá a cara.
  const graves = contexto.createBiquadFilter();
  graves.type = "highpass";
  graves.frequency.value = 300;
  const agudos = contexto.createBiquadFilter();
  agudos.type = "lowpass";
  agudos.frequency.value = 3400;
  const saturacao = contexto.createWaveShaper();
  const curva = new Float32Array(1024);
  for (let i = 0; i < curva.length; i++) {
    const x = (i / (curva.length - 1)) * 2 - 1;
    curva[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  saturacao.curve = curva;
  graves.connect(agudos);
  agudos.connect(saturacao);
  saturacao.connect(saida);
  filtros = { primeiro: graves };

  entradaDaVoz = contexto.createGain();
  ligarEfeito(efeitoLigado);
};

const ligarEfeito = (ligado) => {
  efeitoLigado = ligado;
  if (!entradaDaVoz) return;
  try {
    entradaDaVoz.disconnect();
  } catch {
    // ainda não estava ligada a nada
  }
  entradaDaVoz.connect(ligado ? filtros.primeiro : saida);
};

/** Precisa ser chamado a partir de um clique: navegador não toca som sem gesto. */
export const prepararAudio = async () => {
  if (!contexto) {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) throw new Error("sem-web-audio");
    contexto = new Contexto({ latencyHint: "interactive" });
    montarSaida();
  }
  if (contexto.state === "suspended") {
    try {
      await contexto.resume();
    } catch {
      // segue suspenso; o próximo gesto tenta de novo
    }
  }
  return contexto;
};

export const definirVolume = (volume) => {
  if (saida) saida.gain.value = Math.max(0, Math.min(1.5, volume));
};

export const definirEfeitoRadio = (ligado) => ligarEfeito(ligado);

// ── Sons de sinalização ─────────────────────────────────────────────────────

const tom = (frequencia, inicio, duracao, volume = 0.18, forma = "sine") => {
  const osc = contexto.createOscillator();
  const ganho = contexto.createGain();
  osc.type = forma;
  osc.frequency.value = frequencia;
  ganho.gain.setValueAtTime(0, inicio);
  ganho.gain.linearRampToValueAtTime(volume, inicio + 0.005);
  ganho.gain.setValueAtTime(volume, inicio + duracao - 0.01);
  ganho.gain.linearRampToValueAtTime(0, inicio + duracao);
  osc.connect(ganho);
  ganho.connect(saida);
  osc.start(inicio);
  osc.stop(inicio + duracao + 0.02);
};

const chiado = (inicio, duracao, volume = 0.05) => {
  const n = Math.floor(contexto.sampleRate * duracao);
  const buffer = contexto.createBuffer(1, n, contexto.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) dados[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  const ganho = contexto.createGain();
  ganho.gain.value = volume;
  const banda = contexto.createBiquadFilter();
  banda.type = "bandpass";
  banda.frequency.value = 2500;
  fonte.connect(banda);
  banda.connect(ganho);
  ganho.connect(saida);
  fonte.start(inicio);
};

export const sons = {
  /** Eu peguei a vez: o "clique" de abrir o microfone. */
  transmitir() {
    if (!contexto) return;
    const t = contexto.currentTime;
    tom(1200, t, 0.05, 0.12);
  },
  /** Fim de câmbio de outra pessoa: o bip e a cauda de squelch. */
  cambio(tocarBip = true) {
    if (!contexto) return;
    const t = Math.max(contexto.currentTime, proximoInicio);
    if (tocarBip) {
      tom(1400, t, 0.07, 0.12);
      tom(1050, t + 0.07, 0.09, 0.12);
    }
    chiado(t + (tocarBip ? 0.16 : 0), 0.12);
  },
  /** Canal ocupado: três toques graves. */
  ocupado() {
    if (!contexto) return;
    const t = contexto.currentTime;
    [0, 0.18, 0.36].forEach((d) => tom(425, t + d, 0.12, 0.15, "square"));
  },
  /** Estourou o tempo máximo de transmissão. */
  tempoEsgotado() {
    if (!contexto) return;
    const t = contexto.currentTime;
    tom(600, t, 0.5, 0.15, "square");
  },
  /** Alguém entrou ou saiu do canal. */
  entrou() {
    if (!contexto) return;
    const t = contexto.currentTime;
    tom(880, t, 0.06, 0.08);
    tom(1320, t + 0.07, 0.08, 0.08);
  },
  saiu() {
    if (!contexto) return;
    const t = contexto.currentTime;
    tom(1320, t, 0.06, 0.08);
    tom(880, t + 0.07, 0.08, 0.08);
  },
  mensagem() {
    if (!contexto) return;
    const t = contexto.currentTime;
    tom(988, t, 0.08, 0.07);
    tom(1319, t + 0.09, 0.12, 0.07);
  },
};

// ── Reprodução da voz recebida ──────────────────────────────────────────────

let proximoInicio = 0;

/** Começa uma fala nova: o próximo pacote espera o colchão de chegada. */
export const reiniciarReproducao = () => {
  proximoInicio = 0;
};

export const tocarPacote = (pacote) => {
  if (!contexto || !entradaDaVoz) return;
  const bytes = pacote instanceof Uint8Array ? pacote : new Uint8Array(pacote);
  if (bytes.length === 0) return;

  const agora = contexto.currentTime;
  if (proximoInicio < agora + 0.01) {
    proximoInicio = agora + ATRASO_INICIAL;
  } else if (proximoInicio - agora > ATRASO_MAXIMO) {
    // Fila atrasada demais: descarta para alcançar o presente.
    return;
  }

  const buffer = contexto.createBuffer(1, bytes.length, TAXA);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < bytes.length; i++) dados[i] = DECODIFICA[bytes[i]];

  const fonte = contexto.createBufferSource();
  fonte.buffer = buffer;
  fonte.connect(entradaDaVoz);
  fonte.start(proximoInicio);
  proximoInicio += buffer.duration;
};

// ── Captura do microfone ────────────────────────────────────────────────────

let microfone = null; // { stream, fonte, no, silencio, aoPacote }
let workletPronto = false;

export const podeFalarAqui = () =>
  !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);

/**
 * Abre o microfone e deixa o worklet pronto, mas sem transmitir.
 *
 * O microfone fica aberto enquanto a pessoa está no canal — como um rádio
 * ligado —, para o aperto do botão não esperar a negociação do navegador.
 * `aoPacote` recebe cada pacote codificado.
 */
export const abrirMicrofone = async (aoPacote) => {
  await prepararAudio();
  if (microfone) {
    microfone.aoPacote = aoPacote;
    return;
  }
  if (!podeFalarAqui()) throw new Error("inseguro");

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  // O processador é registrado uma vez por contexto: registrar de novo o
  // mesmo nome faz o addModule falhar.
  if (!workletPronto) {
    const url = URL.createObjectURL(
      new Blob([CODIGO_DO_WORKLET], { type: "application/javascript" })
    );
    try {
      await contexto.audioWorklet.addModule(url);
      workletPronto = true;
    } catch (err) {
      stream.getTracks().forEach((t) => t.stop());
      throw err;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const fonte = contexto.createMediaStreamSource(stream);
  const no = new AudioWorkletNode(contexto, "captura-do-radio");
  // O worklet só processa se estiver ligado a um destino; ligado em silêncio.
  const silencio = contexto.createGain();
  silencio.gain.value = 0;
  fonte.connect(no);
  no.connect(silencio);
  silencio.connect(contexto.destination);

  microfone = { stream, fonte, no, silencio, aoPacote };
  no.port.onmessage = (e) => microfone?.aoPacote?.(new Uint8Array(e.data));
};

export const ligarTransmissao = () => microfone?.no.port.postMessage("ligar");
export const desligarTransmissao = () => microfone?.no.port.postMessage("desligar");
export const microfoneAberto = () => !!microfone;

export const fecharMicrofone = () => {
  if (!microfone) return;
  try {
    microfone.no.port.postMessage("desligar");
    microfone.fonte.disconnect();
    microfone.no.disconnect();
    microfone.silencio.disconnect();
  } catch {
    // já desligado
  }
  microfone.stream.getTracks().forEach((t) => t.stop());
  microfone = null;
};
