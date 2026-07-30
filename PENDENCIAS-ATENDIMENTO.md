# Atendimento — o que foi implementado

Escopo: **Chat (prioridade) · Clientes · Usuários · Configurações**, com Conexões movida para dentro de Configurações.
Base: WhaTicket (fork) — a partir do commit `6c2f5e2`.

---

## ⚠️ Antes de rodar

Cinco migrations novas. É obrigatório rodar:

```bash
cd backend
npm run build
npx sequelize db:migrate
```

Migrations adicionadas:

| Arquivo | O que faz |
|---|---|
| `20260729100000-add-attendance-fields-to-users` | `maxSimultaneousTickets`, `online`, `lastSeenAt` em Users |
| `20260729100001-create-tags` | Tabela `Tags` (nome único por empresa) |
| `20260729100002-create-ticket-tags` | Tabela pivô `TicketTags` |
| `20260729100003-add-internal-note-to-messages` | `isInternal` e `userId` em Messages |

---

## 1. Segurança — rotas que estavam abertas

`hasPermission` aplicado em `userRoutes`, `settingRoutes`, `whatsappRoutes`, `ticketStatusRoutes`, `businessHourRoutes`, `dashboardRoutes` e `messageRoutes` (este também ganhou `requiresCompany`).

No frontend, `/users` passou a exigir `users:access`.

O módulo `campaigns` — que existia só no catálogo de permissões, sem tela nenhuma — foi trocado por `tags`.

> **Atenção:** admin e super continuam com bypass total. Grupos de permissão restritos precisam ter `tickets:edit` para enviar mensagem e encerrar chat — antes qualquer logado conseguia.

## 2. Multiatendimento — vários números num lugar só

- **Filtro por conexão** no painel (`ListTicketsService` aceita `whatsappIds`). Nenhuma selecionada = todos os números. A escolha fica salva no navegador.
- O filtro vale **também no tempo real**: um chat de outro número não aparece na lista filtrada quando chega mensagem.
- **Escolha do número de origem** ao criar chat novo. Lista só conexões `CONNECTED` e pré-seleciona a preferencial do atendente → padrão da empresa → primeira ativa.
- **Número visível no cabeçalho da conversa** (chip verde), não só no item da lista.
- `GetDefaultWhatsApp` agora ignora conexões offline e cai para qualquer conexão ativa da empresa. Antes o sistema tentava enviar por um número caído.

## 3. Distribuição automática de chats

Novo `AutoAssignTicketService`, ligado no recebimento de mensagem. Ativável em Configurações › Geral.

Regra: candidato precisa estar **online** e pertencer à fila do chat; quem estourou o `maxSimultaneousTickets` é descartado; entre os restantes ganha quem tem menos chats abertos, com desempate por quem recebeu chat há mais tempo (rodízio real).

- **Presença online/offline** dos atendentes, mantida pelo socket (suporta múltiplas abas) e zerada no boot do servidor.
- Status aparece na lista de Usuários e no modal de transferência.
- **Limite de chats simultâneos** por usuário (0 = ilimitado).

## 4. Conexões dentro de Configurações

Saiu do menu lateral e virou a segunda aba de Configurações. O badge de alerta de número caído subiu para o item Configurações. `/connections` redireciona, para não quebrar link salvo.

A tela só monta quando a aba está ativa — ela abre socket e dispara requisições de sessão.

## 5. Configurações operacionais (aba Geral)

Antes só tinha o token da API. Agora:

| Configuração | Efeito real |
|---|---|
| Distribuição automática de chats | Liga o serviço da seção 3 |
| Exigir status ao encerrar | Bloqueia o fechamento sem motivo (validado no backend) |
| Atendente vê chats de outras filas | Libera o switch "Todos" para não-admin |
| Encerrar chats parados após X horas | Job no servidor, a cada 5 min |
| Janela de reabertura (horas) | Substitui as 2h que estavam fixas no código |
| Assinar mensagens | Padrão para novos atendentes |
| Som de notificação | Liga/desliga o alerta sonoro |

O **encerramento automático saiu do frontend**. Antes rodava no hook `useTickets`: só fechava se alguém estivesse com a tela aberta e disparava um PUT por ticket a cada carregamento da lista. Agora é `jobs/CloseInactiveTicketsJob`, no servidor.

Novo endpoint `GET /settings/attendance` — subconjunto liberado para quem atende, porque `/settings` é restrito a admin e o atendente comum precisa de assinatura e som.

**Modal de encerramento**: ao resolver um chat, o atendente agora escolhe o motivo. `closingStatusId` nunca era preenchido antes — o campo existia no banco sem nenhuma UI.

## 6. Etiquetas

Model `Tag` + pivô `TicketTags`, CRUD completo, aba própria em Configurações.

- Seletor de etiquetas dentro da conversa (salva ao mudar, sem botão de confirmar).
- Chips coloridos no item da lista (até 3, depois "+N").
- **Filtro por etiqueta** no painel, válido também no tempo real.
- Validação de tenant: não dá pra colar etiqueta de outra empresa passando id na mão.

## 7. Notas internas e busca na conversa

- **Nota interna**: botão no compositor. O campo fica amarelo, a assinatura é desabilitada e o texto vai para `POST /messages/:ticketId/notes` — nunca sai para o WhatsApp. Renderizada centralizada, em amarelo, com o nome do autor.
- Nota interna **não mexe** em `unreadMessages` nem reordena a lista de chats.
- **Busca dentro da conversa**: lupa no topo do histórico. Durante a busca, mensagens novas não são injetadas na lista e nada é marcado como lido.

## 8. Cliente dentro do chat

Painel lateral do contato agora mostra:

- **Cliente vinculado**: situação, CNPJ, segmento, responsável, cidade, observações. Botão de editar.
- **Criar cliente pelo chat** quando não existe vínculo — já pré-preenchido com nome, WhatsApp e `contactId`.
- **Histórico de atendimentos anteriores**: número, fila, data, atendente e status de encerramento. Clicável.

Novos endpoints: `GET /customers/by-contact/:contactId` e `GET /contacts/:contactId/tickets`.

**Busca de CEP (ViaCEP)** no cadastro de cliente: preenche rua, bairro, cidade e UF. Falha em silêncio se o CEP não existir.

---

## Verificação

- `tsc --noEmit` no backend: **0 erros**
- 105 arquivos do frontend parseados: **0 erros de sintaxe**
- **0 imports relativos quebrados**
- 424 chaves i18n usadas, todas presentes em pt/en/es (incluindo as 30 chaves dinâmicas conferidas uma a uma)

O build do Vite não roda aqui — o `node_modules` do frontend foi instalado no Windows e o esbuild é binário nativo. Rode `npm run build` na sua máquina para confirmar.

---

## Não implementado (ficou fora)

Da análise original, seguem pendentes — todos de menor peso que o que foi feito:

- Encaminhar / editar / reagir a mensagem
- Agendar mensagem
- Protocolo de atendimento
- Indicador de "digitando"
- Transcrição de áudio e sugestão de resposta com IA
- Chatbot / fluxo de atendimento
- Kanban / funil
- Refatoração de `MessagesList` e `MessageInput` (ambos ainda monolíticos)
- `multi_vcard` continua comentado
- Feriados no horário de atendimento
- Importação de clientes via CSV
- Aba separada de grupos
