# Inventário da migração do backend Node para .NET

Decisão: reescrever todo o backend em .NET antes de ligar o frontend nele (ver `docs/decisions/0002-reescrita-completa-em-dotnet.md`). Até lá, o frontend continua falando com o backend Node.

Legenda: ✅ migrado e testado · ⏳ pendente

## Base

| Item | Situação | Observação |
| --- | --- | --- |
| Banco (EF Core sobre o MySQL existente) | ✅ | tabelas e colunas do Sequelize mapeadas; datas gravadas em -03:00 como o Sequelize |
| Erros `{ "error": "..." }` com os mesmos códigos | ✅ | `AppException` + `AppExceptionHandler` |
| JWT compatível (15 min) e refresh token no cookie `jrt` (7 dias) | ✅ | 401 sem token, 403 com token inválido, como o frontend espera |
| Permissões por grupo e sobrescritas individuais | ✅ | catálogo gerado a partir do Node |
| CORS (rede local, Tailscale, `PUBLIC_ORIGINS`) | ✅ | |
| Limite de requisições (600/min) e de tentativas de login (10 falhas/15 min) | ✅ | |
| Arquivos em `/public` e upload com lista de tipos permitidos | ✅ | |
| Tempo real | ✅ base | SignalR em `/socket` com as mesmas salas e presença; falta o adaptador no frontend |

## Rotas

| Grupo | Rotas | Situação |
| --- | --- | --- |
| auth | `POST /auth/login`, `POST /auth/refresh_token`, `DELETE /auth/logout`, `POST /auth/select-company` | ✅ |
| users | `GET/POST /users`, `GET/PUT/DELETE /users/:id` | ✅ (ao excluir, tickets abertos voltam a `pending`; os eventos de ticket entram com o módulo de tickets) |
| permission-groups | `available`, `modules`, `user/:id`, CRUD | ✅ |
| companies | CRUD (super) e `GET/PUT /company/branding` | ✅ |
| settings | `GET /settings`, `GET /settings/attendance`, `PUT /settings/:key` | ⏳ |
| queues | CRUD `/queue` | ⏳ |
| tags | CRUD `/tags` | ⏳ |
| quick-answers | CRUD `/quick-answers` | ⏳ |
| ticket-statuses | CRUD `/ticket-statuses` | ⏳ |
| business-hours / holidays | 5 rotas | ⏳ |
| stickers | 5 rotas | ⏳ |
| products | 5 rotas | ⏳ |
| customers | 6 rotas | ⏳ |
| contacts | 9 rotas, incluindo importação | ⏳ |
| tickets | 6 rotas + regras de abas | ⏳ |
| messages | 6 rotas (envio, mídia, edição, exclusão, notas internas) | ⏳ |
| whatsapp / sessions | CRUD de conexões + iniciar/reiniciar/remover sessão via gateway | ⏳ |
| api externa | `POST /api/messages/send` | ⏳ |
| dashboard | `GET /dashboard/metrics` | ⏳ |
| crm | quadros, etapas, negócios, itens, atividades, ordem de serviço (31 rotas) | ⏳ |

## Fora das rotas

| Item | Situação |
| --- | --- |
| Eventos do gateway → contatos, tickets e mensagens | ⏳ |
| Job de fechar tickets inativos | ⏳ |
| Adaptador SignalR no frontend (`frontend/src/services/socket-io.js`) | ⏳ |
| Troca do frontend para o .NET e remoção da pasta `backend/` | ⏳ |
