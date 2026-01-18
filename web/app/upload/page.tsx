"use client";

import { useState } from "react";
import { 
  Upload, Save, Activity, Droplets, Thermometer, Wind, Search, 
  Sprout, Calendar, BarChart3, ArrowRight, Brain, ShieldCheck, 
  CheckCircle, AlertTriangle 
} from "lucide-react";
import { SensorData, SearchResult, AgentDecision } from "@/models"; // Ensure AgentDecision is exported in models
import { IngestService } from "@/services/api";

export default function UnifiedPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [textQuery, setTextQuery] = useState("");
  
  // 🧠 State for the Supervisor's Output
  const [decision, setDecision] = useState<AgentDecision | null>(null);

  const [sensors, setSensors] = useState<SensorData>({
    pH: "6.0",
    EC: "1.2",
    temp: "24.0",
    humidity: "60",
    crop: "Lettuce",
    stage: "Vegetative"
  });

  // --- Handlers ---

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setSearchResults([]); 
      setDecision(null); // Clear old reasoning when new image is picked
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSensors({ ...sensors, [e.target.name]: e.target.value });
  };

  const handleIngest = async () => {
    if (!file) return alert("Please select an image first.");
    setLoadingIngest(true);
    try {
      await IngestService.uploadFMU(file, sensors);
      alert("✅ FMU Created & Stored Successfully!");
    } catch (error) {
      console.error(error);
      alert("❌ Ingest Failed. Check console.");
    } finally {
      setLoadingIngest(false);
    }
  };

  // Add state to store the ID of the current query
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!file) return alert("Please select an image to search with.");
    setLoadingSearch(true);
    setDecision(null);

    try {
      const response = await IngestService.searchFMU(file, sensors);
      
      setSearchResults(response.search_results || []);
      
      if (response.agent_decision) {
        setDecision(response.agent_decision);
      }
      
      // 👇 Capture the ID of the newly created FMU
      if (response.new_fmu_id) {
        setCurrentQueryId(response.new_fmu_id);
        console.log("Query Logged with ID:", response.new_fmu_id);
      }

    } catch (error) {
      console.error(error);
      alert("❌ Search Failed.");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleTextQuery = async () => {
    if (!textQuery) return;
    setLoadingSearch(true);
    setSearchResults([]); // Clear old results

    try {
      const formData = new FormData();
      formData.append("query", textQuery);

      const res = await fetch("http://localhost:8000/query-text", {
        method: "POST",
        body: formData
      });
      const data = await res.json();

      if (data.results) {
        // Map the "scroll" results to your "search result" format
        // @ts-ignore
        const mappedResults = data.results.map(r => ({
          id: r.id,
          score: 1.0, // Text search matches are exact, so 100% score
          payload: r.payload
        }));
        setSearchResults(mappedResults);
        
        if (mappedResults.length === 0) alert("No records found matching that description.");
      }
    } catch (e) {
      console.error(e);
      alert("Text Query Failed");
    } finally {
      setLoadingSearch(false);
    }
  };

  // --- UI Render ---

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 flex flex-col items-center">
      
      {/* Top Section: Control Panel */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12">
        
        {/* Left: Image Input */}
        <div className="space-y-6">
          <div className="relative border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-2xl h-96 flex flex-col items-center justify-center hover:border-emerald-500/50 transition-colors group overflow-hidden">
            <input 
              type="file" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover opacity-90" />
            ) : (
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-emerald-400" />
                </div>
                <p className="text-slate-400 font-medium">Drop crop image here</p>
                <p className="text-xs text-slate-600 mt-2">JPG, PNG supported</p>
              </div>
            )}
          </div>
        </div>

        {/* 🔍 TEXT SEARCH BAR */}
<div className="max-w-6xl w-full mb-8">
  <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex gap-4">
    <input 
      type="text" 
      value={textQuery}
      onChange={(e) => setTextQuery(e.target.value)}
      placeholder="Ask Demeter: 'Show me all failed Lettuce crops' or 'Show me Batch-001'"
      className="flex-1 bg-transparent border-none outline-none text-white placeholder-slate-500"
    />
    <button 
      onClick={handleTextQuery}
      className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors"
    >
      Ask
    </button>
  </div>
