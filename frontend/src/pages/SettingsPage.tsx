import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Key, User, Building, Eye, EyeOff, Copy, 
  RefreshCw, Check, ArrowLeft, Loader2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
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
    } catch (err) {
      alert('Failed to regenerate API key');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = () => {
    const key = newApiKey || '************************************';
    if (newApiKey) {
      navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </header>

        <div className="space-y-6">
          {/* Account Section */}
          <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">Account Information</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3 text-slate-400">
                  <User className="w-4 h-4" />
                  <span>Email Address</span>
                </div>
                <span className="font-medium">{user?.email || 'user@example.com'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3 text-slate-400">
                  <Building className="w-4 h-4" />
                  <span>Organisation</span>
                </div>
                <span className="font-medium">{user?.organisationName || 'Default Org'}</span>
              </div>
            </div>
          </section>

          {/* Security Section */}
          <section className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-800/30 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold">API Credentials</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Project API Key</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 font-mono text-indigo-300 relative flex items-center">
                    {showKey && newApiKey ? newApiKey : '••••••••••••••••••••••••••••••••••••'}
                    <button 
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 text-slate-500 hover:text-white transition"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button 
                    onClick={handleCopy}
                    disabled={!newApiKey}
                    className="p-3 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                {!newApiKey && (
                  <p className="text-xs text-amber-500/80 mt-2">
                    Note: Your original API key is masked for security. Regenerate to get a new one.
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button 
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="bg-slate-800 hover:bg-indigo-600 border border-slate-700 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                >
                  {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Regenerate API Key
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
