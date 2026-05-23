import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Shield, Zap, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-indigo-500/30">
      {/* Hero Section */}
      <nav className="flex justify-between items-center px-8 py-6 max-w-7xl mx-auto">
        <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          LogWatch
        </div>
        <div className="space-x-4">
          <Link to="/login" className="text-slate-300 hover:text-white transition">Login</Link>
          <Link to="/register" className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg font-medium transition">
            Get Started
          </Link>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-8 pt-20 pb-32">
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-6xl font-extrabold tracking-tight sm:text-7xl">
            Detect log anomalies <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              before users notice
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            LogWatch uses machine learning to analyze your system logs in real-time, 
            flagging security threats and performance bottlenecks automatically.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Link to="/register" className="group bg-indigo-600 hover:bg-indigo-700 px-8 py-4 rounded-xl text-lg font-semibold flex items-center gap-2 transition-all hover:scale-105">
              Get started free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Code Snippet */}
        <div className="mt-24 max-w-3xl mx-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 shadow-2xl">
            <div className="flex gap-1.5 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <pre className="font-mono text-sm sm:text-base overflow-x-auto text-slate-300">
              <code>{`// 1. Install SDK
npm install @logwatch/node

// 2. Initialize and attach
import { LogWatch } from '@logwatch/node';
const lw = new LogWatch({ apiKey: '...', service: 'api' });
lw.attach();`}</code>
            </pre>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-32">
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-yellow-400" />}
            title="Real-time Alerts"
            description="Instant notifications when anomalies are detected, integrated with Slack and PagerDuty."
          />
          <FeatureCard 
            icon={<Shield className="w-8 h-8 text-indigo-400" />}
            title="Zero Config"
            description="Auto-instrumentation for Node.js, Python, and Go. No manual log parsing required."
          />
          <FeatureCard 
            icon={<Terminal className="w-8 h-8 text-cyan-400" />}
            title="ML-Powered"
            description="Advanced clustering algorithms identify unique patterns and ignore the noise."
          />
        </div>
      </main>
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition group">
    <div className="mb-4 p-3 rounded-xl bg-slate-800 w-fit group-hover:bg-slate-700 transition">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-2">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);

export default LandingPage;
