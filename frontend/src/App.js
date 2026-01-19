import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import CropDetails from './pages/CropDetails';
import AgentControl from './pages/AgentControl';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public "Web" Landing Page */}
        <Route path="/" element={<LandingPage />} />
        
        {/* The "Brain" Control Panel (Python Agent) */}
        <Route path="/control" element={<AgentControl />} />

        {/* The "CRUD" Dashboard (Node.js Backend) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crop/:cropId" element={<CropDetails />} />
      </Routes>
    </Router>
  );
}

export default App;