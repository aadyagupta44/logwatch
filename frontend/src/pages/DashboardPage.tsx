import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import {
  Activity, AlertCircle, Shield, Cpu, ExternalLink, CheckCircle2, Loader2,
  Bell, TrendingUp, TrendingDown, Minus, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const StatCard = ({
  title, value, icon, color, trend
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-700 transition">
    <div className="flex items-center justify-between">
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
    </div>
    <div className="flex items-end justify-between">
      <p className="text-3xl font-bold text-white">{value}</p>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
          trend === 'up' ? 'text-red-400 bg-red-400/10' :
          trend === 'down' ? 'text-green-400 bg-green-400/10' :
          'text-slate-400 bg-slate-800'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-3 h-3" /> :
           trend === 'down' ? <TrendingDown className="w-3 h-3" /> :
           <Minus className="w-3 h-3" />}
          {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
        </div>
      )}
    </div>
  </div>
);

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: summary, isLoading: summaryLoading, dataUpdatedAt } = useQuery({
    queryKey: ['anomalySummary'],
    queryFn: async () => {
      const res = await api.get('/anomalies/summary');
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: recentAnomalies, isLoading: tableLoading } = useQuery({
    queryKey: ['recentAnomalies'],
    queryFn: async () => {
      const res = await api.get('/anomalies?size=10&sort=detectedAt,desc');
      return res.data.content;
    },
    refetchInterval: 30000,
  });

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
  const mediumSeverityCount = summary?.countBySeverity?.MEDIUM || 0;
  const servicesMonitored = barData.length;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (summaryLoading || tableLoading) {
    return (
      <div className="flex h-screen w-screen bg-slate-950 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-slate-400 text-sm">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-slate-900/50 border-b border-slate-800 px-8 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white">Security Dashboard</h1>
            <p className="text-slate-500 text-xs mt-0.5">Real-time log anomaly monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live · Updated {lastUpdated}
            </div>
            <button
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['anomalySummary'] });
                queryClient.invalidateQueries({ queryKey: ['recentAnomalies'] });
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 space-y-8 overflow-auto">
          {/* Stat cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              title="Total Anomalies"
              value={summary?.totalCount || 0}
              icon={<Activity className="w-5 h-5 text-indigo-400" />}
              color="bg-indigo-500/10"
              trend="neutral"
            />
            <StatCard
              title="High Severity"
              value={highSeverityCount}
              icon={<AlertCircle className="w-5 h-5 text-red-400" />}
              color="bg-red-500/10"
              trend={highSeverityCount > 0 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Services Monitored"
              value={servicesMonitored}
              icon={<Shield className="w-5 h-5 text-green-400" />}
              color="bg-green-500/10"
              trend="neutral"
            />
            <StatCard
              title="Avg Anomaly Score"
              value={summary?.avgScore != null ? summary.avgScore.toFixed(3) : '—'}
              icon={<Cpu className="w-5 h-5 text-amber-400" />}
              color="bg-amber-500/10"
              trend={summary?.avgScore != null && summary.avgScore < -0.1 ? 'up' : 'neutral'}
            />
          </div>

          {/* Severity summary bar */}
          {(summary?.totalCount || 0) > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Severity Breakdown</h3>
                <span className="text-xs text-slate-500">{summary?.totalCount} total</span>
              </div>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: 'HIGH', count: highSeverityCount, color: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                  { label: 'MEDIUM', count: mediumSeverityCount, color: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                  { label: 'LOW', count: (summary?.countBySeverity?.LOW || 0), color: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
                ].map(s => (
                  <div key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${s.bg} ${s.text}`}>
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    {s.label}: {s.count}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Anomaly Timeline</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Last 24 hours</p>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '12px' }}
                      itemStyle={{ color: '#818cf8' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: '#818cf8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Top Anomalous Services</h3>
                  <p className="text-xs text-slate-500 mt-0.5">By detection count</p>
                </div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      stroke="#475569"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(99,102,241,0.05)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '12px' }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {barData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'][index % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent detections table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Recent Detections</h3>
                <p className="text-xs text-slate-500 mt-0.5">Latest 10 anomalies</p>
              </div>
              {recentAnomalies?.length > 0 && (
                <span className="text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                  {recentAnomalies.filter((a: any) => !a.acknowledged).length} unacknowledged
                </span>
              )}
            </div>

            {!recentAnomalies || recentAnomalies.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-slate-400 font-medium text-sm">No anomalies detected</p>
                <p className="text-slate-600 text-xs">Your services are running normally.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Service</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Severity</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Detected</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {recentAnomalies.map((anomaly: any) => (
                      <tr key={anomaly.id} className="hover:bg-slate-800/30 transition group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${
                              anomaly.severity === 'HIGH' ? 'bg-red-400' :
                              anomaly.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-green-400'
                            }`} />
                            <span className="text-sm font-medium text-white">{anomaly.serviceName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            anomaly.severity === 'HIGH' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            anomaly.severity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            'bg-green-500/10 text-green-400 border-green-500/20'
                          }`}>
                            {anomaly.severity}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {new Date(anomaly.detectedAt).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                            {anomaly.anomalyScore.toFixed(4)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {anomaly.acknowledged ? (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Acknowledged
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> Open
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/anomalies/${anomaly.id}`)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition"
                              title="View Details"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {!anomaly.acknowledged && (
                              <button
                                onClick={() => acknowledgeMutation.mutate(anomaly.id)}
                                disabled={acknowledgeMutation.isPending}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition"
                                title="Acknowledge"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardPage;
