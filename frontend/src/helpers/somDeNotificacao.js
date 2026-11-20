/**
 * Sons de notificação, sintetizados na hora.
 *
 * O mp3 de antes era sempre o mesmo, no mesmo tom: numa tarde de movimento
 * vira um martelo. Aqui não há arquivo — cada toque é gerado pelo Web Audio:
 *
 *  - `tocarClique()` — mensagem nova numa conversa sem dono ou da fila.
 *    Um "toc" curto e arredondado, de bolha estourando. O tom anda por uma
 *    escala pentatônica: mensagens seguidas sobem a escala (soa como
 *    progresso, não como insistência), e depois de uma pausa recomeça de uma
 *    nota sorteada. A pentatônica não tem nota que brigue com outra, então
 *    qualquer sequência soa bem.
 *
 *  - `tocarParaMim()` — mensagem numa conversa que é sua, ou uma conversa
 *    transferida para você. Mais chamativo: duas notas subindo (um "ding-ding"
 *    de sininho) com o mesmo clique na frente. O desenho é sempre o mesmo, para
 *    o ouvido aprender que "esse é o meu"; só a tonalidade varia um pouco.
 *
 * O navegador só libera áudio depois de um gesto da pessoa (clique ou tecla).
 * `prepararSom()` deixa um ouvinte esperando esse primeiro gesto e destrava o
 * contexto ali — sem isso, o primeiro aviso do dia sairia mudo.
 */

// Graus da pentatônica maior, em semitons a partir da tônica.
const PENTATONICA = [0, 2, 4, 7, 9, 12, 14, 16];

// Lá 5 — agudo o bastante para ser ouvido por cima de conversa e música
// ambiente, sem chegar a ser estridente.
const FREQUENCIA_BASE = 880;

// Mensagens com menos que isso de intervalo contam como "em sequência".
const JANELA_DE_SEQUENCIA_MS = 2500;

// Duas mensagens no mesmo instante (lote offline chegando) tocam uma vez.
const INTERVALO_MINIMO_MS = 110;

let contexto = null;
let saidaGeral = null;
let preparado = false;

let passoDaSequencia = 0;
let ultimoToque = 0;

const obterContexto = () => {
  if (contexto) return contexto;
  const Construtor = window.AudioContext || window.webkitAudioContext;
  if (!Construtor) return null;

  contexto = new Construtor();

  // Um compressor leve na saída: dois sons sobrepostos não estouram, e o
  // volume percebido fica parecido em fone e em caixinha de notebook.
  const compressor = contexto.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.12;

  saidaGeral = contexto.createGain();
  saidaGeral.gain.value = 0.9;
  saidaGeral.connect(compressor);
  compressor.connect(contexto.destination);

  return contexto;
};

const destravar = () => {
  const ctx = obterContexto();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
};

export const prepararSom = () => {
  if (preparado || typeof window === "undefined") return;
  preparado = true;
  const aoPrimeiroGesto = () => {
    destravar();
    window.removeEventListener("pointerdown", aoPrimeiroGesto);
    window.removeEventListener("keydown", aoPrimeiroGesto);
  };
  window.addEventListener("pointerdown", aoPrimeiroGesto);
  window.addEventListener("keydown", aoPrimeiroGesto);
};

const semitom = (base, passos) => base * Math.pow(2, passos / 12);

// Pequena imperfeição de afinação (±8 cents): sons idênticos ao bit cansam o
// ouvido mais depressa que sons quase iguais.
const desafinar = (freq) => freq * Math.pow(2, ((Math.random() - 0.5) * 16) / 1200);

/**
 * O "toc": uma senoide que cai de tom muito rápido (é isso que dá a sensação
 * de bolha/estalo), com um harmônico curto por cima para o brilho e uma
 * pitada de ruído no ataque para o clique.
 */
