import { api } from "./client";

// Types - these will be moved to @paperclipai/shared by Agent 3
export interface AdvisoryEntry {
  id: string;
  companyId: string;
  agentId: string;
  action: string;
  details: string;
  createdAt: string;
}

export const advisoriesApi = {
  list: (companyId: string) =>
    api.get<AdvisoryEntry[]>(`/companies/${companyId}/advisories`),

  promote: (advisoryId: string) =>
    api.post<void>(`/advisories/${advisoryId}/promote`, {}),
};
