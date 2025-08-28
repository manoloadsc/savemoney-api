import OpenAI from "openai";
import "dotenv/config";
import tools, { ToolFunctionNames } from "gpt/tools.js";
import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { EmbeddingModel } from "openai/resources";

interface ToolEmbedding {
  name: string;
  vector: number[];
}

// ---- Config simples (pode trocar por env) ----
const EMBED_MODEL : EmbeddingModel = "text-embedding-3-small";

// prefixo “passage:” ajuda alguns encoders
const passage = (t: string) => `passage: ${t}`;

// sinônimos/exemplos positivos reais do usuário (pt-BR)
const POSITIVES: Partial<Record<ToolFunctionNames, string[]>> = {
  list_entries: [
    "listar minhas movimentações",
    "mostrar meu extrato deste mês",
    "ver meus lançamentos de hoje",
    "consultar transações recentes",
    "exibir despesas de agosto",
    "filtrar entradas e saídas da última semana",
    "me mostra ganhos e gastos",
    "listar meus gastos de 2025-07-01 a 2025-07-15",
    "quero ver minhas transações",
  ],
  add_finance: [
    "registrar gasto de R$50 em alimentação",
    "adicionar ganho de R$2000 salário",
    "lançar uma despesa de mercado 120 reais",
    "criar uma nova receita de 300",
    "Pode criar uma nova transação financeira no valor de 400 reais sobre ir para a igreja",
    "Comprei um biscoito de 60 reais",
    "Recebi 1400 reais em um salario, registre isso"
  ],
  delete_transaction: [
    "apagar transação 123",
    "excluir lançamento 456",
    "remover esse pagamento errado",
    "deletar entrada duplicada",
    "cancelar essa movimentação",
  ],
  update_transaction: [
    "corrigir valor da transação 123 para 250",
    "atualizar descrição da transação 456",
    "editar data do lançamento 789 para 2025-08-01",
  ],
  list_analysis: [
    "resumo dos meus gastos dos últimos 15 dias",
    "qual meu saldo do mês?",
    "me dá uma visão geral por categoria",
    "relate meu saldo",
  ],
  deep_analysis: [
    "análise profunda de gastos de junho",
    "gerar relatório detalhado de ganhos",
    "faça uma análise completa do meu orçamento",
  ],
  create_notification: [
    "lembre-me de pagar aluguel todo mês",
    "criar notificação para fatura do cartão",
    "me lembre amanhã de pagar o boleto",
    "pode atualizar a notificação 3 para o valor de 4100 reais ?",
  ],
  update_notification: [
    "atualizar descrição do lembrete 123 para pagar conta de luz",
    "alterar data do lembrete 456 para 2025-08-01",
  ],
  list_notifications: [
    "mostrar minhas notificações ativas",
    "listar lembretes",
    "exibir lembretes de agosto",
    "pode listar as notificações pra mim ?"
  ],
  delete_notification: [
    "remover lembrete 789",
    "deletar notificação 321",
  ],
  delete_parcel: [
    "remover parcela 012",
    "deletar parcela 345",
  ],
  update_transicion_parcel: [
    "atualizar parcela 12 para valor 200",
    "ajustar data de vencimento da parcela 03",
  ],
  escalate_to_human_support: [
    "falar com atendente",
    "chamar suporte humano",
    "tenho um erro preciso de ajuda",
    "Eu quero falar com suporte humano."
  ],
};

// anti-exemplos (intenções vizinhas que confundem)
const NEGATIVES: Partial<Record<ToolFunctionNames, string[]>> = {
  list_entries: [
    "apagar transação 123",
    "deletar lançamento",
    "adicionar nova despesa",
    "criar receita",
    "editar valor da transação",
  ],
  delete_transaction: [
    "listar minhas movimentações",
    "mostrar extrato",
    "ver lançamentos",
    "adicionar uma despesa",
    "atualizar uma transação",
  ],
  add_finance: [
    "listar minhas movimentações",
    "apagar transação",
  ],
  list_analysis: [
    "apagar transação",
    "adicionar despesa",
    "editar transação",
  ],
  update_transaction: [
    "listar minhas movimentações",
    "apagar transação",
    "adicionar despesa",
  ],
  update_transicion_parcel : [
    "listar minhas movimentações",
    "Ataulizar transação",
    "Atualizar valor da transação para",
    "Pode fazer uma analise",
  ],
  create_notification : [
    "criar uma nova transação",
  ]
};

