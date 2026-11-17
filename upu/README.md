# UPU — Unmess Production Updater

Um serviço em C# que fica de pé o tempo todo na máquina da produção. Ele busca
a branch `production`, aplica a atualização **no horário programado**, e avisa
os usuários na tela e pelo navegador.

E há uma regra que é o motivo de ele existir: **publicar na branch não é
suficiente**. Para uma atualização entrar em produção, alguém precisa preencher
os campos obrigatórios no painel do UPU.

---

## Por que os campos são obrigatórios

Cada campo responde a uma pergunta que alguém vai fazer depois, e que ninguém
consegue responder no dia seguinte:

| Pergunta | Campo |
|---|---|
| "que versão está no ar?" | **Versão** |
| "o que mudou para o cliente?" | **Resumo para usuários**, **Alterações** |
| "vai cair? por quanto tempo?" | **Impacto**, **Duração estimada** |
| "quem subiu isso?" | **Responsável** |
| "e se der errado?" | **Plano de volta** |
| "isso chegou a rodar em algum lugar?" | **Testado em desenvolvimento** |

Regras que o UPU aplica sozinho:

- A **versão** precisa ser maior que a que está no ar. Versão que anda para trás
  faz o histórico mentir.
- O **resumo** tem tamanho mínimo, porque é o texto que aparece na tela de todos
  os clientes — não é documentação, é comunicação.
- **Plano de volta** vira obrigatório quando o tipo é `segurança` ou `crítica`,
  ou quando o sistema para. O UPU restaura código e build sozinho; migration
  destrutiva e dado de cliente já gravado, não.
- Impacto `interrupção` exige **horário marcado** e **aviso prévio de pelo menos
  10 minutos**. Ninguém deve descobrir a manutenção ao clicar em salvar.

A validação roda duas vezes: quando o painel salva, para ensinar enquanto a
pessoa digita; e de novo dentro do executor, um instante antes de aplicar —
porque entre agendar e aplicar pode passar uma noite.

---

## O caminho de uma atualização

```
você publica em production
        ↓
UPU percebe (vigia a cada 10 min) e cria um RASCUNHO
        ↓
alguém preenche os campos obrigatórios no painel     ← o portão
        ↓
AGENDADA para 03:00, aviso 30 min antes
        ↓
02:30  faixa na tela de todos: "atualização às 03:00"   (+ notificação do navegador)
        ↓
03:00  APLICANDO
        ├─ confere árvore limpa, busca a branch, confere o commit
        ├─ guarda o build atual (para poder voltar)
        ├─ reset --hard no commit da release
        ├─ npm install (só se package.json mudou)
        ├─ compila  ← antes de tocar em qualquer serviço
        ├─ migrations
        ├─ reinicia os serviços afetados
        └─ confere se as portas respondem
        ↓
CONCLUÍDA → faixa: "Versão 1.4.0 no ar" + o que mudou
   ou
FALHOU    → desfaz sozinho, volta o build e o commit anteriores,
            reinicia, confere, e avisa que está tudo normal de novo
```

---

## Instalar

Três passos. Só o terceiro precisa de Administrador.

```powershell
cd C:\unmess\upu
.\scripts\instalar-dotnet.ps1   # só na primeira vez; instala em ~\.dotnet, sem admin
.\scripts\compilar.ps1          # publica em upu\publicacao
.\scripts\instalar-upu.ps1      # registra o serviço unmess-upu (precisa de Administrador)
```

O painel abre em <http://127.0.0.1:8091> e pede para criar a senha na primeira
vez. O diário fica em `C:\unmess\logs\upu.log`.

Para rodar sem instalar o serviço, útil para ver funcionando:

```powershell
.\publicacao\Upu.Server.exe
```

Para remover:

```powershell
.\scripts\instalar-upu.ps1 -Remover
```

---

## Como o aviso chega ao usuário

Três camadas, com graus diferentes de exigência de infraestrutura:

**1. Faixa no topo da tela** — funciona sempre, sem configurar nada.

O UPU grava `avisos.json` e `avisos-unmess.js` dentro de `frontend\build`, que é
a pasta que o frontend já serve. O aviso chega pela mesma origem que o usuário
já tem aberta: sem porta nova, sem CORS, sem certificado. O `frontend/index.html`
carrega o widget com uma linha.

O widget fica fora do bundle de propósito: o aviso mais importante que ele dá é
"o sistema vai cair em cinco minutos", e esse é justamente o instante em que o
bundle está sendo trocado.

**2. Notificação do navegador com a aba aberta** — funciona sem configurar nada,
depois que o usuário permite. O widget oferece o botão de permissão em qualquer
aviso enquanto ela não tiver sido dada.

