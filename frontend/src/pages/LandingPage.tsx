import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Zap, Shield, Activity, ChevronRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#020817] text-white overflow-x-hidden">

      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[500px] h-[500px] bg-purple-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-cyan-600/8 rounded-full blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#020817]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">LogWatch</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="px-4 py-2 text-sm text-slate-400 hover:text-white transition rounded-lg hover:bg-white/5">
              Login
            </Link>
            <Link to="/register" className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 rounded-lg transition flex items-center gap-1.5">
              Get Started <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-7xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          ML-Powered · Real-time · Zero Config
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-4xl mx-auto">
          Detect log anomalies{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            before users notice
          </span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
          LogWatch ingests your microservice logs, runs IsolationForest ML scoring in real-time,
          and flags anomalies the moment they surface.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            Start for free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-medium rounded-xl transition-all hover:bg-white/5"
          >
            Sign in
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-px max-w-2xl mx-auto rounded-2xl overflow-hidden border border-slate-800 bg-slate-800">
          {[
            { value: '< 60s', label: 'Detection latency' },
            { value: '787 KB', label: 'Model size' },
            { value: '3-tier', label: 'Severity scoring' },
          ].map((s) => (
            <div key={s.label} className="bg-[#0a1628] px-6 py-5 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Terminal */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-slate-800 bg-[#0a1628] overflow-hidden shadow-2xl shadow-indigo-950/50">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-800 bg-slate-900/50">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-2 text-xs text-slate-500 font-mono">your-service/app.ts</span>
          </div>
          <pre className="p-6 font-mono text-sm leading-7 overflow-x-auto">
            <code>
              <span className="text-slate-500">// 1. Install the SDK</span>{'\n'}
              <span className="text-cyan-400">npm install</span>
              <span className="text-white"> @logwatch/node</span>{'\n\n'}
              <span className="text-slate-500">// 2. One-line setup</span>{'\n'}
              <span className="text-purple-400">import</span>
              <span className="text-white"> {'{ LogWatch } '}</span>
              <span className="text-purple-400">from</span>
              <span className="text-green-400"> '@logwatch/node'</span>
              <span className="text-white">{';'}</span>{'\n\n'}
              <span className="text-slate-400">LogWatch</span>
              <span className="text-white">.</span>
              <span className="text-cyan-400">init</span>
              <span className="text-white">({'{'} </span>
              <span className="text-slate-300">apiKey</span>
              <span className="text-white">: </span>
              <span className="text-green-400">'lw_••••••••'</span>
              <span className="text-white">, </span>
              <span className="text-slate-300">service</span>
              <span className="text-white">: </span>
              <span className="text-green-400">'payment-api'</span>
              <span className="text-white"> {'}'});</span>{'\n\n'}
              <span className="text-slate-500">// ✓ Anomalies detected automatically</span>
            </code>
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 pb-32">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold">Everything you need. Nothing you don't.</h2>
          <p className="mt-3 text-slate-400">Built for engineers who care about reliability.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <Zap className="w-5 h-5 text-amber-400" />,
              iconBg: 'bg-amber-400/10',
              title: 'Real-time Detection',
              desc: 'Anomalies are flagged within 60 seconds. Kafka-backed ingestion ensures no log is ever dropped.',
            },
            {
              icon: <Shield className="w-5 h-5 text-indigo-400" />,
              iconBg: 'bg-indigo-400/10',
              title: 'ML-Powered, Zero Config',
              desc: 'IsolationForest model runs entirely in the Rust engine. No rules to write, no thresholds to tune.',
            },
            {
              icon: <Activity className="w-5 h-5 text-green-400" />,
              iconBg: 'bg-green-400/10',
              title: 'Multi-service Visibility',
              desc: 'Monitor every microservice from a single dashboard. Filter by severity, service, or time window.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/80 transition-all"
            >
              <div className={`w-10 h-10 ${f.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-transparent to-indigo-950/20">
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to ship with confidence?</h2>
          <p className="text-slate-400 mb-8">Create a free account and connect your first service in under 5 minutes.</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800/40 py-6 text-center text-xs text-slate-600">
        © 2026 LogWatch · Built with Rust + Spring Boot + React
      </footer>
    </div>
  );
};

export default LandingPage;