const toc = (ctx, inicio, freq, volume) => {
  const corpo = ctx.createOscillator();
  const ganhoCorpo = ctx.createGain();
  corpo.type = "sine";
  corpo.frequency.setValueAtTime(freq * 1.9, inicio);
  corpo.frequency.exponentialRampToValueAtTime(freq, inicio + 0.018);
  ganhoCorpo.gain.setValueAtTime(0.0001, inicio);
  ganhoCorpo.gain.exponentialRampToValueAtTime(volume, inicio + 0.004);
  ganhoCorpo.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.11);
  corpo.connect(ganhoCorpo).connect(saidaGeral);
  corpo.start(inicio);
  corpo.stop(inicio + 0.13);

  const brilho = ctx.createOscillator();
  const ganhoBrilho = ctx.createGain();
  brilho.type = "triangle";
  brilho.frequency.setValueAtTime(freq * 2, inicio);
  ganhoBrilho.gain.setValueAtTime(0.0001, inicio);
  ganhoBrilho.gain.exponentialRampToValueAtTime(volume * 0.28, inicio + 0.003);
  ganhoBrilho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.05);
  brilho.connect(ganhoBrilho).connect(saidaGeral);
  brilho.start(inicio);
  brilho.stop(inicio + 0.06);

  // 12 ms de ruído filtrado: é o "clique" de verdade, o que faz o som
  // parecer físico em vez de um bipe de eletrônico.
  const amostras = Math.floor(ctx.sampleRate * 0.012);
  const buffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < amostras; i += 1) {
    dados[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
  }
  const ruido = ctx.createBufferSource();
  ruido.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = freq * 3;
  filtro.Q.value = 1.2;
  const ganhoRuido = ctx.createGain();
  ganhoRuido.gain.value = volume * 0.35;
  ruido.connect(filtro).connect(ganhoRuido).connect(saidaGeral);
  ruido.start(inicio);
};

/**
 * Nota de sininho: triangular com um parcial inarmônico leve (2,76×, o que
 * dá cor de metal) e cauda mais longa que o toc.
 */
const sino = (ctx, inicio, freq, volume, duracao = 0.32) => {
  [
    { tipo: "triangle", mult: 1, vol: 1 },
    { tipo: "sine", mult: 2.76, vol: 0.18 },
  ].forEach(({ tipo, mult, vol }) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq * mult, inicio);
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(volume * vol, inicio + 0.006);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    osc.connect(ganho).connect(saidaGeral);
    osc.start(inicio);
    osc.stop(inicio + duracao + 0.02);
  });
};

const podeTocar = () => {
  const ctx = obterContexto();
  if (!ctx) return null;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const agora = performance.now();
  if (agora - ultimoToque < INTERVALO_MINIMO_MS) return null;

  // Sequência: perto do toque anterior, sobe um degrau; depois de uma pausa,
  // recomeça num dos três primeiros graus, sorteado.
  if (agora - ultimoToque > JANELA_DE_SEQUENCIA_MS) {
    passoDaSequencia = Math.floor(Math.random() * 3);
  } else {
    passoDaSequencia = (passoDaSequencia + 1) % PENTATONICA.length;
  }
  ultimoToque = agora;
  return ctx;
};

export const tocarClique = () => {
  try {
    const ctx = podeTocar();
    if (!ctx) return;
    const freq = desafinar(semitom(FREQUENCIA_BASE, PENTATONICA[passoDaSequencia]));
    toc(ctx, ctx.currentTime + 0.005, freq, 0.32);
  } catch (err) {
    // Som é enfeite: falhar aqui não pode derrubar o aviso.
  }
};

export const tocarParaMim = () => {
  try {
    const ctx = podeTocar();
    if (!ctx) return;
    // A tonalidade gira entre três vizinhas (0, +2 e +5 semitons, uma oitava
    // abaixo do clique): reconhecível como "o meu", sem ser idêntico.
    const tonica = desafinar(
      semitom(FREQUENCIA_BASE / 2, [0, 2, 5][passoDaSequencia % 3])
    );
    const t = ctx.currentTime + 0.005;
    toc(ctx, t, tonica * 2, 0.26);
    sino(ctx, t + 0.012, tonica * 1.5, 0.36, 0.26); // quinta
    sino(ctx, t + 0.13, tonica * 2, 0.42, 0.42); // oitava, mais longa
  } catch (err) {
    // idem
  }
};
