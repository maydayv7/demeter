import Link from "next/link";
import { Leaf, Database, ArrowRight, CheckCircle2, Sprout, Globe2, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30 flex flex-col">
      
      {/* --- Top Navigation (Shifted Up) --- */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-20 h-14">
        <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Leaf className="w-5 h-5 text-emerald-500" />
            <span className="text-lg font-bold tracking-tight text-white">
              Demeter <span className="text-emerald-500">OS</span>
            </span>
          </div>
          <div className="flex items-center space-x-6 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span>System Online</span>
            </div>
            <div className="flex items-center space-x-1">
              <Database className="w-3 h-3" />
              <span>Memory Active</span>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Main Content --- */}
      <div className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col justify-center">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: Title & Vision */}
          <div className="space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 leading-tight">
              The Future of <br /> Farming is Agentic.
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Demeter is a multi-agent AI system that transforms raw hydroponic data into evidence-backed decisions. By leveraging long-term vector memory, we don't just grow plants—we evolve recipes for perfect yields.
            </p>
          </div>

          {/* Right: The "Why" (Bullet Points) */}
          <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-2xl backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-400" />
              Why Automated Hydroponics?
            </h3>
            
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="mt-1 bg-emerald-500/10 p-1 rounded-full">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <strong className="text-slate-200 block">Precision & Consistency</strong>
                  <span className="text-slate-400 text-sm">AI Agents monitor pH & EC 24/7, eliminating human error and ensuring optimal nutrient uptake for every growth stage.</span>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 bg-blue-500/10 p-1 rounded-full">
                  <Globe2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <strong className="text-slate-200 block">The Future of Food Security</strong>
                  <span className="text-slate-400 text-sm">With arable land shrinking, hydroponics occupies 90% less water and space, dominating the future agricultural market share.</span>
                </div>
              </li>

              <li className="flex items-start gap-4">
                <div className="mt-1 bg-yellow-500/10 p-1 rounded-full">
                  <Zap className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <strong className="text-slate-200 block">Memory-Driven Yields</strong>
                  <span className="text-slate-400 text-sm">Unlike static farms, Demeter "remembers" past successes via Vector Database, constantly optimizing growth cycles.</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* --- Bottom Right CTA --- */}
        <div className="mt-16 flex justify-end">
          <Link href="/upload">
            <button className="group flex items-center space-x-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-full text-lg font-bold transition-all shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/20 hover:-translate-y-1">
              <span>Try Now</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>

      </div>
    </main>
  );
}