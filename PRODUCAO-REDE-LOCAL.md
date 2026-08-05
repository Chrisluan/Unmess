# 🎯 Configuração Completa - Produção em Rede Local

## ✅ O que foi criado/configurado

### 1. **Arquivos de Ambiente**
- ✅ `.env.network` - Configuração de produção (rede local)
- ✅ `.env.local` - Configuração de desenvolvimento (seu PC)

### 2. **Docker & Containers**
- ✅ `docker-compose.yml` - Orquestração de todos os serviços
  - MySQL (banco de dados)
  - Backend (Node.js) na porta **8080**
  - Frontend (React) na porta **3000**
  - Nginx (reverse proxy) na porta **80/443**
  - Browserless (Chrome headless) na porta **3001**

### 3. **Dockerfiles**
- ✅ `backend/Dockerfile` - Imagem do backend
- ✅ `frontend/Dockerfile` - Imagem do frontend otimizada

### 4. **Nginx (Reverse Proxy)**
- ✅ `nginx.conf` - Configuração completa de roteamento:
  - `/` → Frontend (React)
  - `/api/` → Backend (Node.js)
  - `/socket.io/` → WebSocket do Backend
  - `/phpmyadmin/` → PhpMyAdmin
  - `/browserless/` → Browserless
  - Compressão Gzip ativada
  - Cache de arquivos estáticos

### 5. **Scripts de Inicialização**
- ✅ `start-production.ps1` - Script PowerShell (Windows) que:
  - Descobre seu IP local automaticamente
  - Verifica se Docker está instalado
  - Valida arquivo `.env.network`
  - Inicia os containers com um comando
  - Mostra URLs de acesso

### 6. **Documentação**
- ✅ `STARTUP.md` - Guia completo de inicialização
- ✅ `PRODUCAO-REDE-LOCAL.md` - Este arquivo

---

## 🚀 Como Começar

### Passo 1: Preencher as Senhas
Edite `.env.network` e preencha:
```env
MYSQL_ROOT_PASSWORD=SuaSenhaSegura123!
JWT_SECRET=ChaveDeSeguranca123456789012345678
JWT_REFRESH_SECRET=OutraChaveSegura123456789012345678
PMA_PASSWORD=SuaSenhaSegura123!
```

### Passo 2: Executar o Script
```powershell
# Abra PowerShell como administrador e execute:
cd C:\Users\usuario\Documents\unmess
.\start-production.ps1
```

Ou manualmente:
```bash
docker-compose -f docker-compose.yml --env-file .env.network up -d
```

### Passo 3: Acessar a Aplicação

Descubra seu IP (exemplo: `192.168.1.100`):

| Serviço | URL |
|---------|-----|
| **Frontend Principal** | `http://192.168.1.100` |
| **Backend API** | `http://192.168.1.100:8080/api` |
| **Banco de Dados** | `http://192.168.1.100:8081/phpmyadmin` |
| **Browserless** | `http://192.168.1.100:3001` |

---

## 🌐 Acessar de Outro Computador

1. Ambos conectados na mesma rede (WiFi ou Ethernet)
2. Use o IP da máquina com a aplicação
3. Abra no navegador: `http://seu-ip-aqui`

---

## 📊 Arquitetura

```
┌─────────────────────────────────────────┐
│          Navegador Remoto               │
│      (Qualquer PC na rede)              │
└────────────┬────────────────────────────┘
             │ HTTP (porta 80)
             ▼
┌─────────────────────────────────────────┐
│   NGINX (Reverse Proxy)                 │
│   - Rota / → Frontend                   │
│   - Rota /api → Backend                 │
│   - Rota /socket.io → Backend WS        │
│   - Rota /phpmyadmin → PhpMyAdmin       │
└──┬──────────────────┬──────────────────┬┘
   │                  │                  │
   ▼                  ▼                  ▼
┌─────────┐    ┌─────────────┐    ┌──────────┐
│Frontend │    │  Backend    │    │PhpMyAdmin│
│ React   │    │  Node.js    │    │          │
│:3000    │    │  :8080      │    │  :8081   │
└────┬────┘    └──────┬──────┘    └────┬─────┘
     │                │                │
     └────────────────┼────────────────┘
                      │
                      ▼
                 ┌──────────┐
                 │  MySQL   │
                 │ :3306    │
                 └──────────┘
```

---

## 🛠️ Comandos Úteis

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f backend

# Parar a aplicação
docker-compose down

# Parar e remover volumes (limpar dados)
docker-compose down -v

# Reiniciar um serviço
docker-compose restart backend

# Entrar em um container
docker exec -it whaticket-backend sh
```

---

## ⚙️ Configurações Importantes

### Variáveis em `.env.network`

| Variável | Função | Exemplo |
|----------|--------|---------|
| `NODE_ENV` | Ambiente (production/development) | `production` |
| `MYSQL_ROOT_PASSWORD` | Senha do MySQL | `SuaSenha123!` |
| `JWT_SECRET` | Chave para JWT | Gere com `openssl rand -base64 32` |
| `BACKEND_PORT` | Porta do Backend | `8080` |
| `FRONTEND_PORT` | Porta do Frontend | `3000` |
| `LOG_LEVEL` | Nível de logs | `info` |
| `API_RATE_LIMIT` | Limite de requisições | `100` |

---

## 🔒 Segurança

- ✅ Senhas em arquivo `.env.network` (fora do git)
- ✅ JWT secrets seguros (gere novos)
- ✅ Rate limiting ativado
- ✅ CORS configurado (ajuste conforme necessário)
- ✅ Nginx com compressão Gzip
- ⏳ HTTPS (comentado - descomente quando tiver certificado)

---

## 📋 Próximos Passos

- [ ] Preencher senhas em `.env.network`
- [ ] Executar `start-production.ps1`
- [ ] Verificar acesso em `http://seu-ip`
- [ ] Testar login e funcionalidades
- [ ] Configurar backup automático do MySQL
- [ ] Configurar SSL/HTTPS (se necessário)
- [ ] Configurar monitoramento (logs, alertas)

---

## 🆘 Troubleshooting

### Erro: "Connection refused"
```bash
# Verifique se os containers estão rodando
docker-compose ps

# Reinicie tudo
docker-compose down
docker-compose -f docker-compose.yml --env-file .env.network up -d
```

### Erro: "Access denied" no PhpMyAdmin
- Verifique `MYSQL_ROOT_PASSWORD` em `.env.network`
- Use usuário: `root`
- Senha: (a que você configurou)

### Frontend não carrega
```bash
# Verifique logs do frontend
docker-compose logs frontend

# Verifique se build foi bem-sucedido
docker images | grep whaticket
```

### Outros PCs não conseguem acessar
1. Verifique firewall do Windows (porta 80)
2. Use `ipconfig` para confirmar IP local
3. Teste: `ping seu-ip-local` de outro PC
4. Teste: `curl http://seu-ip-local:80` do servidor

---

## 📞 Suporte

Se tiver dúvidas:
1. Verifique `STARTUP.md`
2. Veja logs: `docker-compose logs -f`
3. Teste endpoints com Postman/Insomnia
4. Verifique conectividade de rede

---

**Tudo pronto! Sua aplicação está configurada para rodar em rede local com Docker. 🎉**
