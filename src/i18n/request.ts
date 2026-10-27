import { getRequestConfig } from "next-intl/server";

import { defaultLocale, timeZone } from "./config";

// Single-locale setup without i18n routing: German only for now, but every
// UI string lives in messages/<locale>.json so English can follow later.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
