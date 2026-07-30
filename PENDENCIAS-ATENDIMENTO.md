# Atendimento — o que foi implementado

Escopo: **Chat (prioridade) · Clientes · Usuários · Configurações**, com Conexões movida para dentro de Configurações.
Base: WhaTicket (fork) — a partir do commit `6c2f5e2`.

---

## ⚠️ Antes de rodar

Seis migrations novas. É obrigatório rodar:

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
| `20260729100004-add-protocol-to-tickets` | `protocol` em Tickets — já preenche o histórico existente |
| `20260729100005-create-holidays` | Tabela `Holidays` |

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

## 9. Autorização unificada nos controllers

`SettingController` e `UserController` ainda checavam `profile === "admin"` na mão, o que anulava o sistema de grupos de permissão recém-aplicado nas rotas: um usuário com `settings:edit` passava o middleware e tomava 403 no controller. As checagens redundantes saíram; a autorização mora só na rota.

Mantida a checagem de `PermissionGroupController`, que é sobre visibilidade entre empresas, não sobre papel.

## 10. Encaminhar mensagem

Opção no menu da mensagem, com busca de contato de destino. Se o contato já tem chat aberto ou pendente, ele é reaproveitado; senão abre um novo. Depois de encaminhar, navega para a conversa de destino.

Reenvia o conteúdo em vez de usar o forward nativo do WhatsApp — wwebjs e Baileys expõem isso de formas diferentes e nem sempre com a mídia baixada. Mídia é lida do disco; se o arquivo já foi removido, encaminha só o texto e registra aviso no log. Nota interna não pode ser encaminhada.

## 11. Protocolo de atendimento

Formato `AAAAMMDD` + id com 6 dígitos (ex: `20260729000482`). Derivado do id, então é único sem precisar de contador nem lock.

- Chip clicável no cabeçalho da conversa — copia para a área de transferência.
- Aparece no histórico de atendimentos do painel lateral.
- Variável `{{protocolo}}` disponível nas mensagens automáticas.
- A migration preenche o histórico existente; `ShowTicketService` também gera sob demanda, como rede de segurança.

## 12. Aba de grupos

Quarta aba no painel, com contador. Grupos saíram das abas de conversas individuais (Meus / Em Atendimento / Aguardando) e agora aparecem só na própria aba — todos os grupos ativos da empresa, com ou sem atendente.

## 13. multi_vcard e feriados

- **multi_vcard reativado**. Estava comentado desde o fork: a mensagem caía no branch de download e virava um botão quebrado. Agora renderiza os contatos; se o corpo não for JSON válido, mostra o texto cru em vez de derrubar a lista inteira.
- **Feriados e exceções** no horário de atendimento (tabela `Holidays`, seção nova na aba). Suporta data única ou recorrente todo ano. Feriado tem precedência sobre a grade semanal.

---

## Verificação

- `tsc --noEmit` no backend: **0 erros**
- 107 arquivos do frontend parseados: **0 erros de sintaxe**
- **0 imports relativos quebrados**
- 450 chaves i18n usadas, todas presentes em pt/en/es (as 9 restantes no relatório são template literals — os valores possíveis foram conferidos um a um)

O build do Vite não roda aqui — o `node_modules` do frontend foi instalado no Windows e o esbuild é binário nativo. Rode `npm run build` na sua máquina para confirmar.

---

## Não implementado (ficou fora)

- Editar / reagir a mensagem enviada
- Agendar mensagem
- Indicador de "digitando"
- Transcrição de áudio e sugestão de resposta com IA
- Chatbot / fluxo de atendimento
- Kanban / funil
- Refatoração de `MessagesList` e `MessageInput` (ambos ainda monolíticos)
- Importação de clientes via CSV
- Galeria de mídias do contato
- Separador visual de "não lidas" no histórico
- Drag-and-drop de arquivo na conversa
