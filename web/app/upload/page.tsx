"use client";

import { useState } from "react";
import { Upload, Save, Activity, Droplets, Thermometer, Wind, Search, Sprout, Calendar, BarChart3, ArrowRight } from "lucide-react";
import { SensorData, SearchResult } from "@/models";
import { IngestService } from "@/services/api"; // Ensure you have this service file created

export default function UnifiedPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  // Separate loading states to show which button is working
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // Sensor State
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
      setSearchResults([]); // Clear old results on new file
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
      // Optional: Clear form after success?
      // setFile(null); setPreview(null); setSearchResults([]);
    } catch (error) {
        console.log(error);
      alert("❌ Ingest Failed. Is the backend running?");
    } finally {
      setLoadingIngest(false);
    }
  };

  const handleSearch = async () => {
    if (!file) return alert("Please select an image to search with.");
    setLoadingSearch(true);

    try {
      const response = await IngestService.searchFMU(file, sensors);
      setSearchResults(response.results || []);
      if (response.results.length === 0) alert("No similar memories found.");
    } catch (error) {
      alert("❌ Search Failed. Is the backend running?");
    } finally {
      setLoadingSearch(false);
    }
  };

  // --- UI Render ---

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 flex flex-col items-center">
      
      {/* Top Section: Control Panel */}
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
        
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

        {/* Right: Sensor Inputs & Actions */}
        <div className="space-y-8 flex flex-col justify-center">
           <div>
              <h1 className="text-3xl font-bold text-white mb-2">Demeter Control</h1>
              <p className="text-slate-500">Ingest new data or query the Historian Agent.</p>
           </div>

           {/* Sensor Grid */}
           <div className="grid grid-cols-2 gap-4">
               {/* Helper function to render inputs cleanly */}
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

           {/* Metadata Selects */}
           <div className="grid grid-cols-2 gap-4">
               <select name="crop" value={sensors.crop} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                   <option>Lettuce</option><option>Basil</option><option>Tomato</option>
               </select>
               <select name="stage" value={sensors.stage} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                   <option>Seedling</option><option>Vegetative</option><option>Flowering</option><option>Harvest</option>
               </select>
           </div>

           {/* --- Action Buttons --- */}
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
                  {loadingSearch ? <Activity className="animate-spin w-5 h-5" /> : <><Search className="w-5 h-5" /> <span>Search Archives</span></>}
               </button>
           </div>
        </div>
      </div>

      {/* Bottom Section: Search Results (Conditional Render) */}
      {searchResults.length > 0 && (
        <div className="max-w-6xl w-full animate-in fade-in slide-in-from-bottom-10 duration-500">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-blue-500" />
              Retrieved Evidence
            </h2>
            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              {searchResults.length} SIMILAR CASES
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