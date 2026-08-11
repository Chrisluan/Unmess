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
        title: "Login",
        form: {
          email: "Email",
          password: "Senha",
        },
        buttons: {
          submit: "Entrar",
          register: "Não tem um conta? Cadastre-se!",
        },
      },
      auth: {
        toasts: {
          success: "Login efetuado com sucesso!",
        },
      },
      dashboard: {
        period: {
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
            title: "Chats hoje: ",
          },
        },
        messages: {
          inAttendance: {
            title: "Em Atendimento"
          },
          waiting: {
            title: "Aguardando"
          },
          closed: {
            title: "Finalizado"
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
          byConnection: "Chats por conexão",
          avgHandling: "Tempo médio de atendimento",
          totalPeriod: "Total no período",
          closed: "Finalizados",
          byAgent: "Desempenho por atendente",
          byQueue: "Chats por setor",
          byClosingStatus: "Motivos de finalização",
          noData: "Nenhum chat finalizado com status definido ainda.",
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
        toasts: {
          deleted: "Conexão com o WhatsApp excluída com sucesso!",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida.",
          disconnectTitle: "Desconectar",
          disconnectMessage:
            "Tem certeza? Você precisará ler o QR Code novamente.",
        },
        buttons: {
          add: "Adicionar WhatsApp",
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
          add: "Adicionar WhatsApp",
          edit: "Editar WhatsApp",
        },
        form: {
          name: "Nome",
          default: "Padrão",
          farewellMessage: "Mensagem de despedida"
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
        searchPlaceholder: "Pesquisar...",
        known: {
          badge: "Conhecido",
          set: "Marcar como pessoa conhecida (não entra em Oportunidades)",
          unset: "Deixar de tratar como pessoa conhecida",
          toastSet: "Contato marcado como conhecido. As conversas dele vão para a aba Conhecidos.",
          toastUnset: "Contato desmarcado. As conversas dele voltam para Oportunidades.",
        },
        confirmationModal: {
          deleteTitle: "Deletar ",
          importTitlte: "Importar contatos",
          deleteMessage:
            "Tem certeza que deseja deletar este contato? Todos os chats relacionados serão perdidos.",
          importMessage: "Deseja importas todos os contatos do telefone?",
        },
        buttons: {
          import: "Importar Contatos",
          add: "Adicionar Contato",
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
        searchPlaceholder: "Pesquisar por nome, documento ou telefone...",
        confirmationModal: {
          deleteTitle: "Deletar cliente",
          deleteMessage: "Tem certeza que deseja deletar este cliente?",
        },
        buttons: {
          add: "Adicionar Cliente",
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
          add: "Adicionar fila",
          edit: "Editar fila",
        },
        form: {
          name: "Nome",
          color: "Cor",
          greetingMessage: "Mensagem de saudação",
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
          profile: "Perfil",
          whatsapp: "Conexão Padrão",
          permissionGroup: "Grupo de permissão",
          maxSimultaneousTickets: "Limite de chats simultâneos",
          maxSimultaneousTicketsHelper:
            "0 = sem limite. Usado pela distribuição automática de chats.",
        },
        profiles: {
          vendedor: "Vendedor",
          producao: "Produção",
          instalacao: "Instalação",
          financeiro: "Financeiro",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Usuário salvo com sucesso.",
      },
      permissionGroups: {
        title: "Equipe - Grupos de Permissão",
        table: {
          name: "Nome",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar grupo",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Você tem certeza? Essa ação não pode ser revertida! Só é possível excluir grupos que não possuam mais usuários vinculados.",
        },
        toasts: {
          deleted: "Grupo excluído com sucesso!",
        },
      },
      permissionGroupModal: {
        title: {
          add: "Adicionar Grupo de Permissão",
          edit: "Editar Grupo de Permissão",
        },
        form: {
          name: "Nome do grupo",
          permissions: "Permissões",
        },
        permissions: {
          "chats:viewAll": "Ver todos os chats",
          "chats:delete": "Excluir chats",
          "chats:transfer": "Transferir chats",
          "customers:manage": "Gerenciar clientes",
          "users:manage": "Gerenciar usuários",
          "queues:manage": "Gerenciar setores",
          "settings:manage": "Gerenciar configurações",
          "reports:view": "Ver relatórios",
          "financial:manage": "Gerenciar financeiro",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Grupo salvo com sucesso!",
      },
      chat: {
        noTicketMessage: "Selecione um chat para começar a conversar.",
      },
      ticketsManager: {
        buttons: {
          newTicket: "Novo",
          filters: "Filtros",
          clearFilters: "Limpar filtros",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Filas",
      },
      ticketsWhatsappSelect: {
        placeholder: "Conexões",
        allConnections: "Todos os números",
        multiple: "{{count}} números",
        tooltip: "Filtrar chats por número de WhatsApp",
        disconnected: "Desconectado",
      },
      tickets: {
        toasts: {
          deleted: "O chat que você estava foi deletado.",
        },
        notification: {
          message: "Mensagem de",
        },
        tabs: {
          open: { title: "Inbox" },
          closed: { title: "Resolvidos" },
          groups: { title: "Grupos" },
          search: { title: "Busca" },
        },
        search: {
          placeholder: "Buscar por nome, mensagem ou protocolo",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Chat",
        fieldLabel: "Digite para buscar usuários",
        fieldQueueLabel: "Transferir para fila",
        fieldConnectionLabel: "Transferir para conexão",
        fieldQueuePlaceholder: "Selecione uma fila",
        fieldConnectionPlaceholder: "Selecione uma conexão",
        noOptions: "Nenhum usuário encontrado com esse nome",
        removeQueueHelp: "Se remover a fila e não sobrar nenhuma, o ticket cai automaticamente no setor padrão.",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
          removeUser: "Remover atendente",
          removeQueue: "Remover fila",
        },
      },
      ticketsList: {
        pendingHeader: "Aguardando",
        assignedHeader: "Atendendo",
        myTicketsHeader: "Meus",
        attendingHeader: "Em Atendimento",
        waitingHeader: "Oportunidades",
        knownHeader: "Conhecidos",
        noTicketsTitle: "Nada aqui!",
        noTicketsMessage:
          "Nenhum chat encontrado com esse status ou termo pesquisado",
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
        tooltip: "Filtrar chats por etiqueta",
      },
      ticketsUserSelect: {
        all: "Atendentes",
        multiple: "{{count}} atendentes",
        tooltip: "Filtrar chats por atendente responsável",
      },
      ticketTags: {
        placeholder: "Adicionar etiqueta...",
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
        title: "Encerrar chat",
        status: "Motivo do encerramento",
        none: "Sem motivo",
        requiredHelper:
          "Selecione o motivo do encerramento para finalizar este chat.",
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
        title: "Criar Chat",
        fieldLabel: "Digite para pesquisar o contato",
        add: "Adicionar",
        connection: "Enviar pelo número",
        connectionHelper: "O contato receberá a mensagem por este número.",
        noConnection: "Nenhuma conexão ativa. Conecte um número em Configurações › Conexões.",
        buttons: {
          ok: "Salvar",
          cancel: "Cancelar",
        },
      },
      mainDrawer: {
        listItems: {
          dashboard: "Dashboard",
          connections: "Conexões",
          tickets: "Chats",
          contacts: "Contatos",
          customers: "Clientes",
          quickAnswers: "Respostas Rápidas",
          queues: "Filas",
          administration: "Administração",
          superAdmin: "Gestão de Empresas",
          companies: "Empresas",
          users: "Usuários",
          permissionGroups: "Equipe",
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
        noTickets: "Nenhuma notificação.",
      },
      queues: {
        title: "Filas",
        table: {
          name: "Nome",
          color: "Cor",
          greeting: "Mensagem de saudação",
          isDefault: "Padrão",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar fila",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Você tem certeza? Essa ação não pode ser revertida! Os chats dessa fila continuarão existindo, mas não terão mais nenhuma fila atribuída.",
        },
      },
      companies: {
        title: "Empresas",
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
        inputLabel: "Filas",
      },
      quickAnswers: {
        title: "Respostas Rápidas",
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
        table: {
          name: "Nome",
          email: "Email",
          profile: "Perfil",
          whatsapp: "Conexão Padrão",
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
            "Todos os dados do usuário serão perdidos. Os chats abertos deste usuário serão movidos para a fila.",
        },
      },
      settings: {
        success: "Configurações salvas com sucesso.",
        title: "Configurações",
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
          },
          autoAssignTickets: {
            label: "Distribuição automática de chats",
            helper:
              "Novos chats são entregues automaticamente ao atendente online da fila com menos conversas abertas. Respeita o limite individual de cada atendente.",
          },
          requireClosingStatus: {
            label: "Exigir status ao encerrar",
            helper:
              "O atendente precisa escolher um motivo de encerramento antes de finalizar o chat.",
          },
          allowAgentSeeAllTickets: {
            label: "Atendente pode ver chats de outras filas",
            helper:
              "Quando desligado, cada atendente vê apenas os chats das filas às quais pertence.",
          },
          autoCloseInactiveHours: {
            label: "Encerrar chats parados após (horas)",
            helper: "0 desliga o encerramento automático. Verificado a cada 5 minutos pelo servidor.",
          },
          reopenTicketWindowHours: {
            label: "Janela de reabertura (horas)",
            helper:
              "Nova mensagem dentro desse período reabre o último chat do contato em vez de criar outro.",
          },
          signMessages: {
            label: "Assinar mensagens com o nome do atendente",
            helper: "Define o padrão para novos atendentes. Cada um pode alternar na tela de chat.",
          },
          notificationSound: {
            label: "Som de notificação",
            helper: "Toca um alerta sonoro quando chega mensagem em um chat não aberto.",
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
            helper: "Use este token para autenticar integrações externas com a API de mensagens desta empresa.",
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
            description: "Enviada automaticamente quando um chat é transferido de atendente ou setor.",
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
        searchResults: "{{count}} resultado(s)",
        header: {
          assignedTo: "Atribuído à:",
          buttons: {
            return: "Retornar",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceitar",
          },
        },
      },
      messagesInput: {
        placeholderOpen: "Digite uma mensagem ou tecle ''/'' para utilizar as respostas rápidas cadastrada",
        placeholderClosed:
          "Reabra ou aceite esse chat para enviar uma mensagem.",
        signMessage: "Assinar",
        internalNoteTooltip: "Nota interna (só a equipe vê)",
        placeholderInternalNote:
          "Nota interna — não será enviada ao cliente",
      },
      contactDrawer: {
        header: "Dados do contato",
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
        },
        buttons: {
          edit: "Editar contato",
        },
        extraInfo: "Outras informações",
      },
      ticketOptionsMenu: {
        delete: "Deletar",
        transfer: "Transferir",
        confirmationModal: {
          title: "Deletar o chat do contato",
          titleFrom: "do contato ",
          message:
            "Atenção! Todas as mensagens relacionadas ao chat serão perdidas.",
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
        delete: "Deletar",
        edit: "Editar",
        reply: "Responder",
        forward: "Encaminhar",
        confirmationModal: {
          title: "Apagar mensagem?",
          message: "Esta ação não pode ser revertida.",
        },
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
        ERR_OTHER_OPEN_TICKET: "Já existe um tíquete aberto para este contato.",
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
        ERR_NO_TICKET_FOUND: "Nenhum tíquete encontrado com este ID.",
        ERR_NO_USER_FOUND: "Nenhum usuário encontrado com este ID.",
        ERR_NO_WAPP_FOUND: "Nenhum WhatsApp encontrado com este ID.",
        ERR_CREATING_MESSAGE: "Erro ao criar mensagem no banco de dados.",
        ERR_CREATING_TICKET: "Erro ao criar tíquete no banco de dados.",
        ERR_FETCH_WAPP_MSG:
          "Erro ao buscar a mensagem no WhtasApp, talvez ela seja muito antiga.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "Esta cor já está em uso, escolha outra.",
        ERR_WAPP_GREETING_REQUIRED:
          "A mensagem de saudação é obrigatório quando há mais de uma fila.",
      },
    },
  },
};

export { messages };
