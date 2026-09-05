import React, { useEffect, useState } from 'react';
import { Database, KeyRound, RotateCcw, ShieldAlert, ShieldCheck } from 'lucide-react';
import useSectionScrollProgress from '../hooks/useSectionScrollProgress';
import { RightFeatureList } from './CalendarShowcase';

const ENCRYPTION_FEATURE_ITEMS = [
  {
    icon: <ShieldCheck className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'AES-256-GCM',
    copy: 'Federal-standard encryption with authenticated integrity. Protected content is unreadable without the key, and altered ciphertext is rejected.',
  },
  {
    icon: <KeyRound className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1 group-hover:rotate-6" />,
    title: 'Per-Business Keys',
    copy: 'Every business receives its own random 256-bit data key. One platform, with cryptographic walls between tenants.',
  },
  {
    icon: <Database className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-translate-y-1" />,
    title: 'Keys Stay Server-Side',
    copy: 'Master keys never enter the browser or database. Only wrapped data keys and ciphertext are stored.',
  },
  {
    icon: <RotateCcw className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:-rotate-12" />,
    title: 'Rotation Without Amnesia',
    copy: 'Rotate keys or change passwords, PINs, and MFA without sacrificing authorized access to protected historical data.',
  },
  {
    icon: <ShieldAlert className="h-5 w-5 stroke-current overflow-visible transition-all duration-500 ease-out group-hover:scale-110" />,
    title: 'Tamper Fails Closed',
    copy: 'Move ciphertext to another business, record, field, or file path and authentication fails. No quiet corruption. No accidental unlock.',
  },
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function EncryptionShowcase() {
  const { rootRef, progress: sectionProgress } = useSectionScrollProgress({ mobileMinDelta: 0.0025 });
  const [copyVisible, setCopyVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : 1440
  ));

  useEffect(() => {
    const root = rootRef.current;
    if (!root || copyVisible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCopyVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: '0px 0px -68% 0px' }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [copyVisible, rootRef]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateViewportWidth = () => setViewportWidth(window.innerWidth);
    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);
    return () => window.removeEventListener('resize', updateViewportWidth);
  }, []);

  const isCompactViewport = viewportWidth < 1024;
  const featuresEntered = sectionProgress >= 0.44;
  const introOpacity = featuresEntered ? 0 : 1;
  const featureOpacity = featuresEntered ? 1 : 0;
  const featureProgress = isCompactViewport
    ? clamp((sectionProgress - 0.44) / 0.4, 0, 1)
    : featuresEntered ? 1 : 0;

  return (
    <div ref={rootRef} className="calendar-showcase scenario-demo-showcase relative h-[240vh] w-full bg-[#020202]">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#020202]">
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
            introOpacity <= 0.01 ? 'pointer-events-none' : ''
          }`}
          style={{
            opacity: introOpacity,
            visibility: introOpacity <= 0.01 ? 'hidden' : 'visible',
            transform: `translateY(${featuresEntered ? -12 : 0}px)`,
          }}
        >
          <div className="mx-auto max-w-[980px] px-2 text-center sm:px-4">
            <h2 className={`homepage-copy-reveal bg-gradient-to-b from-white via-zinc-100 to-zinc-500 bg-clip-text pb-2 text-5xl font-bold leading-[0.98] tracking-[-0.055em] text-transparent md:text-7xl lg:text-[5.8rem] ${copyVisible ? 'is-visible' : ''}`}>
              AES-256-GCM Encryption
            </h2>
            <div className={`homepage-copy-reveal homepage-copy-reveal--delayed mx-auto mt-6 max-w-[870px] text-base font-semibold leading-[1.55] tracking-[-0.02em] text-[#d4d4d8] md:text-xl ${copyVisible ? 'is-visible' : ''}`}>
              The same encryption standard trusted by the U.S. government for classified information. Built for Nodemere. Some platforms stop at securing the database. Nodemere goes further, protecting sensitive information with business-specific encryption and keeping the keys separate from the data
            </div>
          </div>
        </div>

        <div
          className={`absolute inset-0 z-20 flex items-center justify-center px-6 transition-[opacity,transform] duration-500 ease-out ${
            featureOpacity <= 0.01 ? 'pointer-events-none' : ''
          }`}
          style={{
            opacity: featureOpacity,
            visibility: featureOpacity <= 0.01 ? 'hidden' : 'visible',
            transform: `translateY(${featuresEntered ? 0 : 18}px)`,
          }}
        >
          <div className="mx-auto w-full max-w-[1120px]">
            <RightFeatureList
              featureProgress={featureProgress}
              items={ENCRYPTION_FEATURE_ITEMS}
              useScrollHighlight={isCompactViewport}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
