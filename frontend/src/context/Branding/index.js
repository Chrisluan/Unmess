import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

import api from "../../services/api";
import openSocket from "../../services/socket-io";
import { mediaUrl } from "../../helpers/mediaUrl";

/** Nome do produto. Aparece quando a empresa não definiu identidade própria. */
export const APP_NAME = "Unmess";

const BrandingContext = createContext({
  name: APP_NAME,
  logo: null,
  refresh: () => {}
});

/**
 * Nome e logo da empresa, vindos do banco.
 *
 * Carrega uma vez e escuta o socket: quando o admin troca a identidade, as
 * demais telas abertas se atualizam sem precisar recarregar.
 */
export const BrandingProvider = ({ children }) => {
  const [branding, setBranding] = useState({ name: null, logo: null });

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/company/branding");
      setBranding(data);
    } catch {
      // Sem identidade configurada a interface cai no nome do produto; não é
      // erro que mereça interromper o carregamento da tela.
      setBranding({ name: null, logo: null });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = openSocket();
    socket.on("branding", data => {
      if (data.action === "update") setBranding(data.branding);
    });
    return () => socket.disconnect();
  }, []);

  const valor = {
    name: branding.name || APP_NAME,
    logo: branding.logo ? mediaUrl(branding.logo) : null,
    refresh
  };

  return (
    <BrandingContext.Provider value={valor}>{children}</BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);

export default BrandingContext;
