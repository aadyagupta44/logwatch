import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { Loader2, Copy, Check, AlertTriangle } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organisationName, setOrganisationName] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        organisationName
      });

      const { token, email: userEmail, organisationName: orgName, apiKey: newApiKey } = response.data;
      setApiKey(newApiKey);
      login(token, { email: userEmail, organisationName: orgName });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (apiKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-6 lg:px-8 text-white">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold">Welcome to LogWatch!</h2>
            <p className="mt-2 text-slate-400">Your account has been created successfully.</p>
          </div>

          <div className="bg-slate-900 p-8 rounded-2xl border border-indigo-500/30 shadow-2xl space-y-6">
            <div className="flex items-center gap-3 text-amber-400 bg-amber-400/10 p-4 rounded-xl border border-amber-400/20">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <p className="text-sm font-medium">
                Copy this API key now — it won't be shown again for security reasons.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Your API Key</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-slate-800 p-3 rounded-lg font-mono text-indigo-300 break-all border border-slate-700">
                  {apiKey}
                </code>
                <button
                  onClick={copyToClipboard}
                  className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700 transition"
                >
                  {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-600/20"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-extrabold">Create your account</h2>
        <p className="mt-2 text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow-xl border border-slate-800 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-300">Organisation Name</label>
              <input
                type="text"
                required
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-lg font-bold transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
