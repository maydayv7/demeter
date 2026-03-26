import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { FarmDataProvider } from "./hooks/useFarmData";
import { SettingsProvider } from "./hooks/useSettings";
import { useSettings } from "./hooks/useSettings";

import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import CropDetails from "./pages/CropDetails";
import AddCrop from "./pages/AddCrop";
import FarmIntelligence from "./pages/FarmIntelligence";
import Analytics from "./pages/Analytics";
import Alerts from "./pages/Alerts";
import SettingsPage from "./pages/Settings";
import Help from "./pages/Help";
import Onboarding from "./components/Onboarding";

function AppInner() {
  const { settings, update } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!settings.onboardingDone) {
      // Small delay so the page renders first
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, [settings.onboardingDone]);

  return (
    <>
      <Router>
        {showOnboarding && (
          <Onboarding
            onDone={() => {
              update("onboardingDone", true);
              setShowOnboarding(false);
            }}
          />
        )}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/crop/:cropId" element={<CropDetails />} />
          <Route path="/add-crop" element={<AddCrop />} />
          <Route path="/intelligence" element={<FarmIntelligence />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </Router>
    </>
  );
}

function App() {
  return (
    <SettingsProvider>
      <FarmDataProvider>
        <AppInner />
      </FarmDataProvider>
    </SettingsProvider>
  );
}

export default App;
