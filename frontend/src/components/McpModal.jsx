import React from 'react';
import { X, Wrench, FileSearch, FileText, ListFilter, UserCheck, HelpCircle, ShieldCheck } from 'lucide-react';

const GENERAL_TOOLS = [
  {
    name: 'search_documents',
    title: 'Document Search (Hybrid RAG)',
    desc: 'Performs keyword (BM25) and semantic vector search strictly partitioned within your tenant namespace to retrieve relevant document chunks.',
    icon: FileSearch,
    badge: 'General'
  },
  {
    name: 'summarize_document',
    title: 'Document Summarizer',
    desc: 'Analyzes long-form documents (PDF, DOCX, TXT) and generates concise executive summaries, key findings, and core highlights.',
    icon: FileText,
    badge: 'General'
  },
  {
    name: 'extract_key_information',
    title: 'Key Information & Entity Extractor',
    desc: 'Extracts critical dates, monetary metrics, names, organizational responsibilities, and actionable deadlines from uploaded files.',
    icon: ListFilter,
    badge: 'General'
  }
];

const HR_TOOLS = [
  {
    name: 'summarize_resume',
    title: 'Candidate Resume Parser',
    desc: 'Extracts skills, work experience, certifications, and project achievements from authorized candidate resumes for talent evaluation.',
    icon: UserCheck,
    badge: 'HR-Specific'
  },
  {
    name: 'generate_interview_questions',
    title: 'Interview Question Generator',
    desc: 'Produces tailored technical, behavioral, and competency-based interview questions based on job requirements and candidate profiles.',
    icon: HelpCircle,
    badge: 'HR-Specific'
  },
  {
    name: 'search_hr_policies',
    title: 'HR Policy & Compliance Lookup',
    desc: 'Answers questions regarding company leave rules, attendance guidelines, employee benefits, and onboarding compliance from authorized HR documentation.',
    icon: ShieldCheck,
    badge: 'HR-Specific'
  }
];

export default function McpModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                Model Context Protocol (MCP) Tools
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  6 Configured
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Tenant isolation enforced for user: <span className="font-mono text-emerald-400">{user.generated_user_id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Reference Catalog */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          
          {/* General Tools Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                General Tools (3)
              </span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {GENERAL_TOOLS.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-800 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-white">{tool.title}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {tool.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HR-Specific Tools Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                HR-Specific Tools (3)
              </span>
              <div className="h-px flex-1 bg-slate-800" />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {HR_TOOLS.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-800 text-teal-400 rounded-lg shrink-0 mt-0.5">
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold text-white">{tool.title}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                            {tool.name}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{tool.desc}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <span>Thaagam Foundations • Done by Rajasekaran M</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition text-xs font-medium"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
