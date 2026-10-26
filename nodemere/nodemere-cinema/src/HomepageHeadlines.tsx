import type { CSSProperties } from "react";
import { p } from "./design";
import { Hero } from "./PhaseTwoShared";
import { AccentWord, CenteredPhrases } from "./HeroTypography";

const alwaysOnParticles = Array.from({ length: 96 }, (_, index) => {
  const seed = index * 137.508;
  return {
    x: ((Math.sin(seed * 0.73) + 1) / 2) * 1920,
    y: 80 + ((Math.sin(seed * 1.17 + 2.4) + 1) / 2) * 920,
    radius: 0.45 + ((Math.sin(seed * 0.31) + 1) / 2) * 0.85,
    phase: seed * 0.047,
    speed: 0.18 + ((Math.sin(seed * 0.19) + 1) / 2) * 0.22,
    rise: 10 + ((Math.sin(seed * 0.43) + 1) / 2) * 12,
    sway: 20 + ((Math.sin(seed * 0.61) + 1) / 2) * 22,
    color: "#fff",
  };
});

function AlwaysOnParticles({ time }: { time: number }) {
  const reveal = p(time, 1.84, 2.18);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        opacity: reveal,
        pointerEvents: "none",
      }}
    >
      {alwaysOnParticles.map((particle, index) => {
        const drift = time * particle.speed + particle.phase;
        const x = particle.x + Math.sin(drift) * particle.sway;
        const y = particle.y - ((time * particle.rise) % 320) + Math.sin(drift * 0.7) * 14;
        const twinkle = 0.16 + 0.38 * ((Math.sin(drift * 1.7) + 1) / 2);
        return (
          <circle key={index} cx={x} cy={y} r={particle.radius} fill={particle.color} opacity={twinkle} />
        );
      })}
    </svg>
  );
}
// Exact homepage CrmStunningWord keyframes; only its clock is replaced.
const CRM_STUNNING_STYLES = `
  @keyframes crm-prism-red-move {
    0% { transform: translate(-14px, -4px) scale(1.03); opacity: 0; filter: blur(3px); }
    15% { opacity: 0.95; }
    55% { transform: translate(-3px, -1px) scale(1.01); opacity: 0.5; }
    80% { opacity: 0.15; }
    100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
  }

  @keyframes crm-prism-blue-move {
    0% { transform: translate(14px, 4px) scale(1.03); opacity: 0; filter: blur(3px); }
    15% { opacity: 0.95; }
    55% { transform: translate(3px, 1px) scale(1.01); opacity: 0.5; }
    80% { opacity: 0.15; }
    100% { transform: translate(0, 0) scale(1); opacity: 0; filter: blur(0); }
  }

  @keyframes crm-prism-green-move {
    0% { transform: scale(1.1); opacity: 0; filter: blur(10px); }
    30% { opacity: 0.7; filter: blur(3px); }
    100% { transform: scale(1); opacity: 1; filter: blur(0); }
  }

  @keyframes crm-flash-settle {
    0% { filter: brightness(4.5) contrast(1.5) drop-shadow(0 0 35px rgba(255,255,255,0.9)); }
    25% { filter: brightness(1.8) contrast(1.2) drop-shadow(0 0 15px rgba(255,255,255,0.3)); }
    100% { filter: brightness(1) contrast(1) drop-shadow(0 2px 10px rgba(255,255,255,0.15)); }
  }
`;
export function StunningWord({time}: {time:number}) {
  const base: CSSProperties = {padding: '.22em .16em .42em', margin:'-.22em -.16em -.42em', lineHeight:'inherit', animationDuration:'1.2s', animationTimingFunction:'cubic-bezier(.16,1,.3,1)', animationIterationCount:1, animationFillMode:'forwards', animationPlayState:'paused', animationDelay:`${-Math.max(0,time)}s`};
  if (time < 0) return <span style={{display:'inline-block'}}>Stunning.</span>;
  return <><style>{CRM_STUNNING_STYLES}</style><span aria-label="Stunning." style={{position:'relative',margin:0,display:'inline-block',overflow:'visible',verticalAlign:'baseline'}}>
    <span aria-hidden style={{visibility:'hidden',display:'inline-block'}}>Stunning.</span>
    <span aria-hidden style={{position:'absolute',left:0,top:0,display:'block',overflow:'visible',lineHeight:'inherit',pointerEvents:'none'}}>
      <span style={{...base,position:'absolute',left:0,top:0,color:'#ff0055',mixBlendMode:'screen',animationName:'crm-prism-red-move'}}>Stunning.</span>
      <span style={{...base,position:'absolute',left:0,top:0,color:'#00ffcc',mixBlendMode:'screen',animationName:'crm-prism-blue-move'}}>Stunning.</span>
      <span style={{...base,position:'relative',display:'inline-block',backgroundImage:'linear-gradient(to bottom,#fff,#f4f4f5,#71717a)',backgroundClip:'text',WebkitBackgroundClip:'text',color:'transparent',filter:'drop-shadow(0 2px 12px rgba(255,255,255,.1))',animationName:'crm-prism-green-move, crm-flash-settle',animationDuration:'1.2s,.9s',animationDelay:`${-Math.max(0,time)}s,${.24-Math.max(0,time)}s`,animationTimingFunction:'cubic-bezier(.16,1,.3,1),ease-out',animationIterationCount:'1,1'}}>Stunning.</span>
    </span>
  </span></>;
}
export const sweptGradientStyle = (gradientPosition: number): CSSProperties => ({
  display: "inline-block",
  backgroundImage: "linear-gradient(90deg,#ff32ac,#8B5CF6,#ff32ac)",
  backgroundSize: "200% 100%",
  backgroundPosition: `${gradientPosition}% 50%`,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  color: "transparent",
});

