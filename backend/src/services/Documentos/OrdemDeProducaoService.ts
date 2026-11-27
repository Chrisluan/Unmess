import fs from "fs";
import path from "path";
import { Op } from "sequelize";

import AppError from "../../errors/AppError";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";
import Contact from "../../models/Contact";
import Customer from "../../models/Customer";
import DealAttachment from "../../models/DealAttachment";
import Order from "../../models/Order";
import OrderItem from "../../models/OrderItem";
import User from "../../models/User";
import {
  blocoDeTotais,
  campo,
  data,
  empresaDoDocumento,
  escapar,
  montarDocumento,
  observacoes,
  tabelaDeItens
} from "./modelo";

interface Request {
  orderId: number | string;
  companyId: number;
  /**
   * A O.P. sai sem preço por padrão: é o papel da oficina, e a oficina não
   * precisa de dinheiro. Com valores só para quem pode vê-los e pediu.
   */
  mostrarValores?: boolean;
}

const pastaPublica = path.resolve(__dirname, "..", "..", "..", "public");

/**
 * Miniaturas da arte, embutidas no documento.
 *
 * Quem produz confere pela imagem. Limitadas em quantidade e tamanho para o
 * documento não virar dezenas de megabytes.
 */
const miniaturas = async (dealIds: number[], companyId: number): Promise<string> => {
  if (dealIds.length === 0) return "";
  const anexos = await DealAttachment.findAll({
    where: { dealId: { [Op.in]: dealIds }, companyId, mimetype: { [Op.like]: "image/%" } },
    order: [["isPreview", "DESC"], ["id", "ASC"]],
    limit: 4
  });
  const imagens = anexos
    .map(anexo => {
      try {
        const arquivo = anexo.getDataValue("fileName") as string;
        const caminho = path.join(pastaPublica, path.basename(arquivo || ""));
        if (!arquivo || !fs.existsSync(caminho) || fs.statSync(caminho).size > 400 * 1024) {
          return null;
        }
        return `<img src="data:${anexo.mimetype};base64,${fs
          .readFileSync(caminho)
          .toString("base64")}" alt="${escapar(anexo.name)}" />`;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return imagens.length ? `<div class="miniaturas">${imagens.join("")}</div>` : "";
};

/**
 * Ordem de produção: o documento do pedido para quem executa.
 *
 * Lê do pedido (itens congelados), e não do card: é o mesmo papel em
 * Produção e em Expedição, e confere com o que o cliente aprovou.
 */
const OrdemDeProducaoService = async ({
  orderId,
  companyId,
  mostrarValores = false
}: Request): Promise<string> => {
  const pedido = await Order.findOne({
    where: { id: orderId, companyId },
    include: [
      {
        model: OrderItem,
        as: "items",
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      },
      { model: Customer, as: "customer" },
      { model: Contact, as: "contact", attributes: ["id", "name", "number"] },
      { model: User, as: "responsibleUser", attributes: ["id", "name"] }
    ]
  });

  if (!pedido) throw new AppError("ERR_PEDIDO_NAO_ENCONTRADO", 404);

  const empresa = await empresaDoDocumento(companyId);
  const itens = (pedido.items || []) as OrderItem[];
  const nomeCliente =
    pedido.customer?.tradeName ||
    pedido.customer?.name ||
    pedido.contact?.name ||
    "Cliente não identificado";

  const entrega = pedido.deliveryToArrange
    ? "A combinar"
    : [
        pedido.deliveryAt
          ? new Date(pedido.deliveryAt).toLocaleString("pt-BR", {
              dateStyle: "short",
              timeStyle: "short"
            })
          : null,
        pedido.deliveryMode === "delivery"
          ? `Entrega${pedido.carrier ? ` (${pedido.carrier})` : ""}`
          : pedido.deliveryMode === "pickup"
            ? "Retirada"
            : null
      ]
        .filter(Boolean)
        .join(" · ") || "—";

  const arte = await miniaturas(
    [pedido.dealId, pedido.rootDealId].filter(Boolean) as number[],
    companyId
  );

  const corpo = `
    ${pedido.canceledAt ? `<div class="observacoes"><div class="rotulo">Pedido cancelado</div>Cancelado em ${data(pedido.canceledAt)}${pedido.canceledReason ? `: ${escapar(pedido.canceledReason)}` : ""}. Não produzir.</div>` : ""}
    <section class="dados">
      ${campo("Cliente", nomeCliente)}
      ${campo("Telefone", pedido.customer?.phone || pedido.contact?.number)}
      ${campo("Referência", pedido.title)}
      ${campo("Vendedor", pedido.responsibleUser?.name)}
      ${campo("Entrega", entrega)}
      ${campo("Aprovado em", data(pedido.approvedAt || pedido.createdAt))}
    </section>

    ${tabelaDeItens(itens, mostrarValores)}
    ${mostrarValores ? blocoDeTotais(itens, valorLiquidoDoNegocio(pedido), true) : ""}
    ${observacoes("Observações", pedido.notes)}
    ${arte}

    <div class="conferencia">
      <div>Arte conferida</div>
      <div>Impressão</div>
      <div>Acabamento</div>
      <div>Conferência final</div>
    </div>`;

  return montarDocumento({
    tituloDaAba: `O.P. — Pedido nº ${pedido.number} — ${nomeCliente}`,
    empresa,
    tipo: "Ordem de produção",
    numero: String(pedido.number),
    linhasDoNumero: [
      `Pedido nº ${pedido.number}`,
      ...(pedido.quoteNumber ? [`Orçamento nº ${pedido.quoteNumber}`] : [])
    ],
    corpo
  });
};

export default OrdemDeProducaoService;
