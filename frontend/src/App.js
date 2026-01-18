// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard'; // This is your existing QdrantManager component
import CropDetails from './pages/CropDetails';

function App() {
  return (
    <Router>
      <Routes>
        {/* The Landing Page from your design */}
        <Route path="/" element={<LandingPage />} />
        
        {/* The Dashboard (The CRUD functionality we built previously) */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crop/:cropId" element={<CropDetails />} />
      </Routes>
    </Router>
  );
}

export default App;