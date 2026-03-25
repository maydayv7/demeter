import { useCallback } from "react";
import { useSettings } from "./useSettings";
import { translate, translateDynamic } from "../utils/translations";

// Returns a translation helper bound to the current language setting
export function useT() {
  const { settings } = useSettings();
  const lang = settings.language || "en";

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const td = useCallback((text) => translateDynamic(text, lang), [lang]);

  return { t, td, lang };
}
