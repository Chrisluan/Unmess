import { Response } from "express";

/**
 * `secure` é decidido por requisição, e não por configuração fixa, porque a
 * mesma instalação atende os dois transportes ao mesmo tempo: HTTPS para quem
 * entra pela internet e HTTP para os computadores do escritório que acessam
 * pelo IP da rede. Marcar o cookie como secure sempre faria o navegador
 * descartá-lo silenciosamente no acesso local, e a sessão nunca renovaria;
 * nunca marcar deixaria o cookie de sessão trafegar sem essa proteção na
 * internet.
 *
 * Quando o proxy não informa o protocolo, sobra o comportamento antigo (sem
 * `secure`) — degrada, mas não quebra o login.
 */
export const SendRefreshToken = (res: Response, token: string): void => {
  const viaHttps =
    res.req?.secure || res.req?.get("x-forwarded-proto") === "https";

  res.cookie("jrt", token, {
    httpOnly: true,
    secure: !!viaHttps,
    sameSite: "lax"
  });
};
