/**
 * A model provider just needs to take a prompt and return whatever raw
 * object the model produced for the emit_card tool call — or null if the
 * call failed outright (network/auth error, no tool call returned). All
 * validation/retry/truncation logic lives in the shared orchestrator
 * (../summarize.ts), not per-provider.
 */
export interface ModelProvider {
  name: string;
  callForCard(prompt: string): Promise<Record<string, unknown> | null>;
}
