import React from "react";
import { BrowserRouter, Switch, Redirect } from "react-router-dom";
import Avisos from "../components/Avisos";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import Tickets from "../pages/Tickets/";
import Login from "../pages/Login/";
import Settings from "../pages/Settings/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import Customers from "../pages/Customers/";
import Crm from "../pages/Crm/";
import Cadastros from "../pages/Cadastros/";
import Queues from "../pages/Queues/";
import Companies from "../pages/Companies/";
import CompanyDetail from "../pages/CompanyDetail/";
import Access from "../pages/Access/";
import SuperCompanySelect from "../pages/SuperCompanySelect/";
import TeamChat from "../pages/TeamChat/";
import Finance from "../pages/Finance";
import FinancePdv from "../pages/Finance/Pdv";
import FinanceMetricas from "../pages/Finance/Metricas";
import FinanceReceber from "../pages/Finance/Receber";
import FinancePagar from "../pages/Finance/Pagar";
import FinanceCaixa from "../pages/Finance/Caixa";
import FinanceConfiguracao from "../pages/Finance/Configuracao";
import { TeamChatProvider } from "../context/TeamChat";
import { RadioDock } from "../components/TeamRadio";
import TeamChat from "../pages/TeamChat/";
import { TeamChatProvider } from "../context/TeamChat";
import { RadioDock } from "../components/TeamRadio";

import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { AttendanceSettingsProvider } from "../context/Settings/AttendanceSettingsContext";
import { BrandingProvider } from "../context/Branding";
import { OutgoingMessagesProvider } from "../context/OutgoingMessages/OutgoingMessagesContext";
import { ThemeProvider } from "../context/DarkMode";
// O codemod importou StyledEngineProvider junto do ThemeProvider local; ele
// vem do MUI. injectFirst faz o CSS do Emotion ser injetado antes, para as
// classes do makeStyles continuarem vencendo os estilos padrão dos componentes.
import { StyledEngineProvider } from "@mui/material/styles";
import Route from "./Route";

const ConnectionsRedirect = () => <Redirect to="/Settings?aba=conexoes" />;

/**
 * Os caminhos que mudaram de casa.
 *
 * Produtos, Respostas rápidas, Etiquetas, Mensagens automáticas e Status de
 * finalização viraram abas de Cadastro. Link antigo em e-mail, favorito do
 * navegador e atalho anotado num papel continuam chegando onde devem — cada
 * um direto na sua aba, e não numa tela genérica de onde a pessoa teria de
 * procurar de novo.
 *
 * Os redirects não carregam permissão: quem não alcança a aba entra em
 * Cadastro e cai na primeira que lhe cabe; quem não alcança nenhuma é barrado
 * pela própria rota de /cadastros.
 */
const ParaCadastros = (aba) => {
  const Redireciona = () => <Redirect to={`/cadastros#${aba}`} />;
  // Sem displayName o React DevTools mostra três componentes chamados
  // "Redireciona" e não dá para saber qual é qual.
  Redireciona.displayName = `ParaCadastros(${aba})`;
  return Redireciona;
};

