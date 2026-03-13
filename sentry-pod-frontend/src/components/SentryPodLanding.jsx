import React from 'react';
import { 
  Network, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Search, 
  Database, 
  ChevronRight 
} from 'lucide-react';

// --- Reusable Feature Card Component ---
const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700 hover:border-blue-500 transition-all duration-300">
    <div className="bg-blue-600/20 p-3 rounded-lg w-fit mb-4">
      <Icon className="text-blue-400" size={24} />
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
  </div>
);

const SentryPodLanding = () => {
  return (
    <div className="min-h-screen bg-[#0b0f1a] text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* --- HERO SECTION --- */}
      <header className="relative pt-20 pb-32 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div className="z-10">
            <div className="flex items-center gap-2 mb-8">
              <div className="bg-emerald-400 p-2 rounded-lg">
                <Network className="text-slate-900" size={28} />
              </div>
              <h1 className="text-3xl font-bold tracking-tighter text-white">SentryPod AI</h1>
            </div>
            
            <h2 className="text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              AI-Driven Network <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                Monitoring and Automation
              </span>
            </h2>
            <p className="text-lg text-slate-400 mb-10 max-w-lg">
              Streamline your network operations with enterprise-grade monitoring, 
              intelligent automation, and robust security.
            </p>
            
            <button className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-lg font-bold flex items-center gap-2 transition-all">
              Get Started <ChevronRight size={20} />
            </button>
            
            <div className="mt-8 flex gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-2">● 99.9% Uptime SLA</span>
              <span className="flex items-center gap-2">● SOC2 Compliant</span>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <img 
              src="https://images.unsplash.com/photo-1558494949-ef010cbdcc4b?auto=format&fit=crop&q=80&w=800" 
              alt="Network Visualization" 
              className="relative rounded-2xl border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      </header>

      {/* --- CORE FEATURES --- */}
      <section className="py-24 px-6 bg-slate-900/30">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Powerful Features for Modern Networks</h2>
          <p className="text-slate-400">Everything you need to manage, monitor, and secure your infrastructure.</p>
        </div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Zap} 
            title="AI-Powered Commands" 
            description="Generate network configurations using natural language with intelligent AI assistance."
          />
          <FeatureCard 
            icon={Network} 
            title="Live Topology Mapping" 
            description="Interactive visual representation of your entire network infrastructure in real-time."
          />
          <FeatureCard 
            icon={ShieldCheck} 
            title="Staging Data Approval" 
            description="Review and approve configuration changes before deployment to production."
          />
          <FeatureCard 
            icon={Search} 
            title="Drift Detection" 
            description="Automatically detect unauthorized configuration changes and policy violations."
          />
          <FeatureCard 
            icon={Activity} 
            title="Intelligent Syslog" 
            description="AI-powered log analysis with root cause analysis and smart alerting."
          />
          <FeatureCard 
            icon={Database} 
            title="Enterprise Security" 
            description="JIT authorization, RBAC, and comprehensive audit logging for compliance."
          />
        </div>
      </section>
      {/* --- WHY CHOOSE SECTION --- */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-8">Why Choose Sentry-Pod?</h2>
            <ul className="space-y-4">
              {[
                "Reduce configuration time by 80% with AI automation",
                "Zero-touch device onboarding and management",
                "Real-time drift detection and prevention",
                "Complete audit trail for compliance requirements",
                "Multi-vendor device support (Cisco, Juniper, Arista)"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300">
                  <div className="mt-1 bg-emerald-500/20 p-1 rounded">
                    <ShieldCheck className="text-emerald-400" size={16} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-900/40 p-8 rounded-2xl border border-blue-500/30">
              <p className="text-4xl font-bold text-white mb-2">10k+</p>
              <p className="text-blue-300 text-sm">Devices Monitored</p>
            </div>
            <div className="bg-emerald-900/40 p-8 rounded-2xl border border-emerald-500/30">
              <p className="text-4xl font-bold text-white mb-2">99.9%</p>
              <p className="text-emerald-300 text-sm">Uptime SLA</p>
            </div>
            <div className="col-span-2 bg-slate-800 p-8 rounded-2xl border border-slate-700">
              <p className="text-white italic">"The most comprehensive network AI platform we've ever used."</p>
              <p className="mt-4 text-slate-500 text-sm">— CTO, Fortune 500 Enterprise</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-12 text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Network?</h2>
            <p className="text-blue-100 mb-10 text-lg max-w-2xl mx-auto">
              Join hundreds of enterprises already using Sentry-Pod to automate and secure their network infrastructures.
            </p>
            <button className="bg-white text-blue-700 hover:bg-blue-50 px-10 py-4 rounded-xl font-bold transition-colors">
              Get Started Now
            </button>
          </div>
          {/* Subtle background circles */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-black/10 rounded-full blur-3xl"></div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-slate-800 text-center text-slate-500 text-sm">
        <p>© 2026 Sentry-Pod AI. All rights reserved. Built for modern infrastructure.</p>
      </footer>
    </div>
  );
};

export default SentryPodLanding;