/// <reference types="vite/client" />

declare module "virtual:i18next-loader" {
  const resources: import("i18next").Resource;
  export default resources;
}
