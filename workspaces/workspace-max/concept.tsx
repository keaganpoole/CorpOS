import React, { useState, useEffect } from 'react';

const App = () => {
  const [glitch, setGlitch] = useState(false);
  const [bootSequence, setBootSequence] = useState(true);

  // System Effects
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      if (Math.random() > 0.97) {
        setGlitch(true);
        setTimeout(() => setGlitch(false), 120);
      }
    }, 2500);

    const bootTimeout = setTimeout(() => setBootSequence(false), 800);

    return () => {
      clearInterval(glitchInterval);
      clearTimeout(bootTimeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-['JetBrains_Mono',_monospace] flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* CRT Overlay Layer */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.04]" 
        style={{ 
          background: `linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))`,
          backgroundSize: '100% 4px, 3px 100%'
        }} 
      />

      {/* Atmospheric Glow */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#6366f1]/5 blur-[120px] rounded-full pointer-events-none animate-pulse" />

      {/* Main Branding Container */}
      <div className={`relative z-10 transition-all duration-700 ease-out flex flex-col items-center ${bootSequence ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
        
        {/* Technical Label (Top) */}
        <div className="mb-12 flex flex-col items-center">
          <div className="text-[10px] text-white/20 uppercase tracking-[0.6em] font-light mb-2">Core_System_Identity</div>
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* The Prism Logic Logo */}
        <div className={`relative transition-transform duration-75 ${glitch ? 'translate-x-1 translate-y-1 scale-[1.02] skew-x-1' : ''}`}>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-4">
              <h1 className="text-[120px] md:text-[160px] font-bold tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                Corp
              </h1>
              {/* White Anchor Point Square */}
              <div className="w-6 h-6 md:w-8 md:h-8 bg-white mb-6 md:mb-8 shadow-[0_0_30px_rgba(255,255,255,0.5)] animate-pulse" />
            </div>
            
            {/* Spectral OS Signature */}
            <h1 className="text-[120px] md:text-[160px] font-bold tracking-tighter bg-gradient-to-r from-[#22d3ee] via-[#ec4899] to-[#a855f7] bg-clip-text text-transparent -mt-16 md:-mt-24 ml-24 md:ml-32 drop-shadow-[0_10px_40px_rgba(34,211,238,0.15)]">
              OS
            </h1>
          </div>
          
          {/* Subtle Glitch Shadow (Visible only during glitch) */}
          {glitch && (
            <div className="absolute inset-0 text-[120px] md:text-[160px] font-bold tracking-tighter opacity-30 blur-[2px] pointer-events-none select-none">
              <span className="text-[#ff00ff] absolute top-[-2px] left-[-2px]">CorpOS</span>
              <span className="text-[#00ffff] absolute top-[2px] left-[2px]">CorpOS</span>
            </div>
          )}
        </div>

        {/* Metadata Footer */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-2xl border-t border-white/5 pt-10 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <div className="text-center">
            <div className="text-[8px] uppercase tracking-widest text-white/50 mb-1">Architecture</div>
            <div className="text-[10px] font-bold">X64_NEURAL_CORE</div>
          </div>
          <div className="text-center border-x border-white/5">
            <div className="text-[8px] uppercase tracking-widest text-white/50 mb-1">Lead_Sync</div>
            <div className="text-[10px] font-bold text-[#22d3ee]">PRISM_01</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] uppercase tracking-widest text-white/50 mb-1">State</div>
            <div className="text-[10px] font-bold">OPERATIONAL</div>
          </div>
        </div>
      </div>

      {/* Decorative Corner Brackets */}
      <div className="fixed top-8 left-8 w-12 h-12 border-t border-l border-white/10" />
      <div className="fixed top-8 right-8 w-12 h-12 border-t border-r border-white/10" />
      <div className="fixed bottom-8 left-8 w-12 h-12 border-b border-l border-white/10" />
      <div className="fixed bottom-8 right-8 w-12 h-12 border-b border-r border-white/10" />

      {/* Background Digital Rain Effect (Subtle) */}
      <div className="fixed bottom-12 right-12 text-[8px] text-white/5 pointer-events-none select-none text-right font-mono uppercase leading-relaxed">
        Trace_Log_092<br/>
        Buffer_Init... OK<br/>
        Prism_Link... OK<br/>
        Spectral_Shift... ACTIVE
      </div>
    </div>
  );
};

export default App;