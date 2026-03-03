import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { 
  Upload, Save, Activity, Droplets, Thermometer, Wind, Search, 
  Sprout, Calendar, BarChart3, ArrowRight, Brain, Mic, Square, 
  ArrowLeft, Leaf, Database, CheckCircle2
} from "lucide-react";
import { agentService } from "../api/agentApi";

export default function AgentControl() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  
  const [loadingIngest, setLoadingIngest] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  
  const [searchResults, setSearchResults] = useState([]);
  const [textQuery, setTextQuery] = useState("");

  const [showExplanation, setShowExplanation] = useState(false);
  const [explanationText, setExplanationText] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  const [decision, setDecision] = useState(null);

  const [sensors, setSensors] = useState({
    pH: "6.0",
    EC: "1.2",
    temp: "24.0",
    humidity: "60",
    crop: "Lettuce",
    stage: "Vegetative"
  });

  // --- Handlers ---
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setSearchResults([]); 
      setDecision(null);
    }
  };

  const handleInputChange = (e) => {
    setSensors({ ...sensors, [e.target.name]: e.target.value });
  };

  const handleIngest = async () => {
    if (!file) return alert("Please select an image first.");
    setLoadingIngest(true);
    try {
      await agentService.uploadFMU(file, sensors);
      alert("✅ FMU Created & Stored Successfully!");
    } catch (error) {
      console.error(error);
      alert("❌ Ingest Failed. Check console.");
    } finally {
      setLoadingIngest(false);
    }
  };

  const handleSearch = async () => {
    if (!file) return alert("Please select an image to search with.");
    setLoadingSearch(true);
    setDecision(null);

    try {
      const response = await agentService.searchFMU(file, sensors);
      if (response.explanation) setExplanationText(response.explanation);
      setSearchResults(response.search_results || []);
      if (response.agent_decision) setDecision(response.agent_decision);
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
    setSearchResults([]); 

    try {
      const data = await agentService.queryText(textQuery);
      if (data.results) {
        const mappedResults = data.results.map(r => ({
          id: r.id,
          score: 1.0, 
          payload: r.payload
        }));
        setSearchResults(mappedResults);
        if (mappedResults.length === 0) alert("No records found.");
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

  const handleAudioUpload = async (audioBlob) => {
    setLoadingSearch(true);
    setSearchResults([]); 
    try {
      const data = await agentService.queryAudio(audioBlob);
      if (data.transcription) setTextQuery(data.transcription);
      if (data.results) {
        const mappedResults = data.results.map(r => ({
          id: r.id,
          score: 1.0,
          payload: r.payload
        }));
        setSearchResults(mappedResults);
      }
    } catch (e) {
      console.error(e);
      alert("Audio Query Failed");
    } finally {
      setLoadingSearch(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F9F6] font-sans text-gray-800 pb-20">
      
      {/* --- 1. NAVBAR (Light Mode) --- */}
      <nav className="border-b border-gray-200 bg-white sticky top-0 z-20 h-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition">
            <div className="bg-emerald-500 p-1.5 rounded-lg text-white">
               <Leaf size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Demeter
            </span>
          </Link>
          <div className="flex items-center space-x-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span>System Online</span>
            </div>
            <Link to="/dashboard" className="hover:text-emerald-600 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
           <div className="flex items-center gap-4">
             <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                <Brain className="text-emerald-500 w-8 h-8"/> 
             </div>
             <div>
               <h1 className="text-3xl font-bold text-gray-900">Agent Control Center</h1>
               <p className="text-gray-500 mt-1">Ingest new crop memories or query the Supervisor Agent</p>
             </div>
           </div>
           <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-emerald-600 transition-colors bg-white px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm hover:shadow-md">
              <ArrowLeft size={18} /> Back Home
           </Link>
        </div>
        
        {/* --- MAIN GRID --- */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          
          {/* LEFT: Image Upload (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative border-2 border-dashed border-gray-300 bg-white rounded-3xl h-[420px] flex flex-col items-center justify-center hover:border-emerald-500/50 hover:bg-emerald-50/30 transition-all group overflow-hidden shadow-sm hover:shadow-md">
              <input 
                type="file" 
                onChange={handleFileChange} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              {preview ? (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              ) : (
                <div className="text-center p-6 space-y-4">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-bold text-lg">Upload Crop Scan</p>
                    <p className="text-gray-400 text-sm">Drag & drop or click to browse</p>
                  </div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full text-[10px] text-gray-500 font-bold border border-gray-200">
                    JPG, PNG SUPPORTED
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Controls (Span 7) */}
          <div className="lg:col-span-7 space-y-6">
             
             {/* Search Bar */}
             <div className="bg-white p-2 rounded-2xl border border-gray-200 flex gap-2 shadow-sm focus-within:shadow-md transition-shadow">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-3 rounded-xl transition-all flex items-center justify-center ${
                    isRecording 
                      ? "bg-red-50 text-red-500 animate-pulse border border-red-100" 
                      : "bg-gray-50 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  }`}
                  title="Voice Search"
                >
                  {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <input 
                  type="text" 
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  placeholder="Ask Demeter: 'Show me all failed Lettuce crops'..."
                  className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 px-2 font-medium"
                />
                <button 
                  onClick={handleTextQuery}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  Ask Agent
                </button>
             </div>

             {/* Sensor Inputs Panel */}
             <div className="bg-white border border-gray-200 rounded-3xl p-8 space-y-6 shadow-sm">
                 <div className="flex items-center justify-between">
                    <h3 className="text-gray-900 font-bold flex items-center gap-2 text-lg">
                       <Activity className="w-5 h-5 text-emerald-500"/> Manual Parameters
                    </h3>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-5">
                     {[
                       { label: "pH Level", name: "pH", icon: Droplets, color: "text-emerald-600", bg: "bg-emerald-50", type: "number" },
                       { label: "EC (mS/cm)", name: "EC", icon: Activity, color: "text-yellow-600", bg: "bg-yellow-50", type: "number" },
                       { label: "Temp (°C)", name: "temp", icon: Thermometer, color: "text-red-600", bg: "bg-red-50", type: "number" },
                       { label: "Humidity (%)", name: "humidity", icon: Wind, color: "text-blue-600", bg: "bg-blue-50", type: "number" },
                       { label: "Crop", name: "crop", icon: Sprout, color: "text-green-600", bg: "bg-green-50", type: "select", options: ["Lettuce", "Tomato", "Cucumber", "Basil", "Spinach", "Kale"] },
                       { label: "Stage", name: "stage", icon: Calendar, color: "text-purple-600", bg: "bg-purple-50", type: "select", options: ["Seedling", "Vegetative", "Flowering", "Fruiting", "Mature"] }
                     ].map((field) => (
                       <div key={field.name} className="space-y-2 group">
                         <label className={`text-[11px] font-bold uppercase tracking-wider ${field.color} ml-1`}>{field.label}</label>
                         <div className="relative">
                           <div className={`absolute left-3 top-2.5 w-8 h-8 rounded-lg ${field.bg} flex items-center justify-center z-10`}>
                              <field.icon className={`w-4 h-4 ${field.color}`} />
                           </div>
                           {field.type === "select" ? (
                             <select 
                               name={field.name} 
                               value={sensors[field.name]} 
                               onChange={handleInputChange} 
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-14 pr-4 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all text-gray-800 font-bold appearance-none cursor-pointer"
                             >
                               {field.options.map((opt) => (
                                 <option key={opt} value={opt}>{opt}</option>
                               ))}
                             </select>
                           ) : (
                             <input 
                               name={field.name} 
                               value={sensors[field.name]} 
                               onChange={handleInputChange} 
                               type="number" step="0.1" 
                               className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-14 pr-4 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all text-gray-800 font-bold" 
                             />
                           )}
                         </div>
                       </div>
                     ))}
                 </div>

                 {/* Action Buttons */}
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                     <button 
                       onClick={handleIngest}
                       disabled={loadingIngest || loadingSearch} 
                       className="py-3.5 bg-gray-100 hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center space-x-2 group"
                     >
                        {loadingIngest ? <Activity className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5 text-gray-400 group-hover:text-emerald-500 transition-colors" /> <span>Store Memory</span></>}
                     </button>

                     <button 
                       onClick={handleSearch}
                       disabled={loadingIngest || loadingSearch} 
                       className="py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center space-x-2 group"
                     >
                        {loadingSearch ? <Activity className="animate-spin w-5 h-5" /> : <><Search className="w-5 h-5" /> <span>Reason & Solve</span></>}
                     </button>
                 </div>
             </div>
          </div>
        </div>

        {/* --- OUTPUT SECTION --- */}

        {/* 1. Decision Card (Supervisor) */}
        {decision && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white border border-emerald-100 rounded-3xl overflow-hidden shadow-xl shadow-emerald-500/10 relative">
              {/* Background Decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50"></div>

              <div className="p-6 border-b border-gray-100 flex justify-between items-center relative z-10 bg-white/80 backdrop-blur-sm">
                <h3 className="text-gray-900 font-bold text-lg flex items-center gap-2">
                  <div className="bg-emerald-500 text-white p-1.5 rounded-lg"><Brain size={18}/></div>
                  Demeter Recommendation
                </h3>
                <button 
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                >
                  <Search size={12}/> View Logic Trace
                </button>
              </div>

              <div className="p-8 relative z-10">
                <p className="text-xl text-gray-700 leading-relaxed font-medium">
                  {decision.reasoning || "Analyzing..."}
                </p>
              </div>

              {showExplanation && (
                 <div className="bg-gray-50 p-6 border-t border-gray-200 animate-in slide-in-from-top-2">
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                     Supervisor Thought Process
                   </h4>
                   <div className="text-gray-600 text-sm whitespace-pre-wrap font-mono leading-relaxed bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                     {explanationText || "Generating logic trace..."}
                   </div>
                 </div>
              )}
            </div>
          </div>
        )}

        {/* 2. Search Results Grid */}
        {searchResults.length > 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-500" />
                Retrieved Memory Matches
              </h2>
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                {searchResults.length} SIMILAR CASES FOUND
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((res) => (
                <div key={res.id} className="bg-white border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10 transition-all group relative overflow-hidden flex flex-col">
                  {/* Confidence Badge */}
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-lg z-10">
                    {(res.score * 100).toFixed(1)}% MATCH
                  </div>
                  
                  {/* Card Header */}
                  <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Sprout className="w-5 h-5 text-emerald-500" />
                      {res.payload.crop}
                    </h3>
                    <span className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1 block">
                      {res.payload.stage} Phase
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-4 flex-1">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center gap-2 font-medium"><Calendar className="w-4 h-4 text-gray-400" /> Date</div>
                      <span className="font-mono text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {res.payload.timestamp ? new Date(res.payload.timestamp).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                         <div className="text-center p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                            <div className="text-[10px] text-emerald-600 font-bold uppercase">pH Level</div>
                            <div className="text-emerald-800 font-mono font-bold text-lg">{res.payload.sensor_data?.pH || '-'}</div>
                         </div>
                         <div className="text-center p-2 rounded-lg bg-yellow-50 border border-yellow-100">
                            <div className="text-[10px] text-yellow-600 font-bold uppercase">EC Level</div>
                            <div className="text-yellow-800 font-mono font-bold text-lg">{res.payload.sensor_data?.EC || '-'}</div>
                         </div>
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div className="p-4 border-t border-gray-100 bg-white">
                    <button className="w-full py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-bold uppercase rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:text-blue-600 group-hover:border-blue-200">
                      <span>Load Full Context</span> <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}