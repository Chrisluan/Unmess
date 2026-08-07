// Os padrões de IP terminam em $ (com porta opcional) de propósito. Casar só
// o começo do host deixava passar "http://192.168.1.200.evil.com": bastava
// registrar esse subdomínio para furar o CORS.
const OCTETO = String.raw`\d{1,3}`;
const PORTA = String.raw`(:\d+)?$`;

// Faixas privadas da RFC 1918: 192.168.x.x, 10.x.x.x e 172.16-31.x.x.
const PRIVATE_NETWORK = new RegExp(
  `^https?://(192\\.168\\.${OCTETO}\\.${OCTETO}` +
    `|10\\.${OCTETO}\\.${OCTETO}\\.${OCTETO}` +
    `|172\\.(1[6-9]|2\\d|3[01])\\.${OCTETO}\\.${OCTETO})${PORTA}`
);

// 100.64.0.0/10 (CGNAT) é a faixa usada pelo Tailscale, que dá acesso remoto
// à mesma instalação.
const TAILSCALE = new RegExp(
  `^https?://100\\.(6[4-9]|[7-9]\\d|1[01]\\d|12[0-7])\\.${OCTETO}\\.${OCTETO}${PORTA}`
);

const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const MDNS = /^https?:\/\/[\w-]+\.local(:\d+)?$/;

// Nome de máquina sem domínio, como "servidor:3001". Só resolve dentro da
// rede local — na internet um host de rótulo único não é endereçável —, então
// liberar essa forma não amplia a superfície para fora do escritório.
const HOSTNAME_LOCAL = /^https?:\/\/[a-z0-9][a-z0-9-]*(:\d+)?$/i;

/**
 * A aplicação roda em rede local sem domínio fixo, e a mesma instalação é
 * alcançada por caminhos diferentes: localhost na máquina servidora, o IP
 * privado nos demais computadores, o nome da máquina no Windows e o IP do
 * Tailscale quando alguém acessa de fora. Fixar uma origem quebraria os
 * outros casos.
 */
export const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Requisições sem Origin (curl, apps nativos, same-origin) não são CORS.
  if (!origin) return true;

  return (
    LOOPBACK.test(origin) ||
    PRIVATE_NETWORK.test(origin) ||
    TAILSCALE.test(origin) ||
    MDNS.test(origin) ||
    HOSTNAME_LOCAL.test(origin)
  );
};

export default isAllowedOrigin;
