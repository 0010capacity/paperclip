export type NormalizedAgentPermissions = Record<string, unknown> & {
  canCreateAgents: boolean;
  canProposeGoals: boolean;
  canProposeProjects: boolean;
  canProposeStrategy: boolean;
  canRequestBudget: boolean;
  canProposeHiring: boolean;
  canEscalate: boolean;
  canAdvisory: boolean;
};

export function defaultPermissionsForRole(role: string): NormalizedAgentPermissions {
  const isExecutive = ["ceo", "cto", "cmo", "cfo", "cso"].includes(role);
  const isManager = isExecutive || ["pm", "lead"].includes(role);

  return {
    canCreateAgents: role === "ceo",
    canProposeGoals: isManager,
    canProposeProjects: isManager,
    canProposeStrategy: isExecutive,
    canRequestBudget: true,
    canProposeHiring: isManager,
    canEscalate: true,
    canAdvisory: true,
  };
}

export function normalizeAgentPermissions(
  permissions: unknown,
  role: string,
): NormalizedAgentPermissions {
  const defaults = defaultPermissionsForRole(role);
  if (typeof permissions !== "object" || permissions === null || Array.isArray(permissions)) {
    return defaults;
  }

  const record = permissions as Record<string, unknown>;
  return {
    canCreateAgents:
      typeof record.canCreateAgents === "boolean"
        ? record.canCreateAgents
        : defaults.canCreateAgents,
    canProposeGoals:
      typeof record.canProposeGoals === "boolean"
        ? record.canProposeGoals
        : defaults.canProposeGoals,
    canProposeProjects:
      typeof record.canProposeProjects === "boolean"
        ? record.canProposeProjects
        : defaults.canProposeProjects,
    canProposeStrategy:
      typeof record.canProposeStrategy === "boolean"
        ? record.canProposeStrategy
        : defaults.canProposeStrategy,
    canRequestBudget:
      typeof record.canRequestBudget === "boolean"
        ? record.canRequestBudget
        : defaults.canRequestBudget,
    canProposeHiring:
      typeof record.canProposeHiring === "boolean"
        ? record.canProposeHiring
        : defaults.canProposeHiring,
    canEscalate:
      typeof record.canEscalate === "boolean"
        ? record.canEscalate
        : defaults.canEscalate,
    canAdvisory:
      typeof record.canAdvisory === "boolean"
        ? record.canAdvisory
        : defaults.canAdvisory,
  };
}
