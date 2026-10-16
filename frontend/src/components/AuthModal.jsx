import React, { useState } from 'react';
import { UserPlus, LogIn, Shield, CheckCircle2, Copy, ArrowRight, AlertCircle } from 'lucide-react';
import { authAPI } from '../api';

export default function AuthModal({ onRegistered, onLoggedIn }) {
  const [mode, setMode] = useState('register'); // 'register' or 'login'
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [loginUserId, setLoginUserId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedUser, setGeneratedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !role.trim()) {
      setError('Please provide both Name and Role.');
      return;
    }

    try {
      setLoading(true);
      const res = await authAPI.register(name, role);
      if (res.data && res.data.user) {
        setGeneratedUser(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedAfterRegistration = () => {
    if (generatedUser) {
      onRegistered(generatedUser);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginUserId.trim()) {
      setError('Please enter your User ID.');
      return;
    }

    try {
      setLoading(true);
      const res = await authAPI.login(loginUserId.trim());
      if (res.data && res.data.user) {
        onLoggedIn(res.data.user, res.data.config);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid User ID. Please check your ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedUser?.generated_user_id) {
      navigator.clipboard.writeText(generatedUser.generated_user_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-40">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        
        {/* Top Header & Mode Toggle at top right */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {generatedUser ? 'ID Generated' : mode === 'register' ? 'Register' : 'Login'}
              </h2>
              <p className="text-xs text-slate-400">
                Thaagam Foundations • Done by <span className="text-emerald-400 font-medium">Rajasekaran M</span>
              </p>
            </div>
          </div>

          {!generatedUser && (
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  mode === 'register' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  mode === 'login' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Login
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Post-Registration Success Step */}
        {generatedUser ? (
          <div className="space-y-5 animate-fade-in">
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-white font-semibold text-base mb-1">Registration Successful!</h3>
              <p className="text-xs text-slate-400 mb-4">
                Your unique multi-tenant User ID has been created:
              </p>
              
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-950 border border-emerald-500/40 rounded-lg">
                <span className="font-mono text-emerald-400 text-sm font-bold tracking-wide break-all">
                  {generatedUser.generated_user_id}
                </span>
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition"
                  title="Copy User ID"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && <span className="text-xs text-emerald-400 block mt-1">Copied to clipboard!</span>}
            </div>

            <p className="text-xs text-slate-400 text-center">
              Please save this User ID for future logins. Next, configure your personal AI Agent instructions.
            </p>

            <button
              type="button"
              onClick={handleProceedAfterRegistration}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
            >
              <span>Configure Agent Prompt</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : mode === 'register' ? (
          /* Wireframe Screen 2: User id Creation page (Register) */
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Name:-
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Alex Johnson"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-white placeholder-slate-500 text-sm outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Role:-
              </label>
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., HR, Manager, Legal, Auditor"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-white placeholder-slate-500 text-sm outline-none transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {loading ? 'Registering...' : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>login (Submit Registration)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Wireframe Screen 3: Login page */
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                user id:-
              </label>
              <input
                type="text"
                required
                value={loginUserId}
                onChange={(e) => setLoginUserId(e.target.value)}
                placeholder="e.g., 8573_John_HR"
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl text-white placeholder-slate-500 font-mono text-sm outline-none transition"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Login to Workspace</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
