function getConfig(name, defaultValue = null) {
  // If inside a docker container, use window.ENV
  if (window.ENV !== undefined) {
    return window.ENV[name] || defaultValue;
  }

  return import.meta.env[name] || defaultValue;
}

export function getBackendUrl() {
  // VITE_BACKEND_URL existe para o caso de a API ficar em outro host.
  const explicito = getConfig("VITE_BACKEND_URL");
  if (explicito) return explicito.replace(/\/+$/, "");

  const { protocol, hostname } = window.location;

  // Pela internet a instalação sai por um túnel que entrega a interface e a
  // API em hostnames diferentes (app.dominio / api.dominio), ambos na 443 —
  // não há porta a deduzir. O hostname da página é o que distingue esse
  // acesso do acesso pela rede local, e por isso o par é declarado.
  if (
    hostname === getConfig("VITE_PUBLIC_APP_HOST") &&
    getConfig("VITE_PUBLIC_API_URL")
  ) {
    return getConfig("VITE_PUBLIC_API_URL").replace(/\/+$/, "");
  }

  // Fora daí, derivar do host que serviu a página é o comportamento normal: a
  // mesma instalação é alcançada pelo IP da rede, pelo nome da máquina, pela
  // VPN e por localhost, e um endereço fixo só funcionaria para um deles. Em
  // todos esses casos o backend está na 8080, onde ele realmente escuta.
  return `${protocol}//${hostname}:8080`;
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}
