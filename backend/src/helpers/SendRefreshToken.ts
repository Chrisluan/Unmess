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
 *
 * `sameSite` segue a mesma lógica, e pelo mesmo motivo:
 *
 *   - Pela internet, interface e API saem por hostnames que o navegador trata
 *     como sites diferentes. Com `lax` o cookie simplesmente não acompanha a
 *     chamada de /auth/refresh_token: ela responde 401, o frontend descarta o
 *     token e o atendente volta para a tela de login sozinho, minutos depois
 *     de ter entrado. `none` é o que permite o cookie atravessar.
 *   - Na rede local o acesso é HTTP, e `none` exige `secure`; o navegador
 *     descartaria o cookie caladamente. Por isso ali continua `lax`, que
 *     naquele caso basta -- página e API estão no mesmo host.
 *
 * O preço de `none` é abrir mão da proteção contra CSRF que o `lax` dava. Quem
 * segura o risco passa a ser o CORS de PUBLIC_ORIGINS (ver IsAllowedOrigin),
 * que por isso não pode ganhar origem que não seja estritamente necessária.
 */
export const SendRefreshToken = (res: Response, token: string): void => {
  const viaHttps =
    res.req?.secure || res.req?.get("x-forwarded-proto") === "https";

  res.cookie("jrt", token, {
    httpOnly: true,
    secure: !!viaHttps,
    sameSite: viaHttps ? "none" : "lax"
  });
};
