# Ambiente local de desenvolvimento

Este guia sobe o Unmess inteiro na sua máquina: frontend, backend Node (que ainda atende o produto), backend .NET (a nova base, que assume rota por rota) e o gateway WhatsApp em Node.

## O que roda e onde

| Serviço | Pasta | Porta | Como roda |
| --- | --- | --- | --- |
| Frontend (React + Vite) | `frontend/` | 3001 | código-fonte, hot reload |
| Backend Node (Express + Sequelize) | `backend/` | 8080 | código-fonte, hot reload |
| Backend .NET (ASP.NET Core 10) | `backend-dotnet/` | 5240 | `dotnet watch` |
| Gateway WhatsApp (Baileys) | `whatsapp-gateway/` | 8090 | `node --watch` |
| MySQL 8.4 | container | 127.0.0.1:3306 | `deploy/compose.dev.yaml` |
| Redis 7.4 | container | 127.0.0.1:6379 | `deploy/compose.dev.yaml` |

O frontend fala com o backend Node em `http://localhost:8080`. O gateway entrega os eventos do WhatsApp ao backend .NET em `/internal/whatsapp-gateway/events`, assinados com HMAC.

Por padrão o gateway roda em **modo fake**: simula QR, conexão, envio, confirmação de leitura e mensagens recebidas, sem tocar em nenhum número real.

## Pré-requisitos

- Windows 10/11 com **Docker Desktop** (usa WSL2). O "Docker Sandboxes" não serve: ele não traz o comando `docker` nem o compose.
- Node.js 24 ou superior (`.nvmrc` indica 24).
- .NET SDK 10 (`global.json` fixa a 10.0.404, aceitando patches mais novos).
- Git.

## Primeira vez

```powershell
git clone https://github.com/Chrisluan/Unmess
cd Unmess
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 up
.\scripts\dev.ps1 migrate
.\scripts\dev.ps1 seed
.\scripts\dev.ps1 dev
```

- `setup` instala as dependências de todos os projetos, cria o `.env` a partir do `.env.example` com segredos aleatórios de desenvolvimento e gera `backend/.env.localhost` e `frontend/.env.localhost`.
- `up` sobe MySQL e Redis e espera os dois ficarem saudáveis.
- `migrate` e `seed` preparam o banco de dev. O seed cria o super-admin `super@whaticket.com` / `super123`.
- `dev` sobe os quatro serviços num só terminal, com prefixo colorido por serviço. `Ctrl+C` para tudo.

Abra http://localhost:3001 e entre com o super-admin.

## Dia a dia

| Comando | O que faz |
| --- | --- |
| `.\scripts\dev.ps1 dev` | sobe os serviços com hot reload |
| `.\scripts\dev.ps1 status` | mostra o que está de pé |
| `.\scripts\dev.ps1 test` | roda exatamente os testes do CI |
| `.\scripts\dev.ps1 down` | para MySQL e Redis, mantendo os dados |
| `.\scripts\dev.ps1 reset -Force` | apaga o banco e o Redis de dev |

`migrate`, `seed` e `reset` recusam rodar se `APP_ENV` não for `development` ou se `DB_HOST` não for o banco local.

## Testando o WhatsApp sem número real

Com o `dev` rodando, use o token `GATEWAY_API_TOKEN` do seu `.env`:

```powershell
$token = (Select-String -Path .env -Pattern '^GATEWAY_API_TOKEN=(.*)$').Matches[0].Groups[1].Value
$h = @{ Authorization = "Bearer $token" }
Invoke-RestMethod -Method Post http://localhost:8090/v1/sessions/demo/connect -Headers $h
Invoke-RestMethod http://localhost:8090/v1/sessions/demo -Headers $h
Invoke-RestMethod -Method Post http://localhost:8090/v1/sessions/demo/messages -Headers $h -ContentType application/json -Body '{"to":"5585999990000","text":"Teste"}'
Invoke-RestMethod -Method Post http://localhost:8090/v1/fake/sessions/demo/inbound -Headers $h -ContentType application/json -Body '{"from":"5585988880000","text":"Oi"}'
```

Os eventos aparecem no log do backend .NET como `Gateway event ...`. O contrato completo está em `whatsapp-gateway/openapi.yaml` e em http://localhost:8090/openapi.yaml.

Para testar com WhatsApp de verdade, troque `GATEWAY_MODE=baileys` no `.env` e use **somente um número de teste**. Nunca conecte o número de produção em dev: duas sessões no mesmo número se derrubam e podem enviar mensagens reais.

## O backend Node e o WhatsApp

O backend Node ainda tem a própria conexão de WhatsApp (`WHATSAPP_PROVIDER=whaileys`). No banco de dev não existe nenhuma conexão cadastrada, então nada conecta sozinho. Se você criar uma conexão pela tela, ela vai pedir QR: use só número de teste.

Ligar o backend Node ao gateway, em vez do whaileys, é o próximo passo da Fase 8 e ainda não foi feito.

## Problemas comuns

- **"Comando 'docker' nao encontrado"**: instale e abra o Docker Desktop.
- **Porta 3306 ocupada**: mude `DB_PORT` no `.env` e rode `.\scripts\dev.ps1 setup -Force` para regenerar o `backend/.env.localhost`.
- **"Sessão expirada" na tela de login**: o backend Node não alcança o banco. Rode `up` e `migrate`.
- **Mudou o `.env`**: rode `.\scripts\dev.ps1 setup -Force` para regenerar os `.env.localhost`.
