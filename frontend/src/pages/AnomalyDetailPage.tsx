import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import Sidebar from '../components/Sidebar';
import {
  ArrowLeft, CheckCircle2, Trash2, Shield, Calendar,
  Target, BarChart3, Loader2, AlertCircle, MessageSquare,
  Send, X, Bot, User, Key
} from 'lucide-react';

// ── Feature metadata ───────────────────────────────────────────────────────────
const FEATURE_NAMES = [
  'Total Requests',
  'Error Count',
  'Warn Count',
  'Info Count',
  'Error Ratio',
  'Warn Ratio',
  'Unique Endpoints',
];

// ── Auto-generated anomaly description ────────────────────────────────────────
function buildDescription(features: number[], severity: string, service: string): string {
  const [total, errors, warns, , errorRatio, warnRatio, uniqueEndpoints] = features;

  if (!total) return 'Insufficient data to generate a description.';

  const lines: string[] = [];

  if (errorRatio >= 0.8) {
    lines.push(`${service} was almost completely failing — ${Math.round(errorRatio * 100)}% of requests returned 5xx errors in the detection window.`);
  } else if (errorRatio >= 0.5) {
    lines.push(`${service} had a critical error spike — ${Math.round(errorRatio * 100)}% of requests failed (${errors} of ${total} total).`);
  } else if (errorRatio >= 0.2) {
    lines.push(`${service} showed an elevated error rate of ${Math.round(errorRatio * 100)}% — above the normal baseline.`);
  }

  if (warnRatio >= 0.3 && errorRatio < 0.5) {
    lines.push(`Warning-level responses were also elevated at ${Math.round(warnRatio * 100)}%, suggesting upstream degradation or timeouts.`);
  }

  if (total < 5 && errors > 0) {
    lines.push(`Low request volume (${total} total) combined with ${errors} error(s) suggests a specific endpoint or dependency is failing rather than a full outage.`);
  }

  if (uniqueEndpoints === 1) {
    lines.push(`All traffic was concentrated on a single endpoint — the failure may be isolated to one route.`);
  } else if (uniqueEndpoints >= 4) {
    lines.push(`Failures were spread across ${uniqueEndpoints} different endpoints, indicating a broader service-level issue.`);
  }

  if (severity === 'HIGH') {
    lines.push(`The IsolationForest model scored this as HIGH severity — the feature combination is highly unusual compared to the service\'s historical baseline.`);
  } else {
    lines.push(`The IsolationForest model flagged this as MEDIUM severity — the pattern is unusual but may represent a transient spike.`);
  }

  return lines.join(' ');
}

// ── Groq chat ──────────────────────────────────────────────────────────────────
const GROQ_MODEL = 'llama-3.3-70b-versatile';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(anomaly: any, features: number[], description: string): string {
  const featureStr = FEATURE_NAMES.map((n, i) => `  ${n}: ${features[i]?.toFixed(3) ?? 'N/A'}`).join('\n');
  return `You are a senior site reliability engineer helping debug a microservice anomaly.

Anomaly context:
  Service: ${anomaly.serviceName}
  Severity: ${anomaly.severity}
  Detected at: ${new Date(anomaly.detectedAt).toLocaleString()}
  Model score: ${anomaly.anomalyScore?.toFixed(4)} (more negative = more anomalous)
  Status: ${anomaly.acknowledged ? 'Acknowledged' : 'Open'}

Feature vector (from 20-second sliding window):
${featureStr}

Auto-analysis: ${description}

The anomaly was detected by an IsolationForest ML model trained on historical log patterns.
Feature values represent counts and ratios of HTTP request outcomes in the detection window.

Answer the user's debugging questions concisely and practically. Suggest specific things to check in their service.`;
}

