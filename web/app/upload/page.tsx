"use client";

import { useState } from "react";
import { Upload, Save, Activity, Droplets, Thermometer, Wind } from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Sensor State
  const [sensors, setSensors] = useState({
    pH: "6.0",
    EC: "1.2",
    temp: "24.0",
    humidity: "60",
    crop: "Lettuce",
    stage: "Vegetative"
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSensors({ ...sensors, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return alert("Please select an image");

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    // Append sensor data as JSON string or individual fields
    formData.append("sensors", JSON.stringify({
        pH: parseFloat(sensors.pH),
        EC: parseFloat(sensors.EC),
        temp: parseFloat(sensors.temp),
        humidity: parseFloat(sensors.humidity)
    }));
    formData.append("metadata", JSON.stringify({
        crop: sensors.crop,
        stage: sensors.stage
    }));

    try {
      const res = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        alert("FMU Created & Stored Successfully! 🌱");
        // Reset form
        setFile(null);
        setPreview(null);
      } else {
        alert("Error uploading data.");
      }
    } catch (error) {
      console.error(error);
      alert("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
        
        {/* --- Left Column: Image Upload --- */}
        <div className="space-y-6">
          <div className="relative border-2 border-dashed border-slate-700 bg-slate-900/50 rounded-2xl h-96 flex flex-col items-center justify-center hover:border-emerald-500/50 transition-colors group">
            <input 
              type="file" 
              onChange={handleFileChange} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            {preview ? (
              <img src={preview} alt="Preview" className="h-full w-full object-cover rounded-2xl opacity-80" />
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

        {/* --- Right Column: Sensor Data --- */}
        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">New Entry</h1>
                <p className="text-slate-500">Manual override for Sentinel Agent.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-xs font-mono text-emerald-400 uppercase">pH Level</label>
                    <div className="relative">
                        <Droplets className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input name="pH" value={sensors.pH} onChange={handleInputChange} type="number" step="0.1" className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-mono text-yellow-400 uppercase">EC (mS/cm)</label>
                    <div className="relative">
                        <Activity className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input name="EC" value={sensors.EC} onChange={handleInputChange} type="number" step="0.1" className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-yellow-500 outline-none transition-all" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-mono text-red-400 uppercase">Temp (°C)</label>
                    <div className="relative">
                        <Thermometer className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input name="temp" value={sensors.temp} onChange={handleInputChange} type="number" step="0.1" className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-red-500 outline-none transition-all" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-mono text-blue-400 uppercase">Humidity (%)</label>
                    <div className="relative">
                        <Wind className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input name="humidity" value={sensors.humidity} onChange={handleInputChange} type="number" step="1" className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <select name="crop" value={sensors.crop} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                    <option>Lettuce</option>
                    <option>Basil</option>
                    <option>Tomato</option>
                </select>
                <select name="stage" value={sensors.stage} onChange={handleInputChange} className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-3 outline-none">
                    <option>Seedling</option>
                    <option>Vegetative</option>
                    <option>Flowering</option>
                    <option>Harvest</option>
                </select>
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center justify-center space-x-2">
                {loading ? <Activity className="animate-spin w-5 h-5" /> : <><Save className="w-5 h-5" /> <span>Store Memory Unit</span></>}
            </button>
        </form>
      </div>
    </main>
  );
}