// descrição base (curta, direta)
const DESC_BASE: Partial<Record<ToolFunctionNames, string>> = {
  list_entries:
    "Lista/exibe/mostra/consulta movimentações, extrato, lançamentos, transações; suporta filtros por data/categoria/valor. Não cria/edita/apaga.",
  add_finance:
    "Registra/adiciona/cria transações financeiras (despesas/receitas). Não lista, não apaga, não atualiza.",
  delete_transaction:
    "Apaga/exclui/remove uma transação. Operação destrutiva. Exige confirmação/id claro.",
  update_transaction:
    "Atualiza/edita/corrige uma transação existente (valor, descrição, data, categoria). Não cria nem apaga.",
  list_analysis:
    "Resumo/visão geral dos gastos/ganhos em período; métricas, totais, categorias. Não mexe em dados.",
  deep_analysis:
    "Análise profunda/relatório detalhado de finanças com insights e explicações. Não mexe em dados.",
  create_notification:
    "Cria lembretes/notificações (pagar contas, metas, datas). Não altera nem exclui existente.",
  update_notification:
    "Atualiza um lembrete existente (título, data, descrição). Não cria nem apaga.",
  list_notifications:
    "Lista/exibe/mostra notificações/lembretes ativos ou futuros. Não cria/edita/apaga.",
  delete_notification:
    "Exclui/apaga/remover um lembrete. Operação destrutiva. Exige identificação clara.",
  delete_parcel:
    "Apaga/exclui/remove uma parcela específica de uma transação parcelada. Destrutivo.",
  update_transicion_parcel:
    "Atualiza/edita dados de uma parcela (valor, data, status). Não cria nem apaga.",
  escalate_to_human_support:
    "Encaminha para atendente humano em caso de erro, dúvida, contestação ou suporte.",
};

function buildInput(name: ToolFunctionNames, originalDesc: string) {
  const desc = DESC_BASE[name] ?? originalDesc ?? "";
  const pos = POSITIVES[name] ?? [];
  const neg = NEGATIVES[name] ?? [];

  // enriquecemos o texto que vai para o embedding com:
  // - o que faz / quando usar
  // - exemplos positivos (sinônimos/jeitos de pedir)
  // - quando NÃO usar (anti-exemplos próximos)
  const text =
    `${name} — ${desc} | ` +
    `Quando usar: ${pos.slice(0, 8).join("; ")} | ` +
    (neg.length ? `Quando NÃO usar: ${neg.slice(0, 6).join("; ")} | ` : "") +
    `Exemplos: ${pos.slice(0, 8).join("; ")}`;

  return passage(text);
}

async function computeToolEmbeddings(): Promise<void> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embeddings: ToolEmbedding[] = [];

  for (const tool of tools) {
    const name = tool.function.name as ToolFunctionNames;
    const input = buildInput(name, tool.function.description || "");

    try {
      const response = await openai.embeddings.create({
        model: EMBED_MODEL,
        input,
      });
      const vector = response.data?.[0]?.embedding as number[];
      if (!Array.isArray(vector) || vector.length === 0) {
        console.warn(`Embedding vazio para ${tool.function.name}, pulando.`);
        continue;
      }
      embeddings.push({ name: tool.function.name, vector });
      console.log(`Computed embedding for ${tool.function.name}`);
    } catch (err) {
      console.error(`Erro ao computar embedding para ${tool.function.name}:`, err);
    }
  }

  const outDir = path.resolve(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "toolEmbeddings.json");
  writeFileSync(outPath, JSON.stringify(embeddings, null, 2), "utf8");
  console.log(`Saved embeddings to ${outPath}`);
}

computeToolEmbeddings();
