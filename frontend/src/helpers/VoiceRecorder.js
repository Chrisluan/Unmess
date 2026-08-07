/**
 * Gravador de voz baseado no MediaRecorder nativo.
 *
 * A biblioteca mic-recorder-to-mp3 não funciona sob o Vite: o bundle dela
 * chama `new Lame()` sem definir `Lame`. O lamejs por baixo tem o mesmo
 * problema — os fontes dependem de variáveis globais e o build concatenado só
 * se expõe via <script>, sem export de módulo.
 *
 * O MediaRecorder é nativo, não tem dependência e grava em Opus, que é o
 * próprio codec das mensagens de voz do WhatsApp.
 */

// Ogg primeiro: é o contêiner que o WhatsApp usa nas mensagens de voz. O
// Chrome só grava em WebM, então ele entra como alternativa.
const FORMATOS = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4"
];

export const formatoSuportado = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATOS.find(f => MediaRecorder.isTypeSupported(f)) || null;
};

export const extensaoDe = mimetype => {
  if (mimetype.includes("ogg")) return "ogg";
  if (mimetype.includes("webm")) return "webm";
  if (mimetype.includes("mp4")) return "m4a";
  return "bin";
};

class VoiceRecorder {
  constructor() {
    this.reset();
  }

  reset() {
    this.stream = null;
    this.recorder = null;
    this.pedacos = [];
    this.mimetype = null;
  }

  get gravando() {
    return this.recorder !== null;
  }

  async start() {
    if (this.gravando) return;

    const mimetype = formatoSuportado();
    if (!mimetype) {
      throw new Error("MediaRecorder indisponível neste navegador");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mimetype = mimetype;
    this.pedacos = [];

    this.recorder = new MediaRecorder(this.stream, { mimeType: mimetype });
    this.recorder.ondataavailable = evento => {
      if (evento.data && evento.data.size > 0) this.pedacos.push(evento.data);
    };

    // Fatias de 1s: sem isso o áudio só aparece no stop e uma aba fechada no
    // meio levaria a gravação inteira junto.
    this.recorder.start(1000);
  }

  /**
   * Encerra a captura e devolve { blob, mimetype, extensao }, ou null se não
   * havia gravação. Libera o microfone em qualquer caso.
   */
  async stop() {
    if (!this.gravando) return null;

    const { recorder, mimetype } = this;

    const blob = await new Promise(resolve => {
      recorder.onstop = () => {
        resolve(new Blob(this.pedacos, { type: mimetype }));
      };
      // Estado "inactive" acontece se o navegador já encerrou por conta
      // própria (aba em segundo plano, dispositivo removido).
      if (recorder.state === "inactive") {
        resolve(new Blob(this.pedacos, { type: mimetype }));
      } else {
        recorder.stop();
      }
    });

    this.stream.getTracks().forEach(track => track.stop());
    const extensao = extensaoDe(mimetype);
    this.reset();

    return { blob, mimetype, extensao };
  }
}

export default VoiceRecorder;
