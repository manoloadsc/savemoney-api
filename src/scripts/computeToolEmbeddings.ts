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

// ---- Configuración simple (puedes cambiar por env) ----
const EMBED_MODEL : EmbeddingModel = "text-embedding-3-small";

// el prefijo “passage:” ayuda a algunos encoders
const passage = (t: string) => `passage: ${t}`;

// sinónimos/ejemplos positivos reales del usuario (es-ES)
const POSITIVES: Partial<Record<ToolFunctionNames, string[]>> = {
  list_entries: [
    "listar mis movimientos",
    "mostrar mi extracto de este mes",
    "ver mis registros de hoy",
    "consultar transacciones recientes",
    "mostrar gastos de agosto",
    "filtrar ingresos y egresos de la última semana",
    "muéstrame ingresos y gastos",
    "listar mis gastos del 2025-07-01 al 2025-07-15",
    "quiero ver mis transacciones",
  ],
  add_finance: [
    "registrar gasto de $50 en alimentación",
    "añadir ingreso de $2000 salario",
    "registrar un gasto de supermercado 120 pesos",
    "crear un nuevo ingreso de 300",
    "¿Puedes crear una nueva transacción financiera por 400 pesos sobre ir a la iglesia?",
    "Compré una galleta de 60 pesos",
    "Recibí 1400 pesos en un salario, regístralo"
  ],
  delete_transaction: [
    "borrar transacción 123",
    "eliminar registro 456",
    "quitar este pago erróneo",
    "borrar entrada duplicada",
    "cancelar este movimiento",
  ],
  update_transaction: [
    "corregir valor de la transacción 123 a 250",
    "actualizar descripción de la transacción 456",
    "editar fecha del registro 789 a 2025-08-01",
  ],
  list_analysis: [
    "resumen de mis gastos de los últimos 15 días",
    "¿cuál es mi saldo del mes?",
    "dame una visión general por categoría",
    "informa mi saldo",
  ],
  deep_analysis: [
    "análisis profundo de gastos de junio",
    "generar informe detallado de ingresos",
    "haz un análisis completo de mi presupuesto",
  ],
  create_notification: [
    "recuérdame pagar el alquiler cada mes",
    "crear notificación para la factura de la tarjeta",
    "recuérdame mañana pagar el recibo",
    "¿puedes actualizar la notificación 3 al valor de 4100 pesos?",
  ],
  update_notification: [
    "actualizar descripción del recordatorio 123 para pagar la luz",
    "cambiar fecha del recordatorio 456 a 2025-08-01",
  ],
  list_notifications: [
    "mostrar mis notificaciones activas",
    "listar recordatorios",
    "mostrar recordatorios de agosto",
    "¿puedes listar las notificaciones para mí?"
  ],
  delete_notification: [
    "eliminar recordatorio 789",
    "borrar notificación 321",
  ],
  delete_parcel: [
    "eliminar cuota 012",
    "borrar cuota 345",
  ],
  update_transicion_parcel: [
    "actualizar cuota 12 al valor 200",
    "ajustar fecha de vencimiento de la cuota 03",
  ],
  escalate_to_human_support: [
    "hablar con un agente",
    "llamar a soporte humano",
    "tengo un error, necesito ayuda",
    "Quiero hablar con soporte humano."
  ],
};

// anti-ejemplos (intenciones cercanas que confunden)
const NEGATIVES: Partial<Record<ToolFunctionNames, string[]>> = {
  list_entries: [
    "borrar transacción 123",
    "eliminar registro",
    "añadir nuevo gasto",
    "crear ingreso",
    "editar valor de la transacción",
  ],
  delete_transaction: [
    "listar mis movimientos",
    "mostrar extracto",
    "ver registros",
    "añadir un gasto",
    "actualizar una transacción",
  ],
  add_finance: [
    "listar mis movimientos",
    "borrar transacción",
  ],
  list_analysis: [
    "borrar transacción",
    "añadir gasto",
    "editar transacción",
  ],
  update_transaction: [
    "listar mis movimientos",
    "borrar transacción",
    "añadir gasto",
  ],
  update_transicion_parcel : [
    "listar mis movimientos",
    "Actualizar transacción",
    "Actualizar valor de la transacción a",
    "¿Puedes hacer un análisis?",
  ],
  create_notification : [
    "crear una nueva transacción",
  ]
};

// descripción base (curta, direta)
const DESC_BASE: Partial<Record<ToolFunctionNames, string>> = {
  list_entries:
    "Lista/muestra/consulta movimientos, extractos, registros, transacciones; soporta filtros por fecha/categoría/valor. No crea/edita/borra.",
  add_finance:
    "Registra/añade/crea transacciones financieras (gastos/ingresos). No lista, no borra, no actualiza.",
  delete_transaction:
    "Borra/elimina/quita una transacción. Operación destructiva. Requiere confirmación/id claro.",
  update_transaction:
    "Actualiza/edita/corrige una transacción existente (valor, descripción, fecha, categoría). No crea ni borra.",
  list_analysis:
    "Resumen/visión general de gastos/ingresos en un periodo; métricas, totales, categorías. No modifica datos.",
  deep_analysis:
    "Análisis profundo/informe detallado de finanzas con insights y explicaciones. No modifica datos.",
  create_notification:
    "Crea recordatorios/notificaciones (pagar cuentas, metas, fechas). No altera ni elimina existentes.",
  update_notification:
    "Actualiza un recordatorio existente (título, fecha, descripción). No crea ni borra.",
  list_notifications:
    "Lista/muestra notificaciones/recordatorios activos o futuros. No crea/edita/borra.",
  delete_notification:
    "Elimina/borra/quita un recordatorio. Operación destructiva. Requiere identificación clara.",
  delete_parcel:
    "Borra/elimina/quita una cuota específica de una transacción en cuotas. Destructivo.",
  update_transicion_parcel:
    "Actualiza/edita datos de una cuota (valor, fecha, estado). No crea ni borra.",
  escalate_to_human_support:
    "Escala a un agente humano en caso de error, duda, disputa o soporte.",
};

function buildInput(name: ToolFunctionNames, originalDesc: string) {
  const desc = DESC_BASE[name] ?? originalDesc ?? "";
  const pos = POSITIVES[name] ?? [];
  const neg = NEGATIVES[name] ?? [];

  // enriquecemos el texto que va para el embedding con:
  // - qué hace / cuándo usar
  // - ejemplos positivos (sinónimos/formas de pedir)
  // - cuándo NO usar (anti-ejemplos cercanos)
  const text =
    `${name} — ${desc} | ` +
    `Cuándo usar: ${pos.slice(0, 8).join("; ")} | ` +
    (neg.length ? `Cuándo NO usar: ${neg.slice(0, 6).join("; ")} | ` : "") +
    `Ejemplos: ${pos.slice(0, 8).join("; ")}`;

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
        console.warn(`Embedding vacío para ${tool.function.name}, saltando.`);
        continue;
      }
      embeddings.push({ name: tool.function.name, vector });
      console.log(`Embedding calculado para ${tool.function.name}`);
    } catch (err) {
      console.error(`Error al calcular embedding para ${tool.function.name}:`, err);
    }
  }

  const outDir = path.resolve(process.cwd(), "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "toolEmbeddings.json");
  writeFileSync(outPath, JSON.stringify(embeddings, null, 2), "utf8");
  console.log(`Embeddings guardados en ${outPath}`);
}

computeToolEmbeddings();
