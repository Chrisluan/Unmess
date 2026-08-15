# Painel de operação

Uma tela para o que hoje exige RDP e linha de comando: ver como a máquina está
aguentando e ligar, desligar ou reiniciar cada serviço da instalação
separadamente.

Roda sob demanda, sem instalar nada e sem dependências: só a biblioteca padrão
do Node. Um painel que existe para consertar a produção não pode ter um
`npm install` entre ele e o conserto.

## Como usar

Abra o PowerShell **como Administrador** e rode:

```powershell
cd C:\unmess\painel
.\painel.ps1
```

Na primeira execução ele pede uma senha (mínimo 8 caracteres) e pergunta se deve
liberar a porta no firewall. Depois disso, abra no navegador:

- nesta máquina: `http://localhost:8090`
- de outro computador do escritório: `http://<ip-do-servidor>:8090`

`Ctrl+C` encerra o painel. **Isso não afeta os serviços** — backend, frontend e
banco continuam rodando normalmente.

### Por que Administrador

Ligar e desligar serviço do Windows é operação privilegiada. Sem elevação o
painel abre e monitora tudo normalmente, mas os botões ficam desabilitados e a
tela avisa o motivo.

### Outras opções

```powershell
.\painel.ps1 -Porta 9000      # sobe em outra porta
.\painel.ps1 -TrocarSenha     # redefine a senha e sai
```

## O que a tela mostra

**Máquina** — CPU, memória, espaço em disco e há quanto tempo o servidor está
ligado.

**Serviços** — para cada um dos três serviços da instalação:

| Serviço | Nome no Windows | Porta |
|---|---|---|
| API (backend) | `unmess-backend` | 8080 |
| Interface (frontend) | `unmess-frontend` | 3333 |
| Banco de dados | `MySQL80` | 3306 (só 127.0.0.1) |

O selo de estado separa três situações que o Gerenciador de Serviços mistura:

- **no ar** — serviço rodando e atendendo na porta;
- **porta fechada** — o Windows diz que está rodando, mas ninguém atende. É o
  estado que mais engana: o processo subiu e morreu por dentro, ou ainda está
  carregando;
- **parado** — serviço desligado.

**Logs** — as últimas linhas do que o backend e o frontend escreveram em
`C:\unmess\logs`. O log do backend é JSON numa linha só; o painel reescreve como
`hora NÍVEL mensagem`.

## Segurança

O painel liga e desliga a produção e escuta na rede local, então:

- **senha obrigatória**, guardada como hash scrypt em `config.json` (nunca em
  texto). Só se define pelo console da máquina, nunca pela web;
- **cinco tentativas erradas** bloqueiam o IP por 5 minutos;
- **sessão de 8 horas**, amarrada ao IP que fez o login, e que só existe na
  memória: reiniciar o painel derruba todas;
- **serviços críticos** (o MySQL) exigem digitar o nome do serviço para
  confirmar, além do clique;
- **`auditoria.log`** registra todo login e toda ação, com IP e horário. Como a
  sessão é volátil, é o único rastro permanente de quem parou o quê;
- os nomes de serviço saem de uma lista fixa no código — nada vindo da rede
  chega ao PowerShell.

`config.json` e `auditoria.log` são desta instalação, não do projeto, e estão no
`.gitignore`.

### HTTPS

Se `certs/server.crt` e `certs/server.key` existirem, o painel sobe em HTTPS
sozinho. Sem eles sobe em HTTP, e a senha trafega em claro pela rede local — a
tela avisa quando é o caso. Para gerar os certificados:

```powershell
node scripts/generate-certs.js
```

## Se algo não funcionar

**"Este script precisa de privilégios de Administrador"** — o PowerShell foi
aberto normal. Feche e reabra com "Executar como administrador".

**Botões desabilitados e aviso de privilégios** — mesma causa acima; o painel
subiu sem elevação.

**"acesso negado pelo Windows"** ao clicar — idem.

**Não abre de outro computador** — a regra de firewall não foi criada. Rode o
`painel.ps1` de novo e responda `s`, ou crie manualmente:

```powershell
New-NetFirewallRule -DisplayName "Unmess-Painel" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8090 -Profile Private
```

**"A porta 8090 já está em uso"** — outro painel ficou aberto. Feche a janela
dele ou suba em outra porta com `-Porta`.

**Esqueceu a senha** — `.\painel.ps1 -TrocarSenha` (exige acesso à máquina, que
é justamente a garantia).
