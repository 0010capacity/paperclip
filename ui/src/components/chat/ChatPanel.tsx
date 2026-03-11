import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot } from "lucide-react";
import { ChatMessageItem } from "./ChatMessage";
import { useChatMessages, useSendChatMessage, useResolveChatAction } from "../../hooks/useLiveEvents";
import type { ChatMessage } from "../../api/chat";

interface Props {
  companyId: string;
}

export function ChatPanel({ companyId }: Props) {
  const { t } = useTranslation("components");
  const { data: messages = [], isLoading } = useChatMessages();
  const sendMutation = useSendChatMessage();
  const resolveMutation = useResolveChatAction();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;

    setInput("");
    try {
      await sendMutation.mutateAsync(content);
    } catch (err) {
      console.error("Failed to send message:", err);
      setInput(content); // Restore input on failure
    }
  };

  const handleActionConfirm = async (messageId: string) => {
    await resolveMutation.mutateAsync({ messageId, decision: "confirmed" });
  };

  const handleActionReject = async (messageId: string) => {
    await resolveMutation.mutateAsync({ messageId, decision: "rejected" });
  };

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-muted">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{t("chat.assistant")}</p>
          <p className="text-xs text-muted-foreground">{t("chat.assistant_desc")}</p>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">{t("chat.empty")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(messages as ChatMessage[]).map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                onActionConfirm={handleActionConfirm}
                onActionReject={handleActionReject}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("chat.placeholder")}
            className="max-h-32 min-h-[40px] flex-1 resize-none"
            rows={1}
            disabled={sendMutation.isPending}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            size="sm"
          >
            {sendMutation.isPending ? "..." : t("chat.send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
