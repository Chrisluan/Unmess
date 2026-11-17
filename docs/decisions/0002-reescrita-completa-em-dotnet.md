# 0002 — Reescrita completa do backend em .NET

Data: 17/11/2026

## Decisão

O backend Node (herdado do Whaticket) será reescrito por inteiro em .NET antes de o frontend passar a usá-lo. Ao final, o sistema terá só duas peças de servidor: o backend .NET (rotas, banco, regras, tempo real) e o gateway WhatsApp em Node.

## Consequências

- O plano original recomendava migrar rota por rota (Strangler Fig). Esta decisão troca isso por uma virada única, que só acontece quando todas as rotas estiverem prontas e testadas.
- Até a virada, a produção e o frontend continuam no backend Node.
- O contrato HTTP com o frontend é mantido: mesmas rotas, mesmos nomes de campos no JSON e mesmos códigos de erro.
- O tempo real passa de Socket.IO para SignalR. O frontend troca só o arquivo `services/socket-io.js` por um adaptador com a mesma interface (`on`, `off`, `emit`, `disconnect`).
- O banco continua o mesmo MySQL. O EF Core mapeia o schema criado pelas migrations do Sequelize; a posse do schema passa ao .NET quando o Node for desligado.
- Convenção de nomes: tecnologia em inglês, produto em português; os campos do JSON seguem o contrato atual com o frontend.
