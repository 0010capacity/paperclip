import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resources from "virtual:i18next-loader";

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
