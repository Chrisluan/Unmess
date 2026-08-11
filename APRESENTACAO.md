# Unmess — Atendimento por WhatsApp para equipes

**Documento de apresentação — funcionalidades, benefícios e diferenciais**

---

## 1. O que é

O Unmess transforma o WhatsApp da sua empresa em uma central de atendimento com
vários atendentes trabalhando no **mesmo número**, ao mesmo tempo, cada um com
seu próprio login.

Toda mensagem que chega vira um **chat** (atendimento) na fila da equipe. O chat
é distribuído para o setor certo, atendido por uma pessoa responsável,
etiquetado, finalizado com um motivo e registrado no histórico do contato. Nada
mais se perde num celular que fica na gaveta ou num aparelho que só uma pessoa
tem na mão.

Funciona no navegador, em tempo real, no computador e no celular.

---

## 2. O problema que ele resolve

| Sem o Unmess | Com o Unmess |
|---|---|
| Um celular passando de mão em mão, ou cada vendedor com o número dele | Um número só, toda a equipe atendendo em paralelo |
| Ninguém sabe quem já respondeu o cliente — dois atendentes respondem o mesmo | Cada chat tem um responsável visível; a lista separa "meus", "em atendimento" e "aguardando" |
| Cliente manda mensagem e ninguém vê até alguém abrir o aparelho | Fila com contador, alerta sonoro e indicador de quem está esperando há mais de 30 minutos |
| Quando o funcionário sai, o histórico sai junto com ele | Todo o histórico fica na empresa, por contato e por cliente |
| "Quantos atendimentos fizemos esse mês?" — ninguém sabe responder | Dashboard com volume, tempo de resposta, desempenho por atendente e motivos de encerramento |
| Cliente escreve fora do expediente e fica sem resposta | Mensagem automática de fora de horário, com feriados considerados |
| Sem controle de quem pode ver ou fazer o quê | Grupos de permissão com mais de 50 permissões granulares |

---

## 3. Benefícios por perfil

### Para a diretoria / dono
- **O ativo volta a ser da empresa.** Contatos, conversas e histórico ficam no
  sistema, não no aparelho de quem atende.
- **Números para decidir.** Volume por dia e por hora, tempo médio de primeira
  resposta, taxa de resolução, desempenho por atendente e por setor.
- **Escala sem bagunça.** Contratou mais gente? Cria o usuário, coloca no setor
  e a distribuição automática cuida do resto.
- **Custo previsível.** A conexão é feita por leitura de QR Code, como o
  WhatsApp Web — sem cobrança por mensagem ou por janela de conversa.

### Para o supervisor / gestor de equipe
- **Visão do todo.** Filtro por atendente, por setor, por conexão e por
  etiqueta — dá para olhar o dia inteiro de uma pessoa específica em dois cliques.
- **Fila sob controle.** Quem está esperando, há quanto tempo, e o que ainda não
  tem dono.
- **Regras no lugar de cobrança.** Limite de conversas simultâneas por atendente,
  encerramento obrigatório com motivo, encerramento automático de chat parado.
- **Auditoria.** Cada chat registra quem atendeu, quando respondeu pela primeira
  vez, quando encerrou e por quê.

### Para o atendente
- **Uma tela só.** Todos os números da empresa, todas as conversas, no mesmo
  lugar — sem trocar de aparelho ou de aba.
- **Menos digitação.** Respostas rápidas por atalho, basta digitar `/` e o
  apelido da resposta.
- **Contexto na mão.** Ao abrir a conversa, aparecem os dados do contato, o
  cadastro do cliente e os atendimentos anteriores dele.
- **Combinação com a equipe sem o cliente ver.** Notas internas ficam visíveis só
  para quem trabalha no sistema.

### Para o cliente final
- Resposta mais rápida, porque a conversa cai direto no setor certo.
- Não precisa se repetir: o histórico anterior está ali.
- Recebe retorno mesmo fora do expediente, avisando quando será atendido.
- Continua usando o WhatsApp normal, sem instalar nada.

---

## 4. Funcionalidades

### 4.1 Conexão com o WhatsApp
- **Várias conexões simultâneas.** Vários números de WhatsApp na mesma conta —
  comercial, suporte, financeiro — com todas as conversas caindo no mesmo painel.
- **Conexão por QR Code**, igual ao WhatsApp Web. Painel de conexões mostra o
  status de cada número em tempo real (conectado, aguardando leitura, sem sinal).
- **Aviso de número duplicado**: se alguém ler o QR Code com um aparelho já
  vinculado a outra conexão, o sistema avisa antes que os atendimentos comecem a
  duplicar.
- **Grupos suportados**, com aba própria para não misturar grupo com atendimento
  individual.
- **Mensagens enviadas pelo celular aparecem no painel**, marcadas como "pelo
  celular", para o histórico ficar completo mesmo quando alguém responde por fora.

### 4.2 Painel de atendimento
- **Abas de trabalho**: *Meus atendimentos*, *Em atendimento* (da equipe),
  *Aguardando*, *Conhecidos*, *Grupos*, *Finalizados* e *Busca* — cada uma com
  contador ao vivo.
