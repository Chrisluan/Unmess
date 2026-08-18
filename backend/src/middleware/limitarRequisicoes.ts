import rateLimit from "express-rate-limit";

/**
 * Limites de requisição por IP.
 *
 * A instalação passou a atender pela internet, e a diferença é grande: na rede
 * local o pior caso era um atendente com a tela travada em loop; agora
 * qualquer um pode varrer o login com uma lista de senhas a noite inteira sem
 * que nada o impeça.
 *
 * São dois limites com propósitos diferentes -- um protege as contas, o outro
 * protege a máquina.
 */

/**
 * Freio geral: existe para a máquina não cair.
 *
 * O teto é folgado de propósito. A tela de tickets faz muitas chamadas em
 * sequência ao abrir, e um escritório inteiro costuma sair pelo mesmo IP
 * público -- um limite apertado transformaria proteção em indisponibilidade
 * para quem está trabalhando.
 */
export const limitadorGeral = rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT) || 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "ERR_MUITAS_REQUISICOES" },
  // O WebSocket do socket.io mantém conexão longa e faz polling de fallback;
  // contá-lo aqui derrubaria a atualização das conversas em tempo real.
  skip: req => req.path.startsWith("/socket.io")
});

/**
 * Freio do login: existe para proteger as contas.
 *
 * Aqui o teto é baixo porque ninguém erra a senha vinte vezes por minuto -- só
 * um programa faz isso. `skipSuccessfulRequests` faz o contador ignorar quem
 * acertou, então um atendente que entra e sai várias vezes no dia nunca esbarra
 * no limite; quem erra em série, sim.
 */
export const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "ERR_MUITAS_TENTATIVAS_LOGIN" }
});