</div>

        {/* Right: Inputs & Actions */}
        <div className="space-y-8 flex flex-col justify-center">
           <div>
              <h1 className="text-3xl font-bold text-white mb-2">Demeter Control</h1>
              <p className="text-slate-500">Ingest new data or query the Historian Agent.</p>
           </div>

           <div className="grid grid-cols-2 gap-4">
               {[
                 { label: "pH Level", name: "pH", icon: Droplets, color: "text-emerald-400" },
                 { label: "EC (mS/cm)", name: "EC", icon: Activity, color: "text-yellow-400" },
                 { label: "Temp (°C)", name: "temp", icon: Thermometer, color: "text-red-400" },
                 { label: "Humidity (%)", name: "humidity", icon: Wind, color: "text-blue-400" }
               ].map((field) => (
                 <div key={field.name} className="space-y-2">
                   <label className={`text-xs font-mono uppercase ${field.color}`}>{field.label}</label>
                   <div className="relative">
                     <field.icon className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                     <input 
                       name={field.name} 
                       // @ts-ignore
                       value={sensors[field.name as keyof SensorData]} 
                       onChange={handleInputChange} 
                       type="number" step="0.1" 
                       className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" 
                     />
                   </div>
                 </div>
               ))}
           </div>

           <div className="grid grid-cols-2 gap-4">
               <select name="crop" value={sensors.crop} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                   <option>Lettuce</option><option>Basil</option><option>Tomato</option>
               </select>
               <select name="stage" value={sensors.stage} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                   <option>Seedling</option><option>Vegetative</option><option>Flowering</option><option>Harvest</option>
               </select>
           </div>

           <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
               <button 
                 onClick={handleIngest}
                 disabled={loadingIngest || loadingSearch} 
                 className="py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center space-x-2"
               >
                  {loadingIngest ? <Activity className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5" /> <span>Store Memory</span></>}
               </button>

               <button 
                 onClick={handleSearch}
                 disabled={loadingIngest || loadingSearch} 
                 className="py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center space-x-2"
               >
                  {loadingSearch ? <Activity className="animate-spin w-5 h-5" /> : <><Search className="w-5 h-5" /> <span>Search & Reason</span></>}
               </button>
           </div>
        </div>
      </div>

      {/* 🧠 SECTION: SUPERVISOR REASONING OUTPUT */}
      {decision && (
        <div className="max-w-6xl w-full mb-12 animate-in fade-in slide-in-from-top-10 duration-700">
            <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900/40 border border-indigo-500/30 p-8 rounded-3xl relative overflow-hidden">
                {/* Glowing Top Border */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Icon Column */}
                    <div className="flex-shrink-0 flex flex-col items-center justify-center md:items-start space-y-2">
                        <div className="w-16 h-16 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                            <Brain className="w-8 h-8 text-indigo-300" />
                        </div>
                        <span className="text-xs font-mono text-indigo-400 tracking-widest uppercase">Supervisor</span>
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 space-y-6">
                        {/* Reasoning Text */}
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                Analysis & Reasoning
                            </h3>
                            <p className="text-slate-300 leading-relaxed text-lg border-l-2 border-indigo-500/50 pl-4">
                                {decision.reasoning}
                            </p>
                        </div>

                        {/* Action & Confidence Row */}
                        <div className="flex flex-col md:flex-row gap-4">
                             {/* Recommended Action */}
                             <div className="flex-1 bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-4">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <span className="text-xs text-emerald-500 uppercase font-bold tracking-wider">Recommended Action</span>
                                    <p className="text-lg font-bold text-white">{decision.action}</p>
                                </div>
                             </div>

                             {/* Confidence Score */}
                             <div className="bg-slate-900/50 border border-slate-700 p-4 rounded-xl flex items-center gap-4 min-w-[200px]">
                                <div className="p-2 bg-slate-700/50 rounded-lg">
                                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">Confidence</span>
                                    <p className="text-lg font-bold text-white">{(decision.confidence * 100).toFixed(0)}%</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
      {/* 🧠 END REASONING SECTION */}
      {/* {decision && currentQueryId && (
    <div className="mt-4 bg-slate-900 p-4 rounded-xl border border-slate-700">
      <h4 className="text-white font-bold mb-2">Report Outcome</h4>
      <div className="flex gap-2">
        <button 
          onClick={() => submitFeedback(currentQueryId, decision.action, "Effective")}
          className="px-4 py-2 bg-green-600 rounded text-sm hover:bg-green-500"
        >
          It Worked!
        </button>
        <button 
          onClick={() => submitFeedback(currentQueryId, decision.action, "Ineffective")}
          className="px-4 py-2 bg-red-600 rounded text-sm hover:bg-red-500"
        >
          Failed
        </button>
      </div>
    </div>
)} */}


      {/* Bottom Section: Search Results */}
      {searchResults.length > 0 && (
        <div className="max-w-6xl w-full animate-in fade-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-500" />
              Retrieved Memory (Similar Cases)
            </h2>
            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              {searchResults.length} RECORDS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {searchResults.map((res) => (
              <div key={res.id} className="bg-slate-900/50 border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
                  {(res.score * 100).toFixed(1)}% MATCH
                </div>
                
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sprout className="w-5 h-5 text-emerald-400" />
                    {res.payload.crop}
                  </h3>
                  <span className="text-xs text-slate-400 uppercase tracking-wider">{res.payload.stage}</span>
                </div>

                <div className="space-y-3 text-sm text-slate-400">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Date</div>
                    <span className="font-mono text-slate-300">{res.payload.timestamp ? new Date(res.payload.timestamp).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Sensors</div>
                    <span className="font-mono text-xs text-slate-300">
                        pH: {res.payload.sensors?.pH} | EC: {res.payload.sensors?.EC}
                    </span>
                  </div>
                </div>
                
                <button className="w-full mt-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:text-blue-400">
                  <span>Load Context</span> <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}