# 🚀 Guia de Inicialização - Rede Local

## 1. Encontre o IP Local do Seu Computador

### Windows (PowerShell):
```powershell
ipconfig
```
Procure por "IPv4 Address" na seção do seu adaptador de rede ativo (geralmente começa com 192.168 ou 10.0)

Exemplo: `192.168.1.100`

### Linux/Mac:
```bash
ifconfig
# ou
ip addr show
```

---

## 2. Configure os Arquivos `.env`

### `.env.network` (Produção - Rede Local)
Atualize essas variáveis com valores seguros:

```env
MYSQL_ROOT_PASSWORD=sua_senha_super_segura_aqui
JWT_SECRET=gere_uma_chave_de_32_caracteres_aqui
JWT_REFRESH_SECRET=gere_outra_chave_de_32_caracteres_aqui
PMA_PASSWORD=sua_senha_super_segura_aqui
```

💡 **Dica:** Gere chaves seguras com:
```bash
# Linux/Mac
openssl rand -base64 32

# PowerShell (Windows)
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((1..32 | ForEach-Object {[char][Random]::new().Next(33, 127)} | Join-String)))
```

---

## 3. Inicie os Containers

```bash
docker-compose -f docker-compose.yml --env-file .env.network up -d
```

### Verificar status:
```bash
docker-compose ps
```

### Ver logs:
```bash
docker-compose logs -f
```

### Parar:
```bash
docker-compose down
```

---

## 4. Acesso pela Rede Local

Substitua `192.168.1.100` pelo **seu IP local**:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Frontend** | `http://192.168.1.100` | Aplicação principal |
| **API** | `http://192.168.1.100:8080/api` | Backend API |
| **MySQL** | `192.168.1.100:3306` | Banco de dados |
| **Browserless** | `http://192.168.1.100:3001` | Serviço de chrome headless |

---

## 5. Acessar de Outro Computador na Rede

1. Conecte os outros computadores à mesma rede WiFi
2. Use o IP do servidor (ex: `192.168.1.100`)
3. Abra no navegador: `http://192.168.1.100`

---

## 6. Troubleshooting

### Erro: "Connection refused"
- Verifique se Docker está rodando
- Verifique o firewall do Windows (permite porta 80, 8080, 8081)
- Verifique se os containers iniciaram: `docker-compose ps`

### Erro: "Acesso negado" ao MySQL
- Verifique a senha em `.env.network`
- Limpe volumes: `docker-compose down -v && docker-compose up -d`

### Outros computadores não conseguem acessar
- Verifique o IP: `ipconfig`
- Desabilite firewall temporariamente para teste
- Teste com: `ping 192.168.1.100` de outro PC

---

## 7. Portas Utilizadas

| Porta | Serviço | Host |
|-------|---------|------|
| 80 | Nginx (Frontend) | `0.0.0.0` |
| 443 | Nginx (HTTPS - futuro) | `0.0.0.0` |
| 3000 | Frontend (dev) | `0.0.0.0` |
| 8080 | Backend | `0.0.0.0` |
| 3001 | Browserless | `0.0.0.0` |
| 3306 | MySQL | `0.0.0.0` |

---

## 8. Próximos Passos

- [ ] Atualizar `.env.network` com senhas seguras
- [ ] Ter Docker instalado e rodando
- [ ] Executar `docker-compose up -d`
- [ ] Acessar `http://seu-ip-local`
- [ ] Verificar PhpMyAdmin em `http://seu-ip-local:8081/phpmyadmin`

---

**Pronto? Bora lá! 🎉**
