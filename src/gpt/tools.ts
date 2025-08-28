import { Interval } from "lib/prisma.js";
import { ChatCompletionTool } from "openai/resources";

const newTransactionTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "add_finance",
    description: "Adiciona um novo registro financeiro",
    parameters: {
      type: "object",
      properties: {
        value: {
          type: "number",
          description: "Valor do registro",
        },
        type: {
          type: "string",
          enum: ["GASTO", "GANHO"],
          description: "Tipo de registro",
        },
        recurringType: {
          type: "string",
          enum: ["DIARY", "WEECKLY", "MONTHLY", "YEARLY"],
          description: "Tipo de registro",
        },
        description: {
          type: "string",
          description: "Descrição do registro",
          minLength: 10
        },
        recurring: {
          type: "number",
          description: "Quantidade de parcelas",
          default: 1
        },
        categoryId: {
          type: "number",
          description: `
ID da categoria correspondente entre os seguintes valores:
1 = Doações 2 = Cursos 3 = Viagens 4 = Diversão 5 = Salário 6 = Aluguel 7 = Auxílio 8 = Rendimentos 9 = Alimentação 10 = Transporte 11 = Moradia 12 = Lazer 13 = Educação 14 = Roupas 15 = Acessórios 16 = Presentes 17 = Animais 18 = Beleza, 19 = Outros
`.trim()
        }
      },
      required: ["categoryId", "recurring", "description", "recurringType", "type", "value"],
      additionalProperties: false
    },
    strict : true
  },
};

const listTransactionsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "list_entries",
    description:
      "Retorna dados dos registros financeiros com base em um intervalo de datas, categoria, tipo e descrição. Só chame esta função quando o usuário solicitar explicitamente algo como 'listar meus gastos', 'quero ver as despesas', 'me mostra o que ganhei entre X e Y', etc.",
    parameters: {
      type: "object",
      properties: {
        dataInicial: {
          type: "string",
          description: "Data inicial no formato YYYY-MM-DDTHH:mm:ss.sss",
        },
        dataFinal: {
          type: "string",
          description: "Data final no formato YYYY-MM-DDTHH:mm:ss.sss",
        },
        categoryId: {
          type: "array",
          description: "Lista de IDs de categorias financeiras (ex: [1, 2, 5])",
          items: {
            type: "number",
          },
        },
        type: {
          type: "string",
          enum: ["GASTO", "GANHO"],
          description: "Tipo de transação: GASTO ou GANHO",
        },
        description: {
          type: "string",
          description: "Descrição da transação (mínimo 5 caracteres)",
        },
      },
      required: [],
    },
  },
};

const transactionsAnalysis: ChatCompletionTool = {
  type: "function",
  function: {
    name: "list_analysis",
    description:
      "Retorna uma análise dos registros financeiros em um intervalo de tempo específico. Pode incluir filtros por categoria, tipo e descrição. Só deve ser chamada quando o usuário pedir explicitamente uma análise dos dados financeiros.",
    parameters: {
      type: "object",
      properties: {
        dataInicial: {
          type: "string",
          description: "Data inicial da análise no formato YYYY-MM-DDTHH:mm:ss.sss",
        },
        dataFinal: {
          type: "string",
          description: "Data final da análise no formato YYYY-MM-DDTHH:mm:ss.sss",
        },
        categoryId: {
          type: "array",
          description: "Lista de IDs de categorias financeiras (ex: [1, 2, 5])",
          items: {
            type: "number",
          },
        },
        type: {
          type: "string",
          enum: ["GASTO", "GANHO"],
          description: "Tipo da transação a ser analisada",
        },
        description: {
          type: "string",
          description: "Descrição textual a ser considerada na análise (mínimo 5 caracteres)",
        },
      },
      required: [], // todos os campos são opcionais
    },
  },
};

