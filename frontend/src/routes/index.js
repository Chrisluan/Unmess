import React from "react";
import { BrowserRouter, Switch, Redirect } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import Tickets from "../pages/Tickets/";
import Login from "../pages/Login/";
import Settings from "../pages/Settings/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import Customers from "../pages/Customers/";
import Crm from "../pages/Crm/";
import QuickAnswers from "../pages/QuickAnswers/";
import Products from "../pages/Products/";
import Finance from "../pages/Finance/";
import Queues from "../pages/Queues/";
import Companies from "../pages/Companies/";
import CompanyDetail from "../pages/CompanyDetail/";
import Access from "../pages/Access/";
import SuperCompanySelect from "../pages/SuperCompanySelect/";

import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { AttendanceSettingsProvider } from "../context/Settings/AttendanceSettingsContext";
import { BrandingProvider } from "../context/Branding";
import { ThemeProvider } from "../context/DarkMode";
// O codemod importou StyledEngineProvider junto do ThemeProvider local; ele
// vem do MUI. injectFirst faz o CSS do Emotion ser injetado antes, para as
// classes do makeStyles continuarem vencendo os estilos padrão dos componentes.
import { StyledEngineProvider } from "@mui/material/styles";
import Route from "./Route";

const ConnectionsRedirect = () => <Redirect to="/Settings" />;

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
                <LoggedInLayout>
                  <Route exact path="/"                   component={Dashboard}        isPrivate permission="dashboard:view" />
                  <Route exact path="/tickets/:ticketId?" component={Tickets}          isPrivate permission="tickets:view" />
                  {/* Conexões virou aba de Configurações. A rota fica como
                      redirect para não quebrar link/bookmark antigo. */}
                  <Route exact path="/connections"        component={ConnectionsRedirect} isPrivate permission="connections:view" />
                  <Route exact path="/contacts"           component={Contacts}         isPrivate permission="contacts:view" />
                  <Route exact path="/customers"          component={Customers}        isPrivate permission="clients:view" />
                  <Route exact path="/crm"                component={Crm}              isPrivate permission="crm:view" />
                  <Route exact path="/users"              component={Users}            isPrivate permission="users:view" />
                  <Route exact path="/quickAnswers"       component={QuickAnswers}     isPrivate permission="quickAnswers:view" />

                  <Route exact path="/products"             component={Products}         isPrivate permission="products:view" />
                  <Route exact path="/finance"            component={Finance}          isPrivate permission="finance:view" />
                  {/* Conexões e Etiquetas moram dentro de Configurações, e
                      têm permissão própria: quem cuida só delas também entra. */}
                  <Route exact path="/Settings"           component={Settings}         isPrivate anyOf={["settings:view", "connections:view", "tags:view"]} />
                  <Route exact path="/Queues"             component={Queues}           isPrivate permission="queues:view" />
                  <Route exact path="/companies"          component={Companies}        isPrivate superOnly />
                  {/* Ficha da empresa: usuários, cobrança e acesso. Depois
                      da rota exata acima para não capturá-la. */}
                  <Route exact path="/companies/:companyId" component={CompanyDetail}  isPrivate superOnly />
                  <Route exact path="/roles"              component={Access}           isPrivate permission="roles:view" />
                </LoggedInLayout>
                </BrandingProvider>
                </AttendanceSettingsProvider>
              </WhatsAppsProvider>
            </Switch>
            <ToastContainer autoClose={3000} />
          </ThemeProvider>
        </StyledEngineProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
