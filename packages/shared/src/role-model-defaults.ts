export interface RoleModelDefault {
  adapter: string;
  model: string;
}

// V1 기본 역할
export const ROLE_MODEL_DEFAULTS: Record<string, RoleModelDefault> = {
  ceo: { adapter: "opencode_local", model: "anthropic/claude-opus-4" },
  cto: { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  cfo: { adapter: "opencode_local", model: "openai/gpt-4o" },
  cmo: { adapter: "opencode_local", model: "google/gemini-pro" },
  developer: { adapter: "opencode_local", model: "zai/zai-coding" },
  marketing: { adapter: "opencode_local", model: "google/gemini-flash" },
  support: { adapter: "opencode_local", model: "openai/gpt-4o-mini" },

  // Phase 2 신규 — 전략 부서 역할
  cso: { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  futures_researcher: { adapter: "opencode_local", model: "anthropic/claude-sonnet-4" },
  business_analyst: { adapter: "opencode_local", model: "openai/gpt-4o" },
};

/**
 * 역할에 대한 기본 모델 설정을 반환한다.
 * 알 수 없는 역할이면 undefined를 반환한다.
 */
export function getDefaultModelForRole(
  role: string,
): RoleModelDefault | undefined {
  return ROLE_MODEL_DEFAULTS[role.toLowerCase()];
}
