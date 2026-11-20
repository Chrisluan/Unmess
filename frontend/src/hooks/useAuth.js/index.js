import { useState, useEffect, useRef } from "react";
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

  /**
   * Os módulos que esta pessoa fixou no topo do menu.
   *
   * Vive fora do objeto `user` de propósito: `user` é remontado do zero em
   * meia dúzia de caminhos (login, refresh, entrar numa empresa, sair dela),
   * e cada um deles teria de lembrar de recarregar as preferências junto —
   * até o dia em que um esquecesse e os favoritos sumissem só naquele fluxo.
   */
  const [favoritos, setFavoritos] = useState([]);

  /**
   * Os interceptores são registrados uma vez só — e já no primeiro render.
   *
   * Dentro de um useEffect eles só existiriam depois dos efeitos dos filhos,
   * que já disparam requisições ao montar (conexões, configurações): essas
   * saíam sem o token, voltavam 401, e a sessão era dada como encerrada logo
   * ao abrir a tela. O registro tem de vir antes de qualquer filho.
   *
   *
   * Antes ficavam soltos no corpo do hook e ganhavam um novo a cada render:
   * depois de alguns minutos de uso havia dezenas empilhados, e cada resposta
   * 403 disparava uma renovação de sessão por interceptor. Só a primeira
   * renovação vale — o cookie de renovação gira a cada uso —, as outras
   * voltavam 401, a sessão era dada como expirada e a tela era mandada para o
   * login e de volta às conversas. É o "a tela pisca e volta".
   */
  const interceptoresInstalados = useRef(false);

  if (!interceptoresInstalados.current) {
    interceptoresInstalados.current = true;
    let renovando = null;

    const renovarSessao = () => {
      // Várias requisições podem vencer juntas; todas esperam a mesma renovação.
      if (!renovando) {
        renovando = api
          .post("/auth/refresh_token")
          .then(({ data }) => {
            if (data?.token) {
              localStorage.setItem("token", JSON.stringify(data.token));
              api.defaults.headers.Authorization = `Bearer ${data.token}`;
            }
          })
          .finally(() => {
            renovando = null;
          });
      }
      return renovando;
    };

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
        const mensagem = error?.response?.data?.error || "";

        // Só o token vencido se resolve renovando a sessão. 403 por falta de
        // permissão também é 403, e renovar não muda a resposta: era uma
        // renovação inútil a cada aviso de "sem permissão".
        const tokenVencido =
          error?.response?.status === 403 && /^Invalid token/i.test(mensagem);

        if (tokenVencido && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          await renovarSessao();
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

  }

  /**
   * O que esta pessoa pode fazer, perguntado ao servidor.
   *
   * A resposta vem da mesma conta que as rotas fazem antes de deixar passar —
   * cargo + exceções individuais —, então a tela nunca mostra um botão que a
   * API vai recusar, nem esconde um que ela aceitaria.
   *
   * Em caso de erro, devolve lista vazia. A pessoa vê o menu recolhido e
   * recarrega a página; o contrário — assumir acesso quando a consulta falha —
   * mostraria portas que se abrem em 403.
   */
  const carregarAcesso = async () => {
    try {
      const { data } = await api.get("/access/me");
      return {
        permissions: data.permissions || [],
        role: data.role || null,
        isSuper: !!data.isSuper,
      };
    } catch {
      // null = "não consegui perguntar", e não "sem permissão". Quem já tem
      // uma lista na mão a mantém: uma falha passageira de rede não pode
      // esvaziar o acesso e mandar a pessoa embora da tela em que está.
      return null;
    }
  };

  const applyToken = async (token, skipPermissions = false) => {
    localStorage.setItem("token", JSON.stringify(token));
    api.defaults.headers.Authorization = `Bearer ${token}`;

    const { data: refreshData } = await api.post("/auth/refresh_token");
    const userData = refreshData.user;

    const acesso = skipPermissions
      ? { permissions: [], role: null, isSuper: false }
      : (await carregarAcesso()) ?? { permissions: [], role: null, isSuper: false };
    setUser({ ...userData, ...acesso });
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
        const acesso = await carregarAcesso();
        setUser((atual) => ({ ...atual, ...data.user, ...(acesso ?? {}) }));
      }
    });

    /**
     * Mudança de acesso chega na hora, sem relogar.
     *
     * A API já negava a ação imediatamente — ela consulta o banco a cada
     * requisição —, mas o menu continuava mostrando as portas antigas até o
     * próximo login, e a pessoa levava um 403 sem entender o motivo.
     *
     * O evento não traz permissão nenhuma: só avisa que vale a pena perguntar
     * de novo. Quem responde é `/access/me`, com as mesmas conferências de
     * sempre.
     */
    socket.on("access", async (data) => {
      const mexeuNestaPessoa =
        data.action === "userAccessChanged" && data.userId === user?.id;
      const mexeuNoCargoDela =
        data.action === "roleUpdated" && data.roleId === user?.role?.id;
      const cargoSumiu = data.action === "roleDeleted";

      if (!mexeuNestaPessoa && !mexeuNoCargoDela && !cargoSumiu) return;

      const acesso = await carregarAcesso();
      if (acesso) setUser((atual) => ({ ...atual, ...acesso }));
    });

    return () => socket.disconnect();
  }, [user]);

  /**
   * Preferências acompanham a pessoa, não a sessão: são buscadas quando se
   * sabe quem está logado, e limpas quando não há mais ninguém.
   *
   * Falha silenciosa, sem toast: não conseguir ler os favoritos é o menu sem
   * a seção Favoritos, e não um erro que valha interromper quem acabou de
   * entrar no sistema.
   */
  useEffect(() => {
    if (!user?.id) {
      setFavoritos([]);
      return undefined;
    }

    let ativo = true;
    (async () => {
      try {
        const { data } = await api.get("/preferences");
        if (ativo) {
          setFavoritos(Array.isArray(data?.favoritos) ? data.favoritos : []);
        }
      } catch {
        if (ativo) setFavoritos([]);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [user?.id]);

  /**
   * Favoritar e desfavoritar.
   *
   * A barra reordena antes da resposta do servidor: é a estrela de um menu,
   * o custo de estar errado por 200ms é nenhum, e esperar o ida-e-volta faria
   * o clique parecer que não pegou. Se a gravação falhar, a lista volta ao
   * que era e o erro aparece — o contrário, deixar a tela mostrando um estado
   * que o banco não tem, é o que não pode acontecer.
   */
  const alternarFavorito = async (chave) => {
    const anterior = favoritos;
    const proximo = anterior.includes(chave)
      ? anterior.filter((f) => f !== chave)
      : [...anterior, chave];

    setFavoritos(proximo);

    try {
      await api.put("/preferences", { favoritos: proximo });
    } catch (err) {
      setFavoritos(anterior);
      toastError(err);
    }
  };

  const handleLogin = async (userData) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", userData);
      localStorage.setItem("token", JSON.stringify(data.token));
      api.defaults.headers.Authorization = `Bearer ${data.token}`;

      const acesso = await carregarAcesso();
      setUser({ ...data.user, ...acesso });
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
    const acesso = await carregarAcesso();
    setUser({ ...refreshData.user, ...acesso, isSuperInCompany: true });
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
      // O super fora de qualquer empresa não opera nada: ele só escolhe em
      // qual entrar. Sem permissões até escolher.
      setUser({ ...data.user, permissions: [], role: null, isSuper: true });
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
    favoritos,
    alternarFavorito,
    handleLogin,
    handleLogout,
    handleSelectCompany,
    handleLeaveCompany,
  };
};

export default useAuth;
