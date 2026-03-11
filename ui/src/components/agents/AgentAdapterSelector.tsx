import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AGENT_ADAPTER_TYPES } from "@paperclipai/shared";
import {
  Bot,
  Terminal,
  Globe,
  Code,
  Zap,
} from "lucide-react";
import { OpenCodeLogoIcon } from "../OpenCodeLogoIcon";

interface Props {
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}

const ADAPTER_OPTIONS = [
  {
    value: "claude_local",
    label: "Claude Code (Local)",
    description: "Local Claude Code CLI execution",
    icon: Bot,
  },
  {
    value: "opencode_local",
    label: "OpenCode",
    description: "Multi-provider support (Anthropic, OpenAI, Google, Zai)",
    icon: OpenCodeLogoIcon,
  },
  {
    value: "codex_local",
    label: "Codex (OpenAI)",
    description: "OpenAI Codex local execution",
    icon: Code,
  },
  {
    value: "cursor",
    label: "Cursor",
    description: "Cursor local execution",
    icon: Zap,
  },
  {
    value: "process",
    label: "Process (Shell)",
    description: "Execute shell scripts",
    icon: Terminal,
  },
  {
    value: "http",
    label: "HTTP",
    description: "External HTTP endpoint",
    icon: Globe,
  },
] as const;

const VALID_ADAPTER_TYPES = new Set(AGENT_ADAPTER_TYPES);

export function AgentAdapterSelector({ adapterType, adapterConfig, onChange }: Props) {
  const { t } = useTranslation("components");

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {t("adapter_selector.title")}
      </label>
      <div className="space-y-2">
        {ADAPTER_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = adapterType === opt.value;
          const isDisabled = !VALID_ADAPTER_TYPES.has(opt.value as typeof AGENT_ADAPTER_TYPES[number]);

          return (
            <button
              key={opt.value}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(opt.value, {})}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
                isDisabled && "opacity-50 cursor-not-allowed",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "shrink-0 rounded-md p-2",
                isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              {isSelected && (
                <div className="shrink-0 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                  <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
