# 🌐 ACESSO NA REDE LOCAL - Guia Definitivo

## ✅ Sim, você consegue acessar de qualquer computador!

Esta configuração permite que **qualquer computador conectado na mesma rede WiFi/Ethernet** acesse sua aplicação.

---

## 🚀 Passo a Passo Completo

### **PASSO 1: Configurar Firewall (IMPORTANTE!)**

Abra **PowerShell como ADMINISTRADOR** e execute:

```powershell
cd C:\Users\usuario\Documents\unmess
.\configure-firewall.ps1
```

Isso vai abrir as portas no Firewall do Windows:
- ✅ Porta 80 (Frontend)
- ✅ Porta 443 (HTTPS)
- ✅ Porta 8080 (API Backend)
- ✅ Porta 3001 (Browserless)
- ✅ Porta 3306 (MySQL Server)

---

### **PASSO 2: Preencher Senhas em `.env.network`**

Edite o arquivo `C:\Users\usuario\Documents\unmess\.env.network` e preencha:

```env
MYSQL_ROOT_PASSWORD=SuaSenhaSegura123!@#
JWT_SECRET=ChaveSegura32CaracteresOu+MaisAinda
JWT_REFRESH_SECRET=OutraChaveSegura32CharacteresOu+Mais
```

**Gerar chaves seguras (PowerShell):**
```powershell
# Copie essa chave
[Convert]::ToBase64String($(1..32 | ForEach-Object {[char][Random]::new().Next(33,126)})) -join ""
```

---

### **PASSO 3: Iniciar a Aplicação**

Abra **PowerShell** (não precisa de admin) e execute:

```powershell
cd C:\Users\usuario\Documents\unmess
.\start-production.ps1
```

Espere até ver algo como:
```
✅ Containers iniciados com sucesso!
🌐 Frontend:     http://192.168.1.100
🔌 API:          http://192.168.1.100:8080/api
💾 MySQL:        192.168.1.100:3306
```

---

### **PASSO 4: Verificar Conectividade**

Abra outro PowerShell e execute:

```powershell
cd C:\Users\usuario\Documents\unmess
.\test-network-access.ps1
```

Isso vai testar todos os endpoints e confirmar se está funcionando.

---

## 📱 Acessar de Outro Computador

### No computador onde quer acessar:

1. **Conecte à mesma rede** (WiFi ou Ethernet)

2. **Descubra o IP do servidor** (onde a aplicação está rodando):
   - No PowerShell do servidor, execute:
   ```powershell
   ipconfig
   ```
   - Procure por "IPv4 Address" (ex: `192.168.1.100`)

3. **Abra no navegador:**
   ```
   http://192.168.1.100
   ```

4. **Pronto!** Você verá a aplicação

---

## 🎯 Arquitetura de Rede

```
Computador A (Servidor)
├── Porta 80 → Nginx (Reverse Proxy)
│   ├── Rota / → Frontend React
│   ├── Rota /api/ → Backend Node.js
│   └── Rota /socket.io/ → WebSocket
├── Porta 8080 → Backend (direto)
├── Porta 3001 → Browserless (direto)
└── Porta 3306 → MySQL (docker)

         ↑ Rede Local (WiFi/Ethernet)
         │
         ↓ Qualquer computador pode acessar

Computador B, C, D, etc...
└── http://IP_DO_SERVIDOR
```

---

## 📊 URLs de Acesso

Substitua `192.168.1.100` pelo **seu IP local**:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | `http://192.168.1.100` | Aplicação principal |
| **API** | `http://192.168.1.100:8080` | Backend (porta direta) |
| **API via Nginx** | `http://192.168.1.100/api` | Backend (via reverse proxy) |
| **MySQL Server** | `192.168.1.100:3306` | Banco de dados (use seu cliente) |
| **Browserless** | `http://192.168.1.100:3001` | Chrome headless |
| **Health** | `http://192.168.1.100/health` | Status da aplicação |

---

## 🔧 Se Não Funcionar...

### ❌ "Não consigo acessar de outro PC"

**1. Verifique o Firewall:**
```powershell
# Verifique se as regras foram criadas
Get-NetFirewallRule -DisplayName "WhatTicket-*"

# Se não aparecer, execute:
.\configure-firewall.ps1
```

**2. Verifique os Containers:**
```bash
docker ps
docker logs whaticket-nginx
```

**3. Teste a conectividade:**
```bash
# Do computador remoto:
ping 192.168.1.100  # Verifique se consegue pingar
```

**4. Verifique o IP:**
```powershell
ipconfig
# Procure por IPv4 Address (ex: 192.168.1.100)
```

---

### ❌ "Erro: Connection refused"

```bash
# Reinicie tudo
docker-compose down
docker-compose -f docker-compose.yml --env-file .env.network up -d

# Aguarde 30 segundos
Start-Sleep -Seconds 30

# Teste novamente
.\test-network-access.ps1
```

---

### ❌ "Nginx dá erro"

```bash
# Verifique logs do nginx
docker-compose logs nginx

# Reinicie apenas nginx
docker-compose restart nginx
```

---

### ❌ "Frontend não carrega"

```bash
# Verifique logs do frontend
docker-compose logs frontend

# Verifique se a build foi bem-sucedida
docker images | findstr whaticket

# Reconstrua se necessário
docker-compose build frontend
docker-compose up -d frontend
```

---

## 🛡️ Segurança em Rede Local

Para rede local, essas configurações são seguras:
- ✅ Firewall do Windows filtra acesso
- ✅ Rede privada (não exposta para internet)
- ✅ Senhas fortes em `.env.network`
- ✅ Docker isola os serviços

**⚠️ IMPORTANTE:** Não exponha essa aplicação para a internet sem HTTPS e autenticação forte.

---

## 📞 Comandos Úteis

```bash
# Ver status
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Parar
docker-compose down

# Reiniciar um serviço específico
docker-compose restart frontend

# Entrar em um container
docker exec -it whaticket-frontend sh

# Ver rede Docker
docker network ls
docker network inspect unmess_whaticket-network
```

---

## ✨ Próximas Etapas

- [ ] Executar `configure-firewall.ps1`
- [ ] Preencher `.env.network` com senhas
- [ ] Executar `start-production.ps1`
- [ ] Testar com `test-network-access.ps1`
- [ ] Acessar de outro computador
- [ ] Testar todas as funcionalidades
- [ ] Configurar backup automático (próximo)

---

## 🎉 Pronto!

Sua aplicação está **100% acessível na rede local**.

Qualquer computador conectado pode acessar: `http://seu-ip-local`

**Bora lá testar!**
