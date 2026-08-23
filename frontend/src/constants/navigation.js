import { i18n } from "../translate/i18n";

/**
 * Nome de cada tela, para a barra do topo.
 *
 * A barra repetia o nome da empresa — que já aparece no cabeçalho da lateral,
 * a dois centímetros dali. Duas vezes a mesma palavra, e nenhuma indicação de
 * onde a pessoa está. O item aceso na lateral resolve isso quando ela está
 * aberta; recolhida ou no celular, não sobra nada.
 *
 * A ordem importa: a busca é por prefixo e para no primeiro que casar, então
 * as rotas mais específicas vêm antes.
 */
const TITULOS = [
  ["/tickets", "mainDrawer.listItems.tickets"],
  ["/contacts", "mainDrawer.listItems.contacts"],
  ["/customers", "mainDrawer.listItems.customers"],
  ["/crm", "mainDrawer.listItems.crm"],
  ["/products", "mainDrawer.listItems.products"],
  ["/finance", "mainDrawer.listItems.finance"],
  ["/quickanswers", "mainDrawer.listItems.quickAnswers"],
  ["/users", "mainDrawer.listItems.users"],
  ["/roles", "mainDrawer.listItems.roles"],
  ["/queues", "mainDrawer.listItems.queues"],
  ["/settings", "mainDrawer.listItems.settings"],
  ["/companies/", "companies.detailTitle"],
  ["/companies", "mainDrawer.listItems.companies"],
];

export const tituloDaRota = (pathname) => {
  const rota = (pathname || "/").toLowerCase();
  if (rota === "/") return i18n.t("mainDrawer.listItems.dashboard");
  const achado = TITULOS.find(([prefixo]) => rota.startsWith(prefixo));
  return achado ? i18n.t(achado[1]) : "";
};

export default tituloDaRota;
