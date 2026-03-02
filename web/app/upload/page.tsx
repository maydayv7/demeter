"use client";

import { useRef, useState } from "react";
import { 
  Upload, Save, Activity, Droplets, Thermometer, Wind, Search, 
  Sprout, Calendar, BarChart3, ArrowRight, Brain, ShieldCheck, 
  CheckCircle, Mic, Square
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

  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
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
      if (response.explanation) {
        setExplanationText(response.explanation);
    }
      
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await handleAudioUpload(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setLoadingSearch(true);
    setSearchResults([]); 

    try {
      const formData = new FormData();
      // Rename file to .webm so backend recognizes it
      formData.append("file", audioBlob, "recording.webm");

      const res = await fetch("http://localhost:8000/query-audio", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.transcription) {
        setTextQuery(data.transcription);
      }
      // (Reuse the same result mapping logic as Text Search)
      if (data.results) {
        // @ts-ignore
        const mappedResults = data.results.map(r => ({
          id: r.id,
          score: 1.0,
          payload: r.payload
        }));
        setSearchResults(mappedResults);
        if (mappedResults.length === 0) alert("No records found for that audio query.");
      }
    } catch (e) {
      console.error(e);
      alert("Audio Query Failed");
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
            {/* 🎙️ MICROPHONE BUTTON */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`p-3 rounded-full transition-all ${
          isRecording 
            ? "bg-red-500 animate-pulse text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]" 
            : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
        }`}
        title="Search by Voice"
      >
        {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
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

      {decision && (
        <div className="max-w-3xl w-full mb-12 bg-slate-900 border border-emerald-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-900/20">
          
          {/* Header */}
          <div className="bg-emerald-900/20 p-4 border-b border-emerald-500/20 flex justify-between items-center">
            <h3 className="text-emerald-400 font-bold text-lg flex items-center gap-2">
              🌱 Demeter Recommendation
            </h3>
            
            {/* The "Why?" Button */}
            <button 
              onClick={() => setShowExplanation(!showExplanation)}
              className="text-xs text-slate-400 hover:text-white underline transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              Why this output?
            </button>
          </div>

          {/* Main Decision Text */}
          <div className="p-6">
            <p className="text-2xl text-white font-light leading-relaxed">
              {decision.reasoning || "Analyzing..."}
            </p>
          </div>

          {/* The Explainer Dropdown (Hidden by default) */}
          {showExplanation && (
             <div className="bg-slate-950/50 p-6 border-t border-slate-800 animate-in slide-in-from-top-2">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                 Reasoning Log
               </h4>
               <div className="text-slate-300 text-sm whitespace-pre-wrap font-mono leading-relaxed opacity-90">
                 {explanationText ? explanationText : (
                   <span className="animate-pulse text-slate-500">Generating logic trace...</span>
                 )}
               </div>
             </div>
          )}
        </div>
      )}
      {/* 👆 END OF NEW COMPONENT 👆 */}
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