import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Leaf, 
  Database, 
  Moon, 
  Zap, 
  Droplet, 
  Cpu, 
  Building2, 
  Activity, 
  Rocket, 
  BrainCircuit 
} from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    // CHANGE 1: h-screen and max-h-screen forces one page, no scrolling.
    <div className="h-screen max-h-screen relative font-sans text-gray-800 overflow-hidden flex flex-col">
      
      {/* BACKGROUND IMAGE LAYER */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          // CHANGE 2: Referencing the file directly from the public folder
          backgroundImage: "url('/background.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* White Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent/30"></div>
      </div>

      {/* --- NAVBAR --- */}
      {/* Reduced vertical padding (py-4) to save space */}
      <nav className="relative z-10 flex-none flex items-center justify-between px-8 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500 p-2 rounded-lg text-white">
            <Leaf size={24} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Demeter</h1>
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">Agentic Cultivating AI</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-emerald-100/80 backdrop-blur-sm border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            SYSTEM ONLINE
          </div>
          
          <div className="hidden md:flex items-center gap-2 bg-blue-100/80 backdrop-blur-sm border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold text-blue-800">
            <Database size={12} />
            QDRANT CONNECTED
          </div>

          <button className="p-2 rounded-full bg-gray-100/50 hover:bg-gray-200/50 backdrop-blur-md transition">
            <Moon size={20} className="text-gray-600" />
          </button>
        </div>
      </nav>

      {/* --- MAIN CONTENT --- */}
      {/* flex-1 ensures this takes up remaining height, grid centers vertically */}
      <main className="relative z-10 flex-1 container mx-auto px-8 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full">
        
        {/* LEFT COLUMN: Text & Features */}
        <div className="space-y-6 animate-fade-in-up">
          
          {/* Version Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-50/80 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
            <Zap size={12} fill="currentColor" />
            Autonomous Agriculture v2.0
          </div>

          {/* Headlines - Slightly tighter leading */}
          <div className="space-y-1">
            <h1 className="text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight">
              The Future of <br />
              <span className="text-emerald-500">Farming</span> is Here.
            </h1>
            <p className="text-xl text-gray-600 font-light">
              Smarter, Faster, Sustainable.
            </p>
          </div>

          {/* Feature List - Compact Grid for fitting screen */}
          <div className="grid grid-cols-1 gap-3 pr-4">
            <FeatureItem 
              icon={<Zap className="text-emerald-600" size={18} />} 
              title="Higher Yields" 
              desc="Up to 10x more produce with accelerated cycles." 
            />
            <FeatureItem 
              icon={<Droplet className="text-blue-500" size={18} />} 
              title="Resource Efficient" 
              desc="90% less water, zero soil erosion." 
            />
            <FeatureItem 
              icon={<Cpu className="text-teal-600" size={18} />} 
              title="AI-Driven Precision" 
              desc="Agentic agents optimize climate in real-time." 
            />
            <FeatureItem 
              icon={<Activity className="text-purple-600" size={18} />} 
              title="Data-Powered Insights" 
              desc="Instant anomaly detection via Vector Search." 
            />
          </div>

          {/* CTA Button */}
          <div className="pt-2">
            <button 
              onClick={() => navigate('/dashboard')}
              className="group flex items-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold px-8 py-3 rounded-full shadow-lg shadow-emerald-500/30 transition-all transform hover:-translate-y-1"
            >
              <Rocket size={20} className="group-hover:rotate-12 transition-transform" />
              Try Demeter Now
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Visual HUD Elements */}
        {/* Centered and scaled to fit without scrolling */}
        <div className="hidden lg:flex relative h-full justify-center items-center scale-90 origin-center">
          
          {/* Circular Radar Overlay */}
          <div className="absolute w-[450px] h-[450px] border border-emerald-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
          <div className="absolute w-[300px] h-[300px] border border-emerald-500/40 rounded-full border-dashed animate-[spin_15s_linear_infinite_reverse]"></div>
          
          {/* Central AI Brain Node */}
          <div className="relative z-20 w-24 h-24 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center shadow-xl border border-white/50">
            <BrainCircuit size={48} className="text-white drop-shadow-md" />
          </div>

          {/* Floating Data Cards */}
          <div className="absolute top-[20%] right-[10%] bg-white/80 backdrop-blur-sm border border-emerald-100 p-3 rounded-lg shadow-lg flex items-center gap-3 animate-bounce-slow">
            <div className="h-2 w-2 bg-emerald-500 rounded-full"></div>
            <span className="text-sm font-mono text-emerald-800 font-bold">pH: Optimal</span>
          </div>

          <div className="absolute bottom-[25%] right-[5%] bg-white/80 backdrop-blur-sm border border-blue-100 p-3 rounded-lg shadow-lg flex items-center gap-3 animate-bounce-slower">
            <span className="text-sm font-mono text-blue-800 font-bold">Humidity: 65%</span>
          </div>
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer className="relative z-10 flex-none w-full text-center py-4 text-gray-500 text-xs">
        © 2024 Demeter AI Systems. Revolutionizing Hydroponics.
      </footer>

    </div>
  );
};

// Compact Feature Item
const FeatureItem = ({ icon, title, desc }) => (
  <div className="flex gap-3 items-center p-2 rounded-xl hover:bg-white/40 transition-colors cursor-default">
    <div className="bg-white p-1.5 rounded-lg shadow-sm">
      {icon}
    </div>
    <div>
      <h3 className="text-base font-bold text-gray-900 leading-tight">{title}</h3>
      <p className="text-xs text-gray-600 leading-snug">{desc}</p>
    </div>
  </div>
);

export default LandingPage;