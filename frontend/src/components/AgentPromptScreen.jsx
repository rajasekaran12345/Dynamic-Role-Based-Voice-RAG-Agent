import React, { useState } from 'react';
import { ArrowUp, Bot, Sparkles, Check } from 'lucide-react';
import { authAPI } from '../api';

export default function AgentPromptScreen({ user, onPromptSaved }) {
  const [prompt, setPrompt] = useState(
    `You are the dedicated AI document intelligence assistant for ${user.name}, who serves in the role of ${user.role}. ` +
    `Strictly answer questions based on uploaded authorized documents and execute role-compliant workflows with utmost data security.`
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) {
      setError('Please provide instructions for your agent.');
      return;
    }

    try {
      setSaving(true);
      await authAPI.savePrompt(user.generated_user_id, prompt.trim());
      onPromptSaved(prompt.trim());
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save agent instructions.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-40">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-10 animate-fade-in">
        
        {/* Header matching wireframe Screen 4 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Please mention the instruction for your Agent
            </h2>
            <p className="text-xs text-slate-400">
              Thaagam Foundations • Done by <span className="text-emerald-400 font-semibold">Rajasekaran M</span> • Setting up for: <span className="text-white font-medium">{user.name} ({user.role})</span>
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Dynamic prompt input with inside Enter button (Arrow Up) matching wireframe */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative rounded-2xl border border-slate-700 bg-slate-950 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 p-2 transition">
            <textarea
              rows={7}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Dynamic prompt for Agent..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 p-3 text-sm sm:text-base outline-none resize-none leading-relaxed"
            />

            {/* Enter Button (Up Arrow) inside the bottom right corner */}
            <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-slate-800/60">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Dynamic Role Prompt
              </span>

              <button
                type="submit"
                disabled={saving || !prompt.trim()}
                title="Save Instructions (Enter button)"
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ArrowUp className="w-5 h-5 stroke-[2.5]" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
            <span>Click the enter button (↑) to save and proceed to Voice Selection</span>
            <span className="font-mono text-emerald-400/80">{user.generated_user_id}</span>
          </div>
        </form>

      </div>
    </div>
  );
}
