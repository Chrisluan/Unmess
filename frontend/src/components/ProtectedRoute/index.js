import React, { useContext } from "react";
import { Redirect } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePermissions from "../../hooks/usePermissions";

/**
 * Rota protegida por permissão granular.
 *
 * Uso:
 *   <ProtectedRoute
 *     path="/contacts"
 *     permission="contacts:access"
 *     component={Contacts}
 *   />
 */
const ProtectedRoute = ({ component: Component, permission, ...rest }) => {
  const { isAuth } = useContext(AuthContext);
  const { can, isAdmin } = usePermissions();

  if (!isAuth) return <Redirect to="/login" />;

  // Se não há permissão requerida, ou é admin, acesso livre
  if (!permission || isAdmin) return <Component {...rest} />;

  if (!can(permission)) return <Redirect to="/tickets" />;

  return <Component {...rest} />;
};

export default ProtectedRoute;
