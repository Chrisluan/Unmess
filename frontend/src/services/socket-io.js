import openSocket from "socket.io-client";
import { getBackendUrl } from "../config";
import api from "./api";

const lerToken = () => {
  try {
    return JSON.parse(localStorage.getItem("token"));
  } catch {
    return null;
  }
};

/**
 * Conecta ao servidor em tempo real.
 *
 * O token de acesso vale 15 minutos, e o servidor só o confere no momento de
 * conectar. A conexão guardava o token da primeira vez: quando a rede oscilava
 * ou o servidor reiniciava, ela reconectava com um token já vencido, o
 * servidor a recusava e a tela ficava sem tempo real — mensagem enviada ou
 * recebida só aparecia depois de recarregar a página.
 *
 * Por isso, a cada reconexão o token é relido do armazenamento. E quando o
 * próprio servidor derruba a conexão (é o que ele faz com token vencido), o
 * cliente renova o token e tenta de novo, porque o socket.io não reconecta
 * sozinho nesse caso.
 */
function connectToSocket() {
  const socket = openSocket(getBackendUrl(), {
    transports: ["websocket", "polling", "flashsocket"],
    query: {
      token: lerToken(),
    },
  });

  socket.io.on("reconnect_attempt", () => {
    socket.io.opts.query = { token: lerToken() };
  });

  socket.on("disconnect", async (motivo) => {
    if (motivo !== "io server disconnect") return;

    try {
      const { data } = await api.post("/auth/refresh_token");
      if (data?.token) {
        localStorage.setItem("token", JSON.stringify(data.token));
      }
    } catch {
      // Sem renovar não há o que tentar: o interceptor da API cuida de
      // mandar a pessoa para o login se a sessão acabou.
      return;
    }

    socket.io.opts.query = { token: lerToken() };
    socket.connect();
  });

  return socket;
}

export default connectToSocket;
