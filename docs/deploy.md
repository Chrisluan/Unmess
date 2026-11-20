# Deploy do Unmess

Guia de implantação no servidor (o notebook de produção), seguindo o Plano de Reestruturação e o documento do Gateway WhatsApp com Baileys.

> **Estado em 17/11/2026:** a produção ainda roda do jeito antigo (código-fonte em `C:\unmess`, MySQL nativo em `C:\mysql`, serviços do Windows via NSSM, Cloudflare Tunnel `unmess` com `app.unmess.com.br` e `api.unmess.com.br`). Este documento descreve o caminho para o modelo novo e marca o que **já existe** e o que **ainda falta** no repositório. Não execute nenhum passo em produção sem o backup verificado da seção 2.

## 1. Arquitetura alvo

```
Internet ─► Cloudflare (Tunnel + Access) ─► proxy reverso (Traefik/Caddy) ─┬─► frontend            app.unmess.com.br
                                                                          ├─► backend Node        api.unmess.com.br  (rotas ainda não migradas)
                                                                          ├─► backend .NET        api.unmess.com.br  (rotas migradas, por caminho)
                                                                          ├─► releaseNN previews  releaseNN.unmess.com.br (Access)
                                                                          └─► Deployer            deploy.unmess.com.br    (Access)

backend .NET ◄── eventos assinados (HMAC) ── whatsapp-gateway ──► WhatsApp
backend .NET ──── comandos HTTP (token) ──►  (container separado, volumes /data e /media com backup)
```

| Componente | Imagem / forma | Situação no repositório |
| --- | --- | --- |
| Backend .NET | `ghcr.io/chrisluan/unmess-backend-dotnet` | Dockerfile pronto (`backend-dotnet/Dockerfile`) |
| Gateway WhatsApp | `ghcr.io/chrisluan/unmess-whatsapp-gateway` | Dockerfile pronto (`whatsapp-gateway/Dockerfile`) |
| Deployer | serviço do Windows/systemd, fora do Docker | código pronto, integrações ainda em dry run |
| Backend Node | `ghcr.io/chrisluan/unmess-backend` | **falta** Dockerfile (o do Whaticket foi removido por obsoleto) |
| Frontend | `ghcr.io/chrisluan/unmess-frontend` | **falta** Dockerfile novo com configuração em runtime |
| Migrator | `ghcr.io/chrisluan/unmess-migrator` | **falta** |
| `deploy/compose.yaml` e overrides de prod/preview | — | **falta** (só existe `compose.dev.yaml`) |
| Proxy reverso | Traefik ou Caddy | **falta** |

## 2. Antes de qualquer mudança em produção

1. Backup completo e **verificado** (restaurado em outro lugar):
   - banco: `scripts/backup-banco.ps1`;
   - sessões de WhatsApp atuais (tabela `WppKeys`/Redis, conforme o provedor) e a pasta `backend/public` (mídias);
   - `.env` de produção e `%USERPROFILE%\.cloudflared`.
2. Anotar o commit que roda hoje (`git -C C:\unmess rev-parse HEAD`) para criar a branch `production` a partir dele.
3. Combinar uma janela: a troca do gateway pode exigir parear os números de novo por QR.

## 3. Preparação do servidor (uma vez)

1. **Sistema:** a recomendação do plano é Linux ou tudo dentro do WSL2. Em Windows, instale o Docker Desktop com WSL2 e limite o consumo em `%USERPROFILE%\.wslconfig`:
   ```ini
   [wsl2]
   memory=6GB
   processors=4
   ```
2. **Pastas** (nunca rodar produção da pasta de desenvolvimento):
   ```
   C:\unmess\
     deployer\            binário e appsettings do Deployer
     prod\                .env, compose e volumes da produção
     previews\releaseNN\  um por release
     backups\
   C:\dev\Unmess\         só código de desenvolvimento
   ```
