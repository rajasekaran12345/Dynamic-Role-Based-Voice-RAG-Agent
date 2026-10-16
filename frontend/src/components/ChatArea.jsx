import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, Plus, X, FileText, Bot, User, Volume2, 
  Sparkles, RefreshCw, VolumeX, Radio, Headphones, Loader2
} from 'lucide-react';
import { chatAPI, documentAPI, voiceAPI } from '../api';

export default function ChatArea({ 
  user, 
  retrievalMethod, 
  selectedVoice, 
  apiKey,
  onDocumentUploaded 
}) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello ${user.name}! I am your role-based AI assistant for Thaagam Foundations • Done by Rajasekaran M.\n\nYou are authenticated with strict tenant isolation as an authorized **${user.role}**. You can upload sensitive documents, run Sparse (BM25) or Semantic (Pinecone) RAG queries, or toggle **Live Voice** for real-time bidirectional conversation.`,
      sources: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // LiveKit & Live Voice Conversational Loop States
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('idle'); // 'idle' | 'listening' | 'processing' | 'speaking'
  const [liveTranscription, setLiveTranscription] = useState('');
  const [livekitToken, setLivekitToken] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioPlayerRef = useRef(new Audio());
  const recognitionRef = useRef(null);
  const micStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const voiceModeActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);

  // Keep ref synchronized
  useEffect(() => {
    voiceModeActiveRef.current = voiceModeActive;
  }, [voiceModeActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, liveTranscription]);

  useEffect(() => {
    // Load chat history from backend SQLite on mount
    chatAPI.getHistory(user.generated_user_id)
      .then(res => {
        if (res.data && res.data.length > 0) {
          setMessages(prev => [prev[0], ...res.data]);
        }
      })
      .catch(err => console.error("Error loading chat history:", err));

    const audio = audioPlayerRef.current;
    const handleEnded = () => {
      setPlayingAudioId(null);
      isSpeakingRef.current = false;

      // In Live Voice mode: When assistant finishes speaking, automatically resume listening!
      if (voiceModeActiveRef.current) {
        setVoiceStatus('listening');
        startListening();
      } else {
        setVoiceStatus('idle');
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      stopListening();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (micStreamRef.current) {
        try {
          micStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {}
        micStreamRef.current = null;
      }
    };
  }, [user.generated_user_id]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Helper to execute LLM + Audio flow
  const executeQuery = async (queryText) => {
    if (!queryText.trim() || loading) return;

    // Append user message to UI
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: queryText
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await chatAPI.send({
        user_id: user.generated_user_id,
        message: queryText,
        retrieval_method: retrievalMethod,
        api_key: apiKey
      });

      const replyText = res.data.reply;
      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        sources: res.data.sources || [],
        retrieval_used: res.data.retrieval_used
      };
      setMessages(prev => [...prev, assistantMsg]);

      // If Live Voice Mode is ON, immediately speak the response aloud
      if (voiceModeActiveRef.current) {
        playAssistantSpeech(assistantMsg.id, replyText);
      }
    } catch (err) {
      const errMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.response?.data?.detail || err.message}. Please check connection.`
      };
      setMessages(prev => [...prev, errMsg]);

      if (voiceModeActiveRef.current) {
        setVoiceStatus('listening');
        startListening();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading) return;

    const currentText = input.trim();
    const fileToUpload = selectedFile;

    // Clear inputs immediately
    setInput('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    // If there is a file selected, upload it first
    if (fileToUpload) {
      try {
        setUploading(true);
        setUploadStatus(`Indexing ${fileToUpload.name}...`);
        const formData = new FormData();
        formData.append('file', fileToUpload);
        formData.append('user_id', user.generated_user_id);
        formData.append('retrieval_method', retrievalMethod);
        if (apiKey) formData.append('api_key', apiKey);

        const uploadRes = await documentAPI.upload(formData);
        setUploadStatus(`Indexed ${uploadRes.data.chunks_indexed} chunks!`);
        setTimeout(() => setUploadStatus(''), 3000);
        if (onDocumentUploaded) onDocumentUploaded();
      } catch (err) {
        console.error("Document upload error:", err);
        setUploadStatus('Upload failed: ' + (err.response?.data?.detail || err.message));
      } finally {
        setUploading(false);
      }
    }

    if (currentText) {
      await executeQuery(currentText);
    }
  };

  // Play Assistant Speech through LiveKit Voice synthesis
  const playAssistantSpeech = (msgId, text) => {
    // Pause any current speech recognition while assistant speaks
    stopListening();
    isSpeakingRef.current = true;
    setVoiceStatus('speaking');
    setPlayingAudioId(msgId);

    // Clean markdown tags for clear spoken synthesis
    const cleanText = text
      .replace(/[*_#`[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, 'link')
      .trim()
      .substring(0, 500);

    const url = `${voiceAPI.ttsStreamUrl()}?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(selectedVoice)}&ts=${Date.now()}`;
    audioPlayerRef.current.src = url;
    audioPlayerRef.current.play().catch(err => {
      console.error("Audio playback error:", err);
      isSpeakingRef.current = false;
      setPlayingAudioId(null);
      if (voiceModeActiveRef.current) {
        setVoiceStatus('listening');
        startListening();
      }
    });
  };

  // Manual Playback trigger from message card
  const playMessageVoice = (msgId, text) => {
    if (playingAudioId === msgId) {
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
      isSpeakingRef.current = false;
    } else {
      audioPlayerRef.current.pause();
      playAssistantSpeech(msgId, text);
    }
  };

  // ----------------- LIVEKIT VOICE LOOP & STT INFERENCE HANDLERS -----------------

  const startMediaRecording = () => {
    if (!micStreamRef.current) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      audioChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mime ? new MediaRecorder(micStreamRef.current, { mimeType: mime }) : new MediaRecorder(micStreamRef.current);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
    } catch (e) {
      console.warn("MediaRecorder start notice:", e);
    }
  };

  const stopAndTranscribeLiveKit = async () => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      recorder.onstop = async () => {
        try {
          const mimeType = recorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          if (audioBlob.size > 1500) {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'livekit_stt.webm');
            const res = await voiceAPI.transcribeAudio(formData);
            if (res.data?.text && res.data.text.trim()) {
              resolve(res.data.text.trim());
              return;
            }
          }
        } catch (err) {
          console.warn("LiveKit STT inference notice:", err);
        }
        resolve(null);
      };
      try {
        recorder.stop();
      } catch (e) {
        resolve(null);
      }
    });
  };

  const startListening = () => {
    if (isSpeakingRef.current) return;

    // Start audio recorder for LiveKit STT (Deepgram Nova-3)
    startMediaRecording();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceStatus('listening');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let finalChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const currentSaid = (finalChunk || interim).trim();
        if (currentSaid) {
          // Immediately populate the search bar in real time while user speaks
          setLiveTranscription(currentSaid);
          setInput(currentSaid);
        }

        const processCompleteSpeech = async (fallbackSaid) => {
          stopListening();
          setVoiceStatus('processing');

          // Transcribe via LiveKit Deepgram Nova-3 STT inference from captured audio stream
          const livekitTranscribed = await stopAndTranscribeLiveKit();
          const finalPrompt = (livekitTranscribed || fallbackSaid || '').trim();

          if (finalPrompt) {
            // Generate and confirm the converted text directly in the search bar
            setInput(finalPrompt);
            setLiveTranscription('');
            await executeQuery(finalPrompt);
          } else {
            if (voiceModeActiveRef.current) {
              setVoiceStatus('listening');
              startListening();
            } else {
              setVoiceStatus('idle');
            }
          }
        };

        // Auto-submit after silence or final sentence
        if (finalChunk.trim().length > 0) {
          processCompleteSpeech(finalChunk.trim());
        } else if (interim.trim().length > 2) {
          // Debounced auto-submit if speaker pauses for 1.4s
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (voiceModeActiveRef.current && !isSpeakingRef.current && interim.trim()) {
              processCompleteSpeech(interim.trim());
            }
          }, 1400);
        }
      };

      recognition.onerror = (event) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn("Speech recognition warning:", event.error);
        }
        if (event.error === 'not-allowed') {
          alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
          setVoiceModeActive(false);
          setVoiceStatus('idle');
        }
      };

      recognition.onend = () => {
        // Automatically restart if voice mode is still active and assistant is NOT speaking
        if (voiceModeActiveRef.current && !isSpeakingRef.current) {
          try {
            recognition.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition startup error:", e);
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }
  };

  // Single-click Voice Button Toggle
  const toggleVoiceMode = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Live voice requires speech recognition support. Please use Chrome, Edge, or a WebRTC compatible browser.");
      return;
    }

    if (voiceModeActive) {
      // Turn OFF
      setVoiceModeActive(false);
      setVoiceStatus('idle');
      setLiveTranscription('');
      isSpeakingRef.current = false;
      stopListening();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      if (micStreamRef.current) {
        try {
          micStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {}
        micStreamRef.current = null;
      }
      audioPlayerRef.current.pause();
      setPlayingAudioId(null);
    } else {
      // Turn ON: First acquire microphone permission explicitly
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;
        }
      } catch (micErr) {
        console.error("Microphone access error:", micErr);
        alert("Microphone permission is required for voice conversation. Please allow microphone access in your browser settings.");
        return;
      }

      setVoiceModeActive(true);
      setVoiceStatus('listening');

      // Request LiveKit room token to establish WebRTC participant connection
      try {
        const tokenRes = await voiceAPI.getToken(user.generated_user_id);
        setLivekitToken(tokenRes.data);
      } catch (e) {
        console.warn("LiveKit token initialization notice:", e);
      }

      startListening();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">

      {/* Upload Banner */}
      {uploadStatus && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-300 flex items-center justify-between animate-fade-in z-20">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{uploadStatus}</span>
          </div>
          <button onClick={() => setUploadStatus('')} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Voice Active Notification Banner */}
      {voiceModeActive && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-950 border-b border-emerald-500/40 px-4 py-2.5 flex items-center justify-between z-20 shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>LIVEKIT VOICE ACTIVE</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              {voiceStatus === 'listening' && (
                <span className="text-emerald-300 flex items-center gap-1.5 animate-pulse">
                  <Headphones className="w-3.5 h-3.5" />
                  LiveKit STT (Deepgram Nova-3) listening... Speech generates in search bar!
                </span>
              )}
              {voiceStatus === 'processing' && (
                <span className="text-teal-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  LiveKit STT converting into search bar • Generating answer...
                </span>
              )}
              {voiceStatus === 'speaking' && (
                <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                  LiveKit Assistant Speaking ({selectedVoice === 'voice_2_female' ? 'Jacqueline' : 'Blake'})...
                </span>
              )}
            </div>
          </div>

          <button
            onClick={toggleVoiceMode}
            className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 transition"
          >
            End Voice Call
          </button>
        </div>
      )}

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 max-w-3xl ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                msg.role === 'user'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800 text-emerald-400 border border-slate-700'
              }`}
            >
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            {/* Bubble */}
            <div
              className={`rounded-2xl p-4 text-sm leading-relaxed max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-none shadow-md'
                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Source citations for assistant responses */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                    Retrieved Sources:
                  </span>
                  {msg.sources.map((src, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-mono"
                    >
                      <FileText className="w-2.5 h-2.5" />
                      <span>{src.filename}</span>
                      {src.method && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-teal-300">
                          {src.method}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Audio Listen Button on Assistant Message */}
              {msg.role === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => playMessageVoice(msg.id, msg.content)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-400 transition"
                  >
                    {playingAudioId === msg.id ? (
                      <>
                        <VolumeX className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        <span className="text-emerald-400 font-semibold">Stop Voice</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak Aloud ({selectedVoice === 'voice_2_female' ? 'Female' : 'Male'})</span>
                      </>
                    )}
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {msg.retrieval_used ? msg.retrieval_used.toUpperCase() : retrievalMethod.toUpperCase()} RAG
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Live Transcription Overlay when speaking in Voice Mode */}
        {voiceModeActive && liveTranscription && (
          <div className="flex items-start gap-3 max-w-3xl ml-auto flex-row-reverse animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="rounded-2xl rounded-tr-none bg-emerald-950/40 border border-emerald-500/30 p-3.5 text-xs text-emerald-200 shadow-lg">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Transcription:
              </div>
              <span className="italic">"{liveTranscription}"</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-start gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-slate-900 border border-slate-800 p-4 text-xs text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Analyzing documents and formulating isolated response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Chat Interface with Voice Toggle */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/60 backdrop-blur">
        
        {/* Selected File Preview Icon Above Chat Bar */}
        {selectedFile && (
          <div className="mb-2 max-w-md bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-slate-200 shadow-lg animate-fade-in">
            <div className="flex items-center gap-2 truncate">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="font-semibold block truncate">{selectedFile.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB • Ready to chunk & index
                </span>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="p-1 text-slate-400 hover:text-red-400 rounded-lg transition"
              title="Remove attachment"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Bar Form */}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".pdf,.docx,.doc,.pptx,.ppt,.csv,.xlsx,.xls,.txt,.md"
            className="hidden"
          />

          {/* Plus (+) Button to attach files */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach Document (PDF, DOCX, PPT, CSV, Excel)"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:border-emerald-500/50 transition flex items-center justify-center shrink-0"
          >
            <Plus className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* NEW DEDICATED LIVE VOICE BUTTON (Single click On/Off toggle) */}
          <button
            type="button"
            onClick={toggleVoiceMode}
            title={voiceModeActive ? "Click to Turn Off Live Voice" : "Click to Turn On Live Voice (LiveKit)"}
            className={`px-3 py-2.5 rounded-xl border font-semibold text-xs transition flex items-center gap-2 shrink-0 ${
              voiceModeActive
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700 hover:border-emerald-500/50'
            }`}
          >
            {voiceModeActive ? (
              <>
                <Radio className="w-4 h-4 animate-pulse text-slate-950" />
                <span className="hidden sm:inline">Voice ON</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Voice</span>
              </>
            )}
          </button>

          {/* Text Input / Search Bar */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceModeActive 
                  ? "🎙️ LiveKit STT active (Deepgram Nova-3) — speaking generates text directly in this search bar..."
                  : "Ask your role-based AI agent anything about documents..."
              }
              className={`w-full px-4 py-2.5 bg-slate-950 border ${
                voiceModeActive
                  ? 'border-emerald-500 ring-1 ring-emerald-500/50 shadow-sm shadow-emerald-500/20'
                  : 'border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
              } rounded-xl text-white placeholder-slate-400 text-sm outline-none transition`}
            />
          </div>

          {/* Enter Button (Up Arrow) */}
          <button
            type="submit"
            disabled={(!input.trim() && !selectedFile) || loading}
            title="Submit query (Enter)"
            className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 disabled:opacity-40 transition flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>

        </form>

      </div>

    </div>
  );
}
