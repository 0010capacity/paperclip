import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { MeetingMessage } from "../../api/meetings";

interface Agent {
  id: string;
  name: string;
  role: string;
}

interface Props {
  message: MeetingMessage;
  agent?: Agent;
  isCurrentUser?: boolean;
  onActionConfirm?: (messageId: string) => void;
  onActionReject?: (messageId: string) => void;
}

export function MeetingMessageItem({
  message,
  agent,
  onActionConfirm,
  onActionReject,
}: Props) {
  const { t } = useTranslation("components");
  const isUser = message.senderAgentId === null;
  const senderName = isUser ? t("meeting.me") : (agent?.name ?? t("meeting.unknown"));
  const senderRole = isUser ? "" : (agent?.role ?? "");

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <Avatar className="mt-0.5 h-8 w-8 shrink-0">
        <AvatarFallback className="bg-indigo-100 text-xs font-medium text-indigo-700">
          {isUser ? "U" : senderName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        {/* Sender name + time */}
        <div className="mb-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground">{senderName}</span>
          {senderRole && (
            <Badge variant="secondary" className="text-xs">
              {senderRole}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Message content */}
        <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>

        {/* Inline action (assistant action_request) */}
        {message.contentType === "action_request" && message.actionStatus === "pending" && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onActionConfirm?.(message.id)}
              className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600"
            >
              {t("meeting.approve")}
            </button>
            <button
              onClick={() => onActionReject?.(message.id)}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              {t("meeting.reject")}
            </button>
          </div>
        )}

        {message.contentType === "action_request" && message.actionStatus === "confirmed" && (
          <p className="mt-1 text-xs font-medium text-green-600">{t("meeting.approved")}</p>
        )}
        {message.contentType === "action_request" && message.actionStatus === "rejected" && (
          <p className="mt-1 text-xs font-medium text-red-500">{t("meeting.rejected")}</p>
        )}
      </div>
    </div>
  );
}
