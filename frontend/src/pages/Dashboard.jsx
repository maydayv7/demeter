import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchDashboardData } from '../api/farmApi'; 
import { 
  LayoutGrid, BarChart3, Bell, Settings, Droplet, Sun, Leaf, Search, Database, Thermometer, LogOut, Brain 
} from 'lucide-react';

const Dashboard = () => {
  const [crops, setCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchDashboardData();
      
      if (data && data.length > 0) {
        // --- DATA MAPPING ---
        const formattedData = data.map(item => {
          const p = item.payload || {};
          const sensors = p.sensors || {}; 

          return {
            id: p.crop_id || item.id,
            name: p.crop || "Unknown Crop",
            location: p.location || "Unit A-1 • Hydroponic",
            image: getImageForCrop(p.crop), 
            status: p.outcome === 'CRITICAL' ? 'Critical' : (p.action_taken === 'PENDING_ACTION' ? 'Attention' : 'Healthy'),
            statusMsg: p.stage || "Growing",
            maturity: calculateMaturity(p.sequence_number), 
            daysLeft: 30 - (p.sequence_number || 0), 
            sensors: {
              lux: `${sensors.lux || 0}k`,
              temp: `${sensors.temp || 0}°C`,
              ph: sensors.ph || 7.0
            }
          };
        });
        setCrops(formattedData);
      } else {
        setCrops([]); 
      }
      setLoading(false);
    };

    loadData();
  }, []);

  const getImageForCrop = (name) => {
    if (!name) return "https://images.unsplash.com/photo-1618164436241-4473940d1f5c?q=80&w=2000";
    const n = name.toLowerCase();
    if (n.includes('basil')) return "https://images.unsplash.com/photo-1618164436241-4473940d1f5c?q=80&w=2000";
    if (n.includes('tomato')) return "https://images.unsplash.com/photo-1591857177580-dc82b9e4e5c9?q=80&w=2000";
    if (n.includes('spinach')) return "https://images.unsplash.com/photo-1576045057995-568f588f82fb?q=80&w=2000";
    if (n.includes('straw')) return "https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?q=80&w=2000";
    return "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=2000";
  };

  const calculateMaturity = (seq) => {
    const val = (seq || 1) * 10; 
    return val > 100 ? 100 : val;
  };

  return (
    <div className="flex h-screen bg-[#F4F9F6] font-sans text-gray-800">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col justify-between hidden md:flex">
        <div>
          <div className="p-6 flex items-center gap-3">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white">
              <Leaf size={20} fill="currentColor" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Demeter</h1>
          </div>
          <nav className="px-4 space-y-1">
            <SidebarItem icon={<LayoutGrid size={20} />} label="My Crops" active />
            <SidebarItem icon={<BarChart3 size={20} />} label="Analytics" />
            <SidebarItem icon={<Bell size={20} />} label="Alerts" />
            <SidebarItem icon={<Settings size={20} />} label="Settings" />
          </nav>
        </div>
        <div className="p-4 border-t border-gray-50">
           <div className="flex items-center gap-3 p-2 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">AF</div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">Alex Farmer</h4>
              <p className="text-xs text-gray-500">Head Agronomist</p>
            </div>
           </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* --- HEADER (Updated with Button) --- */}
        <header className="h-20 px-8 flex items-center justify-between bg-white border-b border-gray-50">
          <h2 className="text-lg font-bold text-gray-800">Crops Overview</h2>
          
          <div className="flex items-center gap-4">
            {/* NEW BUTTON FOR AGENT CONTROL */}
            <button 
              onClick={() => navigate('/control')}
              className="flex items-center gap-2 bg-white border border-emerald-100 text-emerald-600 hover:bg-emerald-50 px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm hover:shadow-md"
            >
              <Brain size={18} /> Agent Control
            </button>

            <div className="w-px h-6 bg-gray-200 mx-2"></div>

            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> System online
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex h-full items-center justify-center text-gray-400">Loading Farm Data...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {crops.length > 0 ? (
                crops.map((crop) => (
                  <div key={crop.id} onClick={() => navigate(`/crop/${crop.id}`)} className="cursor-pointer">
                    <CropCard data={crop} />
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center text-gray-400 mt-20">
                  No crops found in database. Start the simulation to see data.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// Sub-components
const SidebarItem = ({ icon, label, active }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-500 hover:bg-gray-50'}`}>
    {icon} <span className="flex-1 text-sm">{label}</span>
  </div>
);

const CropCard = ({ data }) => {
  const isHealthy = data.status === 'Healthy';
  const progressColor = isHealthy ? 'bg-emerald-500' : 'bg-orange-500';

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition group">
      <div className="relative h-40 rounded-xl overflow-hidden mb-4">
        <img src={data.image} alt={data.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-bold bg-white/90 text-emerald-700 backdrop-blur-md">
           {data.statusMsg}
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{data.name}</h3>
          <p className="text-xs text-gray-400 mt-1">{data.location}</p>
        </div>
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1.5">
            <span className="text-gray-500">Maturity</span>
            <span className="text-emerald-600">{data.daysLeft} days left</span>
          </div>
          <div className="h-1.5 w-full bg-gray-100 rounded-full"><div className={`h-full rounded-full ${progressColor}`} style={{ width: `${data.maturity}%` }}></div></div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-50">
          <SensorItem icon={<Sun size={14} />} value={data.sensors.lux} label="Lux" />
          <SensorItem icon={<Thermometer size={14} />} value={data.sensors.temp} label="Temp" />
          <SensorItem icon={<Droplet size={14} />} value={data.sensors.ph} label="pH" />
        </div>
      </div>
    </div>
  );
};

const SensorItem = ({ icon, value, label }) => (
  <div className="text-center p-2 rounded-lg bg-gray-50">
    <div className="flex justify-center text-gray-400 mb-1">{icon}</div>
    <div className="text-sm font-bold text-gray-700">{value}</div>
    <div className="text-[10px] text-gray-400 uppercase">{label}</div>
  </div>
);

export default Dashboard;