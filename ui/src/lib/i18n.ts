import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files directly
import enCommon from "../locales/en/common.json";
import enNavigation from "../locales/en/navigation.json";
import enStatus from "../locales/en/status.json";
import enForms from "../locales/en/forms.json";
import enPages from "../locales/en/pages.json";
import enComponents from "../locales/en/components.json";
import enErrors from "../locales/en/errors.json";

import koCommon from "../locales/ko/common.json";
import koNavigation from "../locales/ko/navigation.json";
import koStatus from "../locales/ko/status.json";
import koForms from "../locales/ko/forms.json";
import koPages from "../locales/ko/pages.json";
import koComponents from "../locales/ko/components.json";
import koErrors from "../locales/ko/errors.json";

const resources = {
  en: {
    common: enCommon,
    navigation: enNavigation,
    status: enStatus,
    forms: enForms,
    pages: enPages,
    components: enComponents,
    errors: enErrors,
  },
  ko: {
    common: koCommon,
    navigation: koNavigation,
    status: koStatus,
    forms: koForms,
    pages: koPages,
    components: koComponents,
    errors: koErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "ko"],
    defaultNS: "common",
    ns: [
      "common",
      "navigation",
      "status",
      "forms",
      "pages",
      "components",
      "errors",
    ],

    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "paperclip.language",
      caches: ["localStorage"],
    },

    interpolation: {
      escapeValue: false, // React already escapes
      format: (value, format, lng) => {
        if (format === "date" && value instanceof Date) {
          // Korean: YYYY-MM-DD, English: MM/DD/YYYY
          return lng === "ko"
            ? value.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
            : value.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
        }
        if (format === "datetime" && value instanceof Date) {
          return lng === "ko"
            ? value.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
            : value.toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        }
        return value;
      },
    },

    react: {
      useSuspense: true,
    },
  });

export default i18n;
