import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';
import { 
  Activity, AlertCircle, Shield, Cpu, ExternalLink, CheckCircle2, Loader2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch Summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['anomalySummary'],
    queryFn: async () => {
      const res = await api.get('/anomalies/summary');
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Fetch Recent Anomalies
  const { data: recentAnomalies, isLoading: tableLoading } = useQuery({
    queryKey: ['recentAnomalies'],
    queryFn: async () => {
      const res = await api.get('/anomalies?size=10&sort=detectedAt,desc');
      return res.data.content;
    },
    refetchInterval: 30000,
  });

  // Acknowledge Mutation
  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/anomalies/${id}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
      queryClient.invalidateQueries({ queryKey: ['anomalySummary'] });
    },
  });

  const chartData = summary?.countByHour 
    ? Object.entries(summary.countByHour).map(([hour, count]) => ({
        time: new Date(hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        count
      }))
    : [];

  const barData = summary?.topServices
    ? Object.entries(summary.topServices).map(([name, count]) => ({ name, count }))
    : [];

  const highSeverityCount = summary?.countBySeverity?.HIGH || 0;
  const servicesMonitored = barData.length;

  if (summaryLoading || tableLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-slate-400 mt-1">Real-time log anomaly monitoring</p>
          </div>
          <button 
            onClick={() => navigate('/settings')}
            className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg hover:bg-slate-800 transition"
          >
            Settings
          </button>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card title="Total Anomalies" value={summary?.totalCount || 0} icon={<Activity className="text-indigo-400" />} />
          <Card title="High Severity" value={highSeverityCount} icon={<AlertCircle className="text-red-400" />} />
          <Card title="Services Monitored" value={servicesMonitored} icon={<Shield className="text-green-400" />} />
          <Card title="Avg Score" value={'-0.82'} icon={<Cpu className="text-amber-400" />} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-[400px]">
            <h3 className="text-lg font-semibold mb-6">Anomaly Distribution (24h)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 h-[400px]">
            <h3 className="text-lg font-semibold mb-6">Top Anomalous Services</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                   cursor={{ fill: 'transparent' }}
                   contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {barData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'][index % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Anomalies Table */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Recent Detections</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-800">
                  <th className="px-6 py-4 font-medium">Service</th>
                  <th className="px-6 py-4 font-medium">Severity</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Score</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {recentAnomalies?.map((anomaly: any) => (
                  <tr key={anomaly.id} className="hover:bg-slate-800/50 transition">
                    <td className="px-6 py-4 font-medium">{anomaly.serviceName}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        anomaly.severity === 'HIGH' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        anomaly.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-green-500/10 text-green-400 border border-green-500/20'
                      }`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(anomaly.detectedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm">
                      {anomaly.anomalyScore.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button 
                        onClick={() => navigate(`/anomalies/${anomaly.id}`)}
                        className="text-slate-400 hover:text-white transition"
                        title="View Details"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </button>
                      {!anomaly.acknowledged && (
                        <button 
                          onClick={() => acknowledgeMutation.mutate(anomaly.id)}
                          className="text-indigo-400 hover:text-indigo-300 transition"
                          title="Acknowledge"
                          disabled={acknowledgeMutation.isPending}
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const Card = ({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) => (
  <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex items-start justify-between">
    <div>
      <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </div>
    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
      {icon}
    </div>
  </div>
);

export default DashboardPage;
