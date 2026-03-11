import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { agentsApi } from "../../api/agents";
import { useCompany } from "../../context/CompanyContext";
import { queryKeys } from "../../lib/queryKeys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb } from "lucide-react";

// Role-based model recommendations
const ROLE_MODEL_RECOMMENDATIONS: Record<string, { model: string; provider: string }> = {
  ceo: { model: "claude-sonnet-4-6", provider: "anthropic" },
  cto: { model: "claude-sonnet-4-6", provider: "anthropic" },
  cmo: { model: "claude-sonnet-4-6", provider: "anthropic" },
  cfo: { model: "claude-sonnet-4-6", provider: "anthropic" },
  engineer: { model: "claude-sonnet-4-6", provider: "anthropic" },
  designer: { model: "claude-sonnet-4-6", provider: "anthropic" },
  pm: { model: "claude-sonnet-4-6", provider: "anthropic" },
  qa: { model: "claude-sonnet-4-6", provider: "anthropic" },
  devops: { model: "claude-sonnet-4-6", provider: "anthropic" },
  researcher: { model: "claude-opus-4-6", provider: "anthropic" },
  general: { model: "claude-sonnet-4-6", provider: "anthropic" },
};

export function getRoleModelRecommendation(role: string): { model: string; provider: string } | null {
  return ROLE_MODEL_RECOMMENDATIONS[role] ?? null;
}

interface Props {
  model: string;
  role?: string;
  onChange: (model: string) => void;
}

export function OpenCodeModelSelector({ model, role, onChange }: Props) {
  const { t } = useTranslation("components");
  const { selectedCompanyId } = useCompany();
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  const { data: models, isLoading, error } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(selectedCompanyId, "opencode_local")
      : ["agents", "none", "adapter-models", "opencode_local"],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, "opencode_local"),
    enabled: !!selectedCompanyId,
  });

  // Role-based recommendation
  const recommendation = role ? getRoleModelRecommendation(role) : null;

  // Apply role recommendation on initial load if no model selected
  useEffect(() => {
    if (role && !model && recommendation) {
      onChange(recommendation.model);
    }
  }, [role, model, recommendation, onChange]);

  // Group models by provider
  const providers = useMemo(() => {
    const grouped: Record<string, string[]> = {};
    for (const m of models ?? []) {
      const [provider, ...rest] = m.id.split("/");
      if (provider && rest.length > 0) {
        grouped[provider] = grouped[provider] ?? [];
        grouped[provider].push(m.id);
      }
    }
    return grouped;
  }, [models]);

  const providerList = Object.keys(providers);
  const currentProvider = model.split("/")[0] ?? selectedProvider;
  const modelList = providers[currentProvider] ?? [];

  if (isLoading) {
    return (
      <p className="animate-pulse text-sm text-muted-foreground">
        {t("model_selector.loading")}
      </p>
    );
  }

  if (error || providerList.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {t("model_selector.unavailable")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("model_selector.check_setup")}
        </p>
      </div>
    );
  }

  const handleApplyRecommendation = () => {
    if (recommendation) {
      onChange(recommendation.model);
    }
  };

  return (
    <div className="space-y-3">
      {/* Role recommendation badge */}
      {role && recommendation && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-700 dark:text-blue-400">
              <strong>{role}</strong> {t("model_selector.recommended")}{" "}
              <code className="font-mono">{recommendation.model}</code>
            </span>
          </div>
          <button
            onClick={handleApplyRecommendation}
            className="shrink-0 text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {t("model_selector.apply")}
          </button>
        </div>
      )}

      {/* Provider selection */}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t("model_selector.provider")}
        </label>
        <Select
          value={currentProvider}
          onValueChange={(v) => {
            setSelectedProvider(v);
            const firstModel = providers[v]?.[0];
            if (firstModel) onChange(firstModel);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("model_selector.select_provider")} />
          </SelectTrigger>
          <SelectContent>
            {providerList.map((p) => (
              <SelectItem key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model selection */}
      {currentProvider && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("model_selector.model")}
          </label>
          <Select value={model} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={t("model_selector.select_model")} />
            </SelectTrigger>
            <SelectContent>
              {modelList.map((m) => (
                <SelectItem key={m} value={m}>
                  {m.split("/").slice(1).join("/")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Selected model display */}
      {model && (
        <p className="text-xs text-muted-foreground">
          {t("model_selector.selected")}:{" "}
          <code className="font-mono text-primary">{model}</code>
        </p>
      )}
    </div>
  );
}
