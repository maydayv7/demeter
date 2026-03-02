import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCropDetails } from '../api/farmApi';
import { 
  ArrowLeft, Thermometer, Droplet, Sun, FlaskConical, Sparkles
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- HELPER 1: Parse Python-style Dict Strings ---
const parsePythonString = (str) => {
  if (!str) return null;
  if (typeof str === 'object') return str;
  
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      // Fix Python single quotes and Booleans
      const fixedStr = str
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, 'null')
        .replace(/\bFalse\b/g, 'false')
        .replace(/\bTrue\b/g, 'true');
      return JSON.parse(fixedStr);
    } catch (e2) {
      return null;
    }
  }
};

// --- HELPER 2: Extract Sensor Data Safely ---
const extractSensors = (payload) => {
  if (!payload) return { temp: 0, ph: 0, lux: 0, humidity: 0 };

  // 1. Check for standard "sensors" object
  if (payload.sensors && payload.sensors.ph) {
    return payload.sensors;
  }

  // 2. If missing, look inside "action_taken"
  const actionData = parsePythonString(payload.action_taken);
  
  if (actionData) {
    // Handle nested structures like 'atmospheric_actions' or flat structures
    return {
      temp: actionData.atmospheric_actions?.air_temp || actionData.air_temp || 0,
      ph: actionData.water_actions?.ph || actionData.ph || 0,
      lux: actionData.atmospheric_actions?.light_intensity || 0,
      humidity: actionData.atmospheric_actions?.humidity || 0,
    };
  }

  // 3. Fallback
  return { temp: 0, ph: 0, lux: 0, humidity: 0 };
};

