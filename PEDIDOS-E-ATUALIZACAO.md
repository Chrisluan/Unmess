# Pedidos, ordem de serviço e atualização remota

Três coisas entregues juntas: o chat passou a conversar com o CRM nos dois
sentidos, o pedido virou uma lista de itens que gera ordem de serviço, e o
servidor ganhou uma forma de se atualizar sozinho a partir do GitHub.

---

## 1. Atualizar o sistema a distância

### Como funciona

Você publica na branch `production`, e o servidor aplica sozinho:

```bash
git push origin production
```

Em até 10 minutos (ou no intervalo que você escolher) ele busca, compila,
aplica migrations, reinicia os serviços e confere se subiram.

### Ligar a atualização automática

Ainda **não está ligada**. Para ligar, num PowerShell **como Administrador**:

```powershell
cd C:\unmess
.\scripts\instalar-atualizacao-automatica.ps1
```

Opções: `-Minutos 30` para mudar o intervalo, `-Remover` para desligar.

Precisa de Administrador porque a tarefa reinicia serviços do Windows, e roda
como SYSTEM para funcionar sem ninguém logado na máquina.

### Atualizar na hora, sem esperar

```powershell
node C:\unmess\scripts\atualizar-producao.js
```

Outras formas: `--forcar` recompila mesmo sem commit novo, `--dry-run` mostra o
que faria sem fazer nada.

### As proteções, e por que existem

| Proteção | Motivo |
|---|---|
| Recusa rodar com alteração não commitada | A atualização usa `reset --hard`; sem isso ela apagaria trabalho em aberto na máquina |
| Só recompila o lado que mudou | O bundle do frontend leva minutos numa máquina de 2 núcleos que atende clientes |
| Compila antes de tocar nos serviços | Código que não compila nunca chega a derrubar o atendimento |
| Confere a porta depois de subir | Serviço "Running" não significa aplicação de pé; só a porta respondendo prova |
| Volta atrás sozinho | Um deploy quebrado às 3 da manhã se desfaz sem ninguém acordar |

O que aconteceu em cada atualização fica em `logs\atualizacao.log`.

### Fluxo sugerido

Trabalhe em `dev`. Quando estiver bom, leve para produção:

```bash
git checkout production; git merge dev; git push origin production; git checkout dev
```

---

## 2. Chat ligado ao CRM

O vínculo entre conversa e negócio já existia, mas só era navegável a partir do
CRM. Faltava o lado de quem atende.

**No drawer lateral da conversa** agora aparece "Pedidos e orçamentos": os
negócios ligados àquela conversa, com etapa, quadro e total. Cada um abre para
editar os itens ali mesmo, e traz o botão de emitir a ordem de serviço.

- Um ticket pode ter **vários pedidos** — o vínculo sempre foi N:N
- Um pedido pode ter **vários itens** — é o que foi criado agora
- "Novo" cria um pedido já vinculado à conversa

### Rotas novas

| Rota | O que faz |
|---|---|
| `GET /tickets/:ticketId/deals` | Negócios da conversa, com itens |
| `GET /deals/:dealId/items` | Itens de um pedido |
| `PUT /deals/:dealId/items` | Grava a lista inteira de itens |
| `GET /deals/:dealId/ordem-servico` | Documento A4 pronto para imprimir |

---

## 3. Itens do pedido

Antes o negócio tinha só um valor total digitado à mão, sem dizer de onde vinha.
Agora tem linhas: descrição, quantidade, unidade, preço unitário e desconto por
item.

**O valor do card do Kanban passa a ser a soma dos itens.** Quem edita os itens
vê o total do funil se atualizar junto, inclusive em outra máquina com o quadro
aberto.

Duas decisões que valem conhecer:

**O total da linha é calculado, nunca gravado.** Guardá-lo criaria uma segunda
fonte de verdade, que diverge no instante em que alguém mudar a quantidade por
fora e o pedido passar a mostrar dois números que não se explicam.

**A quantidade é fracionada** (3 casas). Nem tudo se vende por unidade: metro de
lona, hora de serviço, quilo de material.

---

## 4. Ordem de serviço (A4)

`GET /deals/:dealId/ordem-servico` devolve o documento pronto, com cabeçalho da
empresa, dados do cliente, tabela de itens, total, observações e campos de
assinatura.

Abre em aba nova; o botão "Imprimir / Salvar PDF" usa a impressão do próprio
navegador.

**Por que HTML e não PDF:** gerar PDF exigiria uma biblioteca a mais e um
navegador headless rodando no servidor — justamente o que esta instalação evita
para caber nos 8 GB da máquina. O resultado impresso é o mesmo, e nada extra
roda aqui.

O CSS fixa `@page size: A4`, e impede que uma linha do pedido seja partida entre
duas páginas, com a descrição numa folha e o preço na outra.

---

## O que falta / não foi feito

**Venda avulsa** — hoje toda venda nasce como um negócio no funil, criado pelo
botão "Novo" na conversa. Uma venda sem passar pelo funil (balcão, sem conversa)
ainda não tem caminho próprio. Se for necessário, o desenho natural é permitir
criar o pedido direto, sem quadro.

**Teste de ponta a ponta do deploy** — o script foi testado nos caminhos de
"árvore suja" (recusa) e "já atualizado" (não faz nada). O ciclo completo com
commit novo depende de rodar como Administrador, porque reinicia serviços.

**O kanban que você reportou** — verifiquei e no servidor está tudo de pé:
4 quadros, 21 colunas e 2 negócios no banco, rotas respondendo, bundle com a
rota `/crm`, e seu usuário é admin. O que sobra é cache do navegador
(**Ctrl+Shift+R**) ou um erro específico que só apareceu aí. Se persistir, me
mande o que aparece no console (F12).

---

## Para aplicar tudo isso agora

O código está publicado em `dev` e `production`, e o banco já tem a tabela
`DealItems`. Falta reiniciar, o que precisa de Administrador:

```powershell
Restart-Service unmess-backend; Restart-Service unmess-frontend
```

Depois, **Ctrl+Shift+R** no navegador para o service worker soltar o bundle
antigo.
