export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\d{10,}/g, " ")                // remove telefones/ids longos
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\p{L}\p{N}\s]/gu, " ")       // remove pontuação/símbolos
    .replace(/\s+/g, " ")
    .trim();
}

/** L2-normaliza um vetor */
export function l2(v?: number[]): number[] {
  if (!Array.isArray(v) || v.length === 0) return [];
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / norm;
  return out;
}

/** Produto escalar (assumindo mesmo comprimento) */
export function dot(a?: number[], b?: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

/** Cosseno clássico (sem normalizar de antemão) — compatível com o que você tinha */
export function cosineSimilarity(a?: number[], b?: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const len = Math.min(a.length, b.length);
  let dotp = 0, magA = 0, magB = 0;
  for (let i = 0; i < len; i++) {
    const ai = a[i], bi = b[i];
    dotp += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  return magA && magB ? dotp / (magA * magB) : 0;
}

/** Cosseno para vetores já L2-normalizados (mais rápido) */
export function cosineL2(a?: number[], b?: number[]): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  return dot(a, b); // com L2, dot == cosine
}

/** Versão “segura”: L2-normaliza internamente antes de calcular o cosseno */
export function safeCosine(a?: number[], b?: number[]): number {
  return cosineL2(l2(a), l2(b));
}

/** Ordena itens por similaridade (desc) contra um vetor de consulta */
export function rankByCosine<T extends { vector: number[] }>(
  queryVec: number[],
  items: (T & { name?: string })[]
): Array<{ item: T & { name?: string }; score: number }> {
  const q = l2(queryVec);
  return items
    .map((item) => ({ item, score: cosineL2(q, l2(item.vector)) }))
    .sort((a, b) => b.score - a.score);
}
export const CHITCHAT = [
  "obrigado","obrgiado","obrigada","vlw","valeu","ok","certo",
  "boa","show","perfeito","brigado","obg","tudo bem","blz",
  "bom dia","boa tarde","boa noite","ola","olá","oi","tchau","até mais"
];

export function isChitChat(msg: string) {
  
  const m = msg.toLowerCase().trim();
  return CHITCHAT.some(x => m.includes(x));
}

const TIME_PAT = /\b(\d{1,2})(?:[:h](\d{2}))?\s*(am|pm)?\b|\bàs?\s*\d{1,2}(\:\d{2})?\b/i;
const DATE_WORDS = ["hoje","amanhã","amanha","segunda","terça","terca","quarta","quinta","sexta","sábado","sabado","domingo"];
const MONEY_PAT = /\b(r\$ ?\d+([.,]\d{2})?|\d+([.,]\d{2})?\s*reais?)\b/i;

export function isNotificationFollowup(msg: string) {
  const m = msg.toLowerCase();
  const hasTime = TIME_PAT.test(m) || DATE_WORDS.some(w => m.includes(w));
  const hasSubject = /sobre\s+[\p{L}\s]+/u.test(m); // “sobre tomar café…”
  const hasMoney = MONEY_PAT.test(m);
  // ajuste como preferir: qualquer 2 sinais já valem follow-up
  const hits = [hasTime, hasSubject, hasMoney].filter(Boolean).length;
  return hits >= 1;
}
// ...