const CropDetails = () => {
  const { cropId } = useParams();
  const navigate = useNavigate();
  
  const [history, setHistory] = useState([]);
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getData = async () => {
      try {
        const data = await fetchCropDetails(cropId);
        
        if (data && Array.isArray(data) && data.length > 0) {
          // Sort by sequence number
          const sorted = [...data].sort((a, b) => 
            (a.payload?.sequence_number || 0) - (b.payload?.sequence_number || 0)
          );

          // Process history with safety checks
          const processedHistory = sorted.map(item => {
            const safePayload = item.payload || {};
            const sensors = extractSensors(safePayload);
            return {
              ...item,
              cleanSensors: sensors, 
              parsedAction: parsePythonString(safePayload.action_taken) 
            };
          });

          setHistory(processedHistory);
          setLatest(processedHistory[processedHistory.length - 1]); 
        } else {
          setHistory([]);
          setLatest(null);
        }
      } catch (err) {
        console.error("Error processing crop details:", err);
      } finally {
        setLoading(false);
      }
    };
    getData();
  }, [cropId]);

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading Crop Data...</div>;
  if (!latest) return <div className="h-screen flex items-center justify-center text-gray-500">Crop data not found.</div>;

  const latestPayload = latest.payload || {};
  // Safety: Ensure latestSensors is never undefined
  const latestSensors = latest.cleanSensors || { temp: 0, ph: 0, lux: 0, humidity: 0 };

  // --- CHART DATA (With Safety Checks) ---
  const chartData = history.map(h => ({
    time: h.payload?.timestamp ? new Date(h.payload.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--',
    // FIX: Use optional chaining (?.) and fallback (|| 0)
    temp: h.cleanSensors?.temp || 0,
    ph: h.cleanSensors?.ph || 0
  }));

  // --- VITALS DATA ---
  const vitals = [
    { label: "Air Temp", value: `${latestSensors.temp || 0}°C`, status: "Optimal", icon: <Thermometer size={18} className="text-orange-500" />, color: "bg-orange-100" },
    { label: "Water pH", value: latestSensors.ph || "N/A", status: "Stable", icon: <FlaskConical size={18} className="text-purple-500" />, color: "bg-purple-100" },
    { label: "Humidity", value: `${latestSensors.humidity || 0}%`, status: "Optimal", icon: <Droplet size={18} className="text-blue-500" />, color: "bg-blue-100" },
    { label: "Light", value: `${latestSensors.lux || 0}`, status: "Optimal", icon: <Sun size={18} className="text-yellow-500" />, color: "bg-yellow-100" },
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
           <h1 className="font-bold text-xl text-gray-900">{latestPayload.crop || "Unknown Crop"} <span className="text-gray-400">#{latestPayload.sequence_number || 0}</span></h1>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-semibold">
           <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> System Online
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-6">
        
        {/* TOP ROW: Vitals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
             <div className="relative w-full h-32 rounded-lg overflow-hidden bg-gray-100 mb-2">
                 <img src="https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?q=80&w=2000" className="w-full h-full object-cover" alt="crop" />
             </div>
             <div className="text-xs uppercase text-gray-400 font-bold">Current Stage</div>
             <div className="text-lg font-bold text-emerald-600">{latestPayload.stage || "Unknown"}</div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4">
            {vitals.map((v, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                <div className={`w-12 h-12 rounded-full ${v.color} flex items-center justify-center mb-3`}>{v.icon}</div>
                <div className="text-sm text-gray-500">{v.label}</div>
                <div className="text-2xl font-bold text-gray-900">{v.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE ROW: Chart & Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LATEST AI ANALYSIS */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 relative overflow-hidden">
             <div className="flex gap-4 relative z-10">
               <div className="flex-none bg-emerald-500 text-white w-10 h-10 rounded-lg flex items-center justify-center"><Sparkles size={20} /></div>
               <div className="overflow-hidden w-full">
                 <h3 className="font-bold text-gray-900 mb-2">Latest AI Analysis</h3>
                 
                 <div className="text-sm text-gray-600 leading-relaxed">
                   <p className="mb-2"><strong>Observation:</strong> {latestPayload.outcome || "Monitoring..."}</p>
                   
                   <p className="font-bold text-xs text-gray-400 uppercase tracking-wide mb-1">Active Parameters:</p>
                   <div className="flex flex-wrap gap-2">
                     {latest.parsedAction ? (
                        <>
                          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">pH: {latestSensors.ph}</span>
                          <span className="px-2 py-1 bg-orange-50 text-orange-700 text-xs rounded border border-orange-100">Temp: {latestSensors.temp}°C</span>
                        </>
                     ) : (
                       <span className="text-gray-400 italic">No automated actions active.</span>
                     )}
                   </div>
                 </div>
               </div>
             </div>
          </div>

          {/* CHART */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-80">
             <h3 className="font-bold text-gray-900 mb-4">Environmental Trend</h3>
             <ResponsiveContainer width="100%" height="90%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="time" tick={{fontSize: 10, fill: '#aaa'}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" domain={['auto', 'auto']} tick={{fontSize: 10}} axisLine={false} tickLine={false} label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="right" orientation="right" domain={[4, 8]} tick={{fontSize: 10}} axisLine={false} tickLine={false} label={{ value: 'pH', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip contentStyle={{borderRadius: '8px', border:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.1)'}} />
                  <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#10B981" strokeWidth={3} dot={false} name="Temp" />
                  <Line yAxisId="right" type="monotone" dataKey="ph" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} name="pH" />
                </LineChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* BOTTOM: Event Log */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Historical Event Log</h3>
          <div className="space-y-4">
            {[...history].reverse().slice(0, 10).map((h, i) => (
              <div key={i} className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0">
                 <div className="w-16 text-xs text-gray-400 font-mono pt-1">
                   {h.payload?.timestamp ? new Date(h.payload.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}
                 </div>
                 <div>
                   <div className="text-sm font-bold text-gray-800">
                     {h.parsedAction 
                       ? `Adjusted pH to ${h.cleanSensors?.ph || 0} • Temp to ${h.cleanSensors?.temp || 0}°C` 
                       : h.payload?.action_taken || "Routine Check"}
                   </div>
                   <div className="text-xs text-gray-500 mt-1">
                     {h.payload?.outcome || "Monitoring"}
                   </div>
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