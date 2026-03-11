import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChatPanel } from "../components/chat/ChatPanel";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";

export function Chat() {
  const { t } = useTranslation("pages");
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: t("chat.title") }]);
  }, [setBreadcrumbs, t]);

  if (!selectedCompanyId) {
    return (
      <div className="flex h-[calc(100vh-120px)] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.select_company")}</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)]">
      <ChatPanel companyId={selectedCompanyId} />
    </div>
  );
}
