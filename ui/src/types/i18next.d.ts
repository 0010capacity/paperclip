import "react-i18next";
import type common from "../locales/en/common.json";
import type navigation from "../locales/en/navigation.json";
import type status from "../locales/en/status.json";
import type forms from "../locales/en/forms.json";
import type pages from "../locales/en/pages.json";
import type components from "../locales/en/components.json";
import type errors from "../locales/en/errors.json";

declare module "react-i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof common;
      navigation: typeof navigation;
      status: typeof status;
      forms: typeof forms;
      pages: typeof pages;
      components: typeof components;
      errors: typeof errors;
    };
  }
}

declare module "virtual:i18next-loader" {
  const resources: import("i18next").Resource;
  export default resources;
}
