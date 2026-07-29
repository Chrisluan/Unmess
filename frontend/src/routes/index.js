import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import Tickets from "../pages/Tickets/";
import Login from "../pages/Login/";
import Connections from "../pages/Connections/";
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
import { ThemeProvider } from "../context/DarkMode";
import Route from "./Route";

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
              <LoggedInLayout>
                <Route exact path="/"                   component={Dashboard}        isPrivate permission="dashboard:access" />
                <Route exact path="/tickets/:ticketId?" component={Tickets}          isPrivate permission="tickets:access" />
                <Route exact path="/connections"        component={Connections}      isPrivate permission="connections:access" />
                <Route exact path="/contacts"           component={Contacts}         isPrivate permission="contacts:access" />
                <Route exact path="/customers"          component={Customers}        isPrivate permission="clients:access" />
                <Route exact path="/users"              component={Users}            isPrivate />
                <Route exact path="/quickAnswers"       component={QuickAnswers}     isPrivate permission="quickAnswers:access" />
                <Route exact path="/Settings"           component={Settings}         isPrivate permission="settings:access" />
                <Route exact path="/Queues"             component={Queues}           isPrivate permission="queues:access" />
                <Route exact path="/companies"          component={Companies}        isPrivate />
                <Route exact path="/permission-groups"  component={PermissionGroups} isPrivate permission="permissionGroups:access" />
              </LoggedInLayout>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer autoClose={3000} />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
