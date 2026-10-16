import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Play, Pause, ArrowRight, UserCheck, Sparkles } from 'lucide-react';
import { authAPI, voiceAPI } from '../api';

export default function VoiceSelectionScreen({ user, onVoiceSelected }) {
  const [selectedVoice, setSelectedVoice] = useState('voice_1_male');
  const [playingVoice, setPlayingVoice] = useState(null); // 'voice_1_male' or 'voice_2_female'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const audioRef1 = useRef(null);
  const audioRef2 = useRef(null);

  const voice1Url = voiceAPI.getPreviewUrl('voice_1_male');
  const voice2Url = voiceAPI.getPreviewUrl('voice_2_female');

  const togglePlay = (voiceType, audioRef) => {
    if (playingVoice === voiceType) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingVoice(null);
    } else {
      // Pause other audio
      if (audioRef1.current) audioRef1.current.pause();
      if (audioRef2.current) audioRef2.current.pause();

      if (audioRef.current) {
        // Cache-busting timestamp ensures browser fetches fresh voice audio without cache
        audioRef.current.src = `${voiceAPI.getPreviewUrl(voiceType)}&ts=${Date.now()}`;
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => {
          setPlayingVoice(voiceType);
        }).catch(err => {
          console.error("Audio playback error:", err);
          setPlayingVoice(null);
        });
      }
    }
  };

  const handleAudioEnded = () => {
    setPlayingVoice(null);
  };

  const handleConfirm = async () => {
    try {
      setSaving(true);
      // Stop any playing preview audio
      if (audioRef1.current) audioRef1.current.pause();
      if (audioRef2.current) audioRef2.current.pause();
      await authAPI.saveVoice(user.generated_user_id, selectedVoice);
      onVoiceSelected(selectedVoice);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save voice selection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-40 animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        
        {/* Hidden Audio Elements */}
        <audio ref={audioRef1} src={voice1Url} onEnded={handleAudioEnded} preload="none" />
        <audio ref={audioRef2} src={voice2Url} onEnded={handleAudioEnded} preload="none" />

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Select your Agent Voice
            </h2>
            <p className="text-xs text-slate-400">
              Thaagam Foundations • Done by Rajasekaran M
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4 mb-8">
          
          {/* Voice 1: Male Voice */}
          <div
            onClick={() => setSelectedVoice('voice_1_male')}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              selectedVoice === 'voice_1_male'
                ? 'bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-950/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="agentVoice"
                  checked={selectedVoice === 'voice_1_male'}
                  onChange={() => setSelectedVoice('voice_1_male')}
                  className="w-4 h-4 text-emerald-500 accent-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Voice 1: Blake (Male voice)</h3>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Blake • Male
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Helpful, confident, and authoritative male tone</p>
                </div>
              </div>

              {/* Play / Preview Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay('voice_1_male', audioRef1);
                }}
                className={`p-2.5 rounded-full border transition flex items-center justify-center ${
                  playingVoice === 'voice_1_male'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg scale-105'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                }`}
                title={playingVoice === 'voice_1_male' ? "Pause Preview" : "Play Blake (Male) Preview"}
              >
                {playingVoice === 'voice_1_male' ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5 fill-current" />
                )}
              </button>
            </div>

            {/* Audio Waveform only appears when preview is clicked/playing */}
            {playingVoice === 'voice_1_male' && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-3 animate-fade-in">
                <span className="text-[11px] text-emerald-400 font-semibold shrink-0">Playing Blake Preview:</span>
                <div className="flex-1 flex items-center gap-1 h-6">
                  {[14, 26, 18, 30, 22, 28, 16, 32, 20, 24, 18, 28, 14, 22, 16, 20].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(6, (h + (i % 4) * 5) % 28)}px` }}
                      className="w-1 rounded-full bg-emerald-400 animate-pulse"
                    />
                  ))}
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">Live Sample</span>
              </div>
            )}
          </div>

          {/* Voice 2: Female Voice (Jacqueline) */}
          <div
            onClick={() => setSelectedVoice('voice_2_female')}
            className={`cursor-pointer p-4 rounded-xl border transition-all ${
              selectedVoice === 'voice_2_female'
                ? 'bg-emerald-950/20 border-emerald-500 shadow-md shadow-emerald-950/40'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="agentVoice"
                  checked={selectedVoice === 'voice_2_female'}
                  onChange={() => setSelectedVoice('voice_2_female')}
                  className="w-4 h-4 text-emerald-500 accent-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Voice 2: Jacqueline (Female voice)</h3>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      Jacqueline • Female
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Reassuring, cheerful, and melodic feminine tone</p>
                </div>
              </div>

              {/* Play / Preview Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay('voice_2_female', audioRef2);
                }}
                className={`p-2.5 rounded-full border transition flex items-center justify-center ${
                  playingVoice === 'voice_2_female'
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg scale-105'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                }`}
                title={playingVoice === 'voice_2_female' ? "Pause Preview" : "Play Jacqueline (Female) Preview"}
              >
                {playingVoice === 'voice_2_female' ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5 fill-current" />
                )}
              </button>
            </div>

            {/* Audio Waveform only appears when preview is clicked/playing */}
            {playingVoice === 'voice_2_female' && (
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center gap-3 animate-fade-in">
                <span className="text-[11px] text-pink-400 font-semibold shrink-0">Playing Jacqueline Preview:</span>
                <div className="flex-1 flex items-center gap-1 h-6">
                  {[12, 24, 18, 30, 16, 28, 20, 32, 14, 26, 18, 22, 28, 14, 20, 16].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${Math.max(6, (h + (i % 3) * 6) % 30)}px` }}
                      className="w-1 rounded-full bg-pink-400 animate-pulse"
                    />
                  ))}
                </div>
                <span className="text-[10px] text-pink-400 font-mono">Live Sample</span>
              </div>
            )}
          </div>

        </div>

        <button
          type="button"
          disabled={saving}
          onClick={handleConfirm}
          className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition"
        >
          {saving ? 'Saving...' : (
            <>
              <span>Confirm Voice & Enter Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

      </div>
    </div>
  );
}
