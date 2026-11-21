import { i18n } from "../translate/i18n";
import { MODULOS } from "../layout/modulos";

/**
 * Nome de cada tela, para a barra do topo.
 *
 * A barra repetia o nome da empresa — que já aparece no cabeçalho da lateral,
 * a dois centímetros dali. Duas vezes a mesma palavra, e nenhuma indicação de
 * onde a pessoa está. O item aceso na lateral resolve isso quando ela está
 * aberta; recolhida ou no celular, não sobra nada.
 *
 * A lista vem do mesmo registro que desenha o menu. Antes era uma segunda
 * cópia escrita à mão, e cópias envelhecem: a de Produtos e Respostas rápidas
 * continuaria apontando para telas que viraram abas de Cadastro, e o título
 * do topo diria uma coisa enquanto a lateral dizia outra.
 */
const ROTAS_ESPECIAIS = [
  // A ficha de uma empresa tem título próprio, e precisa vir antes de
  // "/companies" para não ser capturada por ele.
  ["/companies/", "companies.detailTitle"],
];

/**
 * A busca é por prefixo e para no primeiro que casar, então o caminho mais
 * comprido tem de vir primeiro: sem isso "/companies" engoliria
 * "/companies/12", e um dia "/cadastros" engoliria "/cadastros-algo".
 */
const TITULOS = [
  ...ROTAS_ESPECIAIS,
  ...MODULOS.filter((m) => m.to !== "/").map((m) => [m.to.toLowerCase(), m.rotulo]),
].sort((a, b) => b[0].length - a[0].length);

export const tituloDaRota = (pathname) => {
  const rota = (pathname || "/").toLowerCase();
  if (rota === "/") return i18n.t("mainDrawer.listItems.dashboard");
  const achado = TITULOS.find(([prefixo]) => rota.startsWith(prefixo));
  return achado ? i18n.t(achado[1]) : "";
};

export default tituloDaRota;
