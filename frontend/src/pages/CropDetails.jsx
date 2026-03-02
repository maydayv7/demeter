import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCropDetails } from '../api/farmApi';
import { 
  ArrowLeft, Thermometer, Droplet, Sun, Wind, FlaskConical, Sparkles
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const CropDetails = () => {
  const { cropId } = useParams(); // Get ID from URL
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      // 1. Fetch all points for this crop
      const data = await fetchCropDetails(cropId);
      
      if (data && data.length > 0) {
        // 2. Sort by sequence number (Ascending for Chart)
        const sorted = [...data].sort((a, b) => 
          (a.payload.sequence_number || 0) - (b.payload.sequence_number || 0)
        );

        setHistory(sorted);
        setLatest(sorted[sorted.length - 1].payload); // The last one is the current state
      }
      setLoading(false);
    };
    getData();
  }, [cropId]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading Crop Data...</div>;
  if (!latest) return <div className="h-screen flex items-center justify-center">Crop not found</div>;

  // --- DERIVED DATA FOR UI ---
  
  // 1. Chart Data: Map history to time/temp/ph
  const chartData = history.map(h => ({
    time: new Date(h.payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temp: h.payload.sensors?.temp || 0,
    ph: h.payload.sensors?.ph || 0
  }));

  // 2. Vitals: Take from 'latest' state
  const vitals = [
    { label: "Air Temp", value: `${latest.sensors?.temp || 0}°C`, status: "Optimal", icon: <Thermometer size={18} className="text-orange-500" />, color: "bg-orange-100" },
    { label: "Water pH", value: latest.sensors?.ph || 7.0, status: latest.action_taken !== "PENDING_ACTION" ? "Adjusting" : "Stable", icon: <FlaskConical size={18} className="text-purple-500" />, color: "bg-purple-100" },
    { label: "Humidity", value: "58%", status: "Optimal", icon: <Droplet size={18} className="text-blue-500" />, color: "bg-blue-100" }, // Mock if missing
    { label: "Light", value: `${latest.sensors?.lux || 0}k`, status: "Optimal", icon: <Sun size={18} className="text-yellow-500" />, color: "bg-yellow-100" },
  ];

  return (
    <div className="min-h-screen bg-[#F3F4F6] font-sans text-gray-800 flex flex-col">
      
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-full transition">
          <ArrowLeft size={20} />
        </button>
        <div>
           <div className="text-xs text-gray-500">Back to Dashboard</div>
           <h1 className="font-bold text-xl text-gray-900">{latest.crop} <span className="text-gray-400">#{latest.sequence_number}</span></h1>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> System Online
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        
        {/* TOP ROW: Image & Vitals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Image */}
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
            <div className="relative h-48 rounded-xl overflow-hidden bg-gray-100">
               <img src="https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=2000" className="w-full h-full object-cover" />
               <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">LIVE</div>
            </div>
            <div className="mt-3 text-center">
              <div className="text-xs uppercase text-gray-400 font-bold">Growth Stage</div>
              <div className="text-xl font-bold text-emerald-600">{latest.stage}</div>
            </div>
          </div>

          {/* Vitals */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            {vitals.map((v, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                <div className={`w-12 h-12 rounded-full ${v.color} flex items-center justify-center mb-3`}>{v.icon}</div>
                <div className="text-sm text-gray-500">{v.label}</div>
                <div className="text-2xl font-bold text-gray-900">{v.value}</div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded mt-1">{v.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE ROW: Chart & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* AI Insights (Derived from latest outcome) */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="flex gap-4 relative z-10">
               <div className="flex-none bg-emerald-500 text-white w-10 h-10 rounded-lg flex items-center justify-center"><Sparkles size={20} /></div>
               <div>
                 <h3 className="font-bold text-gray-900 mb-2">Latest AI Analysis</h3>
                 <p className="text-sm text-gray-600 leading-relaxed">
                   <strong>Observation:</strong> {latest.outcome === 'PENDING_OBSERVATION' ? 'System Monitoring...' : latest.outcome} <br/>
                   <strong>Action:</strong> {latest.action_taken === 'PENDING_ACTION' ? 'No intervention needed.' : latest.action_taken}
                 </p>
               </div>
             </div>
          </div>

          {/* Chart */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-80">
             <h3 className="font-bold text-gray-900 mb-4">Environmental Trend</h3>
             <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="time" tick={{fontSize: 10, fill: '#aaa'}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" domain={['auto', 'auto']} tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                  <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#10B981" strokeWidth={3} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* BOTTOM: Logs Table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Historical Event Log</h3>
          <div className="space-y-4">
            {/* Reverse history to show newest first, take top 5 */}
            {[...history].reverse().slice(0, 5).map((h, i) => (
              <div key={i} className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0">
                 <div className="w-16 text-xs text-gray-400 font-mono pt-1">
                   {new Date(h.payload.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                 </div>
                 <div>
                   <div className="text-sm font-bold text-gray-800">{h.payload.action_taken}</div>
                   <div className="text-xs text-gray-500">{h.payload.outcome}</div>
                 </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
};

export default CropDetails;