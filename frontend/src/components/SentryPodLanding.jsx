import React from 'react';
import { Link } from 'react-router-dom'; 
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

const FeatureCard = ({ icon: Icon, title, description, iconColor, bgColor }) => (
  <div className="bg-[#111827]/50 p-8 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all duration-300 group">
    <div className={`${bgColor} p-3 rounded-xl w-fit mb-6`}>
      <Icon className={`${iconColor}`} size={24} />
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
  </div>
);

const SentryPodLanding = () => {
  const pageStyle = {
    background: 'linear-gradient(90deg, #020618 0%, #1D293D 70%, #919CA7 150%)',
    backgroundAttachment: 'fixed'
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-[#51A2FF]/30" style={pageStyle}>
      
      {/* --- HERO SECTION --- */}
      <header className="relative pt-2 pb-0 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          
          <div className="z-10 -mt-15 lg: -mt-16">
            <div className="mb-4">
              <img src={logo} alt="SentryPod AI" className="h-32 md:h-40 w-auto object-contain" />
            </div>
            
            <h2 className="text-3xl lg:text-4xl font-bold leading-tight mb-5 text-transparent bg-clip-text bg-gradient-to-r from-[#51A2FF] to-[#00D492]">
              AI-Driven Network <br />
              Monitoring and Automation <br />
              Platform
            </h2>

            <p className="text-lg mb-10 max-w-lg text-[#CAD5E2]">
               Streamline your network operations with enterprise-grade monitoring, 
               intelligent automation, and robust security. Sentry-Pod combines 
               artificial intelligence with powerful network management to deliver 
               unparalleled visibility and control.
            </p>
            
            {/* UPDATED BUTTON: Links to Login */}
            <Link to="/login" className="bg-[#155DFC] hover:bg-blue-600 text-white px-10 py-4 rounded-xl font-bold inline-flex items-center gap-3 transition-all shadow-xl shadow-blue-500/40 hover:-translate-y-1 active:scale-95">
              Get Started <ChevronRight size={20} />
            </Link>
            
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

          <div className="relative group flex lg:justify-end lg:-mr-34 xl:-mr-64 scale-110 lg:scale-135 -mt-10 lg:-mt-15 transition-all duration-700">
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

        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard icon={Zap} title="AI-Powered Commands" description="Generate network configurations using natural language." iconColor="text-blue-400" bgColor="bg-blue-500/10" />
          <FeatureCard icon={Network} title="Live Topology Mapping" description="Interactive visual representation of your entire network." iconColor="text-emerald-400" bgColor="bg-emerald-500/10" />
          <FeatureCard icon={Activity} title="Staging Gate Approval" description="Review changes before deployment to production." iconColor="text-purple-400" bgColor="bg-purple-500/10" />
          <FeatureCard icon={ShieldCheck} title="Enterprise Security" description="JWT authentication, RBAC, and audit logging." iconColor="text-rose-400" bgColor="bg-rose-500/10" />
          <FeatureCard icon={Search} title="Drift Detection" description="Automatically detect unauthorized configuration changes." iconColor="text-amber-400" bgColor="bg-amber-500/10" />
          <FeatureCard icon={Database} title="Intelligent Syslog" description="AI-powered log analysis with natural language summaries." iconColor="text-cyan-400" bgColor="bg-cyan-500/10" />
        </div>
      </section>

      {/* --- WHY CHOOSE SECTION --- */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl font-bold text-white mb-8">Why Choose Sentry-Pod?</h2>
            <ul className="space-y-4">
              {["Reduce configuration time by 80%", "Zero-touch device onboarding", "Real-time drift detection", "Complete audit trail", "Multi-vendor support"].map((item, i) => (
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
          </div>
        </div>
      </section>

      {/* --- CTA SECTION --- */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E293B] to-[#334155] border border-white/10 p-12 lg:p-20 text-center shadow-2xl">
            <div className="relative z-10">
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">Ready to Transform Your Network?</h2>
              <p className ="text-[#CAD5E2] mb-10">Join hundreds of enterprises already using Sentry-Pod to automate and secure their network infrastructure.</p>
              
              {/* UPDATED BUTTON: Links to Login */}
              <Link to="/login" className="bg-[#155DFC] hover:bg-blue-600 text-white px-10 py-4 rounded-xl font-bold inline-flex items-center gap-3 transition-all shadow-xl shadow-blue-500/40 hover:-translate-y-1 active:scale-95">
                Get Started Now <ChevronRight size={22} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10 text-center text-[#CAD5E2]/50 text-sm">
        <p>© 2026 Sentry-Pod AI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SentryPodLanding;