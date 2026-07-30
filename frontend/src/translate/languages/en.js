const messages = {
  en: {
    translations: {
      signup: {
        title: "Sign up",
        toasts: {
          success: "User created successfully! Please login!",
          fail: "Error creating user. Check the reported data.",
        },
        form: {
          name: "Name",
          email: "Email",
          password: "Password",
        },
        buttons: {
          submit: "Register",
          login: "Already have an account? Log in!",
        },
      },
      login: {
        title: "Login",
        form: {
          email: "Email",
          password: "Password",
        },
        buttons: {
          submit: "Enter",
          register: "Don't have an account? Register!",
        },
      },
      auth: {
        toasts: {
          success: "Login successfully!",
        },
      },
      dashboard: {
        charts: {
          perDay: {
            title: "Chats today: ",
          },
        },
        messages: {
          inAttendance: {
            title: "In Service"
          },
          waiting: {
            title: "Waiting"
          },
          closed: {
            title: "Closed"
          }
        },
        metrics: {
          avgFirstResponse: "Avg. first response time",
          avgHandling: "Avg. handling time",
          totalPeriod: "Total in period",
          closed: "Closed",
          byAgent: "Performance by agent",
          byQueue: "Chats by queue",
          byClosingStatus: "Closing reasons",
          noData: "No closed chats with a defined status yet.",
          table: {
            agent: "Agent",
            total: "Total",
            avgFirstResponse: "First response",
            avgHandling: "Handling",
          },
        }
      },
      connections: {
        title: "Connections",
        toasts: {
          deleted: "WhatsApp connection deleted sucessfully!",
        },
        confirmationModal: {
          deleteTitle: "Delete",
          deleteMessage: "Are you sure? It cannot be reverted.",
          disconnectTitle: "Disconnect",
          disconnectMessage: "Are you sure? You'll need to read QR Code again.",
        },
        buttons: {
          add: "Add WhatsApp",
          disconnect: "Disconnect",
          tryAgain: "Try Again",
          qrcode: "QR CODE",
          newQr: "New QR CODE",
          connecting: "Connectiing",
        },
        toolTips: {
          disconnected: {
            title: "Failed to start WhatsApp session",
            content:
              "Make sure your cell phone is connected to the internet and try again, or request a new QR Code",
          },
          qrcode: {
            title: "Waiting for QR Code read",
            content:
              "Click on 'QR CODE' button and read the QR Code with your cell phone to start session",
          },
          connected: {
            title: "Connection established",
          },
          timeout: {
            title: "Connection with cell phone has been lost",
            content:
              "Make sure your cell phone is connected to the internet and WhatsApp is open, or click on 'Disconnect' button to get a new QRcode",
          },
        },
        table: {
          name: "Name",
          status: "Status",
          lastUpdate: "Last Update",
          default: "Default",
          actions: "Actions",
          session: "Session",
        },
      },
      whatsappModal: {
        title: {
          add: "Add WhatsApp",
          edit: "Edit WhatsApp",
        },
        form: {
          farewellMessage: "Farewell message",
          name: "Name",
          default: "Default",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "WhatsApp saved successfully.",
      },
      qrCode: {
        message: "Read QrCode to start the session",
      },
      contacts: {
        title: "Contacts",
        toasts: {
          deleted: "Contact deleted sucessfully!",
        },
        searchPlaceholder: "Search ...",
        confirmationModal: {
          deleteTitle: "Delete",
          importTitlte: "Import contacts",
          deleteMessage:
            "Are you sure you want to delete this contact? All related chats will be lost.",
          importMessage: "Do you want to import all contacts from the phone?",
        },
        buttons: {
          import: "Import Contacts",
          add: "Add Contact",
        },
        table: {
          name: "Name",
          whatsapp: "WhatsApp",
          email: "Email",
          actions: "Actions",
        },
      },
      contactModal: {
        title: {
          add: "Add contact",
          edit: "Edit contact",
        },
        form: {
          mainInfo: "Contact details",
          extraInfo: "Additional information",
          name: "Name",
          number: "Whatsapp number",
          email: "Email",
          extraName: "Field name",
          extraValue: "Value",
        },
        buttons: {
          addExtraInfo: "Add information",
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "Contact saved successfully.",
      },
      customers: {
        title: "Customers",
        toasts: {
          deleted: "Customer deleted successfully!",
        },
        searchPlaceholder: "Search by name, document or phone...",
        confirmationModal: {
          deleteTitle: "Delete customer",
          deleteMessage: "Are you sure you want to delete this customer?",
        },
        buttons: {
          add: "Add Customer",
        },
        table: {
          name: "Name",
          document: "Document",
          phone: "Phone",
          segment: "Segment",
          status: "Status",
          actions: "Actions",
        },
        status: {
          lead: "Lead",
          active: "Active",
          inactive: "Inactive",
        },
      },
      customerModal: {
        title: {
          add: "Add customer",
          edit: "Edit customer",
        },
        form: {
          mainInfo: "Main details",
          addressInfo: "Address",
          crmInfo: "Business information",
          personType: "Person type",
          personTypePF: "Individual",
          personTypePJ: "Company",
          name: "Legal name",
          tradeName: "Trade name",
          document: "Document (CPF/CNPJ)",
          stateRegistration: "State registration",
          email: "Email",
          phone: "Phone",
          whatsapp: "WhatsApp",
          zipCode: "Zip code",
          zipCodeHelper: "Fills the address automatically",
          street: "Street",
          addressNumber: "Number",
          complement: "Complement",
          neighborhood: "Neighborhood",
          city: "City",
          state: "State",
          segment: "Business segment",
          origin: "Origin",
          status: "Status",
          notes: "Notes",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "Customer saved successfully.",
      },
      quickAnswersModal: {
        title: {
          add: "Add Quick Reply",
          edit: "Edit Quick Answer",
        },
        form: {
          shortcut: "Shortcut",
          message: "Quick Reply",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "Quick Reply saved successfully.",
      },
      queueModal: {
        title: {
          add: "Add queue",
          edit: "Edit queue",
        },
        form: {
          name: "Name",
          color: "Color",
          greetingMessage: "Greeting Message",
          isDefault: "Default queue",
          isDefaultHelp: "Conversations without a queue automatically fall into this one. Only one default queue is allowed at a time.",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
      },
      userModal: {
        title: {
          add: "Add user",
          edit: "Edit user",
        },
        form: {
          name: "Name",
          email: "Email",
          password: "Password",
          profile: "Profile",
          whatsapp: "Default Connection",
          permissionGroup: "Permission group",
          maxSimultaneousTickets: "Simultaneous chat limit",
          maxSimultaneousTicketsHelper:
            "0 = unlimited. Used by automatic chat distribution.",
        },
        profiles: {
          vendedor: "Salesperson",
          producao: "Production",
          instalacao: "Installation",
          financeiro: "Finance",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "User saved successfully.",
      },
      permissionGroups: {
        title: "Team - Permission Groups",
        table: {
          name: "Name",
          actions: "Actions",
        },
        buttons: {
          add: "Add group",
        },
        confirmationModal: {
          deleteTitle: "Delete",
          deleteMessage:
            "Are you sure? It cannot be reverted! You can only delete groups with no users linked to them.",
        },
        toasts: {
          deleted: "Group deleted successfully!",
        },
      },
      permissionGroupModal: {
        title: {
          add: "Add Permission Group",
          edit: "Edit Permission Group",
        },
        form: {
          name: "Group name",
          permissions: "Permissions",
        },
        permissions: {
          "chats:viewAll": "View all chats",
          "chats:delete": "Delete chats",
          "chats:transfer": "Transfer chats",
          "customers:manage": "Manage customers",
          "users:manage": "Manage users",
          "queues:manage": "Manage queues",
          "settings:manage": "Manage settings",
          "reports:view": "View reports",
          "financial:manage": "Manage financials",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "Group saved successfully!",
      },
      chat: {
        noTicketMessage: "Select a chat to start chatting.",
      },
      ticketsManager: {
        buttons: {
          newTicket: "New",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Queues",
      },
      ticketsWhatsappSelect: {
        placeholder: "Connections",
        allConnections: "All numbers",
        multiple: "{{count}} numbers",
        tooltip: "Filter chats by WhatsApp number",
        disconnected: "Disconnected",
      },
      tickets: {
        toasts: {
          deleted: "The chat you were on has been deleted.",
        },
        notification: {
          message: "Message from",
        },
        tabs: {
          open: { title: "Inbox" },
          closed: { title: "Resolved" },
          search: { title: "Search" },
        },
        search: {
          placeholder: "Search chats and messages.",
        },
        buttons: {
          showAll: "All",
        },
      },
      transferTicketModal: {
        title: "Transfer Chat",
        fieldLabel: "Type to search for users",
        fieldQueueLabel: "Transfer to queue",
        fieldConnectionLabel: "Transfer to connection",
        fieldQueuePlaceholder: "Please select a queue",
        fieldConnectionPlaceholder: "Please select a connection",
        noOptions: "No user found with this name",
        removeQueueHelp: "If you remove the queue and none is left, the ticket automatically falls into the default queue.",
        buttons: {
          ok: "Transfer",
          cancel: "Cancel",
          removeUser: "Remove agent",
          removeQueue: "Remove queue",
        },
      },
      ticketsList: {
        pendingHeader: "Queue",
        assignedHeader: "Working on",
        myTicketsHeader: "Mine",
        attendingHeader: "Attending",
        waitingHeader: "Waiting",
        noTicketsTitle: "Nothing here!",
        noTicketsMessage: "No chats found with this status or search term.",
        connectionTitle: "Connection that is currently being used.",
        buttons: {
          accept: "Accept",
        },
      },
      ticketsTagSelect: {
        all: "Tags",
        multiple: "{{count}} tags",
        tooltip: "Filter chats by tag",
      },
      ticketTags: {
        placeholder: "Add tag...",
      },
      tags: {
        description:
          "Tags help classify and filter conversations in the attendance panel.",
        saved: "Tag saved successfully.",
        deleted: "Tag deleted successfully.",
        confirmDelete: "Delete tag",
        confirmDeleteMessage:
          "The tag will be removed from every conversation it is applied to.",
        empty: "No tags registered yet.",
        form: {
          name: "Tag name",
          color: "Color",
          add: "Add",
          save: "Save",
          cancel: "Cancel",
        },
        table: {
          tag: "Tag",
          actions: "Actions",
        },
      },
      closeTicketModal: {
        title: "Close chat",
        status: "Closing reason",
        none: "No reason",
        requiredHelper: "Select a closing reason to finish this chat.",
        optionalHelper: "You may record a closing reason. It is optional.",
        noStatuses:
          "No closing status registered. Configure it in Settings › Closing Statuses.",
        buttons: {
          confirm: "Close",
          cancel: "Cancel",
        },
      },
      newTicketModal: {
        title: "Create Chat",
        fieldLabel: "Type to search for a contact",
        add: "Add",
        connection: "Send from number",
        connectionHelper: "The contact will receive the message from this number.",
        noConnection: "No active connection. Connect a number in Settings › Connections.",
        buttons: {
          ok: "Save",
          cancel: "Cancel",
        },
      },
      mainDrawer: {
        listItems: {
          dashboard: "Dashboard",
          connections: "Connections",
          tickets: "Chats",
          contacts: "Contacts",
          customers: "Customers",
          quickAnswers: "Quick Answers",
          queues: "Queues",
          administration: "Administration",
          superAdmin: "Company Management",
          companies: "Companies",
          users: "Users",
          permissionGroups: "Team",
          settings: "Settings",
        },
        appBar: {
          user: {
            profile: "Profile",
            logout: "Logout",
          },
        },
      },
      notifications: {
        noTickets: "No notifications.",
      },
      queues: {
        title: "Queues",
        table: {
          name: "Name",
          color: "Color",
          greeting: "Greeting message",
          isDefault: "Default",
          actions: "Actions",
        },
        buttons: {
          add: "Add queue",
        },
        confirmationModal: {
          deleteTitle: "Delete",
          deleteMessage:
            "Are you sure? It cannot be reverted! Chats in this queue will still exist, but will not have any queues assigned.",
        },
      },
      companies: {
        title: "Companies",
        table: {
          name: "Name",
          document: "Document",
          email: "Email",
          plan: "Plan",
          status: "Status",
          actions: "Actions",
        },
        buttons: {
          add: "Add company",
        },
        status: {
          active: "Active",
          suspended: "Suspended",
          canceled: "Canceled",
        },
        confirmationModal: {
          deleteTitle: "Delete",
          deleteMessage:
            "Are you sure? It cannot be reverted! You can only delete companies with no users linked to them.",
        },
        toasts: {
          deleted: "Company deleted successfully!",
        },
      },
      companyModal: {
        title: {
          add: "Add Company",
          edit: "Edit Company",
        },
        form: {
          companyData: "Company Data",
          name: "Name",
          document: "Document",
          email: "Email",
          phone: "Phone",
          plan: "Plan",
          planBasic: "Basic",
          planPro: "Pro",
          planEnterprise: "Enterprise",
          status: "Status",
          statusActive: "Active",
          statusSuspended: "Suspended",
          statusCanceled: "Canceled",
          adminData: "Admin User",
          adminName: "Admin name",
          adminEmail: "Admin email",
          adminPassword: "Admin password",
        },
        buttons: {
          okAdd: "Add",
          okEdit: "Save",
          cancel: "Cancel",
        },
        success: "Company saved successfully!",
      },
      queueSelect: {
        inputLabel: "Queues",
      },
      quickAnswers: {
        title: "Quick Answers",
        table: {
          shortcut: "Shortcut",
          message: "Quick Reply",
          actions: "Actions",
        },
        buttons: {
          add: "Add Quick Reply",
        },
        toasts: {
          deleted: "Quick Reply deleted successfully.",
        },
        searchPlaceholder: "Search...",
        confirmationModal: {
          deleteTitle: "Are you sure you want to delete this Quick Reply: ",
          deleteMessage: "This action cannot be undone.",
        },
      },
      users: {
        title: "Users",
        table: {
          name: "Name",
          email: "Email",
          profile: "Profile",
          whatsapp: "Default Connection",
          status: "Status",
          online: "Online",
          offline: "Offline",
          maxSimultaneousTickets: "Limit",
          actions: "Actions",
        },
        buttons: {
          add: "Add user",
        },
        toasts: {
          deleted: "User deleted sucessfully.",
        },
        confirmationModal: {
          deleteTitle: "Delete",
          deleteMessage:
            "All user data will be lost. Users' open chats will be moved to queue.",
        },
      },
      settings: {
        success: "Settings saved successfully.",
        title: "Settings",
        tabs: {
          general: "General",
          connections: "Connections",
          businessHours: "Business Hours",
          ticketStatuses: "Closing Statuses",
          tags: "Tags",
          autoMessages: "Automatic Messages",
        },
        general: {
          sections: {
            attendance: "Attendance rules",
            experience: "Agent experience",
          },
          autoAssignTickets: {
            label: "Automatic chat distribution",
            helper:
              "New chats are handed to the online agent in the queue with the fewest open conversations. Respects each agent's individual limit.",
          },
          requireClosingStatus: {
            label: "Require status on close",
            helper:
              "The agent must pick a closing reason before finishing the chat.",
          },
          allowAgentSeeAllTickets: {
            label: "Agents can see chats from other queues",
            helper:
              "When off, each agent only sees chats from the queues they belong to.",
          },
          autoCloseInactiveHours: {
            label: "Close idle chats after (hours)",
            helper: "0 disables auto-close. Checked every 5 minutes by the server.",
          },
          reopenTicketWindowHours: {
            label: "Reopen window (hours)",
            helper:
              "A new message within this period reopens the contact's last chat instead of creating another.",
          },
          signMessages: {
            label: "Sign messages with the agent's name",
            helper: "Sets the default for new agents. Each one can toggle it in the chat screen.",
          },
          notificationSound: {
            label: "Notification sound",
            helper: "Plays an audible alert when a message arrives in a chat that is not open.",
          },
        },
        buttons: {
          save: "Save",
        },
        settings: {
          userCreation: {
            name: "User creation",
            options: {
              enabled: "Enabled",
              disabled: "Disabled",
            },
          },
          apiToken: {
            name: "API Token",
            generate: "Generate new token",
            helper: "Use this token to authenticate external integrations with this company's messages API.",
          },
        },
        businessHours: {
          description: "Set the days and hours your company provides service. Outside this period, the automatic message configured in the 'Automatic Messages' tab can be sent to the customer.",
          table: {
            day: "Day",
            enabled: "Enabled",
            start: "Start",
            end: "End",
          },
          weekDays: {
            0: "Sunday",
            1: "Monday",
            2: "Tuesday",
            3: "Wednesday",
            4: "Thursday",
            5: "Friday",
            6: "Saturday",
          },
        },
        ticketStatuses: {
          buttons: {
            add: "Add status",
            cancel: "Cancel",
            okAdd: "Add",
            okEdit: "Save",
          },
          table: {
            name: "Name",
            type: "Type",
            default: "Default",
            actions: "Actions",
          },
          types: {
            pending: "Waiting",
            open: "In service",
            closed: "Closed",
          },
          yes: "Yes",
          no: "No",
          confirmationModal: {
            deleteTitle: "Delete",
            deleteMessage: "Are you sure? This action cannot be undone!",
          },
          toasts: {
            deleted: "Status deleted successfully!",
          },
          success: "Status saved successfully!",
          modal: {
            title: {
              add: "Add Status",
              edit: "Edit Status",
            },
            name: "Status name",
            color: "Color",
            type: "Linked to",
            isDefault: "Use as default for this type",
          },
        },
        autoMessages: {
          outOfHours: {
            toggle: "Send automatic message outside business hours",
            description: "Automatically sent when the customer starts a conversation outside the configured business hours.",
            placeholder: "E.g.: Hi {{cliente.nome}}, we're currently outside business hours. We'll get back to you soon!",
          },
          transfer: {
            toggle: "Send automatic message when transferring a chat",
            description: "Automatically sent when a chat is transferred to another agent or queue.",
            placeholder: "E.g.: Hi {{cliente.nome}}, your chat was transferred to {{setor}} and will continue with {{atendente}}.",
          },
        },
      },
      messagesList: {
        internalNote: "Internal note",
        searchPlaceholder: "Search in this conversation",
        searchResults: "{{count}} result(s)",
        header: {
          assignedTo: "Assigned to:",
          buttons: {
            return: "Return",
            resolve: "Resolve",
            reopen: "Reopen",
            accept: "Accept",
          },
        },
      },
      messagesInput: {
        placeholderOpen: "Type a message or press ''/'' to use the registered quick responses",
        placeholderClosed: "Reopen or accept this chat to send a message.",
        signMessage: "Sign",
        internalNoteTooltip: "Internal note (team only)",
        placeholderInternalNote:
          "Internal note — will not be sent to the customer",
      },
      contactDrawer: {
        header: "Contact details",
        customer: {
          title: "Customer",
          status: "Status",
          statuses: { lead: "Lead", active: "Active", inactive: "Inactive" },
          name: "Legal name",
          document: "Tax ID",
          segment: "Segment",
          responsible: "Owner",
          city: "City",
          notes: "Notes",
          notLinked: "This contact has no customer record yet.",
          create: "Create customer",
          edit: "Edit customer",
        },
        history: {
          title: "Previous chats",
          empty: "No previous chats.",
          noAgent: "Unassigned",
        },
        buttons: {
          edit: "Edit contact",
        },
        extraInfo: "Other information",
      },
      ticketOptionsMenu: {
        delete: "Delete",
        transfer: "Transfer",
        confirmationModal: {
          title: "Delete chat #",
          titleFrom: "from contact ",
          message: "Attention! All chat's related messages will be lost.",
        },
        buttons: {
          delete: "Delete",
          cancel: "Cancel",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancel",
        },
      },
      messageOptionsMenu: {
        delete: "Delete",
        reply: "Reply",
        confirmationModal: {
          title: "Delete message?",
          message: "This action cannot be reverted.",
        },
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP:
          "There must be at lest one default WhatsApp connection.",
        ERR_NO_DEF_WAPP_FOUND:
          "No default WhatsApp found. Check connections page.",
        ERR_WAPP_NOT_INITIALIZED:
          "This WhatsApp session is not initialized. Check connections page.",
        ERR_WAPP_CHECK_CONTACT:
          "Could not check WhatsApp contact. Check connections page.",
        ERR_WAPP_INVALID_CONTACT: "This is not a valid whatsapp number.",
        ERR_WAPP_DOWNLOAD_MEDIA:
          "Could not download media from WhatsApp. Check connections page.",
        ERR_INVALID_CREDENTIALS: "Authentication error. Please try again.",
        ERR_SENDING_WAPP_MSG:
          "Error sending WhatsApp message. Check connections page.",
        ERR_DELETE_WAPP_MSG: "Couldn't delete message from WhatsApp.",
        ERR_OTHER_OPEN_TICKET:
          "There's already an open chat for this contact.",
        ERR_SESSION_EXPIRED: "Session expired. Please login.",
        ERR_USER_CREATION_DISABLED:
          "User creation was disabled by administrator.",
        ERR_NO_PERMISSION: "You don't have permission to access this resource.",
        ERR_DUPLICATED_CONTACT: "A contact with this number already exists.",
        ERR_NO_COMPANY_FOUND: "No company found with this ID.",
        ERR_DUPLICATED_COMPANY_DOCUMENT:
          "A company with this document already exists.",
        ERR_COMPANY_HAS_USERS:
          "Cannot delete a company that still has users linked to it.",
        ERR_NO_SETTING_FOUND: "No setting found with this ID.",
        ERR_NO_CONTACT_FOUND: "No contact found with this ID.",
        ERR_NO_TICKET_FOUND: "No chat found with this ID.",
        ERR_NO_USER_FOUND: "No user found with this ID.",
        ERR_NO_WAPP_FOUND: "No WhatsApp found with this ID.",
        ERR_CREATING_MESSAGE: "Error while creating message on database.",
        ERR_CREATING_TICKET: "Error while creating chat on database.",
        ERR_FETCH_WAPP_MSG:
          "Error fetching the message in WhtasApp, maybe it is too old.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "This color is already in use, pick another one.",
        ERR_WAPP_GREETING_REQUIRED:
          "Greeting message is required if there is more than one queue.",
      },
    },
  },
};

export { messages };
