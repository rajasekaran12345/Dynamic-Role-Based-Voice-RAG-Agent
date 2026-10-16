import React from 'react';
import { Settings, Key, Volume2, Database, FileText, CheckCircle2, Cpu, Wrench, Trash2 } from 'lucide-react';

export default function Sidebar({
  retrievalMethod,
  setRetrievalMethod,
  selectedVoice,
  onVoiceChange,
  apiKey,
  setApiKey,
  documents,
  onDeleteDocument,
  onOpenMcpModal
}) {
  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900/90 backdrop-blur flex flex-col h-full shrink-0">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Settings className="w-4 h-4 text-emerald-400" />
          <span>Control Panel</span>
        </div>
        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Live
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">

        {/* 1. Retrieval Method Dropdown (Wireframe Image 1) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>RAG Retrieval Method</span>
          </label>
          <div className="relative">
            <select
              value={retrievalMethod}
              onChange={(e) => setRetrievalMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500 cursor-pointer transition appearance-none"
            >
              <option value="sparse">Sparse Retrieval (BM25)</option>
              <option value="semantic">Semantic Retrieval (Vector - Pinecone)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 text-xs">
              ▼
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
            {retrievalMethod === 'sparse'
              ? 'Local high-speed keyword matching using Rank-BM25.'
              : 'Deep semantic vectors via Pinecone Serverless & text-embedding-004.'}
          </p>
        </div>

        {/* 2. Interactive Voice Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Voice Character:-</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>LiveKit</span>
            </div>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onVoiceChange && onVoiceChange('voice_1_male')}
              className={`p-2.5 rounded-xl border text-xs font-medium transition flex flex-col items-center justify-center gap-1 ${
                selectedVoice === 'voice_1_male'
                  ? 'bg-blue-950/50 border-blue-500 text-blue-300 shadow-sm shadow-blue-950/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-bold">Voice 1: Blake</span>
              <span className="text-[10px] opacity-80">Male (Cartesia Sonic)</span>
            </button>
            <button
              type="button"
              onClick={() => onVoiceChange && onVoiceChange('voice_2_female')}
              className={`p-2.5 rounded-xl border text-xs font-medium transition flex flex-col items-center justify-center gap-1 ${
                selectedVoice === 'voice_2_female'
                  ? 'bg-pink-950/50 border-pink-500 text-pink-300 shadow-sm shadow-pink-950/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="font-bold">Voice 2: Jacqueline</span>
              <span className="text-[10px] opacity-80">Female (Cartesia Sonic)</span>
            </button>
          </div>
        </div>

        {/* 3. API Key Input (Wireframe Image 1) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span>API key:-</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your Gemini API Key / Auth Key (AQ... or AIza...)"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs outline-none focus:border-emerald-500 font-mono transition"
          />
          <div className="mt-1.5 flex flex-col gap-1">
            {apiKey && (apiKey.startsWith('AQ.') || apiKey.startsWith('AIzaSy')) ? (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                ✓ Valid Gemini Key format ({apiKey.startsWith('AQ.') ? 'Auth Key AQ...' : 'Standard Key AIzaSy...'})
              </span>
            ) : apiKey ? (
              <span className="text-[10px] text-slate-300 font-mono">
                Key entered ({apiKey.length} chars)
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 leading-tight">
                Get your key from{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  aistudio.google.com
                </a>
              </span>
            )}
            <p className="text-[10px] text-slate-500">
              Stored in local session memory. Never saved to SQLite.
            </p>
          </div>
        </div>

        {/* 4. MCP Tools Trigger */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-400" />
            <span>MCP Tools (15 Functions)</span>
          </label>
          <button
            type="button"
            onClick={onOpenMcpModal}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            <span>Open MCP Tool Explorer</span>
          </button>
        </div>

        {/* 5. Isolated Documents in Namespace */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>User Documents ({documents.length})</span>
            </span>
          </label>
          
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {documents.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic p-2 bg-slate-950/50 rounded-lg text-center">
                No documents uploaded yet. Use the (+) button below to attach files.
              </p>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs hover:border-slate-700 transition"
                >
                  <div className="truncate mr-2 flex-1">
                    <span className="text-slate-200 font-medium truncate block">{doc.filename}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {doc.chunk_count} chunks • {doc.file_type.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <button
                      type="button"
                      onClick={() => onDeleteDocument && onDeleteDocument(doc.id, doc.filename)}
                      title={`Remove ${doc.filename}`}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="p-3 border-t border-slate-800 text-center text-[10px] text-slate-400 font-mono">
        Thaagam Foundations • Done by <span className="text-emerald-400 font-semibold">Rajasekaran M</span>
      </div>
    </aside>
  );
}
