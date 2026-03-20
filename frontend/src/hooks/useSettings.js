import React, { createContext, useContext, useState, useEffect } from "react";

const DEFAULTS = {
  userName: "Rajesh Rai",
  userDesignation: "Farm Owner",
  userInitials: "R",
  theme: "dark",
  maxResultsPerPage: 12,
  alertsShowAcked: false,
  compactMode: false,
};

const SettingsContext = createContext();

const STORAGE_KEY = "demeter_settings";

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  });

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings.theme]);

  const update = (key, value) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const reset = () => setSettings(DEFAULTS);

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
