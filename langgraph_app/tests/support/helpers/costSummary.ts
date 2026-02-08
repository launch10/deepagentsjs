/**
 * Log a formatted cost breakdown for usage records.
 * Shows token counts with actual per-model rates from the billing config.
 */

interface UsageRow {
  modelRaw?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  costMillicredits?: number | null;
}

interface Rates {
  input: number;
  output: number;
  reasoning: number;
  cacheReads: number;
  cacheCreation: number;
}

/**
 * Known model rates ($/M tokens) — mirrors Rails model_configs.
 * Only used for display; actual billing uses DB-stored costMillicredits.
 */
const MODEL_RATES: Record<string, Rates> = {
  "claude-haiku-4-5": {
    input: 1.0,
    output: 5.0,
    reasoning: 5.0,
    cacheReads: 0.1,
    cacheCreation: 2.0,
  },
  "claude-sonnet-4-5": {
    input: 3.0,
    output: 15.0,
    reasoning: 15.0,
    cacheReads: 0.3,
    cacheCreation: 6.0,
  },
  "claude-opus-4-6": {
    input: 15.0,
    output: 75.0,
    reasoning: 75.0,
    cacheReads: 1.5,
    cacheCreation: 18.75,
  },
};

function getRates(records: UsageRow[]): { rates: Rates; modelName: string } | null {
  // Find the dominant model (most records)
  const counts = new Map<string, number>();
  for (const r of records) {
    const model = r.modelRaw;
    if (model) {
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
  }

  if (counts.size === 0) return null;

  // Sort by count descending, pick the most common
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];

  // Try exact match first, then prefix match
  const rates = MODEL_RATES[dominant] ??
    Object.entries(MODEL_RATES).find(([key]) => dominant.startsWith(key))?.[1];

  return rates ? { rates, modelName: dominant } : null;
}

function mc(tokens: number, rate: number): number {
  return Math.round((tokens * rate) / 10);
}

function sum(records: UsageRow[], field: keyof UsageRow): number {
  return records.reduce((s, r) => s + ((r[field] as number) ?? 0), 0);
}

function pad(n: number, width: number = 10): string {
  return n.toLocaleString().padStart(width);
}

export function logCostSummary(label: string, records: UsageRow[]): void {
  const input = sum(records, "inputTokens");
  const output = sum(records, "outputTokens");
  const reasoning = sum(records, "reasoningTokens");
  const cacheReads = sum(records, "cacheReadTokens");
  const cacheCreation = sum(records, "cacheCreationTokens");
  const totalCost = sum(records, "costMillicredits");
  const totalDollars = totalCost / 100_000;

  const rateInfo = getRates(records);

  const lines = [`\n=== ${label} ===`, `LLM calls: ${records.length}`];

  if (rateInfo) {
    const { rates, modelName } = rateInfo;
    lines.push(`Model: ${modelName}`);
    lines.push(
      `Input:          ${pad(input)} tokens × $${rates.input.toFixed(2)}/M  = ${pad(mc(input, rates.input), 8)} mc`
    );
    lines.push(
      `Output:         ${pad(output)} tokens × $${rates.output.toFixed(2)}/M = ${pad(mc(output, rates.output), 8)} mc`
    );
    if (reasoning > 0) {
      lines.push(
        `Reasoning:      ${pad(reasoning)} tokens × $${rates.reasoning.toFixed(2)}/M = ${pad(mc(reasoning, rates.reasoning), 8)} mc`
      );
    }
    lines.push(
      `Cache reads:    ${pad(cacheReads)} tokens × $${rates.cacheReads.toFixed(2)}/M  = ${pad(mc(cacheReads, rates.cacheReads), 8)} mc`
    );
    lines.push(
      `Cache creation: ${pad(cacheCreation)} tokens × $${rates.cacheCreation.toFixed(2)}/M  = ${pad(mc(cacheCreation, rates.cacheCreation), 8)} mc`
    );
  } else {
    lines.push(
      `Input:          ${pad(input)} tokens`,
      `Output:         ${pad(output)} tokens`
    );
    if (reasoning > 0) {
      lines.push(`Reasoning:      ${pad(reasoning)} tokens`);
    }
    lines.push(
      `Cache reads:    ${pad(cacheReads)} tokens`,
      `Cache creation: ${pad(cacheCreation)} tokens`
    );
  }

  lines.push(
    `Total: ${totalCost.toLocaleString()} millicredits = $${totalDollars.toFixed(4)}`,
    `${"=".repeat(label.length + 8)}\n`
  );

  console.log(lines.join("\n"));
}
