import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { 
  ArrowLeft, CheckCircle2, Trash2, Shield, Calendar, 
  Target, BarChart3, Loader2, AlertCircle 
} from 'lucide-react';

const AnomalyDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: anomaly, isLoading, error } = useQuery({
    queryKey: ['anomaly', id],
    queryFn: async () => {
      const res = await api.get(`/anomalies/${id}`);
      return res.data;
    },
  });

  const ackMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/anomalies/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomaly', id] });
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/anomalies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
      navigate('/dashboard');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (error || !anomaly) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold">Anomaly not found</h2>
        <Link to="/dashboard" className="mt-4 text-indigo-400 hover:underline">Back to Dashboard</Link>
      </div>
    );
  }

  // Parse feature vector (assuming comma-separated string from backend)
  const features: number[] = anomaly.featureVector ? anomaly.featureVector.split(',').map(Number) : [];
  const featureNames = ['Log Level', 'Message Entropy', 'Token Count', 'Burst Rate', 'Keyword Match', 'Time Delta', 'User Agent'];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold">Anomaly Details</h1>
            <p className="text-slate-400 text-sm">ID: {id}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-8">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold">{anomaly.serviceName}</h2>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(anomaly.detectedAt).toLocaleString()}</span>
                  </div>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  anomaly.severity === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  anomaly.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-green-500/10 text-green-400 border border-green-500/20'
                }`}>
                  {anomaly.severity} SEVERITY
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                  <Target className="w-8 h-8 text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Model Score</p>
                    <p className="text-xl font-mono font-bold">{anomaly.anomalyScore.toFixed(4)}</p>
                  </div>
                </div>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                  <Shield className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="text-xs text-slate-500 uppercase">Status</p>
                    <p className="text-xl font-bold">{anomaly.acknowledged ? 'Acknowledged' : 'Pending Action'}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                {!anomaly.acknowledged && (
                  <button 
                    onClick={() => ackMutation.mutate()}
                    disabled={ackMutation.isPending}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                  >
                    {ackMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Acknowledge
                  </button>
                )}
                <button 
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1 bg-slate-800 hover:bg-red-600/20 hover:text-red-400 border border-slate-700 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  Delete Record
                </button>
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-semibold">Feature Vector Analysis</h3>
              </div>
              <div className="space-y-4">
                {features.map((val, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{featureNames[idx] || `Feature ${idx + 1}`}</span>
                      <span className="font-mono">{val.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${Math.min(100, Math.abs(val) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Gauge (Visual Representation) */}
          <div className="space-y-8">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 flex flex-col items-center text-center">
              <h3 className="font-semibold mb-6">Anomaly Confidence</h3>
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-slate-800"
                  />
                  <circle
                    cx="64" cy="64" r="58"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={364.4}
                    strokeDashoffset={364.4 * (1 - Math.abs(anomaly.anomalyScore))}
                    className="text-indigo-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{Math.round(Math.abs(anomaly.anomalyScore) * 100)}%</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-400">
                This score indicates the deviation from normal log patterns detected by the Isolation Forest model.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnomalyDetailPage;
