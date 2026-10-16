import React, { useEffect } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';

export default function SplashScreen({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-50">
      <div className="relative max-w-lg w-full bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 sm:p-12 text-center shadow-2xl shadow-emerald-950/50 backdrop-blur-xl animate-fade-in">
        {/* Glow Effects */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl"></div>

        <div className="mx-auto w-16 h-16 mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShieldCheck className="w-10 h-10 animate-pulse" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-1">
          Thaagam Foundations
        </h1>

        <p className="text-sm font-semibold text-emerald-400 mb-4">
          Done by Rajasekaran M
        </p>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Role-Based Multi-Tenant Architecture
        </div>

        <p className="text-slate-300 text-base sm:text-lg font-medium leading-relaxed max-w-md mx-auto">
          Role-Based AI Agent for Secure Document Intelligence
        </p>

        <div className="mt-8 flex justify-center">
          <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full animate-pulse transition-all duration-1000 w-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
