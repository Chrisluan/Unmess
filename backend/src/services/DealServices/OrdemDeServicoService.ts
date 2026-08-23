import Deal from "../../models/Deal";
import DealItem from "../../models/DealItem";
import Customer from "../../models/Customer";
import Contact from "../../models/Contact";
import Company from "../../models/Company";
import Board from "../../models/Board";
import Order from "../../models/Order";
import User from "../../models/User";
import AppError from "../../errors/AppError";
import { descreverMedida } from "../../helpers/CalcularItem";
import valorLiquidoDoNegocio from "../../helpers/ValorLiquidoDoNegocio";

interface Request {
  dealId: number | string;
  companyId: number;
}

const dinheiro = (valor: number): string =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const quantidade = (valor: number): string =>
  Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

const data = (valor?: Date | null): string =>
  valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";

/** Impede que nome de cliente ou descrição de item quebrem o HTML gerado. */
const escapar = (texto: unknown): string =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Monta a ordem de serviço em HTML, no formato A4.
 *
 * HTML e não PDF: gerar PDF exigiria uma biblioteca a mais e, principalmente,
 * um navegador headless -- justamente o que esta instalação evita para caber
 * nos 8 GB da máquina. O HTML abre no navegador do atendente, que imprime ou
 * salva em PDF com o próprio "Imprimir", com o mesmo resultado e sem nada
 * rodando no servidor.
 *
 * O CSS de impressão fixa margem e tamanho A4 para o papel sair igual em
 * qualquer impressora, e evita quebrar uma linha do pedido ao meio entre duas
 * páginas.
 */