A notificação sai por `registration.showNotification()`, e não por
`new Notification()`. A diferença importa exatamente no aplicativo instalado: no
Android, uma página controlada por service worker recebe *Illegal constructor* ao
chamar o construtor. O aviso sumia sem erro visível.

**3. Notificação com a aba fechada (Web Push)** — precisa que o frontend
encaminhe `/upu/*` para o UPU, o que já está feito no `frontend/server.js`.

O Web Push é implementado direto, com o que vem no .NET 8 (ECDH, HKDF, AES-GCM,
JWT ES256). Não há biblioteca de fora: uma dependência que precisa restaurar
durante um deploy é uma forma de o servidor ficar sem conseguir avisar que está
caindo.

As chaves VAPID nascem na primeira execução e ficam em `dados/configuracao.json`.
**Trocá-las invalida todas as permissões já concedidas** — ninguém permite
notificação duas vezes.

### O PWA muda as regras

O unmess é um PWA com `registerType: "autoUpdate"` e `navigateFallback` para o
`index.html` **precacheado**. Consequência que custou uma noite: **o aplicativo
instalado nunca lê o `index.html` do disco**. Ele serve a cópia que o Workbox
guardou no dia do build.

Isso significa que a linha que carrega o widget precisa estar no
`frontend/index.html` **do repositório**, e um `vite build` precisa acontecer.
Editar o arquivo dentro de `build/` resolve para quem abre pelo navegador e não
resolve para quem instalou o aplicativo.

O UPU acrescenta a linha ao `build/index.html` quando ela falta — é uma rede de
segurança para o acesso por navegador, não para o PWA. Para o PWA, a garantia é
o fonte commitado.

Duas coisas ficaram no `vite.config.js` por causa disso:

- `globIgnores` tira `avisos.json`, `avisos-unmess.js` e `aviso-sw/**` do
  precache. Eles são gravados **depois** do build, pelo UPU; precacheados,
  ficariam congelados na versão do dia do build — um aviso de manutenção que
  nunca chega, ou um que nunca sai da tela.
- `/^\/upu/` entrou no `navigateFallbackDenylist`, para que as rotas públicas do
  UPU não recebam o `index.html` de volta.

### Avisos que não são de atualização

O mesmo lugar da tela serve para promoção, recado de configuração e o que mais o
sistema precisar dizer. No painel: **Publicar aviso**. Pela API, autenticada:
`POST /api/avisos`.

---

## O que fica onde

```
upu/
  src/Upu.Core/          o miolo, sem nenhuma dependência externa
    Modelos/             release, aviso, inscrição, configuração
    Validacao/           os campos obrigatórios  ← o portão
    Deploy/              pipeline, reserva, serviços, sonda de porta
    Git/                 conversa com o git por processo
    Notificacoes/        faixa, webhook, Web Push
    Armazenamento/       arquivos JSON em dados/
  src/Upu.Server/        Kestrel + painel + agendador
    publico/             o painel (HTML, CSS e JS sem framework)
    recursos/            o widget e o service worker publicados no frontend
  scripts/               instalar .NET, compilar, instalar o serviço
  dados/                 configuração, releases, avisos, inscrições (fora do git)
  publicacao/            o executável (fora do git)
```

Configuração fica em `dados/configuracao.json` e quase tudo é editável pelo
painel. O que não é: os nomes e portas dos serviços, e o endereço de escuta —
mudanças que pedem reiniciar o UPU de qualquer forma.

---

## Decisões que valem conhecer

**O UPU escuta só em 127.0.0.1**, na porta 8091 (a 8090 é do painel de
operação). Ele reinicia serviços e troca o código da produção; é mais poder do
que o painel de operação tem. Quem precisa alcançá-lo de fora usa o
encaminhamento `/upu/*` do `frontend/server.js`, que repassa **cinco rotas
nomeadas uma a uma** — `/avisos`, `/versao`, `/chave-vapid`, `/inscrever`,
`/desinscrever` — e devolve 404 para qualquer outra coisa.

A lista é explícita porque a versão anterior, que encaminhava o caminho inteiro,
deixava `/upu/../api/estado` chegar à API do painel. A sessão barrava a chamada,
mas a superfície não deveria estar exposta.

**O executável é autocontido.** Não depende de nenhum .NET instalado na máquina.
O serviço roda como LocalSystem, e o SDK que compila isto está no perfil de um
usuário — LocalSystem não enxerga esse perfil.

**Uma atualização por vez.** Duas se sobrescreveriam no meio do build.

**Recusa rodar com alteração não commitada na máquina.** A atualização usa
`reset --hard`, e apagaria o trabalho de quem estivesse editando aqui.

**Compila antes de tocar nos serviços.** Código que não compila nunca chega a
interromper o atendimento.

