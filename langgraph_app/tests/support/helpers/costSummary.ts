/**
 * Log a formatted cost breakdown for usage records.
 * Makes the per-token-type math transparent so you can verify costs at a glance.
 */

interface UsageRow {
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  cacheReadTokens?: number | null;
  cacheCreationTokens?: number | null;
  costMillicredits?: number | null;
}

// Sonnet rates ($/M tokens) — update if default model changes
const RATES = {
  input: 3.0,
  output: 15.0,
  reasoning: 15.0,
  cacheReads: 0.3,
  cacheCreation: 6.0,
};

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

  const lines = [
    `\n=== ${label} ===`,
    `LLM calls: ${records.length}`,
    `Input:          ${pad(input)} tokens × $${RATES.input.toFixed(2)}/M  = ${pad(mc(input, RATES.input), 8)} mc`,
    `Output:         ${pad(output)} tokens × $${RATES.output.toFixed(2)}/M = ${pad(mc(output, RATES.output), 8)} mc`,
  ];

  if (reasoning > 0) {
    lines.push(
      `Reasoning:      ${pad(reasoning)} tokens × $${RATES.reasoning.toFixed(2)}/M = ${pad(mc(reasoning, RATES.reasoning), 8)} mc`
    );
  }

  lines.push(
    `Cache reads:    ${pad(cacheReads)} tokens × $${RATES.cacheReads.toFixed(2)}/M  = ${pad(mc(cacheReads, RATES.cacheReads), 8)} mc`,
    `Cache creation: ${pad(cacheCreation)} tokens × $${RATES.cacheCreation.toFixed(2)}/M  = ${pad(mc(cacheCreation, RATES.cacheCreation), 8)} mc`,
    `Total: ${totalCost.toLocaleString()} millicredits = $${totalDollars.toFixed(4)}`,
    `${"=".repeat(label.length + 8)}\n`
  );

  console.log(lines.join("\n"));
}
