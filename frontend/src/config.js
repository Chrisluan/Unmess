function getConfig(name, defaultValue = null) {
  // If inside a docker container, use window.ENV
  if (window.ENV !== undefined) {
    return window.ENV[name] || defaultValue;
  }

  return import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
  // Sem VITE_BACKEND_URL, deriva do host que serviu a página: um localhost fixo
  // aqui quebraria todo acesso vindo de outro computador da rede.
  const { protocol, hostname } = window.location;
  return getConfig("VITE_BACKEND_URL", `${protocol}//${hostname}:8080`);
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}
