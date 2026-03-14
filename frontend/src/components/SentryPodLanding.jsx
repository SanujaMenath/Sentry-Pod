import React from 'react';
import logo from '../Images/logo.png';
import heroVisual from '../Images/Network Visualization Image.png';
import { 
  ShieldCheck, 
  Activity, 
  Zap, 
  Search, 
  Database, 
  ChevronRight,
  Network 
} from 'lucide-react';

// --- Reusable Feature Card Component ---
const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="bg-slate-800/40 p-6 rounded-xl border border-slate-700 hover:border-[#51A2FF] transition-all duration-300 group">
    <div className="bg-[#51A2FF]/10 p-3 rounded-lg w-fit mb-4 group-hover:bg-[#51A2FF]/20">
      <Icon className="text-[#51A2FF]" size={24} />
    </div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-[#CAD5E2] text-sm leading-relaxed">{description}</p>
  </div>
);

const SentryPodLanding = () => {
  // Linear gradient: Dark on left (#020618) to Light on right (#919CA7)
  const pageStyle = {
    background: 'linear-gradient(90deg, #020618 0%, #1D293D 70%, #919CA7 150%)',
    backgroundAttachment: 'fixed'
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-[#51A2FF]/30" style={pageStyle}>
      
      {/* --- HERO SECTION --- */}
      <header className="relative pt-2 pb-6 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          {/* LEFT SIDE: Text Content */}
          <div className="z-10">
            {/* LOGO */}
            <div className="mb-10">
              <img 
                src={logo} 
                alt="SentryPod AI" 
                className="h-32 md:h-40 w-auto object-contain" 
              />
            </div>
            
            {/* HEADLINE */}
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-6 text-transparent bg-clip-text bg-gradient-to-r from-[#51A2FF] to-[#00D492]">
              AI-Driven Network <br />
              Monitoring and Automation <br />
              Platform
            </h2>

            {/* PARAGRAPH */}
            <p className="text-lg mb-10 max-w-lg text-[#CAD5E2]">
               Streamline your network operations with enterprise-grade monitoring, 
               intelligent automation, and robust security. Sentry-Pod combines 
               artificial intelligence with powerful network management to deliver 
               unparalleled visibility and control.
            </p>
            
            {/* BUTTON */}
            <button className="bg-[#155DFC] hover:bg-blue-600 text-white px-8 py-4 rounded-lg font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              Get Started <ChevronRight size={20} />
            </button>
            
            {/* STATUS ICONS */}
            <div className="mt-8 flex gap-6 text-sm text-[#CAD5E2]/70">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00D492] animate-pulse"></span>
                99.9% Uptime SLA
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#51A2FF]" />
                SOC 2 Compliant
              </span>
            </div>
          </div>

          {/* RIGHT SIDE: Network Visualization (Big & Corner Pushed) */}
          <div className="relative group flex lg:justify-end lg:-mr-34 xl:-mr-64 scale-110 lg:scale-135 transition-all duration-700">
            {/* Glow effect behind image */}
            <div className="absolute -inset-10 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition duration-1000"></div>
            
            <img 
              src={heroVisual} 
              alt="Network Visualization" 
              className="relative w-full max-w-2xl xl:max-w-4xl h-auto drop-shadow-[0_20px_60px_rgba(21,93,252,0.4)] transition-transform duration-500 group-hover:translate-x-4" 
            />
          </div>

        </div>
      </header>

      {/* --- CORE FEATURES --- */}
      <section className="py-24 px-6 bg-black/10">
        <div className="max-w-7xl mx-auto text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Powerful Features</h2>
          <p className="text-[#CAD5E2]">Everything you need to manage, monitor, and secure your infrastructure.</p>
        </div>

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard icon={Zap} title="AI-Powered Commands" description="Generate network configurations using natural language." />
          <FeatureCard icon={Network} title="Live Topology Mapping" description="Interactive visual representation of your entire network." />
          <FeatureCard icon={ShieldCheck} title="Staging Data Approval" description="Review and approve changes before deployment." />
          <FeatureCard icon={Search} title="Drift Detection" description="Automatically detect unauthorized configuration changes." />
          <FeatureCard icon={Activity} title="Intelligent Syslog" description="AI-powered log analysis and smart alerting." />
          <FeatureCard icon={Database} title="Enterprise Security" description="JIT authorization, RBAC, and audit logging." />
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
                <li key={i} className="flex items-start gap-3 text-[#CAD5E2]">
                  <div className="mt-1 bg-[#00D492]/20 p-1 rounded">
                    <ShieldCheck className="text-[#00D492]" size={16} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#51A2FF]/10 p-8 rounded-2xl border border-[#51A2FF]/30">
              <p className="text-4xl font-bold text-white mb-2">10k+</p>
              <p className="text-[#51A2FF] text-sm">Devices Monitored</p>
            </div>
            <div className="bg-[#00D492]/10 p-8 rounded-2xl border border-[#00D492]/30">
              <p className="text-4xl font-bold text-white mb-2">99.9%</p>
              <p className="text-[#00D492] text-sm">Uptime SLA</p>
            </div>
            <div className="col-span-2 bg-slate-800/50 p-8 rounded-2xl border border-slate-700">
              <p className="text-white italic">"The most comprehensive network AI platform we've ever used."</p>
              <p className="mt-4 text-[#CAD5E2] text-sm">— CTO, Fortune 500 Enterprise</p>
            </div>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-white/10 text-center text-[#CAD5E2]/50 text-sm">
        <p>© 2026 Sentry-Pod AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SentryPodLanding;