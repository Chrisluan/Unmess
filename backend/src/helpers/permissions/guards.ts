import AppError from "../../errors/AppError";
import { Permission } from "./catalog";
import { AcessoResolvido } from "./resolve";
import { EscoposResolvidos, alcanca } from "./escopos";

/**
 * As regras que impedem alguém de aumentar o próprio poder.
 *
 * Sem elas, o controle de acesso é decorativo: quem podia editar usuários
 * podia se promover a administrador pelo corpo da requisição — `PUT /users/:id`
 * aceitava `profile`, o grupo de permissão e os overrides individuais junto
 * com nome e e-mail, e a rota só exigia "editar usuários". Um clique de
 * distância entre "arruma o telefone da colega" e "vira dono do sistema".
 *
 * Agora mexer em acesso é uma rota própria, com permissão própria, e passa
 * por estas quatro regras.
 */

/**
 * Regra 1 — ninguém dá o que não tem.
 *
 * Quem concede precisa possuir cada permissão que está concedendo. É o que
 * impede que a pessoa encarregada de organizar cargos se conceda o financeiro
 * de passagem, e é o que torna `roles:assign` uma permissão delegável sem
 * medo: ela nunca vaza para além do que quem a recebeu já podia fazer.
 */
export const garantirQuePodeConceder = (
  ator: AcessoResolvido,
  permissoesConcedidas: Permission[]
): void => {
  if (ator.isSuper) return;

  const faltantes = permissoesConcedidas.filter(
    p => !ator.permissions.includes(p)
  );

  if (faltantes.length > 0) {
    throw new AppError(
      "Você não pode conceder permissões que não possui: " +
        `${faltantes.join(", ")}.`,
      403
    );
  }
};

/**
 * Regra 1b — ninguém dá alcance que não tem.
 *
 * A mesma regra de cima, na outra dimensão. Sem ela, "ninguém dá o que não
 * tem" protegeria só metade da resposta: quem administra o CRM restrito a
 * dois quadros poderia criar um cargo irrestrito, atribuí-lo a si mesmo pela
 * mão de um colega, e passar a enxergar os quadros que lhe foram negados.
 *
 * Irrestrito só se concede sendo irrestrito. É a leitura estrita, e é a certa:
 * "todos os quadros" inclui os que a pessoa não alcança hoje e os que serão
 * criados amanhã, e conceder isso é conceder mais do que se tem.
 */
export const garantirQuePodeConcederEscopos = (
  ator: AcessoResolvido,
  escoposConcedidos: EscoposResolvidos
): void => {
  if (ator.isSuper) return;

  Object.entries(escoposConcedidos).forEach(([dimensao, concedido]) => {
    const doAtor = ator.scopes[dimensao];

    if (doAtor?.irrestrito && doAtor.negados.length === 0) return;

    if (concedido.irrestrito) {
      throw new AppError(
        "Você não pode conceder acesso irrestrito a algo que o seu próprio " +
          "acesso restringe.",
        403
      );
    }

    const foraDoSeuAlcance = concedido.ids.filter(id => !alcanca(doAtor, id));

    if (foraDoSeuAlcance.length > 0) {
      throw new AppError(
        "Você não pode conceder acesso a itens que não alcança " +
          `(${dimensao}: ${foraDoSeuAlcance.join(", ")}).`,
        403
      );
    }
  });
};

/**
 * Regra 2 — ninguém mexe no próprio acesso.
 *
 * Vale inclusive para o administrador. Não é desconfiança: é o que garante que
 * toda mudança de acesso tenha duas pessoas envolvidas, e o que impede que um
 * pedido forjado contra a sessão de quem está logado se transforme em
 * privilégio permanente.
 */
export const garantirQueNaoEhSiMesmo = (
  atorId: number,
  alvoId: number
): void => {
  if (atorId === alvoId) {
    throw new AppError(
      "Você não pode alterar o próprio cargo nem as próprias permissões. " +
        "Peça a outro administrador.",
      403
    );
  }
};

/**
 * Regra 3 — não se mexe em quem pode mais do que você.
 *
 * Sem isto, alguém com "definir o cargo de cada pessoa" poderia rebaixar o
 * administrador da empresa. Não é escalação — não ganharia nada com isso —,
 * mas é sabotagem, e o sistema não precisa deixar essa porta aberta.
 */
export const garantirQuePodeMexerEm = (
  ator: AcessoResolvido,
  alvo: AcessoResolvido
): void => {
  if (ator.isSuper) return;

  if (alvo.isSuper) {
    throw new AppError(
      "O acesso do super-admin da plataforma não é gerenciado pela empresa.",
      403
    );
  }

  const alemDoAlcance = alvo.permissions.filter(
    p => !ator.permissions.includes(p)
  );

  if (alemDoAlcance.length > 0) {
    throw new AppError(
      "Esta pessoa tem permissões que você não tem, então o acesso dela só " +
        "pode ser alterado por alguém com acesso igual ou maior.",
      403
    );
  }
};

/**
 * Regra 4 — a empresa nunca fica sem administrador.
 *
 * Uma empresa sem ninguém no cargo de Administrador é uma empresa onde
 * ninguém consegue conceder acesso a ninguém, nem a si mesmo. O conserto
 * exigiria mexer no banco à mão.
 */
export const garantirQueSobraAdministrador = (
  administradoresRestantes: number
): void => {
  if (administradoresRestantes < 1) {
    throw new AppError(
      "Esta é a única pessoa no cargo de Administrador. Dê o cargo a outra " +
        "pessoa antes de tirá-lo desta, senão a empresa fica sem ninguém " +
        "capaz de gerenciar acessos.",
      400
    );
  }
};