3. **Cloudflare Tunnel:** além de `app` e `api`, publicar `deploy.unmess.com.br` (Deployer) e `*.unmess.com.br` (previews, um nível só), todos apontando para o proxy local. Proteger `deploy` e os previews com Cloudflare Access (e-mail para pessoas, service token para o CI). Nenhuma porta aberta no roteador.
4. **Segredos de produção** em `C:\unmess\prod\.env`, nunca no Git. Gere cada um com:
   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
   ```
   Para `GATEWAY_ENCRYPTION_KEY` use 32 bytes em hexadecimal (64 caracteres). **Perder essa chave apaga o acesso às sessões do WhatsApp**: guarde uma cópia junto com o backup, separada do backup em si.

## 4. Variáveis de ambiente

### Backend .NET

| Variável | Exemplo | Observação |
| --- | --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` | OpenAPI só aparece em Development |
| `Database__ConnectionString` | `Server=mysql;Port=3306;Database=unmess;User ID=unmess;Password=...` | mesmo banco do Node; o Sequelize continua dono do schema |
| `Jwt__Secret` ou `JWT_SECRET` | igual ao do backend Node | obrigatório; tokens do Node valem no .NET |
| `WhatsappGateway__BaseUrl` | `http://whatsapp-gateway:8090` | rede interna do Docker |
| `WhatsappGateway__ApiToken` | segredo | igual a `GATEWAY_API_TOKEN` |
| `WhatsappGateway__WebhookSecret` | segredo | igual a `GATEWAY_WEBHOOK_SECRET` |

Saúde: `/health/live` (processo) e `/health/ready` (banco).

### Gateway WhatsApp

| Variável | Exemplo | Observação |
| --- | --- | --- |
| `GATEWAY_MODE` | `baileys` | `fake` só em dev e previews |
| `GATEWAY_API_TOKEN` | segredo | exigido em `/v1/*` |
| `GATEWAY_CORE_WEBHOOK_URL` | `http://backend-dotnet:8080/internal/whatsapp-gateway/events` | |
| `GATEWAY_WEBHOOK_SECRET` | segredo | assina os eventos (HMAC-SHA256 + timestamp) |
| `GATEWAY_ENCRYPTION_KEY` | 64 hex | criptografa as credenciais em repouso |
| `GATEWAY_SEND_INTERVAL_MS` | `1500` | ritmo mínimo entre envios por número |
| `GATEWAY_SYNC_FULL_HISTORY` | `false` | histórico fica no núcleo |
| `GATEWAY_DATA_DIR` / `GATEWAY_MEDIA_DIR` | `/data` / `/media` | volumes nomeados, **incluídos no backup**; `/media` precisa ser o mesmo volume montado como pasta de uploads do backend .NET (`Uploads__Directory`), porque as mídias recebidas e enviadas são lidas pelos dois |

Saúde: `/health/live` e `/health/ready` (SQLite). Métricas por sessão em `/v1/metrics`.

### Deployer

Seção `Deployer` do `appsettings.json` (ou variáveis `Deployer__*`): `WebhookSecret`, `ApiToken`, `DatabasePath`, `PreviewUrlTemplate` (`https://{release}.unmess.com.br`), `ProductionUrl` (`https://app.unmess.com.br`), `MaxActivePreviews` (3).

## 5. Gateway WhatsApp em produção

Regras do documento do gateway que valem para todo deploy:

- O gateway é um **container separado** e só reinicia quando ele próprio é atualizado. Deploys do núcleo não podem derrubá-lo.
- **Nunca** conectar o mesmo número em dois ambientes ao mesmo tempo. Previews usam `GATEWAY_MODE=fake` ou um número de teste.
- Ao parar, o gateway salva as credenciais e fecha os sockets (`SIGTERM`, até 15 s). Use `docker stop` normal, nunca `kill -9`.
- Eventos não se perdem se o núcleo estiver reiniciando: ficam na caixa de saída (SQLite) e são reenviados com backoff. O núcleo descarta duplicados pelo id do evento.

Subida (quando o `deploy/compose.yaml` existir, isto vira um serviço dele):

```powershell
docker volume create unmess-gateway-data
docker volume create unmess-gateway-media
docker run -d --name unmess-whatsapp-gateway --restart unless-stopped `
  --env-file C:\unmess\prod\gateway.env `
  -v unmess-gateway-data:/data -v unmess-gateway-media:/media `
  --network unmess-prod `
  ghcr.io/chrisluan/unmess-whatsapp-gateway:<tag>
```

### Troca do whaileys pelo Baileys oficial

1. Confirmar se o `whaileys ^6.4.3` atual tem a correção do CVE-2026-48063. Se não tiver, a troca é urgente.
2. Testar antes com um número de teste e com cópia de backup das sessões. O formato das credenciais do whaileys provavelmente é parecido, mas não é garantido; se não forem reaproveitáveis, cada número precisa ser pareado de novo por QR, dentro da janela combinada.
3. Fazer a troca no gateway antes de migrar qualquer módulo para .NET.
4. **Falta no repositório:** o provedor `gateway` no backend Node (`backend/src/providers/WhatsApp`), que faz o núcleo atual falar com o gateway pelo contrato. Sem ele, a produção continua usando o whaileys embutido.

