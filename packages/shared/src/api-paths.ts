export const MEETING_API = {
  list: (companyId: string) => `/api/companies/${companyId}/meetings`,
  create: (companyId: string) => `/api/companies/${companyId}/meetings`,
  get: (meetingId: string) => `/api/meetings/${meetingId}`,
  conclude: (meetingId: string) => `/api/meetings/${meetingId}/conclude`,
  cancel: (meetingId: string) => `/api/meetings/${meetingId}`,
  messages: (meetingId: string) => `/api/meetings/${meetingId}/messages`,
  participants: (meetingId: string) =>
    `/api/meetings/${meetingId}/participants`,
} as const;

export const CHAT_API = {
  send: (companyId: string) => `/api/companies/${companyId}/chat`,
  list: (companyId: string) => `/api/companies/${companyId}/chat`,
  action: (messageId: string) => `/api/chat/${messageId}/action`,
} as const;

export const ADVISORY_API = {
  create: (companyId: string) => `/api/companies/${companyId}/advisories`,
  list: (companyId: string) => `/api/companies/${companyId}/advisories`,
  promote: (advisoryId: string) => `/api/advisories/${advisoryId}/promote`,
} as const;
