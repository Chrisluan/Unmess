/**
 * Para onde mandar uma mensagem a um contato.
 *
 * O contato pode ter só o LID (identificador interno do WhatsApp) e nenhum
 * telefone conhecido — é o caso de quem escreveu com a privacidade de número
 * ligada. Nesse cadastro o campo `number` guarda os dígitos do LID apenas para
 * preencher a coluna, e montar `digitos@c.us` mandaria a mensagem para um
 * telefone que não existe. Com telefone real, o telefone; sem ele, o LID.
 */
interface ContatoDestino {
  number?: string | null;
  lid?: string | null;
}

export const digitosDoLid = (lid?: string | null): string =>
  lid ? lid.split("@")[0].split(":")[0] : "";

/** O número gravado é só o LID ocupando o lugar do telefone? */
export const numeroEhLid = (contato: ContatoDestino): boolean => {
  const digitos = digitosDoLid(contato.lid);
  return !contato.number || (Boolean(digitos) && contato.number === digitos);
};

const chatIdDoContato = (contato: ContatoDestino, isGroup: boolean): string => {
  if (isGroup) return `${contato.number}@g.us`;

  if (numeroEhLid(contato) && contato.lid) {
    return `${digitosDoLid(contato.lid)}@lid`;
  }

  return `${contato.number}@c.us`;
};

export default chatIdDoContato;