**A porta é a prova.** Serviço "Running" não significa aplicação de pé — o node
pode ter morrido dois segundos depois de subir.

**Republica o feed depois de compilar o frontend.** O `vite build` apaga a pasta
inteira, e levaria junto o aviso que os usuários estão vendo naquele momento.

**Dados em JSON, não em banco.** O UPU vigia a produção e teria que subir antes
dela. Um banco a mais seria uma dependência entre o vigia e o vigiado — e dá
para abrir o arquivo no Bloco de Notas às três da manhã.

---

## Convivência com o atualizador anterior

O `scripts/atualizar-producao.js` continua no repositório, como emergência
manual. Os dois compartilham a pasta `.reserva-deploy`, então **não rode os dois
ao mesmo tempo**.

O caminho oficial passa a ser o UPU. Se a tarefa agendada do atualizador antigo
estiver instalada, remova-a:

```powershell
.\..\scripts\instalar-atualizacao-automatica.ps1 -Remover
```

---

## O que foi verificado, e o que não

Rodou nesta máquina, numa instância isolada (porta 8092, pasta de dados
separada), e passou:

- senha curta recusada, senha errada recusada, sessão obrigatória em toda rota
  do painel (401 sem cookie)
- release vazia acusando os 9 campos que faltam, um a um
- agendar e aplicar recusados com 422 enquanto faltar campo
- impacto `interrupção` exigindo duração, plano de volta, aviso ≥ 10 min e
  horário marcado
- release completa → agendada → cancelada, com o aviso saindo da tela junto
- aviso publicado chegando ao `avisos.json`, e o widget desenhando a faixa no
  navegador de verdade: cor por severidade, botão "Entendi", dispensa gravada
  no `localStorage`
- o encaminhamento `/upu/*` repassando as rotas públicas e barrando o resto
- leitura do estado dos serviços e do git (os dois serviços responderam)

**O ciclo de deploy completo, não.** Commit novo, build, migration, restart e
conferência dependem de rodar como Administrador e de um commit de verdade na
branch — e, hoje, a árvore desta máquina tem 212 arquivos não commitados, o que
o UPU (corretamente) recusa. O primeiro deploy de verdade merece ser assistido.

**A faixa sobrepõe o topo da tela.** Ela é `position: fixed` e não empurra o
conteúdo. Numa tela com barra fixa no topo, ela cobre a barra enquanto está
visível. Para atualização e manutenção isso é desejável; se incomodar em avisos
promocionais, o ajuste é no `avisos-unmess.js`.

**Sem destinatário por empresa.** O aviso vai para todo mundo. O unmess é
multiempresa, e um aviso por empresa exigiria o widget saber quem está logado —
o que o tira de fora do bundle, que é justamente o que o mantém funcionando
durante o deploy.

**Autenticação do git como LocalSystem.** O serviço roda como LocalSystem e não
enxerga o gerenciador de credenciais do seu usuário. Se a branch vier de um
repositório privado autenticado assim, o `fetch` vai falhar; o caminho é token
no remote HTTPS.

---

## O git e o dono da pasta

`C:\unmess` pertence a uma conta de pessoa (`UNMESS\quase`), e o serviço roda
como LocalSystem. O git, ao ver isso, recusa: *detected dubious ownership in
repository*. É uma proteção contra repositório plantado por outro usuário — aqui
ela só atrapalha, porque a pasta é a mesma de sempre.

O que o git sugere na mensagem é `git config --global --add safe.directory`. Essa
sugestão **não resolve o serviço**: "global" é por conta, então rodá-la como
usuário logado grava no perfil dele, e o LocalSystem continua sem enxergar. Foi
o que fez o diário repetir o mesmo erro a cada dez minutos.

O UPU passa `-c safe.directory=<raiz>` em toda chamada ao git, então funciona
sob qualquer conta, sem depender de configuração na máquina. O `instalar-upu.ps1`
ainda acrescenta a exceção no escopo `--system` (que vale para todas as contas,
LocalSystem incluído) — não para o UPU, que já se vira, mas para o resto: o
atualizador antigo em Node, um script npm por tarefa agendada, qualquer git que
rode aqui fora da conta do dono.

O `-c` funciona porque o git só aceita `safe.directory` de configuração
protegida — sistema, global e linha de comando. Repositório e variável de
ambiente são ignorados de propósito.

---

## Recompilar com o serviço instalado

O serviço segura os próprios DLLs. Num PowerShell **como Administrador**:

```powershell
cd C:\unmess\upu
.\scripts\compilar.ps1 -PararServico
```

Ele para, publica e sobe de novo. Sem `-PararServico`, o script detecta o
serviço de pé e para antes de tentar, em vez de despejar trinta linhas de
MSB3026.
