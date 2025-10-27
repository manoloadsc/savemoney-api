import { ChatCompletionMessageFunctionToolCall } from "openai/resources";

export type ToolCall = ChatCompletionMessageFunctionToolCall & {
  id?: string; // alguns providers usam id aqui
};

export function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const walk = (v: any): any => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v)) return "[[Circular]]";
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const obj: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) obj[k] = walk(v[k]);
    return obj;
  };
  return JSON.stringify(walk(value));
}

export function makeSignature(name: string, rawArgs: unknown): string {
  let args = rawArgs;
  try { if (typeof rawArgs === "string") args = JSON.parse(rawArgs); } catch {}
  return `${name}:${stableStringify(args)}`;
}

function extractArgs(tc: ToolCall): { name: string; args: unknown } | null {
  if (tc.function?.name) {
    let parsed: unknown = tc.function.arguments as unknown;
    try {
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
    } catch {}
    return { name: tc.function.name, args: parsed };
  }
  // fallback pra casos { name, properties }
  if ((tc as any).name && (tc as any).properties) {
    return { name: (tc as any).name, args: (tc as any).properties };
  }
  return null;
}

/**
 * Remove duplicatas de tool calls.
 * Duplicata = mesmo name + mesmos args normalizados.
 * Mantém só a primeira ocorrência.
 */
export function dedupeToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  const seenIds = new Set<string>();
  const seenSig = new Set<string>();
  const out: ToolCall[] = [];

  for (const tc of toolCalls) {
    const id = (tc.id ?? (tc as any).tool_call_id) as string | undefined;
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);

    const ex = extractArgs(tc);
    if (!ex) continue;

    const sig = makeSignature(ex.name, ex.args);
    if (seenSig.has(sig)) continue;
    seenSig.add(sig);

    out.push(tc);
  }
  return out;
}
