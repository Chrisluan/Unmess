import React, { createContext, useCallback, useEffect, useState } from "react";

import openSocket from "../../services/socket-io";
import api from "../../services/api";

const DEFAULTS = {
  signMessages: "enabled",
  notificationSound: "enabled",
  allowAgentSeeAllTickets: "disabled",
  requireClosingStatus: "disabled",
  autoAssignTickets: "disabled",
};

const AttendanceSettingsContext = createContext({
  settings: DEFAULTS,
  isEnabled: () => false,
  loading: true,
});

/**
 * Configurações operacionais que a tela de atendimento precisa ler.
 * Endpoint separado de /settings porque aquele é restrito a admin — o
 * atendente comum também precisa de assinatura e som de notificação.
 */
const AttendanceSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings/attendance");
      setSettings({ ...DEFAULTS, ...data });
    } catch {
      // Falha aqui não pode derrubar o atendimento: segue com os defaults.
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    const socket = openSocket();

    socket.on("settings", (data) => {
      if (data.action === "update" && data.setting?.key in DEFAULTS) {
        setSettings((prev) => ({
          ...prev,
          [data.setting.key]: data.setting.value,
        }));
      }
    });

    return () => socket.disconnect();
  }, []);

  const isEnabled = useCallback(
    (key) => settings[key] === "enabled",
    [settings]
  );

  return (
    <AttendanceSettingsContext.Provider
      value={{ settings, isEnabled, loading, refresh: fetchSettings }}
    >
      {children}
    </AttendanceSettingsContext.Provider>
  );
};

export { AttendanceSettingsContext, AttendanceSettingsProvider, DEFAULTS };
