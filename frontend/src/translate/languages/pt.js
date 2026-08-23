const messages = {
  pt: {
    translations: {
      signup: {
        title: "Cadastre-se",
        toasts: {
          success: "Usuário criado com sucesso! Faça seu login!!!.",
          fail: "Erro ao criar usuário. Verifique os dados informados.",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
        },
        buttons: {
          submit: "Cadastrar",
          login: "Já tem uma conta? Entre!",
        },
      },
      login: {
        title: "Entrar",
        subtitle: "Use a conta cadastrada para você.",
        form: {
          email: "E-mail",
          password: "Senha",
        },
        buttons: {
          submit: "Entrar",
          submitting: "Entrando...",
          register: "Não tem uma conta? Cadastre-se",
        },
      },
      auth: {
        toasts: {
          success: "Login efetuado com sucesso!",
        },
      },
      dashboard: {
        period: {
          title: "No período selecionado",
          today: "Hoje",
          week: "7 dias",
          month: "Mês",
          all: "Tudo",
          custom: "Período",
          from: "De",
          to: "Até",
          apply: "Aplicar",
        },
        charts: {
          perDay: {
            title: "Conversas hoje: ",
          },
        },
        now: {
          title: "Situação agora",
          inAttendanceHelp: "Conversas já assumidas por um atendente",
          waitingHelp: "Clientes na fila, ainda sem atendente",
          closedHelp: "Total acumulado desde o início",
        },
        messages: {
          inAttendance: {
            title: "Em atendimento"
          },
          waiting: {
            title: "Aguardando"
          },
          closed: {
            title: "Encerradas"
          }
        },
        metrics: {
          avgFirstResponse: "Tempo médio de 1ª resposta",
          avgResolution: "Tempo médio de resolução",
          resolutionRate: "Taxa de resolução",
          stalePending: "Esperando há +30min",
          newContacts: "Novos contatos",
          byHour: "Movimento por hora do dia",
          byDay: "Movimento por dia",
          byConnection: "Conversas por número",
          avgHandling: "Tempo médio de atendimento",
          totalPeriod: "Total no período",
          closed: "Finalizados",
          byAgent: "Desempenho por atendente",
          byQueue: "Conversas por setor",
          byClosingStatus: "Motivos de finalização",
          noData: "Nenhuma conversa encerrada com motivo definido ainda.",
          table: {
            agent: "Atendente",
            total: "Total",
            avgFirstResponse: "1ª resposta",
            avgHandling: "Atendimento",
          },
        }
      },
      connections: {
        title: "Conexões",
        description:
          "Cada conexão é um número de WhatsApp ligado ao sistema. É por eles que as conversas entram e saem.",
        toasts: {
          deleted: "Conexão com o WhatsApp excluída com sucesso!",
        },
        actions: {
          edit: "Editar conexão",
          delete: "Excluir conexão",
        },
        empty: {
          title: "Nenhum número conectado",
          message:
            "Conecte um número de WhatsApp para começar a receber e responder conversas pelo sistema.",
        },
        confirmationModal: {
          deleteTitle: "Excluir conexão",
          deleteMessage:
            "A conexão será removida e as conversas param de entrar por este número. Essa ação não pode ser desfeita.",
          deleteConfirm: "Excluir conexão",
          disconnectTitle: "Desconectar número",
          disconnectMessage:
            "O número sai do ar até alguém ler um novo QR Code. As conversas já recebidas continuam no sistema.",
          disconnectConfirm: "Desconectar",
        },
        buttons: {
          add: "Conectar número",
          disconnect: "desconectar",
          tryAgain: "Tentar novamente",
          qrcode: "QR CODE",
          newQr: "Novo QR CODE",
          connecting: "Conectando",
        },
        toolTips: {
          disconnected: {
            title: "Falha ao iniciar sessão do WhatsApp",
            content:
              "Certifique-se de que seu celular esteja conectado à internet e tente novamente, ou solicite um novo QR Code",
          },
          qrcode: {
            title: "Esperando leitura do QR Code",
            content:
              "Clique no botão 'QR CODE' e leia o QR Code com o seu celular para iniciar a sessão",
          },
          connected: {
            title: "Conexão estabelecida!",
          },
          timeout: {
            title: "A conexão com o celular foi perdida",
            content:
              "Certifique-se de que seu celular esteja conectado à internet e o WhatsApp esteja aberto, ou clique no botão 'Desconectar' para obter um novo QR Code",
          },
          duplicated: {
            title: "Este número já está em outra conexão",
            content:
              "O QR Code foi lido com um celular que já está vinculado a outra conexão. Duas conexões no mesmo número duplicam todos os atendimentos. Leia o novo QR Code com o celular correto.",
          },
        },
        table: {
          name: "Nome",
          number: "Número",
          status: "Status",
          lastUpdate: "Última atualização",
          default: "Padrão",
          actions: "Ações",
          session: "Sessão",
        },
      },
      whatsappModal: {
        title: {
          add: "Conectar número",
          edit: "Editar conexão",
        },
        form: {
          name: "Nome da conexão",
          nameHelp:
            "Só para identificar o número dentro do sistema (ex: Vendas, Suporte). O cliente não vê.",
          default: "Usar como número padrão",
          defaultHelp:
            "É por ele que saem as conversas iniciadas pelo sistema quando nenhum outro é escolhido.",
          greetingMessage: "Mensagem de saudação",
          greetingHelp:
            "Enviada quando o cliente escreve pela primeira vez neste número. Se houver mais de um setor, é nela que se pede para escolher.",
          farewellMessage: "Mensagem de despedida",
          farewellHelp:
            "Enviada quando o atendimento é encerrado. Deixe em branco para não enviar nada.",
          queues: "Setores atendidos por este número",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "WhatsApp salvo com sucesso.",
      },
      qrCode: {
        message: "Leia o QrCode para iniciar a sessão",
      },
      contacts: {
        title: "Contatos",
        toasts: {
          deleted: "Contato excluído com sucesso!",
        },
        searchPlaceholder: "Buscar por nome, número ou e-mail",
        actions: {
          startChat: "Abrir conversa com este contato",
          edit: "Editar contato",
          delete: "Excluir contato",
        },
        empty: {
          title: "Nenhum contato cadastrado",
          message:
            "Os contatos aparecem aqui automaticamente quando alguém escreve pelo WhatsApp. Você também pode cadastrar ou importar do celular.",
          searchTitle: "Nada encontrado",
          searchMessage: "Nenhum contato com esse nome, número ou e-mail.",
        },
        known: {
          badge: "Conhecido",
          set: "Marcar como conhecido: as conversas dele entram já abertas, sem passar por setor",
          unset: "Deixar de tratar como conhecido: as conversas voltam a entrar na fila de espera",
          toastSet:
            "Contato marcado como conhecido. As conversas dele vão para a aba Conhecidos.",
          toastUnset:
            "Contato desmarcado. As conversas dele voltam para a fila de espera.",
        },
        confirmationModal: {
          deleteTitle: "Excluir contato",
          importTitlte: "Importar contatos do celular",
          deleteMessage:
            "Todas as conversas deste contato serão perdidas. Essa ação não pode ser desfeita.",
          importMessage:
            "Todos os contatos salvos no celular conectado serão adicionados à sua lista. Contatos já existentes não são duplicados.",
        },
        buttons: {
          import: "Importar do celular",
          add: "Novo contato",
          confirmDelete: "Excluir contato",
          confirmImport: "Importar contatos",
        },
        table: {
          name: "Nome",
          whatsapp: "WhatsApp",
          email: "Email",
          actions: "Ações",
        },
      },
      contactModal: {
        title: {
          add: "Adicionar contato",
          edit: "Editar contato",
        },
        form: {
          mainInfo: "Dados do contato",
          extraInfo: "Informações adicionais",
          name: "Nome",
          number: "Número do Whatsapp",
          email: "Email",
          extraName: "Nome do campo",
          extraValue: "Valor",
        },
        buttons: {
          addExtraInfo: "Adicionar informação",
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Contato salvo com sucesso.",
      },
      customers: {
        title: "Clientes",
        toasts: {
          deleted: "Cliente excluído com sucesso!",
        },
        searchPlaceholder: "Buscar por nome, documento ou telefone",
        actions: {
          edit: "Editar cliente",
          delete: "Excluir cliente",
        },
        empty: {
          title: "Nenhum cliente cadastrado",
          message:
            "Cadastre os clientes para reunir conversas, oportunidades e cobranças no mesmo histórico.",
          searchTitle: "Nada encontrado",
          searchMessage: "Nenhum cliente com esse nome, documento ou telefone.",
        },
        confirmationModal: {
          deleteTitle: "Excluir cliente",
          deleteMessage:
            "O cadastro do cliente será removido. As conversas do contato continuam existindo. Essa ação não pode ser desfeita.",
          confirmDelete: "Excluir cliente",
        },
        buttons: {
          add: "Novo cliente",
        },
        table: {
          name: "Nome",
          document: "Documento",
          phone: "Telefone",
          segment: "Segmento",
          status: "Status",
          actions: "Ações",
        },
        status: {
          lead: "Lead",
          active: "Ativo",
          inactive: "Inativo",
        },
      },
      crm: {
        title: "CRM",
        searchPlaceholder: "Pesquisar por negócio ou cliente...",
        emptyStages: "Nenhuma coluna configurada neste quadro.",
        emptyStage: "Nenhum negócio nesta coluna",
        filters: {
          responsible: "Responsável",
          all: "Todos",
          status: "Perdidos",
          onlyOpen: "Ocultos",
          withClosed: "Visíveis",
        },
        buttons: {
          addDeal: "Novo Negócio",
          boards: "Quadros",
          stages: "Colunas",
          cancel: "Cancelar",
          save: "Salvar",
          create: "Criar",
          add: "Adicionar",
          close: "Fechar",
          edit: "Editar",
          delete: "Excluir",
        },
        summary: {
          pipeline: "No funil",
          inProgress: "Vendas em andamento",
          billed: "Faturado",
          conversion: "Conversão",
          deals: "{{count}} negócio(s)",
          lost: "{{count}} perdido(s)",
        },
        status: {
          open: "Em aberto",
          moved: "Avançou de quadro",
          won: "Faturado",
          lost: "Perdido",
        },
        stageType: {
          open: "Trabalho",
          lost: "Perda",
        },
        toasts: {
          dealCreated: "Negócio criado com sucesso!",
          dealUpdated: "Negócio atualizado com sucesso!",
          dealDeleted: "Negócio excluído com sucesso!",
          activityDeleted: "Registro excluído com sucesso!",
          stageCreated: "Coluna criada com sucesso!",
          stageDeleted: "Coluna excluída com sucesso!",
          boardCreated: "Quadro criado com sucesso!",
          boardDeleted: "Quadro excluído com sucesso!",
          advanced: "Card concluído — seguiu para {{board}}",
          billed: "Venda faturada!",
        },
        dealModal: {
          title: {
            add: "Novo negócio",
            edit: "Editar negócio",
          },
          form: {
            title: "Título do negócio",
            customer: "Cliente",
            value: "Valor",
            expectedCloseAt: "Previsão de fechamento",
            stage: "Etapa",
            responsible: "Responsável",
            noResponsible: "Sem responsável",
            notes: "Observações",
          },
          validation: {
            titleRequired: "Informe um título",
            titleShort: "Título muito curto",
            titleLong: "Título muito longo",
            valueNegative: "O valor não pode ser negativo",
            valueInvalid: "Informe um valor numérico",
          },
        },
        details: {
          tickets: "Conversas vinculadas",
          timeline: "Histórico",
          notePlaceholder: "Escreva uma anotação...",
          taskPlaceholder: "Descreva a tarefa...",
          asTask: "Como tarefa",
          emptyTimeline: "Nenhum registro ainda.",
        },
        activity: {
          dueAt: "vence em",
          created: "Negócio criado em {{body}}",
          stage_change: "Movido: {{body}}",
          board_out: "Concluiu o quadro: {{body}}",
          board_in: "Recebido do quadro anterior: {{body}}",
        },
        lostModal: {
          title: "Marcar como perdido",
          message: 'Por que "{{title}}" foi perdido? O motivo é opcional.',
          reason: "Motivo da perda",
          confirm: "Marcar como perdido",
        },
        confirmationModal: {
          deleteTitle: "Excluir negócio",
          deleteMessage:
            "Tem certeza que deseja excluir este negócio? O histórico também será apagado.",
        },
        stagesModal: {
          title: "Colunas do quadro",
          help: "A coluna de Entrada é onde pousa o card que chega de outro quadro (só uma por quadro). Colunas de Saída concluem o quadro e mandam o card adiante — pode haver várias, cada uma com seu destino. Sem destino definido, o card segue para o próximo quadro da ordem.",
          initial: "Entrada",
          initialHelp: "Onde pousa o card que chega de outro quadro",
          final: "Saída",
          finalHelp: "Conclui o quadro e envia o card ao destino",
          sendTo: "Enviar para:",
          targetBoard: "Quadro",
          targetStage: "Coluna",
          nextInLine: "Próximo da ordem",
          entryColumn: "Coluna de entrada",
          newStage: "Nome da nova coluna",
          moveUp: "Mover para a esquerda",
          moveDown: "Mover para a direita",
          deleteTitle: "Excluir coluna",
          deleteMessage:
            "Tem certeza que deseja excluir esta coluna? Ela precisa estar vazia.",
        },
        boardsModal: {
          title: "Quadros do fluxo",
          help: "A ordem define o caminho do card: uma coluna de saída sem destino próprio manda para o quadro seguinte desta lista. O último quadro é o que fatura a venda.",
          newBoard: "Nome do novo quadro",
          columns: "{{count}} coluna(s)",
          moveUp: "Subir na ordem",
          moveDown: "Descer na ordem",
          lastBoardNote:
            'Concluir "{{board}}" encerra a venda como faturada.',
          deleteTitle: "Excluir quadro",
          deleteMessage:
            "Tem certeza que deseja excluir este quadro? Ele precisa estar sem negócios ativos.",
        },
      },
      customerModal: {
        title: {
          add: "Adicionar cliente",
          edit: "Editar cliente",
        },
        form: {
          mainInfo: "Dados principais",
          addressInfo: "Endereço",
          crmInfo: "Informações comerciais",
          personType: "Tipo de pessoa",
          personTypePF: "Pessoa Física",
          personTypePJ: "Pessoa Jurídica",
          name: "Razão social / Nome",
          tradeName: "Nome fantasia",
          document: "CPF / CNPJ",
          stateRegistration: "Inscrição estadual",
          email: "Email",
          phone: "Telefone",
          whatsapp: "WhatsApp",
          zipCode: "CEP",
          zipCodeHelper: "Preenche o endereço automaticamente",
          street: "Endereço",
          addressNumber: "Número",
          complement: "Complemento",
          neighborhood: "Bairro",
          city: "Cidade",
          state: "UF",
          segment: "Ramo de atividade",
          origin: "Origem",
          status: "Status",
          notes: "Observações",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Cliente salvo com sucesso.",
      },
      quickAnswersModal: {
        title: {
          add: "Adicionar Resposta Rápida",
          edit: "Editar Resposta Rápida",
        },
        form: {
          shortcut: "Atalho",
          message: "Resposta Rápida",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Resposta Rápida salva com sucesso.",
      },
      queueModal: {
        title: {
          add: "Novo setor",
          edit: "Editar setor",
        },
        form: {
          name: "Nome",
          color: "Cor",
          colorHelp:
            "Marca a lateral da conversa na lista de atendimento e o cabeçalho dela.",
          greetingMessage: "Mensagem de saudação",
          greetingHelp:
            "Enviada automaticamente ao cliente quando a conversa entra neste setor. Deixe em branco para não enviar nada.",
          isDefault: "Setor padrão",
          isDefaultHelp: "Conversas sem setor definido caem automaticamente neste setor. Só pode existir um setor padrão por vez.",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
      },
      userModal: {
        title: {
          add: "Adicionar usuário",
          edit: "Editar usuário",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
          whatsapp: "Número padrão para enviar",
          noWhatsapp: "Usar o número padrão da empresa",
          showPassword: "Mostrar a senha",
          hidePassword: "Ocultar a senha",
          maxSimultaneousTickets: "Limite de conversas simultâneas",
          maxSimultaneousTicketsHelper:
            "0 = sem limite. Usado pela distribuição automática de conversas.",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Usuário salvo com sucesso.",
      },
      chat: {
        noTicketTitle: "Nenhuma conversa aberta",
        noTicketMessage:
          "Escolha uma conversa na lista ao lado para ler o histórico e responder.",
      },
      ticketsManager: {
        buttons: {
          newTicket: "Nova conversa",
          filters: "Filtrar conversas",
          clearFilters: "Limpar filtros",
          clearSearch: "Limpar busca",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Setores",
      },
      ticketsWhatsappSelect: {
        placeholder: "Conexões",
        allConnections: "Todos os números",
        multiple: "{{count}} números",
        tooltip: "Filtrar conversas por número de WhatsApp",
        disconnected: "Desconectado",
      },
      tickets: {
        toasts: {
          deleted: "A conversa que você estava atendendo foi excluída.",
        },
        notification: {
          message: "Mensagem de",
        },
        tabs: {
          ariaLabel: "Situação das conversas",
          open: { title: "Em aberto" },
          closed: { title: "Encerradas" },
          groups: { title: "Grupos" },
          search: { title: "Buscar" },
        },
        search: {
          placeholder: "Buscar por nome, mensagem ou protocolo",
          resultsFor: "Resultados para",
        },
        buttons: {
          showAll: "Ver conversas de todos os atendentes",
        },
      },
      transferTicketModal: {
        title: "Transferir conversa",
        helper:
          "Escolha um atendente, um setor, ou os dois. Só com setor, a conversa volta para a fila de espera dele.",
        noQueue: "Sem setor",
        fieldLabel: "Transferir para atendente",
        fieldQueueLabel: "Transferir para setor",
        fieldConnectionLabel: "Transferir para conexão",
        fieldQueuePlaceholder: "Selecione um setor",
        fieldConnectionPlaceholder: "Selecione uma conexão",
        noOptions: "Nenhum usuário encontrado com esse nome",
        removeQueueHelp:
          "Se remover o setor e não sobrar nenhum, a conversa vai para o setor padrão.",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
          removeUser: "Remover atendente",
          removeQueue: "Remover setor",
        },
      },
      ticketsList: {
        pendingHeader: "Aguardando",
        assignedHeader: "Atendendo",
        myTicketsHeader: "Minhas",
        attendingHeader: "Em atendimento",
        waitingHeader: "Aguardando",
        knownHeader: "Conhecidos",
        tabTooltips: {
          myTickets: "Conversas em que você é o responsável",
          attending: "Todas as conversas já assumidas por algum atendente",
          waiting: "Conversas na fila, ainda sem responsável",
          known: "Conversas de contatos marcados como conhecidos: entram já abertas, sem passar por setor e sem precisar aceitar",
        },
        empty: {
          title: "Nenhuma conversa aqui",
          message:
            "Quando chegar uma conversa nesta aba, ela aparece nesta lista automaticamente.",
          searchTitle: "Nada encontrado",
          searchMessage:
            "Nenhuma conversa com esse nome, mensagem ou protocolo. Tente outro termo.",
        },
        noTicketsTitle: "Nada aqui!",
        noTicketsMessage:
          "Nenhuma conversa encontrada com esse status ou termo pesquisado",
        connectionTitle: "Conexão que está sendo utilizada atualmente.",
        waitingFor: "Tempo que o cliente está aguardando",
        protocol: "Protocolo do atendimento",
        pendingBar: {
          readOnly:
            "Você está apenas visualizando. Aceite o atendimento para responder.",
          accept: "Aceitar atendimento",
        },
        buttons: {
          accept: "Aceitar",
        },
      },
      ticketsTagSelect: {
        all: "Etiquetas",
        multiple: "{{count}} etiquetas",
        tooltip: "Filtrar conversas por etiqueta",
      },
      ticketsUserSelect: {
        all: "Atendentes",
        multiple: "{{count}} atendentes",
        tooltip: "Filtrar conversas por atendente responsável",
      },
      ticketTags: {
        placeholder: "Digite para buscar uma etiqueta",
        add: "Etiquetar conversa",
        edit: "Alterar etiquetas",
        done: "Pronto",
      },
      tags: {
        description:
          "Etiquetas ajudam a classificar e filtrar conversas no painel de atendimento.",
        saved: "Etiqueta salva com sucesso.",
        deleted: "Etiqueta excluída com sucesso.",
        confirmDelete: "Excluir etiqueta",
        confirmDeleteMessage:
          "A etiqueta será removida de todas as conversas em que estiver aplicada.",
        empty: "Nenhuma etiqueta cadastrada ainda.",
        form: {
          name: "Nome da etiqueta",
          color: "Cor",
          add: "Adicionar",
          save: "Salvar",
          cancel: "Cancelar",
        },
        table: {
          tag: "Etiqueta",
          actions: "Ações",
        },
      },
      ticketInfo: {
        protocolTooltip: "Protocolo do atendimento (clique para copiar)",
        protocolCopied: "Protocolo copiado.",
        queueTooltip: "Setor responsável por esta conversa",
        unassigned: "Sem responsável",
        openContact: "Abrir os dados do contato",
        togglePanel: "Dados do cliente e pedidos",
        togglePanelWithDeals:
          "Dados do cliente · {{count}} pedido(s) nesta conversa",
      },
      forwardMessageModal: {
        title: "Encaminhar mensagem",
        helper: "Escolha o contato que vai receber esta mensagem.",
        fieldLabel: "Digite para pesquisar o contato",
        noOptions: "Nenhum contato encontrado",
        success: "Mensagem encaminhada.",
        buttons: { confirm: "Encaminhar", cancel: "Cancelar" },
      },
      closeTicketModal: {
        title: "Encerrar conversa",
        status: "Motivo do encerramento",
        none: "Sem motivo",
        requiredHelper:
          "Selecione o motivo do encerramento para finalizar esta conversa.",
        optionalHelper:
          "Você pode registrar o motivo do encerramento. É opcional.",
        noStatuses:
          "Nenhum status de finalização cadastrado. Configure em Configurações › Status de Finalização.",
        buttons: {
          confirm: "Encerrar",
          cancel: "Cancelar",
        },
      },
      newTicketModal: {
        title: "Nova conversa",
        fieldLabel: "Buscar contato pelo nome ou número",
        add: "Adicionar",
        connection: "Enviar pelo número",
        connectionHelper: "O contato receberá a mensagem por este número.",
        noConnection:
          "Nenhuma conexão ativa. Conecte um número em Configurações › Conexões.",
        buttons: {
          ok: "Abrir conversa",
          cancel: "Cancelar",
        },
      },
      mainDrawer: {
        sections: {
          operation: "Operação",
          commercial: "Comercial",
          administration: "Administração",
          platform: "Plataforma",
        },
        listItems: {
          dashboard: "Visão geral",
          connections: "Conexões",
          tickets: "Conversas",
          contacts: "Contatos",
          customers: "Clientes",
          crm: "Funil de vendas",
          products: "Produtos",
          finance: "Financeiro",
          quickAnswers: "Respostas rápidas",
          queues: "Setores",
          administration: "Administração",
          superAdmin: "Gestão de Empresas",
          companies: "Empresas",
          users: "Usuários",
          roles: "Cargos e acessos",
          settings: "Configurações",
        },
        appBar: {
          user: {
            profile: "Perfil",
            logout: "Sair",
          },
        },
      },
      notifications: {
        title: "Mensagens não lidas",
        tooltip: "Conversas com mensagens não lidas",
        count: "{{count}} conversa(s)",
        noTickets: "Nenhuma mensagem nova.",
      },
      queues: {
        title: "Setores",
        toasts: {
          deleted: "Setor excluído com sucesso!",
        },
        actions: {
          edit: "Editar setor",
          delete: "Excluir setor",
        },
        empty: {
          title: "Nenhum setor cadastrado",
          message:
            "Sem setores, todas as conversas chegam numa lista só. Crie ao menos um para organizar o atendimento por área.",
        },
        confirmDelete: "Excluir setor",
        description:
          "Setores organizam o atendimento por área (Vendas, Suporte, Financeiro). Cada conversa entra em um setor, e o atendente vê apenas os setores dos quais faz parte.",
        table: {
          name: "Nome",
          color: "Cor",
          greeting: "Mensagem de saudação",
          isDefault: "Padrão",
          actions: "Ações",
        },
        buttons: {
          add: "Novo setor",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Essa ação não pode ser desfeita. As conversas deste setor continuam existindo, mas ficam sem setor atribuído.",
        },
      },
      companies: {
        title: "Empresas",
        detailTitle: "Ficha da empresa",
        actions: {
          edit: "Editar empresa",
          delete: "Excluir empresa",
        },
        empty: {
          title: "Nenhuma empresa cadastrada",
          message: "Cadastre a primeira empresa para começar a operar.",
        },
        confirmDelete: "Excluir empresa",
        table: {
          name: "Nome",
          document: "CNPJ/CPF",
          email: "E-mail",
          plan: "Plano",
          status: "Status",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar empresa",
        },
        status: {
          active: "Ativa",
          suspended: "Suspensa",
          canceled: "Cancelada",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Você tem certeza? Essa ação não pode ser revertida! Só é possível excluir empresas que não possuam mais usuários vinculados.",
        },
        toasts: {
          deleted: "Empresa excluída com sucesso!",
        },
      },
      companyModal: {
        title: {
          add: "Adicionar Empresa",
          edit: "Editar Empresa",
        },
        form: {
          companyData: "Dados da Empresa",
          name: "Nome",
          document: "CNPJ/CPF",
          email: "E-mail",
          phone: "Telefone",
          plan: "Plano",
          planBasic: "Básico",
          planPro: "Profissional",
          planEnterprise: "Enterprise",
          status: "Status",
          statusActive: "Ativa",
          statusSuspended: "Suspensa",
          statusCanceled: "Cancelada",
          adminData: "Usuário Administrador",
          adminName: "Nome do administrador",
          adminEmail: "E-mail do administrador",
          adminPassword: "Senha do administrador",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Empresa salva com sucesso!",
      },
      queueSelect: {
        inputLabel: "Setores",
      },
      quickAnswers: {
        title: "Respostas rápidas",
        description:
          "Textos prontos que o atendente insere digitando / na conversa.",
        searchPlaceholderLong: "Buscar por atalho ou texto",
        actions: {
          edit: "Editar resposta rápida",
          delete: "Excluir resposta rápida",
        },
        empty: {
          title: "Nenhuma resposta rápida cadastrada",
          message:
            "Cadastre as frases que sua equipe mais repete. Na conversa, o atendente digita / e escolhe pelo atalho.",
          searchTitle: "Nada encontrado",
          searchMessage: "Nenhuma resposta rápida com esse atalho ou texto.",
        },
        confirmDelete: "Excluir resposta",
        table: {
          shortcut: "Atalho",
          message: "Resposta Rápida",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar Resposta Rápida",
        },
        toasts: {
          deleted: "Resposta Rápida excluída com sucesso.",
        },
        searchPlaceholder: "Pesquisar...",
        confirmationModal: {
          deleteTitle:
            "Você tem certeza que quer excluir esta Resposta Rápida: ",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
      },
      users: {
        title: "Usuários",
        searchPlaceholder: "Buscar por nome ou e-mail",
        actions: {
          edit: "Editar usuário",
          delete: "Excluir usuário",
          access: "Definir cargo e permissões",
        },
        noRole: "sem cargo",
        hasExceptions: "+ exceções",
        hasExceptionsHelp:
          "Esta pessoa tem permissões liberadas ou bloqueadas além do cargo dela.",
        empty: {
          title: "Nenhum usuário cadastrado",
          message:
            "Crie um usuário para cada pessoa que vai atender. Cada uma entra com o próprio e-mail e senha.",
          searchTitle: "Nada encontrado",
          searchMessage: "Nenhum usuário com esse nome ou e-mail.",
        },
        confirmDelete: "Excluir usuário",
        unlimited: "Sem limite",
        table: {
          name: "Nome",
          email: "Email",
          role: "Cargo",
          whatsapp: "Número padrão",
          status: "Status",
          online: "Online",
          offline: "Offline",
          maxSimultaneousTickets: "Limite",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar usuário",
        },
        toasts: {
          deleted: "Usuário excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Todos os dados do usuário serão perdidos. As conversas abertas dele voltam para o setor.",
        },
      },
      settings: {
        success: "Configurações salvas com sucesso.",
        title: "Configurações",
        description:
          "Regras de atendimento, números conectados, horários e identidade da empresa. Usuários, perfis de acesso e setores ficam em Administração, no menu lateral.",
        tabs: {
          general: "Geral",
          connections: "Conexões",
          businessHours: "Horário de Atendimento",
          ticketStatuses: "Status de Finalização",
          tags: "Etiquetas",
          autoMessages: "Mensagens Automáticas",
          branding: "Identidade Visual",
        },
        general: {
          sections: {
            attendance: "Regras de atendimento",
            experience: "Experiência do atendente",
            integrations: "Integrações",
          },
          autoAssignTickets: {
            label: "Distribuição automática de conversas",
            helper:
              "Novas conversas são entregues automaticamente ao atendente online do setor que tiver menos conversas abertas. Respeita o limite individual de cada atendente.",
          },
          requireClosingStatus: {
            label: "Exigir status ao encerrar",
            helper:
              "O atendente precisa escolher um motivo de encerramento antes de finalizar a conversa.",
          },
          allowAgentSeeAllTickets: {
            label: "Atendente pode ver conversas de outros setores",
            helper:
              "Quando desligado, cada atendente vê apenas as conversas dos setores dos quais faz parte.",
          },
          autoCloseInactiveHours: {
            label: "Encerrar conversas paradas após (horas)",
            helper: "0 desliga o encerramento automático. Verificado a cada 5 minutos pelo servidor.",
          },
          reopenTicketWindowHours: {
            label: "Janela de reabertura (horas)",
            helper:
              "Nova mensagem dentro desse período reabre a última conversa do contato em vez de criar outra.",
          },
          signMessages: {
            label: "Assinar mensagens com o nome do atendente",
            helper: "Define o padrão para novos atendentes. Cada um pode alternar dentro da conversa.",
          },
          notificationSound: {
            label: "Som de notificação",
            helper: "Toca um alerta sonoro quando chega mensagem em uma conversa que não está aberta.",
          },
        },
        buttons: {
          save: "Salvar",
        },
        settings: {
          userCreation: {
            name: "Criação de usuário",
            options: {
              enabled: "Ativado",
              disabled: "Desativado",
            },
          },
          apiToken: {
            name: "Token da API",
            generate: "Gerar novo token",
            copy: "Copiar token",
            copied: "Token copiado.",
            generated: "Token novo gerado. Atualize suas integrações.",
            empty: "Nenhum token gerado ainda",
            helper:
              "Use este token para autenticar integrações externas com a API de mensagens desta empresa.",
            confirmTitle: "Gerar um token novo?",
            confirmMessage:
              "O token atual deixa de funcionar imediatamente. Toda integração que já usa ele para de enviar e receber mensagens até ser atualizada com o novo.",
            confirmButton: "Gerar token novo",
          },
        },
        holidays: {
          title: "Feriados e exceções",
          description:
            "Nas datas abaixo a empresa é considerada fechada, mesmo que o dia da semana esteja marcado como útil.",
          saved: "Feriado cadastrado.",
          deleted: "Feriado removido.",
          confirmDelete: "Remover feriado",
          confirmDeleteMessage: "A data volta a seguir o horário normal de atendimento.",
          empty: "Nenhum feriado cadastrado.",
          everyYear: "todo ano",
          form: {
            name: "Descrição",
            date: "Data",
            recurring: "Repete todo ano",
            add: "Adicionar",
          },
          table: { name: "Descrição", date: "Data", actions: "Ações" },
        },
        businessHours: {
          description: "Defina os dias e horários em que sua empresa realiza atendimento. Fora desse período, a mensagem automática configurada na aba 'Mensagens Automáticas' pode ser enviada ao cliente.",
          table: {
            day: "Dia",
            enabled: "Ativo",
            start: "Início",
            end: "Fim",
          },
          weekDays: {
            0: "Domingo",
            1: "Segunda-feira",
            2: "Terça-feira",
            3: "Quarta-feira",
            4: "Quinta-feira",
            5: "Sexta-feira",
            6: "Sábado",
          },
        },
        ticketStatuses: {
          buttons: {
            add: "Adicionar status",
            cancel: "Cancelar",
            okAdd: "Adicionar",
            okEdit: "Salvar",
          },
          table: {
            name: "Nome",
            type: "Tipo",
            default: "Padrão",
            actions: "Ações",
          },
          types: {
            pending: "Aguardando",
            open: "Em atendimento",
            closed: "Finalizado",
          },
          yes: "Sim",
          no: "Não",
          confirmationModal: {
            deleteTitle: "Excluir",
            deleteMessage: "Você tem certeza? Essa ação não pode ser revertida!",
          },
          toasts: {
            deleted: "Status excluído com sucesso!",
          },
          success: "Status salvo com sucesso!",
          modal: {
            title: {
              add: "Adicionar Status",
              edit: "Editar Status",
            },
            name: "Nome do status",
            color: "Cor",
            type: "Vinculado a",
            isDefault: "Usar como padrão para este tipo",
          },
        },
        branding: {
          title: "Identidade da empresa",
          description:
            "Nome e logo exibidos na barra lateral e no topo do sistema, para todos os atendentes.",
          nameLabel: "Nome da empresa",
          nameHelp: "Deixe em branco para usar o nome do sistema (Unmess).",
          choose: "Escolher logo",
          remove: "Remover logo",
          save: "Salvar",
          saved: "Identidade atualizada!",
          fileHelp: "PNG, JPG, WEBP ou SVG, até 2 MB. Ideal quadrada.",
          invalidType: "Formato não suportado. Use PNG, JPG, WEBP ou SVG.",
          tooLarge: "Imagem muito grande. O limite é 2 MB.",
        },
        autoMessages: {
          outOfHours: {
            toggle: "Enviar mensagem automática fora do horário de atendimento",
            description: "Enviada automaticamente quando o cliente inicia contato fora do horário configurado.",
            placeholder: "Ex: Olá {{cliente.nome}}, no momento estamos fora do horário de atendimento. Retornaremos assim que possível!",
          },
          transfer: {
            toggle: "Enviar mensagem automática ao transferir o atendimento",
            description: "Enviada automaticamente quando uma conversa é transferida de atendente ou setor.",
            placeholder: "Ex: Olá {{cliente.nome}}, seu atendimento foi transferido para o setor {{setor}} e será continuado por {{atendente}}.",
          },
        },
      },
      messagesList: {
        internalNote: "Nota interna",
        fromApp: "pelo celular",
        edited: "editada",
        fromAppTooltip:
          "Enviada pelo aplicativo do WhatsApp no celular, fora do sistema",
        searchPlaceholder: "Buscar nesta conversa",
        closeSearch: "Fechar a busca",
        goToEnd: "Ir para o fim",
        newMessages: "{{count}} mensagem(ns) nova(s)",
        searchResults: "{{count}} resultado(s)",
        empty: {
          title: "Nenhuma mensagem ainda",
          message:
            "Escreva a primeira mensagem no campo abaixo para começar a conversa.",
        },
        header: {
          assignedTo: "Responsável:",
          buttons: {
            return: "Devolver",
            resolve: "Encerrar",
            reopen: "Reabrir",
            accept: "Aceitar",
          },
          tooltips: {
            return:
              "Devolve a conversa para o setor. Ela volta para a fila e outro atendente pode assumir.",
            resolve:
              "Encerra o atendimento. A conversa sai da sua lista e vai para 'Encerradas'.",
            reopen: "Reabre a conversa e coloca você como responsável.",
            accept: "Assume a conversa. Você passa a ser o responsável por ela.",
            more: "Mais ações desta conversa",
          },
        },
      },
      messagesInput: {
        placeholderOpen:
          "Escreva uma mensagem, ou digite / para usar uma resposta pronta",
        quickAnswersHint: "↑ ↓ para escolher · Enter para inserir · Esc para fechar",
        placeholderClosed:
          "Reabra ou aceite esta conversa para enviar uma mensagem.",
        signMessage: "Assinar com meu nome",
        internalNoteTooltip: "Nota interna (só a equipe vê)",
        filesSelected: "{{count}} arquivos selecionados",
        tooltips: {
          emoji: "Emoji",
          stickers: "Figurinhas",
          attach: "Anexar arquivo",
          send: "Enviar (Enter)",
          record: "Gravar áudio",
          cancelAttach: "Descartar o anexo",
          sendAttach: "Enviar o anexo",
        },
        placeholderInternalNote:
          "Nota interna — não será enviada ao cliente",
      },
      contactDrawer: {
        header: "Dados do contato",
        close: "Fechar painel",
        customer: {
          title: "Cliente",
          status: "Situação",
          statuses: { lead: "Lead", active: "Ativo", inactive: "Inativo" },
          name: "Razão social / Nome",
          document: "CPF/CNPJ",
          segment: "Segmento",
          responsible: "Responsável",
          city: "Cidade",
          notes: "Observações",
          notLinked: "Este contato ainda não tem cadastro de cliente.",
          create: "Cadastrar cliente",
          edit: "Editar cliente",
        },
        history: {
          title: "Atendimentos anteriores",
          empty: "Nenhum atendimento anterior.",
          noAgent: "Sem atendente",
          open: "Abrir este atendimento",
        },
        buttons: {
          edit: "Editar contato",
        },
        extraInfo: "Outras informações",
      },
      ticketOptionsMenu: {
        delete: "Excluir conversa",
        transfer: "Transferir conversa",
        confirmationModal: {
          title: "Excluir a conversa do contato",
          titleFrom: "do contato ",
          message:
            "Todas as mensagens desta conversa serão perdidas. Essa ação não pode ser desfeita.",
        },
        buttons: {
          delete: "Excluir",
          cancel: "Cancelar",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancelar",
        },
      },
      messageInput: {
        recording: {
          insecureContext:
            "O navegador só libera o microfone em conexão segura (HTTPS). Acessando pelo IP da rede em HTTP, a gravação fica indisponível.",
          unavailable: "Não foi possível iniciar o gravador de áudio.",
          tooShort: "Gravação muito curta, nada foi enviado.",
        },
      },
      editMessageModal: {
        title: "Editar mensagem",
        field: "Mensagem",
        timeLimit:
          "O WhatsApp só permite editar mensagens enviadas há poucos minutos.",
        buttons: {
          cancel: "Cancelar",
          save: "Salvar",
        },
      },
      messageOptionsMenu: {
        delete: "Apagar mensagem",
        edit: "Editar",
        reply: "Responder",
        forward: "Encaminhar",
        confirmationModal: {
          title: "Apagar mensagem?",
          message: "Esta ação não pode ser revertida.",
        },
      },
      errors: {
        generic: "Não foi possível concluir a operação. Tente novamente.",
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP: "Deve haver pelo menos um WhatsApp padrão.",
        ERR_NO_DEF_WAPP_FOUND:
          "Nenhum WhatsApp padrão encontrado. Verifique a página de conexões.",
        ERR_WAPP_NOT_INITIALIZED:
          "Esta sessão do WhatsApp não foi inicializada. Verifique a página de conexões.",
        ERR_WAPP_CHECK_CONTACT:
          "Não foi possível verificar o contato do WhatsApp. Verifique a página de conexões",
        ERR_WAPP_INVALID_CONTACT: "Este não é um número de Whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA:
          "Não foi possível baixar mídia do WhatsApp. Verifique a página de conexões.",
        ERR_INVALID_CREDENTIALS:
          "Erro de autenticação. Por favor, tente novamente.",
        ERR_SENDING_WAPP_MSG:
          "Erro ao enviar mensagem do WhatsApp. Verifique a página de conexões.",
        ERR_DELETE_WAPP_MSG: "Não foi possível excluir a mensagem do WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Já existe uma conversa aberta para este contato.",
        ERR_SESSION_EXPIRED: "Sessão expirada. Por favor entre.",
        ERR_USER_CREATION_DISABLED:
          "A criação do usuário foi desabilitada pelo administrador.",
        ERR_NO_PERMISSION: "Você não tem permissão para acessar este recurso.",
        ERR_DUPLICATED_CONTACT: "Já existe um contato com este número.",
        ERR_NO_COMPANY_FOUND: "Nenhuma empresa encontrada com este ID.",
        ERR_DUPLICATED_COMPANY_DOCUMENT:
          "Já existe uma empresa cadastrada com este CNPJ/CPF.",
        ERR_COMPANY_HAS_USERS:
          "Não é possível excluir uma empresa que ainda possui usuários vinculados.",
        ERR_NO_SETTING_FOUND: "Nenhuma configuração encontrada com este ID.",
        ERR_NO_CONTACT_FOUND: "Nenhum contato encontrado com este ID.",
        ERR_NO_TICKET_FOUND: "Nenhuma conversa encontrada com este ID.",
        ERR_NO_USER_FOUND: "Nenhum usuário encontrado com este ID.",
        ERR_NO_WAPP_FOUND: "Nenhum WhatsApp encontrado com este ID.",
        ERR_CREATING_MESSAGE: "Erro ao criar mensagem no banco de dados.",
        ERR_CREATING_TICKET: "Erro ao criar a conversa no banco de dados.",
        ERR_FETCH_WAPP_MSG:
          "Erro ao buscar a mensagem no WhtasApp, talvez ela seja muito antiga.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "Esta cor já está em uso, escolha outra.",
        ERR_WAPP_GREETING_REQUIRED:
          "A mensagem de saudação é obrigatória quando existe mais de um setor.",
      },
    },
  },
};

export { messages };
