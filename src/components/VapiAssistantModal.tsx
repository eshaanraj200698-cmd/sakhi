import React, { useState, useEffect, useRef } from 'react';
import VapiRaw from '@vapi-ai/web';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Heart,
  MessageSquare,
  ArrowRight,
  Settings,
  AlertCircle,
  Activity
} from 'lucide-react';
import { LanguageCode } from '../types.ts';

const DEFAULT_VAPI_KEY = 'b8be1353-d15e-462b-9783-9186b7cec072';

// Resolve CJS / ESM bundler export differences for @vapi-ai/web
function getVapiConstructor(mod: any): any {
  if (typeof mod === 'function') return mod;
  if (mod && typeof mod.default === 'function') return mod.default;
  if (mod && mod.default && typeof mod.default.default === 'function') return mod.default.default;
  if (mod && typeof mod.Vapi === 'function') return mod.Vapi;
  return mod;
}

interface VapiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferTranscript: (transcript: string) => void;
  language: LanguageCode;
}

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  time: string;
}

// Extract friendly error messages from Vapi Web SDK error payloads
function extractErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred.';
  if (typeof err === 'string') return err;

  const innerMsg = err.error?.message || err.message || err.error?.msg;
  if (innerMsg) {
    if (Array.isArray(innerMsg)) return innerMsg.join('; ');
    return String(innerMsg);
  }

  if (err.type === 'daily-error' || err.type === 'daily-call-join-error') {
    return 'Could not connect audio stream. Please ensure microphone permissions are allowed in your browser.';
  }
  if (err.type === 'validation-error') {
    return 'Invalid assistant configuration. Please check your Assistant ID or language settings.';
  }
  if (err.type) {
    return `Voice service issue (${err.type}). Please try again or use browser dictation.`;
  }
  if (err.error && typeof err.error === 'string') return err.error;

  return 'Unable to establish voice connection. Please check microphone permissions.';
}