const OrdemDeServicoService = async ({ dealId, companyId }: Request): Promise<string> => {
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    include: [
      {
        model: DealItem,
        as: "items",
        required: false,
        separate: true,
        order: [["position", "ASC"], ["id", "ASC"]]
      },
      { model: Customer, as: "customer" },
      { model: Contact, as: "contact" },
      { model: User, as: "responsibleUser", attributes: ["id", "name"] },
      { model: Company, as: "company", attributes: ["id", "name"] },
      { model: Board, as: "board", attributes: ["id", "name", "isSalesFunnel"], required: false },
      {
        model: Order,
        as: "salesOrder",
        attributes: ["id", "number", "quoteNumber"],
        required: false
      }
    ]
  });

  if (!deal) throw new AppError("ERR_NO_DEAL_FOUND", 404);

  const itens = (deal.items || []) as DealItem[];

  /**
   * O documento fecha com o valor que o cliente paga.
   *
   * A soma dos itens é o bruto; o desconto da proposta incide sobre ele. O
   * documento imprimia o bruto e a cobrança lançava o líquido -- dois papéis do
   * mesmo pedido com números diferentes, e a diferença aparecendo só na hora
   * da conversa constrangedora.
   */
  const somaDosItens = itens.reduce((soma, item) => soma + item.total, 0);
  const total = valorLiquidoDoNegocio(deal);
  const desconto = Number((somaDosItens - total).toFixed(2));

  const nomeCliente =
    deal.customer?.name || deal.contact?.name || "Cliente não identificado";

  /**
   * O documento é orçamento ou pedido, e traz o número que o cliente ouve.
   *
   * Antes saía o `deal.id` -- o id da linha no banco. Dois documentos do mesmo
   * trabalho (o orçamento e o pedido que nasceu dele) saíam com números
   * diferentes, nenhum dos dois igual ao que a empresa numera.
   */
  const pedido = deal.salesOrder;
  const eOrcamento = !pedido && deal.board?.isSalesFunnel !== false;

  const tipoDoDocumento = eOrcamento ? "Orçamento" : "Pedido";
  const numeroDoDocumento =
    pedido?.number || deal.quoteNumber || deal.id;
  const orcamentoDeOrigem = pedido?.quoteNumber || null;
  const telefone = deal.contact?.number || "";

  const linhas = itens
    .map(
      (item, i) => `
        <tr>
          <td class="num">${i + 1}</td>
          <td>
            ${escapar(item.description)}
            ${(() => {
              // Sem as dimensões, quem produz precisa perguntar o tamanho --
              // e é a informação mais importante do papel na oficina.
              const medida = descreverMedida(item);
              return medida ? `<div class="medida">${escapar(medida)}</div>` : "";
            })()}
            ${item.notes ? `<div class="obs">${escapar(item.notes)}</div>` : ""}
          </td>
          <td class="num">${quantidade(item.quantity)} ${escapar(item.unit)}</td>
          <td class="num">${dinheiro(item.unitPrice)}</td>
          <td class="num">${item.discount > 0 ? `− ${dinheiro(item.discount)}` : "—"}</td>
          <td class="num forte">${dinheiro(item.total)}</td>
        </tr>`
    )
    .join("");

  const semItens = `
        <tr><td colspan="6" class="vazio">Nenhum item registrado neste pedido.</td></tr>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${tipoDoDocumento} nº ${numeroDoDocumento} — ${escapar(nomeCliente)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 11pt;
    line-height: 1.45;
    color: #111;
    background: #fff;
  }

  .folha { max-width: 186mm; margin: 0 auto; }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16mm;
    border-bottom: 2px solid #111;
    padding-bottom: 6mm;
    margin-bottom: 6mm;
  }

  .empresa { font-size: 15pt; font-weight: 700; letter-spacing: -0.01em; }
  .doc { text-align: right; }
  .doc .titulo { font-size: 13pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .doc .numero { font-size: 20pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .doc .data { font-size: 9.5pt; color: #555; }

  .dados {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4mm 10mm;
    margin-bottom: 6mm;
  }

  .campo .rotulo {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #666;
  }

  .campo .valor { font-size: 11pt; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; }

  thead th {
    background: #f0f0f0;
    border-bottom: 1.5px solid #111;
    padding: 2.5mm 2mm;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
  }

  tbody td {
    padding: 2.5mm 2mm;
    border-bottom: 0.4mm solid #e2e2e2;
    vertical-align: top;
  }

  /* Uma linha do pedido não pode ser partida entre duas páginas: o item ficaria
     com a descrição numa folha e o preço na outra. */
  tbody tr { break-inside: avoid; }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num:first-child { text-align: center; color: #777; }
  .forte { font-weight: 700; }
  .obs { font-size: 9pt; color: #555; margin-top: 1mm; }
  /* A medida é o que se procura primeiro na oficina; vem em destaque. */
  .medida { font-size: 9.5pt; font-weight: 700; margin-top: 0.8mm; }
  .vazio { text-align: center; color: #777; padding: 8mm 0; }

  .totais { display: flex; justify-content: flex-end; margin-top: 4mm; }

  .totais table { width: 70mm; }
  .totais td { border: none; padding: 1.5mm 2mm; }
  .totais .rotulo { color: #555; }
  .totais .final td {
    border-top: 1.5px solid #111;
    font-size: 13pt;
    font-weight: 700;
    padding-top: 2.5mm;
  }

  .observacoes {
    margin-top: 8mm;
    padding: 3mm 4mm;
    border: 0.4mm solid #ddd;
    border-left: 1mm solid #111;
    font-size: 10pt;
    break-inside: avoid;
  }

  .observacoes .rotulo {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #666;
    margin-bottom: 1mm;
  }

  .assinaturas {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16mm;
    margin-top: 18mm;
    break-inside: avoid;
  }

  .assinatura { border-top: 0.4mm solid #111; padding-top: 2mm; font-size: 9.5pt; text-align: center; }

  footer {
    margin-top: 10mm;
    padding-top: 3mm;
    border-top: 0.4mm solid #ddd;
    font-size: 8.5pt;
    color: #777;
    display: flex;
    justify-content: space-between;
  }

  .imprimir {
    position: fixed;
    top: 12px;
    right: 12px;
    padding: 8px 16px;
    font: inherit;
    font-size: 10pt;
    background: #111;
    color: #fff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  /* Na tela, o documento desce para o botão não cobrir o cabeçalho; no papel
     essa folga não existe. */
  @media screen { body { padding-top: 46px; } }

  /* O botão é da tela, não do papel. */
  @media print { .imprimir { display: none; } }
</style>
</head>
<body>
  <button class="imprimir" onclick="window.print()">Imprimir / Salvar PDF</button>

  <div class="folha">
    <header>
      <div>
        <div class="empresa">${escapar(deal.company?.name || "Unmess")}</div>
        <div style="font-size:9.5pt;color:#555">Ordem de serviço / ${tipoDoDocumento}</div>
      </div>
      <div class="doc">
        <div class="titulo">Ordem de Serviço</div>
        <div class="numero">${tipoDoDocumento} nº ${numeroDoDocumento}</div>
        ${orcamentoDeOrigem
          ? `<div class="data">Orçamento nº ${orcamentoDeOrigem}</div>`
          : ""}
        <div class="data">Emitida em ${new Date().toLocaleDateString("pt-BR")}</div>
      </div>
    </header>

    <section class="dados">
      <div class="campo">
        <div class="rotulo">Cliente</div>
        <div class="valor">${escapar(nomeCliente)}</div>
      </div>
      <div class="campo">
        <div class="rotulo">Telefone</div>
        <div class="valor">${escapar(telefone) || "—"}</div>
      </div>
      <div class="campo">
        <div class="rotulo">Referência</div>
        <div class="valor">${escapar(deal.title)}</div>
      </div>
      <div class="campo">
        <div class="rotulo">Responsável</div>
        <div class="valor">${escapar(deal.responsibleUser?.name || "—")}</div>
      </div>
      <div class="campo">
        <div class="rotulo">Previsão de entrega</div>
        <div class="valor">${data(deal.expectedCloseAt)}</div>
      </div>
      <div class="campo">
        <div class="rotulo">Situação</div>
        <div class="valor">${
          { open: "Em aberto", won: "Fechado", lost: "Perdido", moved: "Em andamento" }[
            deal.status
          ] || escapar(deal.status)
        }</div>
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th style="width:8mm">#</th>
          <th>Descrição</th>
          <th class="num" style="width:22mm">Qtd.</th>
          <th class="num" style="width:26mm">Unitário</th>
          <th class="num" style="width:24mm">Desconto</th>
          <th class="num" style="width:28mm">Total</th>
        </tr>
      </thead>
      <tbody>${itens.length ? linhas : semItens}</tbody>
    </table>

    <div class="totais">
      <table>
        <tr>
          <td class="rotulo">Itens</td>
          <td class="num">${itens.length}</td>
        </tr>
        ${
          desconto > 0
            ? `<tr>
                 <td class="rotulo">Subtotal</td>
                 <td class="num">${dinheiro(somaDosItens)}</td>
               </tr>
               <tr>
                 <td class="rotulo">Desconto</td>
                 <td class="num">− ${dinheiro(desconto)}</td>
               </tr>`
            : ""
        }
        <tr class="final">
          <td>Total</td>
          <td class="num">${dinheiro(total)}</td>
        </tr>
      </table>
    </div>

    ${
      deal.notes
        ? `<div class="observacoes">
      <div class="rotulo">Observações</div>
      <div>${escapar(deal.notes).replace(/\n/g, "<br />")}</div>
    </div>`
        : ""
    }

    <div class="assinaturas">
      <div class="assinatura">${escapar(deal.company?.name || "Unmess")}</div>
      <div class="assinatura">${escapar(nomeCliente)}</div>
    </div>

    <footer>
      <span>${tipoDoDocumento} nº ${numeroDoDocumento}</span>
      <span>Gerado em ${new Date().toLocaleString("pt-BR")}</span>
    </footer>
  </div>
</body>
</html>`;
};

export default OrdemDeServicoService;
