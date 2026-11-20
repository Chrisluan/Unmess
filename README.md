# Unmess

SaaS de atendimento por WhatsApp, CRM e operação para empresas de comunicação
visual. Nasceu como fork do [WhaTicket](https://github.com/canove/whaticket) e
hoje está em reescrita do backend para .NET
([decisão 0002](docs/decisions/0002-reescrita-completa-em-dotnet.md)).

## Peças do repositório

| Pasta | O que é |
| --- | --- |
| `frontend/` | Interface React + Vite. Em produção é servida por `frontend/server.js`. |
| `backend/` | Backend Node (Express + Sequelize) que atende o produto hoje. |
| `backend-dotnet/` | Backend .NET que substituirá o Node na virada. |
| `whatsapp-gateway/` | Gateway WhatsApp (Baileys) usado pelo backend .NET. |
| `deployer/` | Deployer da nova arquitetura. |
| `upu/` | UPU, o atualizador da produção atual ([README](upu/README.md)). |
| `painel/` | Painel web para monitorar a máquina e controlar os serviços ([README](painel/README.md)). |
| `scripts/` | Ambiente de dev (`dev.ps1`), backup, publicação e manutenção. |
| `deploy/` | Compose de desenvolvimento (MySQL e Redis). |
| `docs/` | Decisões, plano de deploy, inventário da migração e protótipos. |

## Documentação

- [Ambiente local de desenvolvimento](docs/local-setup.md)
- [Plano de deploy da nova arquitetura](docs/deploy.md)
- [Publicação provisória por túnel](PUBLICACAO-PROVISORIA.md)
- [Apresentação do produto](APRESENTACAO.md)

## Começo rápido

```powershell
.\scripts\dev.ps1 setup
.\scripts\dev.ps1 up
.\scripts\dev.ps1 migrate
.\scripts\dev.ps1 seed
.\scripts\dev.ps1 dev
```

Detalhes, portas e credenciais de dev em [docs/local-setup.md](docs/local-setup.md).

## Licença

MIT, herdada do projeto original. Ver [LICENSE](LICENSE).
