import { useTranslation } from "react-i18next";
import type { AgentStatus, AgentRole, AgentAdapterType } from "@paperclipai/shared";
import type { IssueStatus, IssuePriority } from "@paperclipai/shared";
import type { GoalStatus, GoalLevel } from "@paperclipai/shared";
import type { ProjectStatus } from "@paperclipai/shared";
import type { ApprovalStatus, ApprovalType } from "@paperclipai/shared";
import type { HeartbeatRunStatus } from "@paperclipai/shared";

/**
 * Hook for translating agent-related strings
 */
export function useAgentTranslation() {
  const { t } = useTranslation("status");

  return {
    status: (status: AgentStatus) => t(`agent.status.${status}`),
    role: (role: AgentRole) => t(`agent.role.${role}`),
    adapter: (adapter: AgentAdapterType) => t(`agent.adapter.${adapter}`),
  };
}

/**
 * Hook for translating issue-related strings
 */
export function useIssueTranslation() {
  const { t } = useTranslation("status");

  return {
    status: (status: IssueStatus) => t(`issue.status.${status}`),
    priority: (priority: IssuePriority) => t(`issue.priority.${priority}`),
  };
}

/**
 * Hook for translating goal-related strings
 */
export function useGoalTranslation() {
  const { t } = useTranslation("status");

  return {
    status: (status: GoalStatus) => t(`goal.status.${status}`),
    level: (level: GoalLevel) => t(`goal.level.${level}`),
  };
}

/**
 * Hook for translating project-related strings
 */
export function useProjectTranslation() {
  const { t } = useTranslation("status");

  return {
    status: (status: ProjectStatus) => t(`project.status.${status}`),
  };
}

/**
 * Hook for translating approval-related strings
 */
export function useApprovalTranslation() {
  const { t } = useTranslation("status");

  return {
    status: (status: ApprovalStatus) => t(`approval.status.${status}`),
    type: (type: ApprovalType) => t(`approval.type.${type}`),
  };
}

/**
 * Hook for translating heartbeat-related strings
 */
export function useHeartbeatTranslation() {
  const { t } = useTranslation("status");

  return {
    runStatus: (status: HeartbeatRunStatus) => t(`heartbeat.run_status.${status}`),
  };
}

/**
 * Hook for translating common UI strings
 */
export function useCommonTranslation() {
  const { t } = useTranslation("common");

  return {
    action: (key: string) => t(`actions.${key}`),
    state: (key: string) => t(`states.${key}`),
    label: (key: string) => t(`labels.${key}`),
    confirm: (key: string) => t(`confirmation.${key}`),
    error: (key: string) => t(`errors.${key}`),
    success: (key: string) => t(`success.${key}`),
    time: (key: string, options?: { count?: number }) => 
      t(`time.${key}`, options as Record<string, unknown>),
  };
}

/**
 * Hook for translating navigation strings
 */
export function useNavigationTranslation() {
  const { t } = useTranslation("navigation");

  return {
    sidebar: (key: string) => t(`sidebar.${key}`),
    page: (key: string) => t(`pages.${key}`),
    breadcrumb: (key: string) => t(`breadcrumbs.${key}`),
  };
}
