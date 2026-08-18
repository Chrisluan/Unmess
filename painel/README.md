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

**Energia** — consumo em watts, energia acumulada em kWh, quanto já custou e a
projeção do mês. Ver abaixo o que esses números são de fato.

**Logs** — as últimas linhas do que o backend e o frontend escreveram em
`C:\unmess\logs`. O log do backend é JSON numa linha só; o painel reescreve como
`hora NÍVEL mensagem`.

## Sobre os números de energia

**São estimativa, não medição.** Esta máquina é um notebook sem bateria
instalada, com um i3-3110M: não há sensor de energia acessível. Sem bateria não
existe taxa de descarga para ler, e os contadores internos da CPU exigem driver
em modo kernel. O painel calcula a potência a partir do uso de CPU:

```
potência = repouso + (carga_total - repouso) x uso_da_cpu
```

Os padrões são `15 W` em repouso e `45 W` em carga total — valores plausíveis
para este notebook (TDP de 35 W na CPU), mas ainda assim chute informado.

**Duas ressalvas que importam ao ler o total:**

1. O acumulado só conta as horas em que o painel esteve **rodando**. Como ele
   sobe sob demanda, o total não é a conta de luz do mês — é o consumo do
   período observado. O cartão mostra quantas horas foram de fato acompanhadas.
2. A tarifa padrão é **R$ 0,768/kWh** (Copel, residencial B1, reajuste de
   20,51% vigente desde 24/06/2026). É a tarifa de aplicação: **não** inclui
   ICMS, PIS/COFINS nem bandeira tarifária, então a conta real sai acima disso.

### Deixando os números reais

Em **Ajustar tarifa**:

- **Tarifa**: pegue de uma fatura sua — valor total dividido pelo consumo em
  kWh daquele mês. Isso embute impostos e bandeira automaticamente.
- **Potências**: meça a tomada com um wattímetro, com a máquina parada e depois
  sob carga, e escreva os dois valores. É o que transforma a estimativa em
  algo próximo do real.

**Zerar acumulado** recomeça a contagem a partir daquele momento.

O acumulado fica em `painel/energia.json`, junto com a tarifa e as potências —
é da instalação, não do projeto, e está no `.gitignore`.

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