// Montados uma vez, fora do render: usados inline, o `component` do Route
// mudaria de identidade a cada render e remontaria o redirect sem parar.
const ParaProdutos = ParaCadastros("produtos");
const ParaRespostasRapidas = ParaCadastros("respostas-rapidas");
const ParaEtiquetas = ParaCadastros("etiquetas");

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StyledEngineProvider injectFirst>
          <ThemeProvider>
            <Switch>
              <Route exact path="/login"            component={Login} />
              {/* Tela de seleção de empresa para super-admin — sem layout */}
              <Route exact path="/select-company"   component={SuperCompanySelect} isPrivate superOnly />
              <WhatsAppsProvider>
                <AttendanceSettingsProvider>
                <BrandingProvider>
                <OutgoingMessagesProvider>
                <TeamChatProvider>
                <TeamChatProvider>
                <LoggedInLayout>
                  <RadioDock />
                  <RadioDock />
                  <Route exact path="/"                   component={Dashboard}        isPrivate permission="dashboard:view" />
                  <Route exact path="/tickets/:ticketId?" component={Tickets}          isPrivate permission="tickets:view" />
                  {/* Chat de equipe e rádio: de toda pessoa da empresa, sem permissão. */}
                  <Route exact path="/equipe/:channelId?"  component={TeamChat}         isPrivate />
                  {/* Chat de equipe e rádio: de toda pessoa da empresa, sem permissão. */}
                  <Route exact path="/equipe/:channelId?"     component={TeamChat}         isPrivate />
                  {/* Conexões virou aba de Configurações. A rota fica como
                      redirect para não quebrar link/bookmark antigo. */}
                  <Route exact path="/connections"        component={ConnectionsRedirect} isPrivate permission="connections:view" />
                  <Route exact path="/contacts"           component={Contacts}         isPrivate permission="contacts:view" />
                  <Route exact path="/customers"          component={Customers}        isPrivate permission="clients:view" />
                  <Route exact path="/crm"                component={Crm}              isPrivate permission="crm:view" />
                  <Route exact path="/users"              component={Users}            isPrivate permission="users:view" />
                  {/* Financeiro, um módulo por rota, com as mesmas permissões
                      dos itens de menu (layout/modulos.js). Estas rotas se
                      perderam na revisão de UI de 17/11: o menu apontava para
                      páginas que não existiam. */}
                  <Route exact path="/finance"                component={Finance}             isPrivate permission="finance:view" />
                  <Route exact path="/finance/pdv"            component={FinancePdv}          isPrivate permission="finance:pos" />
                  <Route exact path="/finance/metricas"       component={FinanceMetricas}     isPrivate permission="finance:cashflow" />
                  <Route exact path="/finance/receber"        component={FinanceReceber}      isPrivate permission="finance:view" />
                  <Route exact path="/finance/pagar"          component={FinancePagar}        isPrivate permission="finance:view" />
                  <Route exact path="/finance/caixa"          component={FinanceCaixa}        isPrivate permission="finance:cashflow" />
                  <Route exact path="/finance/configuracao"   component={FinanceConfiguracao} isPrivate permission="finance:manage" />
                  {/* Cadastro: produtos, respostas rápidas, etiquetas,
                      mensagens automáticas e status de finalização. Cinco
                      permissões diferentes, e basta uma para entrar — lá
                      dentro cada aba pergunta pela sua. */}
                  <Route exact path="/cadastros"          component={Cadastros}        isPrivate anyOf={["products:view", "quickAnswers:view", "tags:view", "settings:view"]} />
                  <Route exact path="/quickAnswers"       component={ParaRespostasRapidas} isPrivate />
                  <Route exact path="/products"           component={ParaProdutos}     isPrivate />
                  <Route exact path="/tags"               component={ParaEtiquetas}    isPrivate />
                  {/* Conexões mora dentro de Configurações e tem permissão
                      própria: quem cuida só dos números também entra. */}
                  <Route exact path="/Settings"           component={Settings}         isPrivate anyOf={["settings:view", "connections:view", "tags:view"]} />
                  <Route exact path="/Queues"             component={Queues}           isPrivate permission="queues:view" />
                  <Route exact path="/companies"          component={Companies}        isPrivate superOnly />
                  {/* Ficha da empresa: usuários, cobrança e acesso. Depois
                      da rota exata acima para não capturá-la. */}
                  <Route exact path="/companies/:companyId" component={CompanyDetail}  isPrivate superOnly />
                  <Route exact path="/roles"              component={Access}           isPrivate permission="roles:view" />
                </LoggedInLayout>
                </TeamChatProvider>
                </TeamChatProvider>
                </OutgoingMessagesProvider>
                </BrandingProvider>
                </AttendanceSettingsProvider>
              </WhatsAppsProvider>
            </Switch>
            <Avisos />
          </ThemeProvider>
        </StyledEngineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