- **Filtros combináveis**: por conexão (número), por etiqueta, por setor e
  **por atendente responsável** (disponível para quem supervisiona).
- **Busca** por nome do contato, número ou conteúdo das mensagens.
- **Tempo real de verdade**: mensagem nova, transferência e mudança de status
  aparecem na tela sem recarregar a página.
- **Notificações** no navegador e alerta sonoro configurável.
- **Modo escuro** e interface em **português, inglês e espanhol**.

### 4.3 Recursos de conversa
- Envio e recebimento de **texto, imagem, vídeo, áudio, documentos, contatos
  (vCard) e localização**.
- **Gravação de áudio** direto do navegador.
- **Responder citando** uma mensagem específica.
- **Encaminhar** mensagem para outro chat.
- **Editar** e **apagar** mensagens já enviadas.
- **Notas internas**: recado registrado na conversa, visível só para a equipe.
- **Assinatura automática** com o nome do atendente (o padrão é definido pela
  empresa, e cada atendente pode ligar ou desligar).
- **Emojis**, formatação em negrito/itálico e confirmação de leitura.

### 4.4 Setores (filas) e roteamento
- Setores com **nome, cor e mensagem de saudação própria**.
- **Setor padrão**: conversas sem setor caem direto nele, sem obrigar o cliente a
  escolher opção em menu.
