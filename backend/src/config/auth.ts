/**
 * Chaves de assinatura das sessões.
 *
 * Não existe chave padrão fora dos testes. O código herdado caía em
 * "mysecret"/"myanothersecret" quando o .env vinha sem chave -- e essas
 * palavras estão publicadas no repositório de origem: com elas qualquer um
 * assina um token de qualquer usuário, de qualquer empresa, inclusive o
 * super-admin. Foi o que aconteceu em produção quando o select-env regerou o
 * .env a partir de um molde sem segredos. Subir sem chave agora é um erro
 * na largada, visível no log, e não uma porta aberta silenciosa.
 */
const TAMANHO_MINIMO = 32;

const chave = (nome: string, padraoDeTeste: string): string => {
  const valor = (process.env[nome] || "").trim();
  if (valor.length >= TAMANHO_MINIMO) return valor;
  if (process.env.NODE_ENV === "test") return valor || padraoDeTeste;
  throw new Error(
    `${nome} ausente ou curta demais em backend/.env (mínimo ${TAMANHO_MINIMO} caracteres). ` +
      "Gere com: node scripts/rotacionar-segredos.js"
  );
};

export default {
  secret: chave("JWT_SECRET", "segredo-de-teste-jwt"),
  expiresIn: "15m",
  refreshSecret: chave("JWT_REFRESH_SECRET", "segredo-de-teste-refresh"),
  refreshExpiresIn: "7d"
};
