import fs from "fs";
import path from "path";

import Company from "../../models/Company";
import { descreverMedida } from "../../helpers/CalcularItem";

/**
 * Peças comuns dos documentos impressos (proposta, ordem de produção,
 * cobrança): o mesmo A4, o mesmo cabeçalho da empresa, a mesma tabela de
 * itens. Documentos do mesmo trabalho precisam se reconhecer lado a lado.
 *
 * HTML e não PDF, como a O.S. original: gerar PDF exigiria um navegador
 * headless no servidor, que esta instalação evita. O navegador de quem emite
 * imprime ou salva em PDF.
 */

export const dinheiro = (valor: number): string =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const quantidade = (valor: number): string =>
  Number.isInteger(valor)
    ? String(valor)
    : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

export const data = (valor?: Date | string | null): string =>
  valor ? new Date(valor).toLocaleDateString("pt-BR") : "—";

/** Impede que nome de cliente ou descrição de item quebrem o HTML gerado. */
export const escapar = (texto: unknown): string =>
  String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const pastaPublica = path.resolve(__dirname, "..", "..", "..", "public");

const TIPOS_DE_IMAGEM: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif"
};

/**
 * A logo vai embutida no próprio HTML.
 *
 * O documento abre numa aba a partir de um blob, sem endereço do servidor:
 * um <img src="/public/logo.png"> apontaria para lugar nenhum. Embutir também
 * faz o PDF salvo continuar com a logo depois.
 */
const logoEmbutida = (company: Company): string | null => {
  const arquivo = company.getDataValue("logo") as string | null;
  if (!arquivo) return null;
  try {
    const caminho = path.join(pastaPublica, path.basename(arquivo));
    const tipo = TIPOS_DE_IMAGEM[path.extname(caminho).toLowerCase()];
    if (!tipo || !fs.existsSync(caminho)) return null;
    // Logo enorme incharia todo documento; acima disso, só o nome.
    if (fs.statSync(caminho).size > 600 * 1024) return null;
    return `data:${tipo};base64,${fs.readFileSync(caminho).toString("base64")}`;
  } catch {
    return null;
  }
};

export const empresaDoDocumento = async (companyId: number): Promise<Company | null> =>
  Company.findByPk(companyId, {
    attributes: ["id", "name", "legalName", "document", "email", "phone", "address", "logo"]
  });

export const cabecalhoDaEmpresa = (company: Company | null): string => {
  if (!company) return `<div class="empresa">Unmess</div>`;
  const logo = logoEmbutida(company);
  const linhas = [
    company.legalName && company.legalName !== company.name ? company.legalName : null,
    company.document ? `CNPJ/CPF ${company.document}` : null,
    company.address,
    [company.phone, company.email].filter(Boolean).join(" · ") || null
  ].filter(Boolean);

  return `
    <div class="marca">
      ${logo ? `<img class="logo" src="${logo}" alt="" />` : ""}
      <div>
        <div class="empresa">${escapar(company.name)}</div>
        ${linhas.map(l => `<div class="linha-empresa">${escapar(l)}</div>`).join("")}
      </div>
    </div>`;
};

export interface ItemDoDocumento {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  total: number;
  width: number;
  height: number;
  pricingMode: string;
  minMeasure: number;
  notes?: string | null;
}

