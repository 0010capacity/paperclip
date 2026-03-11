import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, MessageSquare } from "lucide-react";
import { meetingsApi, agentsApi, type Meeting, type CreateMeetingInput } from "../api";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { PageSkeleton } from "../components/PageSkeleton";
import { MeetingRoom } from "../components/meeting";
import { EmptyState } from "../components/EmptyState";

type FilterType = "all" | "sync" | "async" | "active";

export function Meetings() {
  const { t } = useTranslation("pages");
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    setBreadcrumbs([{ label: t("meetings.title") }]);
  }, [setBreadcrumbs, t]);

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: queryKeys.meetings.list(selectedCompanyId!),
    queryFn: () => meetingsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const filtered = meetings.filter((m) => {
    if (filter === "sync") return m.type === "sync";
    if (filter === "async") return m.type === "async";
    if (filter === "active") return m.status === "in_progress" || m.status === "scheduled";
    return true;
  });

  const handleCreated = (meeting: Meeting) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.list(selectedCompanyId!) });
    setSelected(meeting);
    setShowCreateModal(false);
  };

  const handleConcluded = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.meetings.list(selectedCompanyId!) });
  };

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={MessageSquare}
        message={t("common.select_company")}
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Sidebar: Meeting list */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="border-b p-4">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-semibold text-foreground">{t("meetings.title")}</h1>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t("meetings.new")}
            </Button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1">
            {(["all", "active", "sync", "async"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-xs transition",
                  filter === f
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t(`meetings.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {t("meetings.empty")}
            </p>
          )}
          {filtered.map((meeting) => (
            <button
              key={meeting.id}
              onClick={() => setSelected(meeting)}
              className={cn(
                "w-full border-b px-4 py-3 text-left transition hover:bg-muted/50",
                selected?.id === meeting.id && "bg-muted"
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    meeting.status === "in_progress"
                      ? "bg-green-400"
                      : meeting.status === "concluded"
                        ? "bg-muted-foreground"
                        : "bg-yellow-400"
                  )}
                />
                <span className="truncate text-sm font-medium text-foreground">
                  {meeting.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {meeting.type === "sync" ? t("meetings.sync") : t("meetings.async")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(meeting.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: Selected meeting detail */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <MeetingRoom
            meeting={selected}
            agents={agents}
            onConcluded={handleConcluded}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">{t("meetings.select")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Create meeting modal */}
      {showCreateModal && (
        <CreateMeetingModal
          companyId={selectedCompanyId}
          agents={agents}
          onCreated={handleCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function CreateMeetingModal({
  companyId,
  agents,
  onCreated,
  onClose,
}: {
  companyId: string;
  agents: { id: string; name: string; role: string }[];
  onCreated: (meeting: Meeting) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("pages");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"sync" | "async">("sync");
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: CreateMeetingInput) => meetingsApi.create(companyId, data),
    onSuccess: (meeting) => {
      onCreated(meeting);
    },
    onError: () => {
      setError(t("meetings.create_error"));
    },
  });

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleCreate = () => {
    setError("");
    if (!title.trim()) {
      setError(t("meetings.title_required"));
      return;
    }
    if (selectedAgentIds.length === 0) {
      setError(t("meetings.agents_required"));
      return;
    }

    createMutation.mutate({
      title,
      type,
      participantAgentIds: selectedAgentIds,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("meetings.create_title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("meetings.label_title")}
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("meetings.title_placeholder")}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("meetings.label_type")}
            </label>
            <div className="flex gap-2">
              {(["sync", "async"] as const).map((meetingType) => (
                <button
                  key={meetingType}
                  onClick={() => setType(meetingType)}
                  className={cn(
                    "flex-1 rounded-lg border py-2 text-sm transition",
                    type === meetingType
                      ? "border-primary bg-primary/5 font-medium text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {meetingType === "sync" ? t("meetings.sync_label") : t("meetings.async_label")}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {type === "sync"
                ? t("meetings.sync_desc")
                : t("meetings.async_desc")}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("meetings.label_agents")}
            </label>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedAgentIds.includes(agent.id)}
                    onCheckedChange={() => toggleAgent(agent.id)}
                  />
                  <span className="text-sm text-foreground">{agent.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {agent.role}
                  </Badge>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? "..." : t("meetings.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
