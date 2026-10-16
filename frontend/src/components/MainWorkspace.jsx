import React, { useState, useEffect } from 'react';
import { User, LogOut, Copy, Check, Bot, FileText, Globe, ExternalLink } from 'lucide-react';
import ChatArea from './ChatArea';
import Sidebar from './Sidebar';
import McpModal from './McpModal';
import { documentAPI, authAPI } from '../api';

export default function MainWorkspace({ user, initialConfig, onLogout }) {
  const [retrievalMethod, setRetrievalMethod] = useState('sparse'); // 'sparse' or 'semantic'
  const [selectedVoice, setSelectedVoice] = useState(initialConfig?.selected_voice || 'voice_1_male');
  const [apiKey, setApiKeyState] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  const setApiKey = (val) => {
    setApiKeyState(val);
    localStorage.setItem('gemini_api_key', val);
  };
  const [documents, setDocuments] = useState([]);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState(initialConfig?.system_prompt || '');

  const loadDocuments = () => {
    documentAPI.list(user.generated_user_id)
      .then(res => setDocuments(res.data || []))
      .catch(err => console.error("Error listing documents:", err));
  };

  useEffect(() => {
    loadDocuments();
  }, [user.generated_user_id]);

  const copyUserId = () => {
    navigator.clipboard.writeText(user.generated_user_id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleVoiceChange = (newVoice) => {
    setSelectedVoice(newVoice);
    authAPI.saveVoice(user.generated_user_id, newVoice).catch(console.error);
  };

  const handleDeleteDocument = async (docId, filename) => {
    if (!window.confirm(`Are you sure you want to remove '${filename}'? This will delete the file and purge all its indexed vectors.`)) {
      return;
    }
    try {
      await documentAPI.delete(docId, user.generated_user_id);
      loadDocuments();
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document: " + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      
      {/* Top Workspace Navbar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Thaagam Foundations
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-normal">
                Multi-Tenant RAG
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">
              Done by <span className="text-emerald-400 font-semibold">Rajasekaran M</span> • Role-Based AI Agent
            </p>
          </div>
        </div>

        {/* User Badge & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Creator Portfolio Redirect Button */}
          <a
            href="https://rajasekaranm-public-portfolio-page.streamlit.app/"
            target="_blank"
            rel="noopener noreferrer"
            title="Creator: Rajasekaran M (Click to view official portfolio)"
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/30 text-emerald-400 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold group shadow-sm"
          >
            <Globe className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="hidden lg:inline text-slate-200">Creator: Rajasekaran M</span>
            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-400" />
          </a>

          {/* User ID Pill */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-300 font-medium">{user.name}</span>
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
              {user.role}
            </span>
            <button
              onClick={copyUserId}
              title="Copy your multi-tenant User ID"
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-white transition ml-1"
            >
              <span>{user.generated_user_id}</span>
              {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            title="Logout and switch account"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>

      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left / Center: Chat Area */}
        <ChatArea
          user={user}
          retrievalMethod={retrievalMethod}
          selectedVoice={selectedVoice}
          apiKey={apiKey}
          onDocumentUploaded={loadDocuments}
        />

        {/* Right: Control Sidebar (Wireframe Image 1) */}
        <Sidebar
          retrievalMethod={retrievalMethod}
          setRetrievalMethod={setRetrievalMethod}
          selectedVoice={selectedVoice}
          onVoiceChange={handleVoiceChange}
          apiKey={apiKey}
          setApiKey={setApiKey}
          documents={documents}
          onDeleteDocument={handleDeleteDocument}
          onOpenMcpModal={() => setShowMcpModal(true)}
        />

      </div>

      {/* MCP Tools Modal */}
      {showMcpModal && (
        <McpModal
          user={user}
          apiKey={apiKey}
          onClose={() => setShowMcpModal(false)}
          onRefreshDocs={loadDocuments}
        />
      )}

    </div>
  );
}
