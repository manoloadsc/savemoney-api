// utils/textFocus.ts

const SENT_SPLIT = /[.!?\n\r;]+/g;

// sinais por intenção
const CREATE_KW = ["comprei","gastei","paguei","recebi","ganhei","lançar","adicionar","registrar","criar","custou","pix","boleto"];
const NOTIFY_KW = ["notificação","notificacao","lembre","lembrar","me lembre","alarme","aviso","alerta","notificar"];
const LIST_KW   = ["listar","mostrar","ver","consultar","extrato","lançamentos","lancamentos","transações","transacoes"];

const MONEY_RE = /\b(r\$ ?\d{1,3}(\.\d{3})*(,\d{2})?|\d+[.,]?\d*\s*reais?)\b/i;
const TIME_RE  = /\b(\d{1,2})(:\d{2})?\s*(h|horas?)?\b/iu;
const DATE_WORDS = ["hoje","amanhã","amanha","ontem","segunda","terça","terca","quarta","quinta","sexta","sábado","sabado","domingo"];

export function extractFocusText(input: string): { focus: string; signals: Record<string, boolean> } {
  const raw = input.trim();

  // 1) explode em "frases" curtas
  const parts = raw.split(SENT_SPLIT)
    .map(s => s.trim())
    .filter(s => s.length >= 6);

  // 2) pontua cada frase por sinais
  const scored = parts.map(s => {
    const lower = s.toLowerCase();
    const money = MONEY_RE.test(lower);
    const time  = TIME_RE.test(lower) || DATE_WORDS.some(w => lower.includes(w));
    const hasCreate = CREATE_KW.some(k => lower.includes(k));
    const hasNotify = NOTIFY_KW.some(k => lower.includes(k));
    const hasList   = LIST_KW.some(k => lower.includes(k));

    // score simples (ajuste se quiser): prioriza frases com valor/tempo + verbo
    let score = 0;
    if (money) score += 1.1;
    if (time) score += 0.9;
    if (hasCreate) score += 1.0;
    if (hasNotify) score += 1.0;
    if (hasList) score += 0.6;

    return { text: s, score, money, time, hasCreate, hasNotify, hasList };
  }).sort((a,b)=> b.score - a.score);

  let focus = raw;
  let signals = { money:false, time:false, hasCreate:false, hasNotify:false, hasList:false };

  if (scored.length) {
    // junta top-2 frases mais relevantes (mantendo curto)
    const top = scored.slice(0, 2);
    focus = top.map(t => t.text).join(". ");
    const agg = top.reduce((acc, t) => ({
      money: acc.money || t.money,
      time: acc.time || t.time,
      hasCreate: acc.hasCreate || t.hasCreate,
      hasNotify: acc.hasNotify || t.hasNotify,
      hasList: acc.hasList || t.hasList
    }), signals);
    signals = agg;
  } else {
    // fallback: corta em ~300 chars
    focus = raw.slice(0, 300);
  }

  return { focus, signals };
}

// helpers públicos para o roteador
export const hasCreateSignal = (s: Record<string, boolean>) => s.hasCreate || s.money;
export const hasNotifySignal = (s: Record<string, boolean>) => s.hasNotify || s.time;
export const hasListSignal   = (s: Record<string, boolean>) => s.hasList;