export const tabelaDeItens = (itens: ItemDoDocumento[], mostrarValores: boolean): string => {
  const colunas = mostrarValores ? 6 : 3;
  const linhas = itens
    .map((item, i) => {
      // A medida é o que se procura primeiro na oficina e o que o cliente
      // confere na proposta; sem ela "Banner" não diz nada.
      const medida = descreverMedida(item);
      return `
        <tr>
          <td class="num">${i + 1}</td>
          <td>
            ${escapar(item.description)}
            ${medida ? `<div class="medida">${escapar(medida)}</div>` : ""}
            ${item.notes ? `<div class="obs">${escapar(item.notes)}</div>` : ""}
          </td>
          <td class="num">${quantidade(item.quantity)} ${escapar(item.unit)}</td>
          ${
            mostrarValores
              ? `<td class="num">${dinheiro(item.unitPrice)}</td>
          <td class="num">${item.discount > 0 ? `− ${dinheiro(item.discount)}` : "—"}</td>
          <td class="num forte">${dinheiro(item.total)}</td>`
              : ""
          }
        </tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th style="width:8mm">#</th>
          <th>Descrição</th>
          <th class="num" style="width:22mm">Qtd.</th>
          ${
            mostrarValores
              ? `<th class="num" style="width:26mm">Unitário</th>
          <th class="num" style="width:24mm">Desconto</th>
          <th class="num" style="width:28mm">Total</th>`
              : ""
          }
        </tr>
      </thead>
      <tbody>${
        itens.length
          ? linhas
          : `<tr><td colspan="${colunas}" class="vazio">Nenhum item registrado.</td></tr>`
      }</tbody>
    </table>`;
};

export const blocoDeTotais = (
  itens: ItemDoDocumento[],
  total: number,
  mostrarValores: boolean
): string => {
  const somaDosItens = itens.reduce((soma, item) => soma + item.total, 0);
  const desconto = Number((somaDosItens - total).toFixed(2));
  return `
    <div class="totais">
      <table>
        <tr><td class="rotulo">Itens</td><td class="num">${itens.length}</td></tr>
        ${
          mostrarValores && desconto > 0
            ? `<tr><td class="rotulo">Subtotal</td><td class="num">${dinheiro(somaDosItens)}</td></tr>
               <tr><td class="rotulo">Desconto</td><td class="num">− ${dinheiro(desconto)}</td></tr>`
            : ""
        }
        ${
          mostrarValores
            ? `<tr class="final"><td>Total</td><td class="num">${dinheiro(total)}</td></tr>`
            : ""
        }
      </table>
    </div>`;
};

export const campo = (rotulo: string, valor: unknown): string => `
  <div class="campo">
    <div class="rotulo">${escapar(rotulo)}</div>
    <div class="valor">${escapar(valor) || "—"}</div>
  </div>`;

export const observacoes = (rotulo: string, texto?: string | null): string =>
  texto
    ? `<div class="observacoes"><div class="rotulo">${escapar(rotulo)}</div>${escapar(texto).replace(/\n/g, "<br />")}</div>`
    : "";

const CSS = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, sans-serif; font-size: 11pt; line-height: 1.45; color: #111; background: #fff; }
  .folha { max-width: 186mm; margin: 0 auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12mm; border-bottom: 2px solid #111; padding-bottom: 6mm; margin-bottom: 6mm; }
  .marca { display: flex; gap: 4mm; align-items: flex-start; }
  .logo { max-height: 18mm; max-width: 40mm; object-fit: contain; }
  .empresa { font-size: 15pt; font-weight: 700; letter-spacing: -0.01em; }
  .linha-empresa { font-size: 8.5pt; color: #555; }
  .doc { text-align: right; white-space: nowrap; }
  .doc .titulo { font-size: 12pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .doc .numero { font-size: 20pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .doc .data { font-size: 9.5pt; color: #555; }
  .dados { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm; margin-bottom: 6mm; }
  .campo .rotulo { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.07em; color: #666; }
  .campo .valor { font-size: 11pt; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f0f0f0; border-bottom: 1.5px solid #111; padding: 2.5mm 2mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; }
  tbody td { padding: 2.5mm 2mm; border-bottom: 0.4mm solid #e2e2e2; vertical-align: top; }
  tbody tr { break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num:first-child { text-align: center; color: #777; }
  .forte { font-weight: 700; }
  .obs { font-size: 9pt; color: #555; margin-top: 1mm; }
  .medida { font-size: 9.5pt; font-weight: 700; margin-top: 0.8mm; }
  .vazio { text-align: center; color: #777; padding: 8mm 0; }
  .totais { display: flex; justify-content: flex-end; margin-top: 4mm; }
  .totais table { width: 70mm; }
  .totais td { border: none; padding: 1.5mm 2mm; }
  .totais .rotulo { color: #555; }
  .totais .final td { border-top: 1.5px solid #111; font-size: 13pt; font-weight: 700; padding-top: 2.5mm; }
  .observacoes { margin-top: 6mm; padding: 3mm 4mm; border: 0.4mm solid #ddd; border-left: 1mm solid #111; font-size: 10pt; break-inside: avoid; }
  .observacoes .rotulo { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.07em; color: #666; margin-bottom: 1mm; }
  .conferencia { margin-top: 6mm; display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; break-inside: avoid; }
  .conferencia div { border: 0.4mm solid #bbb; padding: 2mm; font-size: 9pt; min-height: 14mm; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 16mm; margin-top: 18mm; break-inside: avoid; }
  .assinatura { border-top: 0.4mm solid #111; padding-top: 2mm; font-size: 9.5pt; text-align: center; }
  .miniaturas { display: flex; flex-wrap: wrap; gap: 3mm; margin-top: 4mm; }
  .miniaturas img { width: 40mm; height: 30mm; object-fit: contain; border: 0.4mm solid #ddd; }
  .pix { display: flex; gap: 6mm; align-items: center; margin-top: 4mm; break-inside: avoid; }
  .pix img { width: 42mm; height: 42mm; }
  .copia { font-family: Consolas, monospace; font-size: 8.5pt; word-break: break-all; background: #f5f5f5; padding: 2mm; }
  footer { margin-top: 10mm; padding-top: 3mm; border-top: 0.4mm solid #ddd; font-size: 8.5pt; color: #777; display: flex; justify-content: space-between; }
  .imprimir { position: fixed; top: 12px; right: 12px; padding: 8px 16px; font: inherit; font-size: 10pt; background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  @media screen { body { padding-top: 46px; } }
  @media print { .imprimir { display: none; } }
`;

interface Documento {
  tituloDaAba: string;
  empresa: Company | null;
  tipo: string;
  numero: string;
  linhasDoNumero: string[];
  corpo: string;
  rodape?: string;
}

export const montarDocumento = ({
  tituloDaAba,
  empresa,
  tipo,
  numero,
  linhasDoNumero,
  corpo,
  rodape
}: Documento): string => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapar(tituloDaAba)}</title>
<style>${CSS}</style>
</head>
<body>
  <button class="imprimir" onclick="window.print()">Imprimir / Salvar PDF</button>
  <div class="folha">
    <header>
      ${cabecalhoDaEmpresa(empresa)}
      <div class="doc">
        <div class="titulo">${escapar(tipo)}</div>
        <div class="numero">nº ${escapar(numero)}</div>
        ${linhasDoNumero.map(l => `<div class="data">${escapar(l)}</div>`).join("")}
      </div>
    </header>
    ${corpo}
    <footer>
      <span>${escapar(rodape || "")}</span>
      <span>Emitido em ${new Date().toLocaleString("pt-BR")}</span>
    </footer>
  </div>
</body>
</html>`;
