import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import usePermissions from "../hooks/usePermissions";

/**
 * Rota com suporte a:
 * - isPrivate: requer login
 * - permission: requer permissão granular (ex: "tickets:access")
 * - superOnly: acessível apenas por profile "super"
 *
 * Lógica especial super-admin:
 * - Super sem companyId → só pode acessar /select-company
 * - Super com companyId → acessa tudo como admin + pode voltar a /select-company
 */
const Route = ({ component: Component, isPrivate = false, permission, superOnly = false, ...rest }) => {
  const { isAuth, loading, user } = useContext(AuthContext);
  const { can, isAdmin } = usePermissions();

  if (loading) return <BackdropLoading />;

  // Não autenticado tentando acessar rota privada
  if (!isAuth && isPrivate) {
    return <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />;
  }

  // Autenticado tentando acessar rota pública (login)
  if (isAuth && !isPrivate) {
    if (user?.profile === "super" && !user?.companyId) {
      return <Redirect to="/select-company" />;
    }
    return <Redirect to="/tickets" />;
  }

  // Rota superOnly — apenas super pode acessar
  if (superOnly && user?.profile !== "super") {
    return <Redirect to="/tickets" />;
  }

  // Super sem empresa tentando acessar rota normal → manda selecionar empresa
  if (isAuth && isPrivate && !superOnly && user?.profile === "super" && !user?.companyId) {
    return <Redirect to="/select-company" />;
  }

  // Verifica permissão granular (admin/super com empresa passam sempre)
  if (isAuth && isPrivate && permission && !isAdmin && !can(permission)) {
    return <Redirect to="/tickets" />;
  }

  return <RouterRoute {...rest} component={Component} />;
};

export default Route;
