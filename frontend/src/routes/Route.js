import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";

import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import usePermissions from "../hooks/usePermissions";

/**
 * Rota com suporte a:
 * - isPrivate: requer login
 * - permission: requer permissão granular (ex: "tickets:view")
 * - superOnly: acessível apenas por profile "super"
 *
 * Lógica especial super-admin:
 * - Super sem companyId → só pode acessar /select-company
 * - Super com companyId → acessa tudo como admin + pode voltar a /select-company
 */
const Route = ({
  component: Component,
  isPrivate = false,
  permission,
  /**
   * Para telas que reúnem assuntos com permissões diferentes — Configurações
   * abriga Conexões e Etiquetas. Sem isto, quem cuidasse só das conexões
   * teria a permissão e não teria como chegar na tela: a porta ficaria
   * trancada por um assunto que não é o dele.
   */
  anyOf,
  superOnly = false,
  ...rest
}) => {
  const { isAuth, loading, user } = useContext(AuthContext);
  const { can, canAny, isSuper } = usePermissions();

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

  /**
   * A permissão da rota, sem exceção para administrador.
   *
   * O Administrador é um cargo com todas as permissões, então ele passa por
   * `can(...)` como qualquer pessoa. O super da plataforma continua por cima:
   * ele opera dentro de uma empresa sem ser membro dela, e o backend faz o
   * mesmo — as duas pontas concordam.
   */
  if (isAuth && isPrivate && !isSuper) {
    if (permission && !can(permission)) return <Redirect to="/tickets" />;
    if (anyOf && !canAny(anyOf)) return <Redirect to="/tickets" />;
  }

  return <RouterRoute {...rest} component={Component} />;
};

export default Route;
