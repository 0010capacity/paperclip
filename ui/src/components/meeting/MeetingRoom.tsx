import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MeetingMessageItem } from "./MeetingMessage";
import { useMeetingMessages, useConcludeMeeting, useSendMeetingMessage } from "../../hooks/useLiveEvents";
import type { Meeting } from "../../api/meetings";

interface Agent {
  id: string;
  name: string;
  role: string;
}

interface Props {
  meeting: Meeting;
  agents: Agent[];
  onConcluded?: () => void;
}

export function MeetingRoom({ meeting, agents, onConcluded }: Props) {
  const { t } = useTranslation("components");
  const { data: messages = [], isLoading } = useMeetingMessages(meeting.id);
  const concludeMutation = useConcludeMeeting();
  const sendMutation = useSendMeetingMessage();
  const [input, setInput] = useState("");
  const [showConcludeModal, setShowConcludeModal] = useState(false);
  const [summary, setSummary] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;

    setInput("");
    try {
      await sendMutation.mutateAsync({
        meetingId: meeting.id,
        content,
        contentType: "text",
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      setInput(content);
    }
  };

  const handleConclude = async () => {
    if (!summary.trim()) return;
    try {
      await concludeMutation.mutateAsync({ meetingId: meeting.id, summary });
      setShowConcludeModal(false);
      onConcluded?.();
    } catch (err) {
      console.error("Failed to conclude meeting:", err);
    }
  };

  const isActive = meeting.status === "in_progress" || meeting.status === "scheduled";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Meeting room header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            {meeting.status === "in_progress" && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            )}
            <h2 className="font-semibold text-foreground">{meeting.title}</h2>
            <Badge variant={meeting.type === "sync" ? "default" : "secondary"}>
              {meeting.type === "sync" ? t("meeting.sync") : t("meeting.async")}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("meeting.participants", { count: agents.length })}
          </p>
        </div>

        {isActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConcludeModal(true)}
          >
            {t("meeting.end")}
          </Button>
        )}

        {meeting.status === "concluded" && (
          <Badge variant="outline">{t("meeting.ended")}</Badge>
        )}
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">{t("meeting.empty")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg) => (
              <MeetingMessageItem
                key={msg.id}
                message={msg}
                agent={msg.senderAgentId ? agentMap[msg.senderAgentId] : undefined}
                isCurrentUser={msg.senderAgentId === null}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Summary (if concluded) */}
      {meeting.status === "concluded" && meeting.summary && (
        <div className="mx-4 mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="mb-1 text-xs font-semibold text-blue-700">{t("meeting.notes")}</p>
          <p className="whitespace-pre-wrap text-sm text-blue-900">{meeting.summary}</p>
        </div>
      )}

      {/* Input area (active meetings only) */}
      {isActive && (
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
              placeholder={t("meeting.placeholder")}
              className="max-h-32 min-h-[40px] flex-1 resize-none"
              rows={1}
              disabled={sendMutation.isPending}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              size="sm"
            >
              {sendMutation.isPending ? "..." : t("meeting.send")}
            </Button>
          </div>
        </div>
      )}

      {/* Conclude modal */}
      <Dialog open={showConcludeModal} onOpenChange={setShowConcludeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("meeting.end_title")}</DialogTitle>
            <DialogDescription>{t("meeting.end_desc")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("meeting.summary_placeholder")}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConcludeModal(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleConclude}
              disabled={!summary.trim() || concludeMutation.isPending}
            >
              {concludeMutation.isPending ? "..." : t("meeting.end_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
