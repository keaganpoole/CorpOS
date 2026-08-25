import React from 'react';

const CubePreloader = ({ className = '', size = 22 }) => (
  <div className={`cube-preloader ${className}`}>
    <div className="boxes" style={{ '--cube-preloader-size': `${size}px` }}>
      <div className="box"><div></div><div></div><div></div><div></div></div>
      <div className="box"><div></div><div></div><div></div><div></div></div>
      <div className="box"><div></div><div></div><div></div><div></div></div>
      <div className="box"><div></div><div></div><div></div><div></div></div>
    </div>
    <style>{`
      .cube-preloader .boxes {
          --brandGradientStart: #ff32ac;
          --brandGradientEnd: #8B5CF6;
          --cube-brand-gradient: linear-gradient(
            135deg,
            var(--brandGradientStart) 0%,
            var(--brandGradientStart) 18%,
            var(--brandGradientEnd) 82%,
            var(--brandGradientEnd) 100%
          );
          --size: var(--cube-preloader-size, 22px);
          --duration: 1000ms;
          --timing: cubic-bezier(0.65, 0, 0.35, 1);
          height: calc(var(--size) * 2);
          width: calc(var(--size) * 3);
          position: relative;
          transform-style: preserve-3d;
          transform-origin: 50% 50%;
          margin-top: calc(var(--size) * 1.5 * -1);
          transform: rotateX(60deg) rotateZ(45deg) rotateY(0deg) translateZ(0px);
      }

      .cube-preloader .boxes .box {
          width: var(--size);
          height: var(--size);
          top: 0;
          left: 0;
          position: absolute;
          transform-style: preserve-3d;
      }

      .cube-preloader .boxes .box:nth-child(1) {
          transform: translate(100%, 0);
          animation: cubePreloaderBox1 var(--duration) var(--timing) infinite;
      }

      .cube-preloader .boxes .box:nth-child(2) {
          transform: translate(0, 100%);
          animation: cubePreloaderBox2 var(--duration) var(--timing) infinite;
      }

      .cube-preloader .boxes .box:nth-child(3) {
          transform: translate(100%, 100%);
          animation: cubePreloaderBox3 var(--duration) var(--timing) infinite;
      }

      .cube-preloader .boxes .box:nth-child(4) {
          transform: translate(200%, 0);
          animation: cubePreloaderBox4 var(--duration) var(--timing) infinite;
      }

      .cube-preloader .boxes .box > div {
          --background: #1a1a1a;
          --top: auto; --right: auto; --bottom: auto; --left: auto;
          --translateZ: calc(var(--size) / 2);
          --rotateY: 0deg; --rotateX: 0deg;
          position: absolute;
          width: 100%; height: 100%;
          background: var(--background);
          top: var(--top); right: var(--right); bottom: var(--bottom); left: var(--left);
          transform: rotateY(var(--rotateY)) rotateX(var(--rotateX)) translateZ(var(--translateZ));
          box-sizing: border-box;
      }

      .cube-preloader .boxes .box > div:nth-child(1) {
          --top: 0; --left: 0;
          --background: #f0f0f0;
          border: 2px solid transparent;
          background-clip: padding-box;
      }

      .cube-preloader .boxes .box > div:nth-child(1)::before {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0; left: 0;
          z-index: -1;
          margin: -2px;
          background: var(--cube-brand-gradient);
          background-size: 300% 100%;
          background-position: var(--cube-gradient-position, 50%) 50%;
      }

      .cube-preloader .boxes .box > div:nth-child(2) {
          --background: #2a2a2a;
          --right: 0; --rotateY: 90deg;
          border: 1px solid #111;
      }

      .cube-preloader .boxes .box > div:nth-child(3) {
          --background: #151515;
          --rotateX: -90deg;
          border: 1px solid #000;
      }

      .cube-preloader .boxes .box > div:nth-child(4) {
          --background: var(--cube-brand-gradient);
          --top: 0; --left: 0;
          --translateZ: calc(var(--size) * 3 * -1);
          filter: blur(15px);
          opacity: 0.6;
      }

      .cube-preloader .boxes .box:nth-child(1) > div:nth-child(1)::before,
      .cube-preloader .boxes .box:nth-child(1) > div:nth-child(4) { --cube-gradient-position: 0%; }
      .cube-preloader .boxes .box:nth-child(2) > div:nth-child(1)::before,
      .cube-preloader .boxes .box:nth-child(2) > div:nth-child(4) { --cube-gradient-position: 33.333%; }
      .cube-preloader .boxes .box:nth-child(3) > div:nth-child(1)::before,
      .cube-preloader .boxes .box:nth-child(3) > div:nth-child(4) { --cube-gradient-position: 66.666%; }
      .cube-preloader .boxes .box:nth-child(4) > div:nth-child(1)::before,
      .cube-preloader .boxes .box:nth-child(4) > div:nth-child(4) { --cube-gradient-position: 100%; }

      @keyframes cubePreloaderBox1 { 0%, 50% { transform: translate(100%, 0); } 100% { transform: translate(200%, 0); } }
      @keyframes cubePreloaderBox2 { 0% { transform: translate(0, 100%); } 50% { transform: translate(0, 0); } 100% { transform: translate(100%, 0); } }
      @keyframes cubePreloaderBox3 { 0%, 50% { transform: translate(100%, 100%); } 100% { transform: translate(0, 100%); } }
      @keyframes cubePreloaderBox4 { 0% { transform: translate(200%, 0); } 50% { transform: translate(200%, 100%); } 100% { transform: translate(100%, 100%); } }
    `}</style>
  </div>
);

export default CubePreloader;
