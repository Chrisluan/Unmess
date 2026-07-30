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
import QuickAnswers from "../pages/QuickAnswers/";
import Queues from "../pages/Queues/";
import Companies from "../pages/Companies/";
import PermissionGroups from "../pages/PermissionGroups/";
import SuperCompanySelect from "../pages/SuperCompanySelect/";

import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { AttendanceSettingsProvider } from "../context/Settings/AttendanceSettingsContext";
import { ThemeProvider } from "../context/DarkMode";
import Route from "./Route";

const ConnectionsRedirect = () => <Redirect to="/Settings" />;

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Switch>
            <Route exact path="/login"            component={Login} />
            {/* Tela de seleção de empresa para super-admin — sem layout */}
            <Route exact path="/select-company"   component={SuperCompanySelect} isPrivate superOnly />
            <WhatsAppsProvider>
              <AttendanceSettingsProvider>
              <LoggedInLayout>
                <Route exact path="/"                   component={Dashboard}        isPrivate permission="dashboard:access" />
                <Route exact path="/tickets/:ticketId?" component={Tickets}          isPrivate permission="tickets:access" />
                {/* Conexões virou aba de Configurações. A rota fica como
                    redirect para não quebrar link/bookmark antigo. */}
                <Route exact path="/connections"        component={ConnectionsRedirect} isPrivate permission="connections:access" />
                <Route exact path="/contacts"           component={Contacts}         isPrivate permission="contacts:access" />
                <Route exact path="/customers"          component={Customers}        isPrivate permission="clients:access" />
                <Route exact path="/users"              component={Users}            isPrivate permission="users:access" />
                <Route exact path="/quickAnswers"       component={QuickAnswers}     isPrivate permission="quickAnswers:access" />
                <Route exact path="/Settings"           component={Settings}         isPrivate permission="settings:access" />
                <Route exact path="/Queues"             component={Queues}           isPrivate permission="queues:access" />
                <Route exact path="/companies"          component={Companies}        isPrivate />
                <Route exact path="/permission-groups"  component={PermissionGroups} isPrivate permission="permissionGroups:access" />
              </LoggedInLayout>
              </AttendanceSettingsProvider>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer autoClose={3000} />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
