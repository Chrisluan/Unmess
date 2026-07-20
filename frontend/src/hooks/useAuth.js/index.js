import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import openSocket from "../../services/socket-io";

import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

/**
 * Hook de autenticação com suporte a super-admin multi-empresa.
 *
 * Fluxo super-admin:
 *   login → user.profile === "super" && !user.companyId → /select-company
 *   handleSelectCompany(companyId) → novo token com companyId → /tickets
 *   handleLeaveCompany() → restaura token original sem companyId → /select-company
 *
 * Tokens:
 *   "token"         — access token atual (pode ter companyId se super selecionou empresa)
 *   "superToken"    — token original do super sem companyId (guardado ao selecionar empresa)
 */
const useAuth = () => {
  const history = useHistory();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({});

  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
        setIsAuth(true);
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error?.response?.status === 403 && !originalRequest._retry) {
        originalRequest._retry = true;
        const { data } = await api.post("/auth/refresh_token");
        if (data) {
          localStorage.setItem("token", JSON.stringify(data.token));
          api.defaults.headers.Authorization = `Bearer ${data.token}`;
        }
        return api(originalRequest);
      }
      if (error?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("superToken");
        api.defaults.headers.Authorization = undefined;
        setIsAuth(false);
      }
      return Promise.reject(error);
    }
  );

  const loadUserPermissions = async (userId) => {
    try {
      const { data } = await api.get(`/permission-groups/user/${userId}`);
      return data.permissions || [];
    } catch {
      return [];
    }
  };

  const applyToken = async (token, skipPermissions = false) => {
    localStorage.setItem("token", JSON.stringify(token));
    api.defaults.headers.Authorization = `Bearer ${token}`;

    const { data: refreshData } = await api.post("/auth/refresh_token");
    const userData = refreshData.user;

    const permissions = skipPermissions ? [] : await loadUserPermissions(userData.id);
    setUser({ ...userData, permissions });
    setIsAuth(true);
    return userData;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          const userData = await applyToken(JSON.parse(token));
          // Super sem empresa → redireciona para seleção
          if (userData.profile === "super" && !userData.companyId) {
            history.push("/select-company");
          }
        } catch (err) {
          toastError(err);
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const socket = openSocket();
    socket.on("user", async (data) => {
      if (data.action === "update" && data.user.id === user.id) {
        const permissions = await loadUserPermissions(data.user.id);
        setUser({ ...data.user, permissions });
      }
    });
    return () => socket.disconnect();
  }, [user]);

  const handleLogin = async (userData) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", userData);
      localStorage.setItem("token", JSON.stringify(data.token));
      api.defaults.headers.Authorization = `Bearer ${data.token}`;

      const permissions = await loadUserPermissions(data.user.id);
      const enrichedUser = { ...data.user, permissions };
      setUser(enrichedUser);
      setIsAuth(true);

      toast.success(i18n.t("auth.toasts.success"));
      setLoading(false);

      // Super sem empresa → seleção de empresa
      if (data.user.profile === "super" && !data.user.companyId) {
        history.push("/select-company");
      } else {
        history.push("/tickets");
      }
    } catch (err) {
      toastError(err);
      setLoading(false);
    }
  };

  /**
   * Super-admin seleciona uma empresa.
   * Guarda o token original para poder sair depois.
   */
  const handleSelectCompany = async (companyId) => {
    // Guarda token original do super (sem companyId)
    const currentToken = localStorage.getItem("token");
    localStorage.setItem("superToken", currentToken);

    const { data } = await api.post("/auth/select-company", { companyId });

    // Aplica o novo token com companyId
    localStorage.setItem("token", JSON.stringify(data.token));
    api.defaults.headers.Authorization = `Bearer ${data.token}`;

    const { data: refreshData } = await api.post("/auth/refresh_token");
    const permissions = await loadUserPermissions(refreshData.user.id);
    setUser({ ...refreshData.user, permissions, isSuperInCompany: true });
  };

  /**
   * Super-admin sai da empresa e volta para a tela de seleção.
   */
  const handleLeaveCompany = async () => {
    const superToken = localStorage.getItem("superToken");
    if (!superToken) {
      handleLogout();
      return;
    }

    try {
      localStorage.setItem("token", superToken);
      localStorage.removeItem("superToken");
      api.defaults.headers.Authorization = `Bearer ${JSON.parse(superToken)}`;

      const { data } = await api.post("/auth/refresh_token");
      setUser({ ...data.user, permissions: [] });
      history.push("/select-company");
    } catch {
      handleLogout();
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.delete("/auth/logout");
    } catch {}
    setIsAuth(false);
    setUser({});
    localStorage.removeItem("token");
    localStorage.removeItem("superToken");
    api.defaults.headers.Authorization = undefined;
    setLoading(false);
    history.push("/login");
  };

  return {
    isAuth,
    user,
    loading,
    handleLogin,
    handleLogout,
    handleSelectCompany,
    handleLeaveCompany,
  };
};

export default useAuth;
