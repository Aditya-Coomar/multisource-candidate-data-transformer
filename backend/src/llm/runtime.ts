import { config } from '../config/config';
import {
  type LLMDecisionEnvelope,
  type LLMExplanation,
  type LLMPolicyInput,
  type LLMStageName,
  type SemanticWarning,
} from './contracts';
import { LLMOrchestrator } from './orchestrator';

export type LLMRuntimePolicy = {
  readonly enabled: boolean;
  readonly mode: 'hybrid' | 'deterministic-only';
  readonly stages: readonly LLMStageName[];
  readonly strictGrounding: boolean;
  readonly maxLatencyMs: number;
  readonly includeExplanations: boolean;
  readonly onFailure: 'fallback' | 'hard-fail';
};

export type LLMRuntimeArtifacts = {
  readonly decisions: readonly LLMDecisionEnvelope[];
  readonly warnings: readonly SemanticWarning[];
  readonly explanations: readonly LLMExplanation[];
};

export class LLMRuntimeContext {
  private readonly decisions: LLMDecisionEnvelope[] = [];
  private readonly warnings: SemanticWarning[] = [];
  private readonly explanations: LLMExplanation[] = [];

  constructor(
    public readonly policy: LLMRuntimePolicy,
    public readonly orchestrator = new LLMOrchestrator(),
  ) {}

  isEnabledFor(stage: LLMStageName): boolean {
    return (
      this.policy.enabled &&
      this.policy.mode !== 'deterministic-only' &&
      this.policy.stages.includes(stage) &&
      this.orchestrator.isAvailable()
    );
  }

  recordDecision(decision: LLMDecisionEnvelope): void {
    this.decisions.push(decision);
  }

  recordWarning(warning: SemanticWarning): void {
    this.warnings.push(warning);
  }

  recordExplanation(explanation: LLMExplanation): void {
    if (this.policy.includeExplanations) {
      this.explanations.push(explanation);
    }
  }

  getArtifacts(): LLMRuntimeArtifacts {
    return Object.freeze({
      decisions: Object.freeze([...this.decisions]),
      warnings: Object.freeze([...this.warnings]),
      explanations: Object.freeze([...this.explanations]),
    });
  }
}

export function createLlmRuntimeContext(
  input: LLMPolicyInput | undefined,
): LLMRuntimeContext {
  return new LLMRuntimeContext({
    enabled: input?.enabled ?? config.llm.enabled,
    mode: input?.mode ?? config.llm.mode,
    stages: input?.stages ?? config.llm.stages,
    strictGrounding: input?.strictGrounding ?? config.llm.strictGrounding,
    maxLatencyMs: input?.maxLatencyMs ?? config.llm.timeoutMs,
    includeExplanations:
      input?.includeExplanations ?? config.llm.includeExplanations,
    onFailure: input?.onLlmFailure ?? config.llm.onFailure,
  });
}
