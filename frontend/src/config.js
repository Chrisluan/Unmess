function getConfig(name, defaultValue = null) {
  // If inside a docker container, use window.ENV
  if (window.ENV !== undefined) {
    return window.ENV[name] || defaultValue;
  }

  return import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
  // Derivar do host que serviu a página é o comportamento normal: a mesma
  // instalação é alcançada pelo IP da rede, pelo nome da máquina, pela VPN e
  // por localhost, e um endereço fixo só funcionaria para um deles.
  // VITE_BACKEND_URL existe para o caso de a API ficar em outro host.
  const { protocol, hostname } = window.location;
  return getConfig("VITE_BACKEND_URL", `${protocol}//${hostname}:8080`);
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}
