import { Op, Transaction } from "sequelize";

import AppError from "../../errors/AppError";
import { AcabamentoDoItem } from "../../helpers/CalcularItem";
import Finish from "../../models/Finish";
import Product from "../../models/Product";

/** O que limparItens devolve, no que importa aqui. */
interface ItemLimpo {
  id?: number;
  description: string;
  productId: number | null;
  unitPrice: number;
  finishes: Array<{ finishId: number; price: number; minPrice: number }>;
}

/** Como o item estava gravado antes desta edição. */
export interface ItemAnterior {
  id: number;
  productId: number | null;
  unitPrice: number;
  unitCost: number | null;
  finishes: AcabamentoDoItem[];
}

interface Request<T extends ItemLimpo> {
  companyId: number;
  itens: T[];
  anteriores: ItemAnterior[];
  /** crm:overridePrice -- pode baixar preço de catálogo. */
  podeBaixarPreco: boolean;
  transaction?: Transaction;
}

const TOLERANCIA = 0.005;

/**
 * Completa os itens com o que a tela não decide: o custo do material e a
 * fotografia de cada acabamento.
 *
 * - Custo e nome/base do acabamento vêm do catálogo, nunca do navegador: quem
 *   vende não vê custo, e mesmo quem vê não o escolhe.
 * - Item já gravado mantém a fotografia de antes (custo e acabamentos do dia em
 *   que foi orçado). Só item novo, ou que trocou de produto, lê o catálogo de
 *   hoje -- mesmo princípio do preço, que é copiado e não referenciado.
 * - Preço de catálogo pode subir à vontade; descer pede crm:overridePrice. A
 *   conferência só olha o que mudou nesta edição: mexer na quantidade de um
 *   item antigo, orçado antes de um reajuste, não pode ser barrado.
 */
const PrecificarItens = async <T extends ItemLimpo>({
  companyId,
  itens,
  anteriores,
  podeBaixarPreco,
  transaction
}: Request<T>): Promise<Array<T & { unitCost: number | null; finishes: AcabamentoDoItem[] }>> => {
  const idsProduto = Array.from(new Set(itens.map(i => i.productId).filter(Boolean))) as number[];
  const idsAcabamento: number[] = Array.from(
    new Set(
      itens.reduce<number[]>((todos, i) => todos.concat(i.finishes.map(a => a.finishId)), [])
    )
  );

  const [produtos, catalogo] = await Promise.all([
    idsProduto.length
      ? Product.findAll({ where: { companyId, id: { [Op.in]: idsProduto } }, transaction })
      : Promise.resolve([] as Product[]),
    idsAcabamento.length
      ? Finish.findAll({ where: { companyId, id: { [Op.in]: idsAcabamento } }, transaction })
      : Promise.resolve([] as Finish[])
  ]);
  const produtoPorId = new Map(produtos.map(p => [p.id, p]));
  const acabamentoPorId = new Map(catalogo.map(a => [a.id, a]));
  const anteriorPorId = new Map(anteriores.map(a => [a.id, a]));

  const abaixo: string[] = [];

  const resultado = itens.map(item => {
    const anterior = item.id ? anteriorPorId.get(item.id) : undefined;
    const mesmoProduto = Boolean(anterior) && (anterior?.productId || null) === (item.productId || null);
    const produto = item.productId ? produtoPorId.get(item.productId) : undefined;

    // Produto de outra empresa (ou apagado) não empresta custo nem preço.
    const productId = produto ? produto.id : mesmoProduto ? item.productId : null;

    const unitCost = mesmoProduto && anterior ? anterior.unitCost : produto ? produto.cost : null;

    if (!podeBaixarPreco && produto) {
      const precoMudou = !mesmoProduto || Math.abs((anterior?.unitPrice ?? 0) - item.unitPrice) > TOLERANCIA;
      if (precoMudou && item.unitPrice + TOLERANCIA < produto.price) abaixo.push(item.description);
    }

    const finishes: AcabamentoDoItem[] = [];
    item.finishes.forEach(escolhido => {
      const antes = mesmoProduto
        ? (anterior?.finishes || []).find(a => Number(a.finishId) === escolhido.finishId)
        : undefined;
      const doCatalogo = acabamentoPorId.get(escolhido.finishId);
      const base = antes || (doCatalogo && doCatalogo.active !== false ? doCatalogo : undefined);
      // Acabamento que não está no item nem no catálogo ativo é descartado.
      if (!base) return;

      if (!podeBaixarPreco && doCatalogo) {
        const mudou =
          !antes ||
          Math.abs(Number(antes.price) - escolhido.price) > 0.00005 ||
          Math.abs(Number(antes.minPrice || 0) - escolhido.minPrice) > TOLERANCIA;
        if (
          mudou &&
          (escolhido.price + 0.00005 < doCatalogo.price || escolhido.minPrice + TOLERANCIA < doCatalogo.minPrice)
        ) {
          abaixo.push(`${item.description} — ${doCatalogo.name}`);
        }
      }

      finishes.push({
        finishId: escolhido.finishId,
        name: base.name,
        base: base.base,
        price: escolhido.price,
        minPrice: escolhido.minPrice,
        cost: Number(base.cost) || 0,
        minCost: Number(base.minCost) || 0
      });
    });

    return { ...item, productId, unitCost, finishes };
  });

  if (abaixo.length) {
    throw new AppError("ERR_PRECO_ABAIXO_DO_CATALOGO", 403, { itens: abaixo });
  }

  return resultado;
};

export default PrecificarItens;
