import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Cpu, 
  Sparkles, 
  User, 
  Volume2,
  Zap,
  Play
} from 'lucide-react';

const RECEPTIONISTS = [
  {
    id: 1,
    name: "Max",
    role: "Operational Lead",
    voice: "ElevenLabs - Josh (Deep, Professional)",
    personality: ["Direct", "Highly Efficient", "No-Nonsense"],
    color: "emerald",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop",
    bio: "Optimized for high-volume logistics and rapid response. Max ensures every caller gets exactly what they need without the fluff."
  },
  {
    id: 2,
    name: "Sofia",
    role: "Hospitality Expert",
    voice: "ElevenLabs - Bella (Warm, Engaging)",
    personality: ["Empathetic", "Graceful", "Detail-Oriented"],
    color: "rose",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1000&auto=format&fit=crop",
    bio: "Focused on building relationships. Sofia handles complex client inquiries with a touch of elegance and unmatched patience."
  },
  {
    id: 3,
    name: "Kai",
    role: "Tech Strategist",
    voice: "ElevenLabs - Adam (Witty, Energetic)",
    personality: ["Innovative", "Problem Solver", "Articulate"],
    color: "blue",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1000&auto=format&fit=crop",
    bio: "Best for technical support and dynamic scheduling. Kai leverages deep logic to resolve conflicts before they even arise."
  }
];

const ReceptionistCard = ({ person, isActive, isNext, isPrev, onClick }) => {
  // Base classes for the card animation/transition
  const baseClasses = "absolute top-0 left-0 w-full h-full transition-all duration-700 ease-in-out transform";
  let stateClasses = "opacity-0 scale-90 pointer-events-none";

  if (isActive) stateClasses = "opacity-100 scale-100 translate-x-0 z-20";
  if (isNext) stateClasses = "opacity-40 scale-95 translate-x-full z-10 blur-[2px] cursor-pointer hover:translate-x-[95%] transition-transform";
  if (isPrev) stateClasses = "opacity-40 scale-95 -translate-x-full z-10 blur-[2px] cursor-pointer hover:-translate-x-[95%] transition-transform";

  return (
    <div className={`${baseClasses} ${stateClasses}`} onClick={onClick}>
      <div className="relative h-full w-full bg-[#0a0c10] border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
        {/* Header Image Area */}
        <div className="relative h-1/2 w-full group overflow-hidden">
          <img 
            src={person.avatar} 
            alt={person.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c10] via-[#0a0c10]/40 to-transparent" />

          {/* Name Overlay */}
          <div className="absolute bottom-6 left-8">
            <h2 className="text-4xl font-bold text-white tracking-tight leading-none mb-1">{person.name}</h2>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 pt-2 flex flex-col gap-6">
          <div className="flex items-center gap-2 text-white/30 text-[11px] uppercase tracking-widest font-semibold">
            <Zap size={12} className="text-white/50" />
            <span>Operational Config</span>
          </div>

          <div className="border-b border-white/5 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
                <Volume2 size={12} />
                <span>Voice Profile</span>
              </div>
              <div className="flex items-center gap-2 group/play">
                <p className="text-sm font-medium text-white/80">{person.voice.split(' - ')[1]}</p>
                <button className="p-1 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                  <Play size={10} fill="white" className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/30">
              <Sparkles size={12} />
              <span>Core Traits</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {person.personality.map((trait, i) => (
                <span key={i} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/60 font-medium">
                  {trait}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/40 leading-relaxed mt-2 italic">
            "{person.bio}"
          </p>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const nextCard = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev + 1) % RECEPTIONISTS.length);
    setTimeout(() => setIsAnimating(false), 700);
  };

  const prevCard = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setCurrentIndex((prev) => (prev - 1 + RECEPTIONISTS.length) % RECEPTIONISTS.length);
    setTimeout(() => setIsAnimating(false), 700);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnimating]);

  return (
    <div className="min-h-screen bg-[#050608] flex items-center justify-center p-6 font-sans antialiased text-white selection:bg-white/10">
      <div className="w-full max-w-[440px] flex flex-col items-center">
        
        {/* Header Branding */}
        <div className="text-center mb-10 space-y-2">
          <h1 className="text-xs uppercase tracking-[6px] font-bold text-white/20">System Config</h1>
          <p className="text-2xl font-semibold tracking-tight">Deploy your Receptionist</p>
        </div>

        {/* Card Container */}
        <div className="relative w-full aspect-[4/5] perspective-1000 mb-12">
          {RECEPTIONISTS.map((person, index) => {
            const isActive = index === currentIndex;
            const isNext = index === (currentIndex + 1) % RECEPTIONISTS.length;
            const isPrev = index === (currentIndex - 1 + RECEPTIONISTS.length) % RECEPTIONISTS.length;
            
            return (
              <ReceptionistCard 
                key={person.id} 
                person={person} 
                isActive={isActive} 
                isNext={isNext}
                isPrev={isPrev}
                onClick={() => {
                  if (isNext) nextCard();
                  if (isPrev) prevCard();
                }}
              />
            );
          })}
        </div>

        {/* Navigation & Select Controls */}
        <div className="flex items-center gap-6 w-full">
          <button className="flex-1 h-16 bg-white text-black font-bold rounded-2xl tracking-wide flex items-center justify-center gap-3 hover:bg-white/90 transition-all active:scale-[0.98] shadow-xl shadow-white/5">
            <User size={20} fill="black" />
            SELECT {RECEPTIONISTS[currentIndex].name.toUpperCase()}
          </button>
        </div>

        {/* Helper Instructions */}
        <div className="mt-8 flex items-center gap-4 text-white/20 text-[10px] font-bold uppercase tracking-[2px]">
          <span className="flex items-center gap-1"><Mic size={10} /> Voice Sample Available</span>
          <span className="w-1 h-1 bg-white/20 rounded-full" />
          <span className="flex items-center gap-1"><Cpu size={10} /> Low Latency</span>
        </div>

      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        .perspective-1000 {
          perspective: 1500px;
        }

        /* Custom scrollbar for dark theme if needed */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #050608;
        }
        ::-webkit-scrollbar-thumb {
          background: #1a1c20;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default App;