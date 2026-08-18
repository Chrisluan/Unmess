const messages = {
  es: {
    translations: {
      signup: {
        title: "Registro",
        toasts: {
          success:
            "¡El usuario ha sido creado satisfactoriamente! ¡Ahora inicia sesión!",
          fail: "Error creando el usuario. Verifica la data reportada.",
        },
        form: {
          name: "Nombre",
          email: "Correo Electrónico",
          password: "Contraseña",
        },
        buttons: {
          submit: "Regístrate",
          login: "¿Ya tienes una cuenta? ¡Inicia sesión!",
        },
      },
      login: {
        title: "Inicio de Sesión",
        form: {
          email: "Correo Electrónico",
          password: "Contraseña",
        },
        buttons: {
          submit: "Ingresa",
          register: "¿No tienes cuenta? ¡Regístrate!",
        },
      },
      auth: {
        toasts: {
          success: "¡Inicio de sesión exitoso!",
        },
      },
      dashboard: {
        period: {
          today: "Hoy",
          week: "7 días",
          month: "Mes",
          all: "Todo",
          custom: "Período",
          from: "Desde",
          to: "Hasta",
          apply: "Aplicar",
        },
        charts: {
          perDay: {
            title: "Chats hoy: ",
          },
        },
        messages: {
          inAttendance: {
            title: "En servicio"
          },
          waiting: {
            title: "Esperando"
          },
          closed: {
            title: "Finalizado"
          }
        },
        metrics: {
          avgFirstResponse: "Tiempo medio de 1ª respuesta",
          avgResolution: "Tiempo medio de resolución",
          resolutionRate: "Tasa de resolución",
          stalePending: "Esperando +30min",
          newContacts: "Nuevos contactos",
          byHour: "Movimiento por hora del día",
          byDay: "Movimiento por día",
          byConnection: "Chats por conexión",
          avgHandling: "Tiempo medio de atención",
          totalPeriod: "Total en el período",
          closed: "Finalizados",
          byAgent: "Desempeño por agente",
          byQueue: "Chats por sector",
          byClosingStatus: "Motivos de cierre",
          noData: "Aún no hay chats finalizados con un estado definido.",
          table: {
            agent: "Agente",
            total: "Total",
            avgFirstResponse: "1ª respuesta",
            avgHandling: "Atención",
          },
        }
      },
      connections: {
        title: "Conexiones",
        toasts: {
          deleted:
            "¡La conexión de WhatsApp ha sido borrada satisfactoriamente!",
        },
        confirmationModal: {
          deleteTitle: "Borrar",
          deleteMessage: "¿Estás seguro? Este proceso no puede ser revertido.",
          disconnectTitle: "Desconectar",
          disconnectMessage: "Estás seguro? Deberá volver a leer el código QR",
        },
        buttons: {
          add: "Agrega WhatsApp",
          disconnect: "Desconectar",
          tryAgain: "Inténtalo de nuevo",
          qrcode: "QR CODE",
          newQr: "Nuevo QR CODE",
          connecting: "Conectando",
        },
        toolTips: {
          disconnected: {
            title: "No se pudo iniciar la sesión de WhatsApp",
            content:
              "Asegúrese de que su teléfono celular esté conectado a Internet y vuelva a intentarlo o solicite un nuevo código QR",
          },
          qrcode: {
            title: "Esperando la lectura del código QR",
            content:
              "Haga clic en el botón 'CÓDIGO QR' y lea el Código QR con su teléfono celular para iniciar la sesión",
          },
          connected: {
            title: "Conexión establecida",
          },
          timeout: {
            title: "Se perdió la conexión con el teléfono celular",
            content:
              "Asegúrese de que su teléfono celular esté conectado a Internet y que WhatsApp esté abierto, o haga clic en el botón 'Desconectar' para obtener un nuevo código QR",
          },
          duplicated: {
            title: "Este número ya está en otra conexión",
            content:
              "El código QR fue leído con un teléfono que ya está vinculado a otra conexión. Dos conexiones en el mismo número duplican todas las atenciones. Lea el nuevo código QR con el teléfono correcto.",
          },
        },
        table: {
          name: "Nombre",
          number: "Número",
          status: "Estado",
          lastUpdate: "Última Actualización",
          default: "Por Defecto",
          actions: "Acciones",
          session: "Sesión",
        },
      },
      whatsappModal: {
        title: {
          add: "Agrega WhatsApp",
          edit: "Edita WhatsApp",
        },
        form: {
          farewellMessage: "Mensaje de despedida",
          name: "Nombre",
          default: "Por Defecto",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "WhatsApp guardado satisfactoriamente.",
      },
      qrCode: {
        message: "Lée el código QR para empezar la sesión.",
      },
      contacts: {
        title: "Contactos",
        toasts: {
          deleted: "¡Contacto borrado satisfactoriamente!",
        },
        searchPlaceholder: "Buscar...",
        known: {
          badge: "Conocido",
          set: "Marcar como persona conocida (no entra en Oportunidades)",
          unset: "Dejar de tratar como persona conocida",
          toastSet: "Contacto marcado como conocido. Sus chats van a la pestaña Conocidos.",
          toastUnset: "Contacto desmarcado. Sus chats vuelven a Oportunidades.",
        },
        confirmationModal: {
          deleteTitle: "Borrar",
          importTitlte: "Importar contactos",
          deleteMessage:
            "¿Estás seguro que deseas borrar este contacto? Todos los chats relacionados se perderán.",
          importMessage:
            "¿Quieres importar todos los contactos desde tu teléfono?",
        },
        buttons: {
          import: "Importar Contactos",
          add: "Agregar Contacto",
        },
        table: {
          name: "Nombre",
          whatsapp: "WhatsApp",
          email: "Correo Electrónico",
          actions: "Acciones",
        },
      },
      contactModal: {
        title: {
          add: "Agregar contacto",
          edit: "Editar contacto",
        },
        form: {
          mainInfo: "Detalles del contacto",
          extraInfo: "Información adicional",
          name: "Nombre",
          number: "Número de Whatsapp",
          email: "Correo Electrónico",
          extraName: "Nombre del Campo",
          extraValue: "Valor",
        },
        buttons: {
          addExtraInfo: "Agregar información",
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Contacto guardado satisfactoriamente.",
      },
      customers: {
        title: "Clientes",
        toasts: {
          deleted: "¡Cliente borrado satisfactoriamente!",
        },
        searchPlaceholder: "Buscar por nombre, documento o teléfono...",
        confirmationModal: {
          deleteTitle: "Borrar cliente",
          deleteMessage: "¿Estás seguro que deseas borrar este cliente?",
        },
        buttons: {
          add: "Agregar Cliente",
        },
        table: {
          name: "Nombre",
          document: "Documento",
          phone: "Teléfono",
          segment: "Segmento",
          status: "Estado",
          actions: "Acciones",
        },
        status: {
          lead: "Lead",
          active: "Activo",
          inactive: "Inactivo",
        },
      },
      crm: {
        title: "CRM",
        searchPlaceholder: "Buscar por negocio o cliente...",
        emptyStages: "Ninguna columna configurada en este tablero.",
        emptyStage: "Ningún negocio en esta columna",
        filters: {
          responsible: "Responsable",
          all: "Todos",
          status: "Mostrar",
          onlyOpen: "Abiertos",
          withClosed: "Con cerrados",
        },
        buttons: {
          addDeal: "Nuevo Negocio",
          boards: "Tableros",
          stages: "Columnas",
          cancel: "Cancelar",
          save: "Guardar",
          create: "Crear",
          add: "Agregar",
          close: "Cerrar",
          edit: "Editar",
          delete: "Eliminar",
        },
        summary: {
          pipeline: "En el embudo",
          inProgress: "Ventas en curso",
          billed: "Facturado",
          conversion: "Conversión",
          deals: "{{count}} negocio(s)",
          lost: "{{count}} perdido(s)",
        },
        status: {
          open: "Abierto",
          moved: "Avanzó de tablero",
          won: "Facturado",
          lost: "Perdido",
        },
        stageType: {
          open: "Trabajo",
          lost: "Pérdida",
        },
        toasts: {
          dealCreated: "¡Negocio creado con éxito!",
          dealUpdated: "¡Negocio actualizado con éxito!",
          dealDeleted: "¡Negocio eliminado con éxito!",
          activityDeleted: "¡Registro eliminado con éxito!",
          stageCreated: "¡Columna creada con éxito!",
          stageDeleted: "¡Columna eliminada con éxito!",
          boardCreated: "¡Tablero creado con éxito!",
          boardDeleted: "¡Tablero eliminado con éxito!",
          advanced: "Tarjeta completada — siguió a {{board}}",
          billed: "¡Venta facturada!",
        },
        dealModal: {
          title: {
            add: "Nuevo negocio",
            edit: "Editar negocio",
          },
          form: {
            title: "Título del negocio",
            customer: "Cliente",
            value: "Valor",
            expectedCloseAt: "Previsión de cierre",
            stage: "Etapa",
            responsible: "Responsable",
            noResponsible: "Sin responsable",
            notes: "Observaciones",
          },
          validation: {
            titleRequired: "Ingrese un título",
            titleShort: "Título demasiado corto",
            titleLong: "Título demasiado largo",
            valueNegative: "El valor no puede ser negativo",
            valueInvalid: "Ingrese un valor numérico",
          },
        },
        details: {
          tickets: "Chats vinculados",
          timeline: "Historial",
          notePlaceholder: "Escriba una nota...",
          taskPlaceholder: "Describa la tarea...",
          asTask: "Como tarea",
          emptyTimeline: "Ningún registro todavía.",
        },
        activity: {
          dueAt: "vence el",
          created: "Negocio creado en {{body}}",
          stage_change: "Movido: {{body}}",
          board_out: "Completó el tablero: {{body}}",
          board_in: "Recibido del tablero anterior: {{body}}",
        },
        lostModal: {
          title: "Marcar como perdido",
          message: '¿Por qué se perdió "{{title}}"? El motivo es opcional.',
          reason: "Motivo de la pérdida",
          confirm: "Marcar como perdido",
        },
        confirmationModal: {
          deleteTitle: "Eliminar negocio",
          deleteMessage:
            "¿Está seguro de que desea eliminar este negocio? El historial también será eliminado.",
        },
        stagesModal: {
          title: "Columnas del tablero",
          help: "La columna de Entrada es donde llega la tarjeta desde otro tablero (una por tablero). Las columnas de Salida completan el tablero y envían la tarjeta adelante — puede haber varias, cada una con su destino. Sin destino definido, la tarjeta sigue el orden de los tableros.",
          initial: "Entrada",
          initialHelp: "Donde llega la tarjeta desde otro tablero",
          final: "Salida",
          finalHelp: "Completa el tablero y envía la tarjeta a su destino",
          sendTo: "Enviar a:",
          targetBoard: "Tablero",
          targetStage: "Columna",
          nextInLine: "Siguiente del orden",
          entryColumn: "Columna de entrada",
          newStage: "Nombre de la nueva columna",
          moveUp: "Mover a la izquierda",
          moveDown: "Mover a la derecha",
          deleteTitle: "Eliminar columna",
          deleteMessage:
            "¿Está seguro de que desea eliminar esta columna? Debe estar vacía.",
        },
        boardsModal: {
          title: "Tableros del flujo",
          help: "El orden define el camino de la tarjeta: una columna de salida sin destino propio envía al siguiente tablero de esta lista. El último tablero es el que factura la venta.",
          newBoard: "Nombre del nuevo tablero",
          columns: "{{count}} columna(s)",
          moveUp: "Subir en el orden",
          moveDown: "Bajar en el orden",
          lastBoardNote:
            'Completar "{{board}}" cierra la venta como facturada.',
          deleteTitle: "Eliminar tablero",
          deleteMessage:
            "¿Está seguro de que desea eliminar este tablero? No debe tener negocios activos.",
        },
      },
      customerModal: {
        title: {
          add: "Agregar cliente",
          edit: "Editar cliente",
        },
        form: {
          mainInfo: "Datos principales",
          addressInfo: "Dirección",
          crmInfo: "Información comercial",
          personType: "Tipo de persona",
          personTypePF: "Persona Física",
          personTypePJ: "Persona Jurídica",
          name: "Razón social / Nombre",
          tradeName: "Nombre fantasía",
          document: "CPF / CNPJ",
          stateRegistration: "Inscripción estadual",
          email: "Correo Electrónico",
          phone: "Teléfono",
          whatsapp: "WhatsApp",
          zipCode: "Código Postal",
          zipCodeHelper: "Completa la dirección automáticamente",
          street: "Dirección",
          addressNumber: "Número",
          complement: "Complemento",
          neighborhood: "Barrio",
          city: "Ciudad",
          state: "Estado",
          segment: "Rubro",
          origin: "Origen",
          status: "Estado",
          notes: "Observaciones",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Cliente guardado satisfactoriamente.",
      },
      quickAnswersModal: {
        title: {
          add: "Agregar respuesta rápida",
          edit: "Editar respuesta rápida",
        },
        form: {
          shortcut: "Atajo",
          message: "Respuesta rápida",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Respuesta rápida guardada correctamente.",
      },
      queueModal: {
        title: {
          add: "Agregar cola",
          edit: "Editar cola",
        },
        form: {
          name: "Nombre",
          color: "Color",
          greetingMessage: "Mensaje de saludo",
          isDefault: "Sector predeterminado",
          isDefaultHelp: "Las conversaciones sin sector definido caen automáticamente en este. Solo puede haber un sector predeterminado a la vez.",
        },
        buttons: {
          okAdd: "Añadir",
          okEdit: "Ahorrar",
          cancel: "Cancelar",
        },
      },
      userModal: {
        title: {
          add: "Agregar usuario",
          edit: "Editar usuario",
        },
        form: {
          name: "Nombre",
          email: "Correo Electrónico",
          password: "Contraseña",
          profile: "Perfil",
          whatsapp: "Conexión estándar",
          permissionGroup: "Grupo de permisos",
          maxSimultaneousTickets: "Límite de chats simultáneos",
          maxSimultaneousTicketsHelper:
            "0 = sin límite. Usado por la distribución automática de chats.",
        },
        profiles: {
          vendedor: "Vendedor",
          producao: "Producción",
          instalacao: "Instalación",
          financeiro: "Finanzas",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "Usuario guardado satisfactoriamente.",
      },
      permissionGroups: {
        title: "Equipo - Grupos de Permisos",
        table: {
          name: "Nombre",
          actions: "Acciones",
        },
        buttons: {
          add: "Agregar grupo",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage:
            "¿Estás seguro? ¡Esta acción no se puede revertir! Solo se pueden eliminar grupos sin usuarios vinculados.",
        },
        toasts: {
          deleted: "¡Grupo eliminado con éxito!",
        },
      },
      permissionGroupModal: {
        title: {
          add: "Agregar Grupo de Permisos",
          edit: "Editar Grupo de Permisos",
        },
        form: {
          name: "Nombre del grupo",
          permissions: "Permisos",
        },
        permissions: {
          "chats:viewAll": "Ver todos los chats",
          "chats:delete": "Eliminar chats",
          "chats:transfer": "Transferir chats",
          "customers:manage": "Gestionar clientes",
          "users:manage": "Gestionar usuarios",
          "queues:manage": "Gestionar sectores",
          "settings:manage": "Gestionar configuraciones",
          "reports:view": "Ver informes",
          "financial:manage": "Gestionar finanzas",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "¡Grupo guardado con éxito!",
      },
      chat: {
        noTicketMessage: "Selecciona un chat para empezar a chatear.",
      },
      ticketsManager: {
        buttons: {
          newTicket: "Nuevo",
          filters: "Filtros",
          clearFilters: "Limpiar filtros",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Linhas",
      },
      ticketsWhatsappSelect: {
        placeholder: "Conexiones",
        allConnections: "Todos los números",
        multiple: "{{count}} números",
        tooltip: "Filtrar chats por número de WhatsApp",
        disconnected: "Desconectado",
      },
      tickets: {
        toasts: {
          deleted: "El chat en el que estabas ha sido borrado.",
        },
        notification: {
          message: "Mensaje de",
        },
        tabs: {
          open: { title: "Bandeja" },
          closed: { title: "Resueltos" },
          groups: { title: "Grupos" },
          search: { title: "Buscar" },
        },
        search: {
          placeholder: "Buscar por nombre, mensaje o protocolo",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Chat",
        fieldLabel: "Escriba para buscar usuarios",
        fieldQueueLabel: "Transferir a la cola",
        fieldConnectionLabel: "Transferir to conexión",
        fieldQueuePlaceholder: "Seleccione una cola",
        fieldConnectionPlaceholder: "Seleccione una conexión",
        noOptions: "No se encontraron usuarios con ese nombre",
        removeQueueHelp: "Si elimina la cola y no queda ninguna, el ticket cae automáticamente en el sector predeterminado.",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
          removeUser: "Quitar agente",
          removeQueue: "Quitar cola",
        },
      },
      ticketsList: {
        pendingHeader: "Cola",
        assignedHeader: "Trabajando en",
        myTicketsHeader: "Míos",
        attendingHeader: "En atención",
        waitingHeader: "Oportunidades",
        knownHeader: "Conocidos",
        noTicketsTitle: "¡Nada acá!",
        connectionTitle: "Conexión que se está utilizando actualmente.",
        waitingFor: "Tiempo que el cliente está esperando",
        protocol: "Protocolo de la atención",
        pendingBar: {
          readOnly: "Solo está visualizando. Acepte la atención para responder.",
          accept: "Aceptar atención",
        },
        noTicketsMessage:
          "No se encontraron chats con este estado o término de búsqueda",
        buttons: {
          accept: "Acceptar",
        },
      },
      ticketsTagSelect: {
        all: "Etiquetas",
        multiple: "{{count}} etiquetas",
        tooltip: "Filtrar chats por etiqueta",
      },
      ticketsUserSelect: {
        all: "Agentes",
        multiple: "{{count}} agentes",
        tooltip: "Filtrar chats por agente responsable",
      },
      ticketTags: {
        placeholder: "Agregar etiqueta...",
      },
      tags: {
        description:
          "Las etiquetas ayudan a clasificar y filtrar conversaciones en el panel de atención.",
        saved: "Etiqueta guardada con éxito.",
        deleted: "Etiqueta eliminada con éxito.",
        confirmDelete: "Eliminar etiqueta",
        confirmDeleteMessage:
          "La etiqueta será removida de todas las conversaciones donde esté aplicada.",
        empty: "Ninguna etiqueta registrada aún.",
        form: {
          name: "Nombre de la etiqueta",
          color: "Color",
          add: "Agregar",
          save: "Guardar",
          cancel: "Cancelar",
        },
        table: {
          tag: "Etiqueta",
          actions: "Acciones",
        },
      },
      ticketInfo: {
        protocolTooltip: "Protocolo de la atención (clic para copiar)",
        protocolCopied: "Protocolo copiado.",
      },
      forwardMessageModal: {
        title: "Reenviar mensaje",
        helper: "Elige el contacto que recibirá este mensaje.",
        fieldLabel: "Escribe para buscar un contacto",
        noOptions: "Ningún contacto encontrado",
        success: "Mensaje reenviado.",
        buttons: { confirm: "Reenviar", cancel: "Cancelar" },
      },
      closeTicketModal: {
        title: "Cerrar chat",
        status: "Motivo del cierre",
        none: "Sin motivo",
        requiredHelper: "Selecciona el motivo del cierre para finalizar este chat.",
        optionalHelper: "Puedes registrar el motivo del cierre. Es opcional.",
        noStatuses:
          "Ningún estado de cierre registrado. Configúralo en Configuración › Estados de Cierre.",
        buttons: {
          confirm: "Cerrar",
          cancel: "Cancelar",
        },
      },
      newTicketModal: {
        title: "Crear Chat",
        fieldLabel: "Escribe para buscar un contacto",
        add: "Añadir",
        connection: "Enviar desde el número",
        connectionHelper: "El contacto recibirá el mensaje desde este número.",
        noConnection: "Sin conexión activa. Conecta un número en Configuración › Conexiones.",
        buttons: {
          ok: "Guardar",
          cancel: "Cancelar",
        },
      },
      mainDrawer: {
        listItems: {
          dashboard: "Dashboard",
          connections: "Conexiones",
          tickets: "Chats",
          contacts: "Contactos",
          customers: "Clientes",
          crm: "CRM",
          quickAnswers: "Respuestas rápidas",
          queues: "Linhas",
          administration: "Administración",
          superAdmin: "Gestión de Empresas",
          companies: "Empresas",
          users: "Usuarios",
          permissionGroups: "Equipo",
          settings: "Configuración",
        },
        appBar: {
          user: {
            profile: "Perfil",
            logout: "Cerrar Sesión",
          },
        },
      },
      notifications: {
        noTickets: "Sin notificaciones.",
      },
      queues: {
        title: "Linhas",
        table: {
          name: "Nombre",
          color: "Color",
          greeting: "Mensaje de saludo",
          isDefault: "Predeterminado",
          actions: "Comportamiento",
        },
        buttons: {
          add: "Agregar cola",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage:
            "¿Estás seguro? ¡Esta acción no se puede revertir! Los chats en esa cola seguirán existiendo, pero ya no tendrán ninguna cola asignada.",
        },
      },
      companies: {
        title: "Empresas",
        table: {
          name: "Nombre",
          document: "Documento",
          email: "Correo",
          plan: "Plan",
          status: "Estado",
          actions: "Acciones",
        },
        buttons: {
          add: "Agregar empresa",
        },
        status: {
          active: "Activa",
          suspended: "Suspendida",
          canceled: "Cancelada",
        },
        confirmationModal: {
          deleteTitle: "Eliminar",
          deleteMessage:
            "¿Estás seguro? ¡Esta acción no se puede revertir! Solo se pueden eliminar empresas sin usuarios vinculados.",
        },
        toasts: {
          deleted: "¡Empresa eliminada con éxito!",
        },
      },
      companyModal: {
        title: {
          add: "Agregar Empresa",
          edit: "Editar Empresa",
        },
        form: {
          companyData: "Datos de la Empresa",
          name: "Nombre",
          document: "Documento",
          email: "Correo",
          phone: "Teléfono",
          plan: "Plan",
          planBasic: "Básico",
          planPro: "Profesional",
          planEnterprise: "Enterprise",
          status: "Estado",
          statusActive: "Activa",
          statusSuspended: "Suspendida",
          statusCanceled: "Cancelada",
          adminData: "Usuario Administrador",
          adminName: "Nombre del administrador",
          adminEmail: "Correo del administrador",
          adminPassword: "Contraseña del administrador",
        },
        buttons: {
          okAdd: "Agregar",
          okEdit: "Guardar",
          cancel: "Cancelar",
        },
        success: "¡Empresa guardada con éxito!",
      },
      queueSelect: {
        inputLabel: "Linhas",
      },
      quickAnswers: {
        title: "Respuestas rápidas",
        table: {
          shortcut: "Atajo",
          message: "Respuesta rápida",
          actions: "Acciones",
        },
        buttons: {
          add: "Agregar respuesta rápida",
        },
        toasts: {
          deleted: "Respuesta rápida eliminada correctamente",
        },
        searchPlaceholder: "Buscar ...",
        confirmationModal: {
          deleteTitle:
            "¿Está seguro de que desea eliminar esta respuesta rápida?",
          deleteMessage: "Esta acción no se puede deshacer.",
        },
      },
      users: {
        title: "Usuarios",
        table: {
          name: "Nombre",
          email: "Correo Electrónico",
          profile: "Perfil",
          whatsapp: "Conexión estándar",
          status: "Estado",
          online: "En línea",
          offline: "Desconectado",
          maxSimultaneousTickets: "Límite",
          actions: "Acciones",
        },
        buttons: {
          add: "Agregar usuario",
        },
        toasts: {
          deleted: "Usuario borrado satisfactoriamente.",
        },
        confirmationModal: {
          deleteTitle: "Borrar",
          deleteMessage:
            "Toda la información del usuario se perderá. Los chats abiertos de los usuarios se moverán a la cola.",
        },
      },
      settings: {
        success: "Configuración guardada satisfactoriamente.",
        title: "Configuración",
        tabs: {
          general: "General",
          connections: "Conexiones",
          businessHours: "Horario de Atención",
          ticketStatuses: "Estados de Finalización",
          tags: "Etiquetas",
          autoMessages: "Mensajes Automáticos",
          branding: "Identidad Visual",
        },
        general: {
          sections: {
            attendance: "Reglas de atención",
            experience: "Experiencia del agente",
          },
          autoAssignTickets: {
            label: "Distribución automática de chats",
            helper:
              "Los chats nuevos se entregan al agente en línea de la cola con menos conversaciones abiertas. Respeta el límite individual de cada agente.",
          },
          requireClosingStatus: {
            label: "Exigir estado al cerrar",
            helper:
              "El agente debe elegir un motivo de cierre antes de finalizar el chat.",
          },
          allowAgentSeeAllTickets: {
            label: "El agente puede ver chats de otras colas",
            helper:
              "Cuando está apagado, cada agente solo ve los chats de las colas a las que pertenece.",
          },
          autoCloseInactiveHours: {
            label: "Cerrar chats inactivos después de (horas)",
            helper: "0 desactiva el cierre automático. Verificado cada 5 minutos por el servidor.",
          },
          reopenTicketWindowHours: {
            label: "Ventana de reapertura (horas)",
            helper:
              "Un mensaje nuevo dentro de ese período reabre el último chat del contacto en lugar de crear otro.",
          },
          signMessages: {
            label: "Firmar mensajes con el nombre del agente",
            helper: "Define el valor por defecto para nuevos agentes. Cada uno puede alternarlo en la pantalla de chat.",
          },
          notificationSound: {
            label: "Sonido de notificación",
            helper: "Reproduce una alerta sonora cuando llega un mensaje en un chat que no está abierto.",
          },
        },
        buttons: {
          save: "Guardar",
        },
        settings: {
          userCreation: {
            name: "Creación de usuarios",
            options: {
              enabled: "Habilitado",
              disabled: "Deshabilitado",
            },
          },
          apiToken: {
            name: "Token de API",
            generate: "Generar nuevo token",
            helper: "Use este token para autenticar integraciones externas con la API de mensajes de esta empresa.",
          },
        },
        holidays: {
          title: "Feriados y excepciones",
          description:
            "En las fechas de abajo la empresa se considera cerrada, aunque el día de la semana esté marcado como hábil.",
          saved: "Feriado registrado.",
          deleted: "Feriado eliminado.",
          confirmDelete: "Eliminar feriado",
          confirmDeleteMessage: "La fecha vuelve a seguir el horario normal de atención.",
          empty: "Ningún feriado registrado.",
          everyYear: "todos los años",
          form: {
            name: "Descripción",
            date: "Fecha",
            recurring: "Se repite todos los años",
            add: "Agregar",
          },
          table: { name: "Descripción", date: "Fecha", actions: "Acciones" },
        },
        businessHours: {
          description: "Defina los días y horarios en que su empresa atiende. Fuera de ese período, el mensaje automático configurado en la pestaña 'Mensajes Automáticos' puede enviarse al cliente.",
          table: {
            day: "Día",
            enabled: "Activo",
            start: "Inicio",
            end: "Fin",
          },
          weekDays: {
            0: "Domingo",
            1: "Lunes",
            2: "Martes",
            3: "Miércoles",
            4: "Jueves",
            5: "Viernes",
            6: "Sábado",
          },
        },
        ticketStatuses: {
          buttons: {
            add: "Agregar estado",
            cancel: "Cancelar",
            okAdd: "Agregar",
            okEdit: "Guardar",
          },
          table: {
            name: "Nombre",
            type: "Tipo",
            default: "Predeterminado",
            actions: "Acciones",
          },
          types: {
            pending: "Esperando",
            open: "En atención",
            closed: "Finalizado",
          },
          yes: "Sí",
          no: "No",
          confirmationModal: {
            deleteTitle: "Eliminar",
            deleteMessage: "¿Estás seguro? ¡Esta acción no se puede revertir!",
          },
          toasts: {
            deleted: "¡Estado eliminado con éxito!",
          },
          success: "¡Estado guardado con éxito!",
          modal: {
            title: {
              add: "Agregar Estado",
              edit: "Editar Estado",
            },
            name: "Nombre del estado",
            color: "Color",
            type: "Vinculado a",
            isDefault: "Usar como predeterminado para este tipo",
          },
        },
        branding: {
          title: "Identidad de la empresa",
          description:
            "Nombre y logo mostrados en la barra lateral y en la parte superior, para todos los agentes.",
          nameLabel: "Nombre de la empresa",
          nameHelp: "Deje en blanco para usar el nombre del sistema (Unmess).",
          choose: "Elegir logo",
          remove: "Quitar logo",
          save: "Guardar",
          saved: "¡Identidad actualizada!",
          fileHelp: "PNG, JPG, WEBP o SVG, hasta 2 MB. Ideal cuadrada.",
          invalidType: "Formato no soportado. Use PNG, JPG, WEBP o SVG.",
          tooLarge: "Imagen demasiado grande. El límite es 2 MB.",
        },
        autoMessages: {
          outOfHours: {
            toggle: "Enviar mensaje automático fuera del horario de atención",
            description: "Se envía automáticamente cuando el cliente inicia contacto fuera del horario configurado.",
            placeholder: "Ej: Hola {{cliente.nome}}, en este momento estamos fuera del horario de atención. ¡Responderemos en breve!",
          },
          transfer: {
            toggle: "Enviar mensaje automático al transferir la atención",
            description: "Se envía automáticamente cuando un chat se transfiere a otro agente o sector.",
            placeholder: "Ej: Hola {{cliente.nome}}, tu atención fue transferida al sector {{setor}} y continuará con {{atendente}}.",
          },
        },
      },
      messagesList: {
        internalNote: "Nota interna",
        fromApp: "desde el celular",
        edited: "editada",
        fromAppTooltip:
          "Enviada desde la aplicación de WhatsApp en el celular, fuera del sistema",
        searchPlaceholder: "Buscar en esta conversación",
        searchResults: "{{count}} resultado(s)",
        header: {
          assignedTo: "Asignado a:",
          buttons: {
            return: "Devolver",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceptar",
          },
        },
      },
      messagesInput: {
        placeholderOpen: "Escriba un mensaje o presione '' / '' para usar las respuestas rápidas registradas",
        placeholderClosed:
          "Vuelva a abrir o acepte este chat para enviar un mensaje.",
        signMessage: "Firmar",
        internalNoteTooltip: "Nota interna (solo el equipo la ve)",
        placeholderInternalNote:
          "Nota interna — no se enviará al cliente",
      },
      contactDrawer: {
        header: "Detalles del contacto",
        customer: {
          title: "Cliente",
          status: "Situación",
          statuses: { lead: "Lead", active: "Activo", inactive: "Inactivo" },
          name: "Razón social / Nombre",
          document: "Documento",
          segment: "Segmento",
          responsible: "Responsable",
          city: "Ciudad",
          notes: "Observaciones",
          notLinked: "Este contacto aún no tiene registro de cliente.",
          create: "Registrar cliente",
          edit: "Editar cliente",
        },
        history: {
          title: "Atenciones anteriores",
          empty: "Ninguna atención anterior.",
          noAgent: "Sin agente",
        },
        buttons: {
          edit: "Editar contacto",
        },
        extraInfo: "Otra información",
      },
      ticketOptionsMenu: {
        delete: "Borrar",
        transfer: "Transferir",
        confirmationModal: {
          title: "¿Borrar chat #",
          titleFrom: "del contacto ",
          message:
            "¡Atención! Todos los mensajes Todos los mensajes relacionados con el chat se perderán.",
        },
        buttons: {
          delete: "Borrar",
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
            "El navegador solo permite el micrófono en conexión segura (HTTPS). Al acceder por la IP de la red en HTTP, la grabación no está disponible.",
          unavailable: "No se pudo iniciar el grabador de audio.",
          tooShort: "Grabación demasiado corta, no se envió nada.",
        },
      },
      editMessageModal: {
        title: "Editar mensaje",
        field: "Mensaje",
        timeLimit:
          "WhatsApp solo permite editar mensajes enviados hace pocos minutos.",
        buttons: {
          cancel: "Cancelar",
          save: "Guardar",
        },
      },
      messageOptionsMenu: {
        delete: "Borrar",
        edit: "Editar",
        reply: "Responder",
        forward: "Reenviar",
        confirmationModal: {
          title: "¿Borrar mensaje?",
          message: "Esta acción no puede ser revertida.",
        },
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP:
          "Debe haber al menos una conexión de WhatsApp predeterminada.",
        ERR_NO_DEF_WAPP_FOUND:
          "No se encontró WhatsApp predeterminado. Verifique la página de conexiones.",
        ERR_WAPP_NOT_INITIALIZED:
          "Esta sesión de WhatsApp no ​​está inicializada. Verifique la página de conexiones.",
        ERR_WAPP_CHECK_CONTACT:
          "No se pudo verificar el contacto de WhatsApp. Verifique la página de conexiones.",
        ERR_WAPP_INVALID_CONTACT: "Este no es un número de whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA:
          "No se pudieron descargar los medios de WhatsApp. Verifique la página de conexiones.",
        ERR_INVALID_CREDENTIALS: "Error de autenticación. Vuelva a intentarlo.",
        ERR_SENDING_WAPP_MSG:
          "Error al enviar el mensaje de WhatsApp. Verifique la página de conexiones.",
        ERR_DELETE_WAPP_MSG: "No se pudo borrar el mensaje de WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Ya hay un chat abierto para este contacto.",
        ERR_SESSION_EXPIRED: "Sesión caducada. Inicie sesión.",
        ERR_USER_CREATION_DISABLED:
          "La creación de usuarios fue deshabilitada por el administrador.",
        ERR_NO_PERMISSION: "No tienes permiso para acceder a este recurso.",
        ERR_DUPLICATED_CONTACT: "Ya existe un contacto con este número.",
        ERR_NO_COMPANY_FOUND: "No se encontró ninguna empresa con este ID.",
        ERR_DUPLICATED_COMPANY_DOCUMENT:
          "Ya existe una empresa registrada con este documento.",
        ERR_COMPANY_HAS_USERS:
          "No se puede eliminar una empresa que todavía tiene usuarios vinculados.",
        ERR_NO_SETTING_FOUND:
          "No se encontró ninguna configuración con este ID.",
        ERR_NO_CONTACT_FOUND: "No se encontró ningún contacto con este ID.",
        ERR_NO_TICKET_FOUND: "No se encontró ningún chat con este ID.",
        ERR_NO_USER_FOUND: "No se encontró ningún usuario con este ID.",
        ERR_NO_WAPP_FOUND: "No se encontró WhatsApp con este ID.",
        ERR_CREATING_MESSAGE: "Error al crear el mensaje en la base de datos.",
        ERR_CREATING_TICKET: "Error al crear el chat en la base de datos.",
        ERR_FETCH_WAPP_MSG:
          "Error al obtener el mensaje en WhtasApp, tal vez sea demasiado antiguo.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "Este color ya está en uso, elija otro.",
        ERR_WAPP_GREETING_REQUIRED:
          "El mensaje de saludo es obligatorio cuando hay más de una cola.",
      },
    },
  },
};

export { messages };