## 6. Backend .NET em produção

Enquanto nenhuma rota for migrada, o backend .NET pode subir ao lado do Node sem receber tráfego do frontend: ele só recebe os eventos do gateway. Quando um módulo migrar, o proxy passa aquele caminho para o .NET com uma flag por rota (Strangler Fig), e o rollback é desligar a flag.

```powershell
docker run -d --name unmess-backend-dotnet --restart unless-stopped `
  --env-file C:\unmess\prod\backend-dotnet.env --network unmess-prod `
  ghcr.io/chrisluan/unmess-backend-dotnet:<tag>
```

## 7. Deployer

Instalação como serviço do Windows (o Deployer nunca roda dentro dos stacks que gerencia):

```powershell
dotnet publish deployer\src\Unmess.Deployer -c Release -r win-x64 --self-contained -o C:\unmess\deployer
New-Service -Name UnmessDeployer -BinaryPathName "C:\unmess\deployer\Unmess.Deployer.exe --urls http://127.0.0.1:5250" -StartupType Automatic
Start-Service UnmessDeployer
```

Hoje Docker, GitHub, backup e notificações estão em **dry run** (só registram em log). Antes de usar o Deployer de verdade é preciso implementar `IContainerOrchestrator`, `ISourceControl` (GitHub App), `IImageRegistry` (GHCR), `IBackupService` e `INotifier` (Fase 6). Até lá, deploys são manuais (seção 8).

## 8. Deploy de uma nova versão (manual, Fase 6.0)

1. Merge do PR na `releaseNN`; o CI publica as imagens com a tag `sha-<commit>`.
2. Testar no preview `releaseNN.unmess.com.br` (banco próprio, gateway fake).
3. Backup do banco e dos volumes, com verificação.
4. Fast-forward da `production` para o commit testado e retag da imagem como `vX.Y.Z` (a mesma imagem, sem recompilar).
5. Rodar o migrator, depois trocar a tag da imagem na produção.
6. Health check por ~60 s (`/health/ready` de cada serviço). Se falhar, voltar para a tag anterior.
7. Registrar o resultado e remover o preview.

## 9. Rollback

- **Código:** trocar a tag da imagem para a anterior (o Deployer guarda as últimas 5) e subir de novo.
- **Banco:** migrations seguem expand/contract e são compatíveis com a versão anterior. Se uma não for, restaurar o backup feito no passo 3.
- **Gateway:** voltar a imagem anterior com os mesmos volumes. Se as credenciais estiverem corrompidas, restaurar o volume `/data` do backup (com a mesma `GATEWAY_ENCRYPTION_KEY`).

## 10. Backups

- Antes de todo deploy em produção e toda noite, com cópia fora do notebook (R2, B2 ou similar). Retenção sugerida: 7 diários, 4 semanais, 3 mensais.
- Itens: banco MySQL, volumes `unmess-gateway-data` e `unmess-gateway-media`, uploads do backend, `.env` de produção e configuração do Cloudflare.
- Teste de restauração mensal. Backup nunca restaurado não conta.

## 11. Checklist depois de cada deploy

- [ ] `app.unmess.com.br` abre e o login funciona.
- [ ] `/health/ready` do backend .NET e do gateway respondem 200.
- [ ] `/v1/metrics` do gateway: sessões `connected`, `outbox.pending` perto de zero.
- [ ] Mensagem de teste enviada e recebida num número interno.
- [ ] Auditoria do Deployer registrou o deploy (quando o Deployer estiver ativo).

## 12. O que falta para este guia valer por inteiro

1. Fase 0: backup verificado, `.env.local` auditado, `docs/current-state.md`.
2. Fase 1: branches `production`/`release01` com proteção.
3. Fase 2: Dockerfiles novos de backend Node e frontend, migrator, `deploy/compose.yaml` com overrides de prod e preview.
4. Fase 4: workflows `release.yml` e `production.yml` publicando no GHCR.
5. Fase 5: proxy, wildcard no Tunnel, Access, estrutura `C:\unmess`.
6. Fase 6: integrações reais do Deployer.
7. Fase 8: provedor `gateway` no backend Node e troca de sessões.