const deepAnalysis: ChatCompletionTool = {
  type: "function",
  function: {
    name: "deep_analysis",
    description: "Faz uma analise completa e profunda das finanças do mês atual.",
    strict: true,
    parameters: {
      type: "object",
      description: "Payload para análise do mês atual",
      additionalProperties: false, // <- NA RAIZ
      properties: {
        greetings: {
          type: "string",
          description: "Greeting message"
        },
        metrics: {
          type: "object",
          description: "Percentuais atuais para cada categoria da regra 60-40",
          additionalProperties: false, // <- EM OBJETO FILHO
          properties: {
            essentials: { type: "string", description: "Feedback dos gastos essenciais" },
            leisure: { type: "string", description: "Feedback dos gastos lazer" },
            education: { type: "string", description: "Feedback dos gastos Educação" },
            investments: { type: "string", description: "Feedback dos gastos Investimentos" },
            dreams: { type: "string", description: "Feedback dos gastos Sonhos" }
          },
          required: ["essentials", "leisure", "education", "investments", "dreams"]
        },
        prosperity: { type: "string", description: "Aviso sobre prosperidade" },
        emergency: {
          type: "object",
          description: "Dados da reserva de emergência",
          additionalProperties: false, // <- EM OBJETO FILHO
          properties: {
            monthlyCost:   { type: "number", description: "Custo mensal médio" },
            minReserve:     { type: "number", description: "Reserva mínima (3 meses)" },
            idealReserve:   { type: "number", description: "Reserva ideal (6 meses)" },
            currentReserve: { type: "number", description: "Valor que já possui" },
            coverageMonths: { type: "number", description: "Cobertura em meses" },
            gapMin:         { type: "number", description: "Gap mínimo para 3 meses" }
          },
          required: ["monthlyCost", "minReserve", "idealReserve", "currentReserve", "coverageMonths", "gapMin"]
        },
        plan: { type: "string", description: "Plano baseado na reserva de emergência" },
        actionPlan: {
          type: "array",
          minItems: 2, maxItems: 2, 
          description: "Ações a serem tomadas",
          items: { type: "string", description: "Ação" }
        },
        next_30days: {
          type: "array",
          minItems: 2, maxItems: 2,
          description: "Próximos 30 dias",
          items: { type: "string", description: "Meta dos próximos 30 dias" }
        },
        next_90days: {
          type: "array",
          minItems: 3, maxItems: 3,
          description: "Próximos 90 dias",
          items: { type: "string", description: "Meta dos próximos 90 dias" }
        },
        resume: { type: "string", description: "Uma piada simples sobre a situação no mês." },
        bye_message: { type: "string", description: "Mensagem de despedida" }
      },
      required: [
        "greetings",
        "metrics",
        "prosperity",
        "emergency",
        "plan",
        "actionPlan",
        "next_30days",
        "next_90days",
        "resume",
        "bye_message"
      ]
    }
  }
};


const monthInformation: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_month_information",
    description: "pega as informações para poder executar o deep analysis",
  },
}

const updateTransaction: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_transaction",
    description: "Atualiza um campo específico de um registro financeiro existente com base em uma correção fornecida pelo usuário. Deve ser usada quando o usuário disser frases como 'na verdade o valor é X' ou 'o nome é Y'. Apenas os campos 'valor' ou 'description' podem ser alterados, quando o ususário chamar por 'atualizar transação, use essa função.'",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Índice do registro financeiro a ser atualizado."
        },
        new_description: {
          type: "string",
          description: "Nova descrição a ser atribuída ao campo 'description'."
        },
        new_value: {
          type: "number",
          description: "Novo valor numérico a ser atribuído ao campo 'valor'."
        },
        startDate: {
          type: "string",
          format: "date-time",
          description: "Data da transação."
        },
        categoryId: {
          type: "number",
          description: "ID da nova categoria a ser atribuída, caso a alteração envolva mudança de categoria."
        }
      },
      required: ["id"]
    }
  }
};

const updateTransactionParcel: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_transicion_parcel",
    description: "Atualiza o valor ou a data de uma parcela de uma transação",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Índice do registro financeiro a ser atualizado."
        },
        value: {
          type: "number",
          description: "Novo valor numérico a ser atribuído ao campo 'valor'."
        },
        date: {
          type: "string",
          format: "date-time",
          description: "Data de início da modificação, caso seja relevante para registros recorrentes."
        },
      },
      required: ["id"]
    }
  }
}

const deleteTransactionTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "delete_transaction",
    description:
      "Deleta uma movimentação financeira existente com base no ID fornecido. Deve ser chamada apenas quando o usuário pedir explicitamente para remover uma movimentação (ex: 'quero excluir aquele gasto do mês passado').",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID da movimentação financeira a ser deletada",
        },
      },
      required: ["id"],
    },
  },
};

const deleteParcelTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "delete_parcel",
    description:
      "Deleta uma parcela específica de uma transação parcelada com base no ID fornecido. Deve ser usada apenas quando o usuário solicitar a remoção de uma única parcela (ex: 'apaga só a parcela de junho').",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID da parcela que será deletada",
        },
      },
      required: ["id"],
    },
  },
};

const createNotificationTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "create_notification",
    description:
      "Cria uma notificação de meta financeira futura com base em uma recorrência desejada. Use quando o usuário pedir para ser lembrado de pagar ou registrar um valor específico em uma data futura (ex: 'me lembra de pagar o aluguel todo mês').",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          description: "Intervalo de recorrência da notificação (ex: DAILY, WEEKLY, MONTHLY, YEARLY)",
          enum: Object.values(Interval),
        },
        referenceDate: {
          type: "string",
          description: "Data inicial da notificação (formato ISO: YYYY-MM-DDTHH:mm:ss.sss)",
        },
        description: {
          type: "string",
          description: "Descrição da notificação (mínimo de 5 caracteres)",
        },
        count: {
          type: "number",
          description: "Quantidade total de vezes que a notificação deve ocorrer (mínimo 1)",
        },
        transactionId: {
          type: "number",
          description: "ID de uma transação existente a ser vinculada (opcional)",
        },
        categoryId: {
          type: "number",
          description: "ID da categoria financeira relacionada à notificação",
        },
        type: {
          type: "string",
          enum: ["GASTO", "GANHO"],
          description: "Tipo de transação relacionada: GASTO ou GANHO",
        },
        value: {
          type: "number",
          description: "Valor associado à notificação (deve ser maior que zero)",
        },
      },
      required: [
        "period",
        "referenceDate",
        "description",
        "count",
        "categoryId",
        "type",
        "value",
      ],
    },
  },
};

const updateNotificationTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_notification",
    description:
      "Atualiza os dados de uma notificação financeira existente com base no ID informado. Deve ser usada quando o usuário quiser alterar o valor, descrição, tipo, categoria ou a data de referência de um lembrete financeiro.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID da notificação a ser atualizada",
        },
        value: {
          type: "number",
          description: "Novo valor da notificação (deve ser maior que zero)",
        },
        description: {
          type: "string",
          description: "Nova descrição da notificação (mínimo de 5 caracteres)",
        },
        type: {
          type: "string",
          enum: ["GASTO", "GANHO"],
          description: "Tipo da notificação: GASTO ou GANHO",
        },
        categoryId: {
          type: "number",
          description: "ID da nova categoria associada (opcional)",
        },
        count: {
          type: "number",
          description: "Nova quantidade de repetições da notificação (mínimo 1)",
        },
        referenceDate: {
          type: "string",
          description: "Nova data de referência (formato YYYY-MM-DDTHH:mm:ss.sss)",
        },
      },
      required: ["id"],
    },
  },
};

const listNotificationsTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "list_notifications",
    description:
      "Lista as notificações financeiras do usuário com base em filtros como tipo (ativas/inativas), ordenação, e pesquisa textual. Deve ser chamada quando o usuário pedir para ver seus lembretes ou notificações financeiras.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "number",
          description: "Número da página de resultados (default = 1)",
        },
        perPage: {
          type: "number",
          description: "Quantidade de itens por página (default = 10)",
        },
        search: {
          type: "string",
          description: "Texto a ser buscado na descrição da notificação",
        },
        type: {
          type: "string",
          enum: ["active", "inactive"],
          description: "Status da notificação: ativa ou inativa, considere se o usuário quer ver as próximas que seriam as ativas. ou todas.",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Ordenação dos resultados (ascendente ou descendente)",
        },
      },
      required: [],
    },
  },
};

const escalateToHumanTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "escalate_to_human_support",
    description:
      "Aciona o suporte humano para questões mais aprofundadas ou complexas. Use esta função quando o usuário pedir ajuda mais especializada, solicitar conversar com alguém, ou demonstrar insatisfação com respostas automáticas. Deve responder com uma mensagem indicando que um atendente está disponível via WhatsApp pelo número (11) 91234-5678.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
};

const deleteNotificationTool: ChatCompletionTool = {
  type: "function",
  function: {
    name: "delete_notification",
    description:
      "Deleta uma notificação financeira com base no ID fornecido. Deve ser usada quando o usuário pedir explicitamente para excluir um lembrete ou notificação.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "ID da notificação a ser deletada",
        },
      },
      required: ["id"],
    },
  },
};

let tools: ChatCompletionTool[] = [
  newTransactionTool,
  listTransactionsTool,
  transactionsAnalysis,
  updateTransaction,
  escalateToHumanTool,
  updateTransactionParcel,
  deleteParcelTool,
  deleteTransactionTool,
  createNotificationTool,
  updateNotificationTool,
  listNotificationsTool,
  deleteNotificationTool,
];

export let analysisOnlyTools = [ deepAnalysis ]

export const toolFunctionNames = [
  "add_finance",
  "list_entries",
  "list_analysis",
  "update_transaction",
  "update_transicion_parcel",
  "delete_parcel",
  "delete_transaction",
  "create_notification",
  "update_notification",
  "list_notifications",
  "delete_notification",
  "escalate_to_human_support",
  "get_month_information",
  "deep_analysis"
] as const;

export type ToolFunctionNames = typeof toolFunctionNames[number];



export default tools;
