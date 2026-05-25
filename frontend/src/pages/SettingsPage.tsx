import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Key, User, Building, Eye, EyeOff, Copy, RefreshCw, Check, Loader2 } from 'lucide-react';
import api from '../api';
import Sidebar from '../components/Sidebar';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!confirm('Are you sure? Old API keys will stop working immediately.')) return;
    setRegenerating(true);
    try {
      const res = await api.post('/api/keys/regenerate');
      setNewApiKey(res.data.apiKey);
      setShowKey(true);
    } catch {
      alert('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = () => {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <header className="bg-slate-900/50 border-b border-slate-800 px-8 py-4 shrink-0">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <p className="text-slate-500 text-xs mt-0.5">Manage your account and API credentials</p>
        </header>

        <main className="flex-1 p-8">
          <div className="max-w-2xl space-y-6">

            {/* Account */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm">Account Information</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 text-slate-400 text-sm">
                    <User className="w-4 h-4" />
                    Email
                  </div>
                  <span className="text-sm font-medium text-white">{user?.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3 text-slate-400 text-sm">
                    <Building className="w-4 h-4" />
                    Organisation
                  </div>
                  <span className="text-sm font-medium text-white">{user?.organisationName}</span>
                </div>
              </div>
            </section>

            {/* API Key */}
            <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm">API Key</h2>
              </div>
              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    {newApiKey ? 'Your new API key — copy it now' : 'Current API key'}
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 font-mono text-sm text-indigo-300 flex items-center justify-between">
                      <span className="truncate">
                        {showKey && newApiKey ? newApiKey : '••••••••••••••••••••••••••••••••••••'}
                      </span>
                      <button
                        onClick={() => setShowKey(!showKey)}
                        className="ml-3 text-slate-500 hover:text-white transition shrink-0"
                      >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={handleCopy}
                      disabled={!newApiKey}
                      title={newApiKey ? 'Copy key' : 'Regenerate to get a copyable key'}
                      className="px-4 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
                    </button>
                  </div>
                  {!newApiKey && (
                    <p className="text-xs text-amber-500/80">
                      Your original key is masked. Regenerate to get a new visible key.
                    </p>
                  )}
                  {newApiKey && (
                    <p className="text-xs text-green-400/80">
                      Save this key — it won't be shown again after you leave this page.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-500 rounded-xl text-sm font-medium transition"
                  >
                    {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate API Key
                  </button>
                </div>

                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">SDK usage</p>
                  <code className="text-xs text-slate-300 font-mono">
                    LogWatch.init({'{ '}apiKey: "YOUR_KEY_HERE"{'}'})
                  </code>
                </div>
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