export const VapiAssistantModal: React.FC<VapiAssistantModalProps> = ({
  isOpen,
  onClose,
  onTransferTranscript,
  language
}) => {
  const [vapi, setVapi] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<'assistant' | 'user' | 'none'>('none');
  const [customAssistantId, setCustomAssistantId] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const userStatementsRef = useRef<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initialize Vapi client
  useEffect(() => {
    if (!isOpen) return;

    try {
      const apiKey =
        (import.meta as any).env?.VITE_VAPI_PUBLIC_KEY || DEFAULT_VAPI_KEY;

      const VapiClass = getVapiConstructor(VapiRaw);
      if (typeof VapiClass !== 'function') {
        throw new Error('Vapi constructor could not be resolved from @vapi-ai/web.');
      }

      const vapiInstance = new VapiClass(apiKey);

      vapiInstance.on('call-start', () => {
        setCallStatus('active');
        setErrorMsg(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            role: 'system',
            text: 'Voice consultation connected. Speak naturally with Sakhi.',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      });

      vapiInstance.on('call-end', () => {
        setCallStatus('idle');
        setActiveSpeaker('none');
      });

      vapiInstance.on('speech-start', () => {
        // Will be updated when transcript comes
      });

      vapiInstance.on('speech-end', () => {
        setActiveSpeaker('none');
      });

      vapiInstance.on('message', (msg: any) => {
        if (msg.type === 'transcript') {
          const role = msg.role === 'assistant' ? 'assistant' : 'user';
          setActiveSpeaker(role);

          if (msg.transcriptType === 'final' && msg.transcript?.trim()) {
            const newMsg: ChatMessage = {
              id: `msg_${Date.now()}_${Math.random()}`,
              role,
              text: msg.transcript.trim(),
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };

            setMessages((prev) => [...prev, newMsg]);

            if (role === 'user') {
              userStatementsRef.current.push(msg.transcript.trim());
            }
          }
        }
      });

      vapiInstance.on('error', (err: any) => {
        console.error('[Vapi Web SDK Error]', err);
        const readable = extractErrorMessage(err);
        setErrorMsg(readable);
        setCallStatus('idle');
        setActiveSpeaker('none');
      });

      setVapi(vapiInstance);

      return () => {
        try {
          vapiInstance.stop();
        } catch {
          // ignore
        }
      };
    } catch (e: any) {
      console.error('Failed to initialize Vapi:', e);
      setErrorMsg(extractErrorMessage(e));
    }
  }, [isOpen]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start Call Handler
  const handleStartCall = async () => {
    if (!vapi) return;
    setErrorMsg(null);
    setCallStatus('connecting');

    // 1. Proactively prompt for microphone permission
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (micErr: any) {
      console.warn('Microphone permission check failed:', micErr);
      setErrorMsg(
        'Microphone access was denied. Please allow microphone permissions in your browser to talk with Sakhi.'
      );
      setCallStatus('idle');
      return;
    }

    try {
      if (customAssistantId.trim()) {
        // Use user's specific assistant ID from their Vapi Dashboard
        await vapi.start(customAssistantId.trim());
      } else {
        // Safe deepgram nova-2 language: 'multi' for Kannada / multilingual, 'hi' for Hindi, 'en-IN' for English
        const safeLang =
          language === 'hi' || language === 'hinglish'
            ? 'hi'
            : language === 'kn'
            ? 'multi'
            : 'en-IN';

        await vapi.start({
          name: 'Sakhi Women Health Companion',
          firstMessage:
            language === 'kn'
              ? 'ನಮಸ್ಕಾರ! ನಾನು ಸಖಿ. ನಿಮ್ಮ ಮುಟ್ಟು, ಕೂದಲು ಅಥವಾ ಆರೋಗ್ಯದಲ್ಲಿ ಏನಾದರೂ ಬದಲಾವಣೆಗಳಿದ್ದರೆ ತಿಳಿಸಿ.'
              : language === 'hi' || language === 'hinglish'
              ? 'नमस्ते! मैं सखी हूँ। आप अपने पीरियड्स, बालों के झड़ने या किसी भी लक्षण के बारे में खुलकर बता सकती हैं।'
              : "Hello! I am Sakhi. Tell me what symptoms or menstrual cycle changes you've been noticing.",
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: safeLang
          },
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `You are Sakhi, an empathetic voice companion for women's hormonal health and the SakhiCheck symptom tool.
CRITICAL GUIDELINES:
- Greet the user warmly and empathetically.
- Gently ask about: (1) Menstrual cycle predictability or missed periods, (2) Hair shedding or pattern thinning, (3) Facial hair or acne, (4) Energy or fatigue.
- Keep all spoken replies SHORT (1 to 2 sentences max) so the conversation flows naturally.
- NEVER diagnose any condition. Do not say "you have PCOS". Instead say "these are symptoms worth discussing with a doctor".
- Language: Respond in simple, natural conversational style in ${
                  language === 'kn' ? 'Kannada' : language === 'hi' || language === 'hinglish' ? 'Hindi or Hinglish' : 'English'
                }.`
              }
            ]
          },
          voice: {
            provider: '11labs',
            voiceId: '21m00Tcm4TlvDq8ikWAM' // Rachel voice
          }
        });
      }
    } catch (err: any) {
      console.error('Call start error:', err);
      setErrorMsg(extractErrorMessage(err));
      setCallStatus('idle');
    }
  };

  // Stop Call Handler
  const handleStopCall = () => {
    if (vapi) {
      vapi.stop();
    }
    setCallStatus('idle');
    setActiveSpeaker('none');
  };

  // Mute / Unmute Handler
  const handleToggleMute = () => {
    if (vapi) {
      const nextMute = !isMuted;
      vapi.setMuted(nextMute);
      setIsMuted(nextMute);
    }
  };

  // Transfer Spoken Symptoms to SakhiCheck Analysis
  const handleEvaluateInSakhiCheck = () => {
    handleStopCall();
    const collectedText = userStatementsRef.current.join('. ');
    if (collectedText.trim()) {
      onTransferTranscript(collectedText.trim());
    } else if (messages.length > 0) {
      const userMsgs = messages.filter((m) => m.role === 'user').map((m) => m.text).join('. ');
      onTransferTranscript(userMsgs);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Heart className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight">Sakhi Voice Companion</h3>
                <span className="text-[10px] font-bold bg-white/25 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Powered by Vapi AI
                </span>
              </div>
              <p className="text-xs text-rose-100">
                Speak your symptoms naturally in real-time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
              title="Voice Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                handleStopCall();
                onClose();
              }}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Assistant ID Settings Drawer */}
        {showSettings && (
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 text-xs space-y-2 animate-in slide-in-from-top-2">
            <label className="font-semibold text-slate-700 block">
              Vapi Assistant ID (Optional):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customAssistantId}
                onChange={(e) => setCustomAssistantId(e.target.value)}
                placeholder="e.g. 8f61... (Leave blank to use pre-configured Sakhi Assistant)"
                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 bg-slate-800 text-white font-medium rounded-lg"
              >
                Done
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Vapi Public Key: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700">{DEFAULT_VAPI_KEY.slice(0, 8)}...</code>
            </p>
          </div>
        )}

        {/* Error Notification */}
        {errorMsg && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-xs text-red-800 space-y-1.5 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block">{errorMsg}</span>
                <span className="text-[11px] text-red-600">
                  Tip: Ensure microphone access is allowed in your browser address bar. You can also type an Assistant ID in Settings (⚙️) if you created one in your Vapi dashboard.
                </span>
              </div>
            </div>
            <div className="flex gap-2 pt-1 pl-6">
              <button
                onClick={handleStartCall}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition"
              >
                Retry Connection
              </button>
              <button
                onClick={() => {
                  setErrorMsg(null);
                  setShowSettings(true);
                }}
                className="px-2.5 py-1 bg-white hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-semibold transition"
              >
                Configure Assistant ID
              </button>
            </div>
          </div>
        )}

        {/* Active Speaker Visualizer Indicator */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                callStatus === 'active'
                  ? 'bg-emerald-500 animate-ping'
                  : callStatus === 'connecting'
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-slate-300'
              }`}
            />
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                {callStatus === 'active'
                  ? activeSpeaker === 'assistant'
                    ? 'Sakhi is speaking...'
                    : activeSpeaker === 'user'
                    ? 'Listening to you...'
                    : 'Call connected • Speak freely'
                  : callStatus === 'connecting'
                  ? 'Connecting to Vapi Voice Cloud...'
                  : 'Ready to connect'}
              </span>
              <span className="text-[11px] text-slate-500">
                {callStatus === 'active'
                  ? 'Audio streamed via WebRTC'
                  : 'Click Start to begin interactive voice session'}
              </span>
            </div>
          </div>

          {/* Audio Wave Visualizer Animation */}
          {callStatus === 'active' && (
            <div className="flex items-center gap-1 h-6">
              <span className="w-1 bg-rose-500 rounded-full animate-bounce [animation-delay:0ms] h-3" />
              <span className="w-1 bg-rose-600 rounded-full animate-bounce [animation-delay:150ms] h-6" />
              <span className="w-1 bg-pink-500 rounded-full animate-bounce [animation-delay:300ms] h-4" />
              <span className="w-1 bg-rose-400 rounded-full animate-bounce [animation-delay:75ms] h-5" />
            </div>
          )}
        </div>

        {/* Live Conversation Transcript Display */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[320px] bg-white text-xs"
        >
          {messages.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-medium text-slate-600">No conversation yet</p>
              <p className="text-[11px] max-w-xs mx-auto text-slate-400">
                Press "Start Voice Consultation" below. Sakhi will greet you and listen to your health questions.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === 'user'
                    ? 'items-end'
                    : msg.role === 'assistant'
                    ? 'items-start'
                    : 'items-center'
                }`}
              >
                {msg.role === 'system' ? (
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full my-1">
                    {msg.text}
                  </span>
                ) : (
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-rose-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 mb-1">
                      <span className="font-bold">
                        {msg.role === 'user' ? 'You' : 'Sakhi (Voice Assistant)'}
                      </span>
                      <span>{msg.time}</span>
                    </div>
                    <p className="leading-relaxed text-xs">{msg.text}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Controls Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            {callStatus === 'idle' ? (
              <button
                onClick={handleStartCall}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-md shadow-rose-200 transition text-sm cursor-pointer"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Start Voice Consultation</span>
              </button>
            ) : (
              <div className="flex-1 flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className={`p-2.5 rounded-xl border transition ${
                    isMuted
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-rose-600" />}
                </button>

                <button
                  onClick={handleStopCall}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition text-xs sm:text-sm"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Voice Call</span>
                </button>
              </div>
            )}
          </div>

          {/* Evaluate Button: Sends Spoken Transcript into SakhiCheck */}
          {userStatementsRef.current.length > 0 || messages.some((m) => m.role === 'user') ? (
            <button
              onClick={handleEvaluateInSakhiCheck}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-rose-50 text-rose-700 font-semibold border border-rose-200 rounded-xl text-xs transition shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span>Analyze Spoken Symptoms in SakhiCheck</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