- **Menu de escolha automático** quando faz sentido oferecer opções ("1 -
  Vendas, 2 - Suporte...").
- Saudação do setor enviada **uma única vez** por atendimento, sem repetir a cada
  mensagem do cliente.
- **Transferência** de chat entre atendentes, setores e até entre conexões, com
  mensagem automática opcional avisando o cliente.

### 4.5 Distribuição e produtividade
- **Distribuição automática de chats** (opcional): o chat novo vai para o
  atendente **online**, do setor certo, com **menos conversas abertas**. Empate
  resolve por rodízio — não cai sempre na mesma pessoa.
- **Limite de conversas simultâneas** por atendente.
- **Respostas rápidas** com atalho: digite `/` no campo de mensagem e escolha.
- **Encerramento automático** de chats parados após X horas (configurável, ou
  desligado).
- **Janela de reabertura**: se o cliente volta a escrever dentro do período
  configurado, o sistema reabre o último atendimento em vez de criar outro do zero.

### 4.6 Organização e classificação
- **Etiquetas** coloridas aplicadas ao chat, com filtro na lista.
- **Status de finalização** personalizados (ex.: "Venda concluída", "Sem
  interesse", "Orçamento enviado"), com opção de **exigir o motivo** antes de
  encerrar — é o que alimenta o relatório de motivos de encerramento.
- **Contatos conhecidos**: marque dono, sócio, fornecedor ou parceiro, e as
  conversas deles ganham aba própria, fora da fila comercial.

### 4.7 Horário de atendimento
- Grade de **horário por dia da semana**, com dias ativos e faixas de início e fim.
- **Feriados e exceções**, inclusive os que se repetem todo ano.
- **Mensagem automática fora do expediente**, enviada uma única vez por
  atendimento para não incomodar o cliente a cada mensagem.

### 4.8 Contatos e cadastro de clientes (CRM)
- Agenda de contatos com foto, número, e-mail e **campos personalizados**.
- **Importação dos contatos** do aparelho conectado.
- **Histórico de atendimentos anteriores** do contato, visível ao lado da conversa.
- **Ficha de cliente** ligada ao contato, com:
  - Pessoa física ou jurídica, razão social, nome fantasia, CPF/CNPJ e inscrição
    estadual;
  - Endereço completo com **preenchimento automático pelo CEP**;
  - Ramo de atividade, origem do contato, situação (**lead / ativo / inativo**),
    responsável interno e observações.
- Criação da ficha **direto da conversa**, sem sair da tela de atendimento.

### 4.9 Indicadores e dashboard
Painel com filtro de período (hoje, 7 dias, mês, período personalizado):
- Chats **em atendimento, aguardando e finalizados**, e total do período;
- **Tempo médio de primeira resposta**, **tempo médio de atendimento** e **tempo
  médio de resolução**;
- **Taxa de resolução** e **contatos novos**;
- **Esperando há mais de 30 minutos** — o número que mostra cliente largado na fila;
- **Desempenho por atendente** (volume e tempos), **chats por setor**, **chats
  por conexão**, **motivos de finalização**;
- **Movimento por dia** e **por hora do dia** — a base para dimensionar a escala
  da equipe.

### 4.10 Equipe, perfis e permissões
- Usuários com perfil **administrador** ou **atendente**, vinculados a um ou mais
  setores.
- **Grupos de permissão** com matriz granular: mais de 50 permissões organizadas
  por módulo (conversas, contatos, clientes, etiquetas, respostas rápidas,
  setores, usuários, conexões, dashboard, configurações).
- **Exceções individuais**: dá para conceder ou remover uma permissão específica
  de uma pessoa sem criar um grupo novo só para ela.
- **Presença online** dos atendentes, usada inclusive pela distribuição automática.

### 4.11 Personalização e integração
- **Identidade visual própria**: nome e logo da empresa na barra lateral e no
  topo do sistema.
- **API de mensagens** com token por empresa, para disparar mensagens (com
  anexos) a partir de outros sistemas — ERP, e-commerce, formulário do site.
- **Multiempresa**: uma instalação pode atender várias empresas ou unidades, com
  dados totalmente separados entre elas e um perfil de administração acima delas.

---

## 5. Por que escolher o Unmess

**1. Feito para equipe, não para uma pessoa.**
A diferença entre "WhatsApp com etiqueta" e um sistema de atendimento é saber de
quem é cada conversa. Aqui isso é o centro do produto: fila, responsável,
transferência, encerramento com motivo e histórico.

**2. Sem custo por mensagem.**
A conexão é a mesma do WhatsApp Web, por QR Code. Não há tarifa por conversa nem
necessidade de aprovar modelo de mensagem antes de falar com o cliente.

**3. Configurável sem programador.**
Setores, saudações, horários, feriados, etiquetas, motivos de encerramento,
respostas rápidas, permissões e identidade visual são telas de configuração —
não são customizações contratadas.

**4. As regras trabalham por você.**
Distribuição automática, encerramento de chat parado, mensagem de fora de
horário, aviso de transferência e reabertura inteligente rodam no servidor, 24
horas, independentemente de alguém estar com a tela aberta.

**5. Controle de acesso de verdade.**
Permissão por módulo e por ação, com exceções individuais. O estagiário atende
sem enxergar o dashboard; o supervisor enxerga tudo sem virar administrador.

**6. Cresce junto.**
Vários números, vários setores, várias empresas na mesma instalação.

---

## 6. Como funciona no dia a dia

1. **Chega a mensagem.** O contato é criado ou atualizado automaticamente e vira
   um chat na aba *Aguardando*.
2. **Roteamento.** O chat cai no setor padrão, no setor escolhido pelo cliente no
   menu, ou já sai atribuído a um atendente pela distribuição automática. Fora do
   expediente, o cliente recebe o aviso automático.
3. **Atendimento.** O atendente assume, conversa, usa respostas rápidas, anexa
   arquivos, registra notas internas e consulta o histórico e a ficha do cliente
   ali do lado.
4. **Transferência, se precisar.** Passa para outro setor ou colega, com aviso
   automático ao cliente.
5. **Encerramento.** O atendente finaliza escolhendo o motivo, e a mensagem de
   despedida sai automaticamente. Chat esquecido é encerrado sozinho depois do
   prazo configurado.
6. **Medição.** Tudo isso vira número no dashboard: tempo de resposta, volume por
   hora, desempenho por pessoa e motivos de encerramento.

---

## 7. Informações técnicas

| Item | Descrição |
|---|---|
| Acesso | Navegador (computador, tablet e celular), sem instalação |
| Conexão com o WhatsApp | Leitura de QR Code, como o WhatsApp Web — não exige conta de API oficial |
| Tempo real | WebSocket: mensagens e mudanças de status aparecem instantaneamente |
| Banco de dados | MySQL / MariaDB |
| Servidor | Node.js, com opção de instalação local (rede da empresa) ou em nuvem |
| Idiomas | Português, inglês e espanhol |
| Armazenamento de mídia | Arquivos enviados e recebidos guardados no servidor da empresa |
| Segurança | Login com senha criptografada, sessão por token, isolamento total de dados entre empresas |

> **Observação sobre a conexão:** o sistema conversa com o WhatsApp da mesma
> forma que o WhatsApp Web faz, lendo o QR Code de um aparelho. É o modelo que
> dispensa tarifa por mensagem e aprovação prévia de conteúdo. Para operações que
> exigem contrato de API oficial com a Meta, a conexão precisa ser avaliada caso
> a caso.

---

## 8. Perguntas frequentes

**Preciso trocar meu número?**
Não. Você conecta o número que já usa.

**Quantas pessoas podem atender no mesmo número?**
Não há limite técnico de atendentes por número. O que existe é o limite de
conversas simultâneas *por atendente*, que você mesmo define.

**O cliente percebe que está falando com um sistema?**
Não. Do lado dele é o WhatsApp de sempre. As únicas marcas visíveis são as que
você escolher: saudação do setor, assinatura do atendente e mensagens automáticas.

**E se a internet cair ou o celular desligar?**
A conexão fica marcada como fora do ar no painel, e volta assim que o aparelho
reconecta. As conversas e o histórico continuam no sistema.

**Perco as conversas antigas do WhatsApp?**
As conversas anteriores à conexão continuam no aparelho. O histórico dentro do
sistema começa a partir da conexão.

**Consigo saber quanto cada atendente produziu?**
Sim: volume de chats, tempo médio de primeira resposta e tempo médio de
atendimento, por pessoa, no período que você escolher.

**Dá para integrar com meu sistema atual?**
Sim, pela API de mensagens, usando um token gerado nas configurações.

---

*Documento gerado a partir da análise das funcionalidades implementadas no
sistema. Recursos configuráveis podem estar ligados ou desligados conforme a
configuração de cada empresa.*
