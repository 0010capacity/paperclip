import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatMessage as ChatMessageType } from "../../api/chat";

interface Props {
  message: ChatMessageType;
  onActionConfirm?: (messageId: string) => void;
  onActionReject?: (messageId: string) => void;
}

export function ChatMessageItem({ message, onActionConfirm, onActionReject }: Props) {
  const { t } = useTranslation("components");
  const isUser = message.senderType === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(
          "text-xs",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          {isUser ? "U" : "AI"}
        </AvatarFallback>
      </Avatar>

      {/* Message bubble */}
      <div className={cn("flex max-w-[70%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm"
          )}
        >
          {message.content}
        </div>

        {/* Inline action buttons (action_request messages) */}
        {message.contentType === "action_request" && message.actionStatus === "pending" && (
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => onActionConfirm?.(message.id)}
              className="rounded-full bg-green-500 px-3 py-1 text-xs text-white transition hover:bg-green-600"
            >
              {t("chat.approve")}
            </button>
            <button
              onClick={() => onActionReject?.(message.id)}
              className="rounded-full bg-red-100 px-3 py-1 text-xs text-red-600 transition hover:bg-red-200"
            >
              {t("chat.reject")}
            </button>
          </div>
        )}

        {/* Processed action status */}
        {message.contentType === "action_request" && message.actionStatus === "confirmed" && (
          <span className="text-xs text-green-600">{t("chat.approved")}</span>
        )}
        {message.contentType === "action_request" && message.actionStatus === "rejected" && (
          <span className="text-xs text-red-500">{t("chat.rejected")}</span>
        )}

        <span className="text-xs text-muted-foreground">
          {new Date(message.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
