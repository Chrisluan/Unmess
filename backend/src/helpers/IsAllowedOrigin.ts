// Faixas privadas da RFC 1918: 192.168.x.x, 10.x.x.x e 172.16-31.x.x.
const PRIVATE_NETWORK = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
const LOOPBACK = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MDNS = /^https?:\/\/[\w-]+\.local(:\d+)?$/;

/**
 * A aplicação roda em rede local sem domínio fixo: o mesmo servidor é acessado
 * por localhost na máquina host e pelo IP privado nos demais computadores.
 * Fixar uma origem só quebraria um dos dois casos, então liberamos loopback e
 * as faixas privadas — e nada além delas.
 */
export const isAllowedOrigin = (origin: string | undefined): boolean => {
  // Requisições sem Origin (curl, apps nativos, same-origin) não são CORS.
  if (!origin) return true;

  return (
    LOOPBACK.test(origin) || PRIVATE_NETWORK.test(origin) || MDNS.test(origin)
  );
};

export default isAllowedOrigin;
