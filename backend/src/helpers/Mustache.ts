import Mustache from "mustache";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";

// Mantém compatibilidade com todos os usos existentes, que chamam
// formatBody(body, contact). Quando um Ticket completo é passado no lugar
// (ele já inclui .contact, .user, .queue), variáveis adicionais de setor e
// atendente também ficam disponíveis nos templates.
export default (body: string, contactOrTicket: Contact | Ticket): string => {
  const isTicket = (contactOrTicket as Ticket)?.contact !== undefined;

  const contact = isTicket
    ? (contactOrTicket as Ticket).contact
    : (contactOrTicket as Contact);

  const ticket = isTicket ? (contactOrTicket as Ticket) : undefined;

  const view = {
    name: contact ? contact.name : "",
    cliente: {
      nome: contact ? contact.name : "",
      numero: contact ? contact.number : ""
    },
    setor: ticket?.queue ? ticket.queue.name : "",
    atendente: ticket?.user ? ticket.user.name : "",
    protocolo: ticket?.protocol ?? ""
  };

  return Mustache.render(body, view);
};