export function FutureHero({
  time,
  y = 0,
  gradientSweepDuration = 1.5,
  continuousGradient = false,
}: {
  time: number;
  y?: number;
  gradientSweepDuration?: number;
  continuousGradient?: boolean;
}) {
  const gradientPosition = continuousGradient
    ? 100 - 100 * (time / gradientSweepDuration)
    : 100 * (1 - p(time, 1.3, 1.3 + gradientSweepDuration));
  return (
    <Hero
      title={"Welcome to the future\nof the front desk."}
      kind="portrait"
      showMark={false}
      time={time}
      y={y}
      kineticContent
      content={
        <CenteredPhrases title={"Welcome to the future\nof the front desk."} time={time} beats={[
          {content: "Welcome to the", at: 0.16, style: "focus"},
          {content: <AccentWord time={time} at={1.05} motion="shear"><span style={sweptGradientStyle(gradientPosition)}>future</span></AccentWord>, at: 1.05, size: 1.75, style: "expand"},
          {content: "of the front desk.", at: 2.35, size: 1.1, style: "focus"},
        ]}/>
      }
    />
  );
}

export function AlwaysOnHero({ time }: { time: number }) {
  const gradientPosition = 100 - 100 * (time / 2.8);
  return (
    <Hero
      title={"Keep your front desk running\n24/7"}
      kind="portrait"
      showMark={false}
      time={time}
      sizeFactor={0.85}
      kineticContent
      content={
        <>
          <AlwaysOnParticles time={time} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <CenteredPhrases title={"Keep your front desk running\n24/7"} time={time} beats={[
              {content: "Keep your front desk", at: 0.16, size: 1.08, style: "focus"},
              {content: <AccentWord time={time} at={1.05} motion="press">running</AccentWord>, at: 1.05, size: 1.35, style: "expand"},
              {content: <span style={sweptGradientStyle(gradientPosition)}>24/7</span>, at: 2, size: 4.5, style: "impact"},
            ]}/>
          </div>
        </>
      }
    />
  );
}