async function callGroq(apiKey: string, messages: Message[], systemPrompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1024,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Groq error ${res.status}`);
  }

  const data = await res.json();
  return data.choices[0]?.message?.content ?? '';
}

// ── LLM Chat panel ─────────────────────────────────────────────────────────────
const ENV_GROQ_KEY = (import.meta as any).env?.VITE_GROQ_API_KEY ?? '';

const LLMPanel: React.FC<{ anomaly: any; features: number[]; description: string; onClose: () => void }> = ({
  anomaly, features, description, onClose
}) => {
  const [apiKey, setApiKey] = useState(() => ENV_GROQ_KEY || localStorage.getItem('groq_api_key') || '');
  const [keyConfirmed, setKeyConfirmed] = useState(() => !!(ENV_GROQ_KEY || localStorage.getItem('groq_api_key')));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const systemPrompt = buildSystemPrompt(anomaly, features, description);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const confirmKey = () => {
    if (!apiKey.trim()) return;
    localStorage.setItem('groq_api_key', apiKey.trim());
    setKeyConfirmed(true);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const reply = await callGroq(apiKey, updated, systemPrompt);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-indigo-500/15 border border-indigo-500/30 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Ask LLM</p>
            <p className="text-xs text-slate-500">Powered by Groq · {GROQ_MODEL}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* API key entry */}
      {!keyConfirmed ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5">
          <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
            <Key className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold mb-1">Enter your Groq API key</p>
            <p className="text-slate-400 text-sm">Get a free key at <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">console.groq.com</a>. Stored locally only.</p>
          </div>
          <div className="w-full space-y-3">
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmKey()}
              placeholder="gsk_..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            <button
              onClick={confirmKey}
              disabled={!apiKey.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-sm font-semibold transition"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Context chip */}
          <div className="px-4 py-3 border-b border-slate-800 shrink-0">
            <div className="bg-slate-800/60 rounded-xl px-3 py-2.5 text-xs text-slate-400 leading-relaxed">
              <span className="text-white font-medium">Context loaded:</span> {anomaly.serviceName} · {anomaly.severity} severity · score {anomaly.anomalyScore?.toFixed(4)}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-2 pt-2">
                {[
                  'Why did this anomaly get flagged?',
                  'What should I check first in my service?',
                  'Is this likely a real outage or a false positive?',
                  'What changes to my service could prevent this?',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="w-full text-left text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 px-3 py-2.5 rounded-lg transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === 'assistant' ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-slate-700'}`}>
                  {m.role === 'assistant' ? <Bot className="w-3.5 h-3.5 text-indigo-400" /> : <User className="w-3.5 h-3.5 text-slate-300" />}
                </div>
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'assistant'
                    ? 'bg-slate-800 text-slate-200 rounded-tl-none'
                    : 'bg-indigo-600 text-white rounded-tr-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                </div>
                <div className="bg-slate-800 rounded-xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-800 shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                placeholder="Ask about this anomaly..."
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => { localStorage.removeItem('groq_api_key'); setKeyConfirmed(false); setApiKey(''); }}
              className="mt-2 text-xs text-slate-600 hover:text-slate-400 transition"
            >
              Change API key
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
const AnomalyDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [llmOpen, setLlmOpen] = useState(false);

  const { data: anomaly, isLoading, error } = useQuery({
    queryKey: ['anomaly', id],
    queryFn: async () => {
      const res = await api.get(`/anomalies/${id}`);
      return res.data;
    },
  });

  const ackMutation = useMutation({
    mutationFn: async () => { await api.patch(`/anomalies/${id}/acknowledge`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomaly', id] });
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => { await api.delete(`/anomalies/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
      navigate('/dashboard');
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !anomaly) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center text-white p-8">
          <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold">Anomaly not found</h2>
          <Link to="/dashboard" className="mt-4 text-indigo-400 hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Parse feature vector — stored as JSON array string
  let features: number[] = [];
  try {
    const parsed = JSON.parse(anomaly.featureVector);
    features = Array.isArray(parsed) ? parsed : Object.values(parsed);
  } catch {
    features = [];
  }

  const description = buildDescription(features, anomaly.severity, anomaly.serviceName);

  const featureMax: Record<number, number> = { 0: 100, 1: 100, 2: 100, 3: 100, 4: 1, 5: 1, 6: 10 };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-slate-900/50 border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white">Anomaly Details</h1>
              <p className="text-xs text-slate-500 font-mono">{id}</p>
            </div>
          </div>
          <button
            onClick={() => setLlmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
          >
            <MessageSquare className="w-4 h-4" />
            Ask LLM
          </button>
        </header>

        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">

            {/* Top row — service + severity + actions */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-2xl font-bold">{anomaly.serviceName}</h2>
                  <div className="flex items-center gap-1.5 text-slate-400 text-sm mt-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(anomaly.detectedAt).toLocaleString()}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  anomaly.severity === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  anomaly.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  'bg-green-500/10 text-green-400 border-green-500/20'
                }`}>
                  {anomaly.severity} SEVERITY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 flex items-center gap-3">
                  <Target className="w-7 h-7 text-indigo-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Model Score</p>
                    <p className="text-lg font-mono font-bold">{anomaly.anomalyScore?.toFixed(4)}</p>
                  </div>
                </div>
                <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 flex items-center gap-3">
                  <Shield className="w-7 h-7 text-green-400 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                    <p className="text-lg font-bold">{anomaly.acknowledged ? 'Acknowledged' : 'Open'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                {!anomaly.acknowledged && (
                  <button
                    onClick={() => ackMutation.mutate()}
                    disabled={ackMutation.isPending}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                  >
                    {ackMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-slate-800 hover:bg-red-600/15 hover:text-red-400 border border-slate-700 py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </div>

            {/* Why this anomaly */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Why was this flagged?
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">{description}</p>
              <button
                onClick={() => setLlmOpen(true)}
                className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Ask the LLM to help debug this →
              </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Feature vector */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold">Feature Vector</h3>
                  <span className="text-xs text-slate-500 ml-auto">20-second window</span>
                </div>
                <div className="space-y-4">
                  {FEATURE_NAMES.map((name, idx) => {
                    const val = features[idx] ?? 0;
                    const max = featureMax[idx] ?? 1;
                    const pct = Math.min(100, (Math.abs(val) / max) * 100);
                    const isHigh = (idx === 4 || idx === 5) && val > 0.5;
                    return (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">{name}</span>
                          <span className={`font-mono font-medium ${isHigh ? 'text-red-400' : 'text-slate-300'}`}>
                            {idx === 4 || idx === 5 ? `${(val * 100).toFixed(1)}%` : val.toFixed(0)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isHigh ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Confidence gauge */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <h3 className="text-sm font-semibold mb-6">Anomaly Confidence</h3>
                <div className="relative w-36 h-36">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 128 128">
                    <circle cx="64" cy="64" r="54" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-800" />
                    <circle
                      cx="64" cy="64" r="54"
                      stroke="currentColor" strokeWidth="10" fill="transparent"
                      strokeDasharray={339.3}
                      strokeDashoffset={339.3 * (1 - Math.min(1, Math.abs(anomaly.anomalyScore ?? 0)))}
                      className={anomaly.severity === 'HIGH' ? 'text-red-500' : anomaly.severity === 'MEDIUM' ? 'text-amber-500' : 'text-green-500'}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold">{Math.round(Math.min(1, Math.abs(anomaly.anomalyScore ?? 0)) * 100)}%</span>
                    <span className="text-xs text-slate-500 mt-0.5">confidence</span>
                  </div>
                </div>
                <p className="mt-5 text-xs text-slate-500 leading-relaxed max-w-xs">
                  Deviation from the normal log pattern baseline as scored by the IsolationForest model.
                </p>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* LLM panel */}
      {llmOpen && (
        <LLMPanel
          anomaly={anomaly}
          features={features}
          description={description}
          onClose={() => setLlmOpen(false)}
        />
      )}
    </div>
  );
};

export default AnomalyDetailPage;
