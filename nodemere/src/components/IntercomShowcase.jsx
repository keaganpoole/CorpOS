import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { UserRound } from 'lucide-react';
import './IntercomShowcase.css';

const EXAMPLES = [
  {
    label: 'Reschedule',
    request: 'Call John and reschedule his appointment for Thursday.',
    response: 'I’ll call John, find a time that works, and update his appointment.',
  },
  {
    label: 'Follow up',
    request: 'Let Cindy know we still need her insurance card.',
    response: 'I’ll follow up with Cindy and send her a secure upload link.',
  },
];
const MAGGIE_AVATAR = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png';
const EASE = [0.22, 1, 0.36, 1];
const CYCLE_MS = 10500;
const REPLY_MS = 1900;

function VoiceAccent() {
  return (
    <span className="intercom-showcase__voice" aria-hidden="true">
      {[3, 6, 11, 7, 16, 10, 5, 13, 8, 4, 7, 3].map((height, index) => (
        <span key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * -0.13}s` }} />
      ))}
    </span>
  );
}

export default function IntercomShowcase() {
  const sectionRef = useRef(null);
  const visualRef = useRef(null);
  const inView = useInView(visualRef, { amount: 0.35 });
  const entered = useInView(sectionRef, { once: true, amount: 0.15 });
  const reducedMotion = useReducedMotion();
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [index, setIndex] = useState(0);
  const [replyVisible, setReplyVisible] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const elapsedRef = useRef(0);
  const running = inView && pageVisible && !reducedMotion;

  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsedRef.current += Math.min(now - last, 200);
      last = now;
      if (elapsedRef.current >= CYCLE_MS) {
        elapsedRef.current = 0;
        setReplyVisible(false);
        setIndex((previous) => (previous + 1) % EXAMPLES.length);
      } else if (elapsedRef.current >= REPLY_MS) {
        setReplyVisible(true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [running]);

  const example = EXAMPLES[index];
  const showReply = replyVisible || reducedMotion;

  return (
    <section
      ref={sectionRef}
      id="homepage-intercom"
      className={`intercom-showcase${running ? ' is-running' : ''}${entered ? ' has-entered' : ''}`}
      aria-labelledby="homepage-intercom-title"
      data-visitor-section="intercom"
      data-visitor-section-index="7"
    >
      <div className="intercom-showcase__layout">
        <div className="intercom-showcase__copy">
          <div className="intercom-showcase__copy-content">
            <h2 id="homepage-intercom-title">Just say<br /><span>the word.</span></h2>
            <p>Talk to your receptionist through the Nest. Ask for a follow-up, a reschedule, or a missing document—and keep your day moving.</p>
          </div>
        </div>

        <div ref={visualRef} className="intercom-showcase__visual" aria-label="Example conversations with your receptionist">
          <div className="intercom-showcase__dialogue">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={index}
                className="intercom-showcase__exchange"
                initial={reducedMotion ? false : { opacity: 0, x: 28, filter: 'blur(5px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: -32, filter: 'blur(5px)' }}
                transition={{ duration: reducedMotion ? 0 : 0.6, ease: EASE }}
              >
                <div className="intercom-showcase__line">
                  <span className="intercom-showcase__avatar intercom-showcase__avatar--user"><UserRound size={20} strokeWidth={1.4} aria-hidden="true" /></span>
                  <div><span className="intercom-showcase__speaker">YOU</span><p>{example.request}</p></div>
                </div>
                <motion.div
                  className="intercom-showcase__line intercom-showcase__line--reply"
                  initial={false}
                  animate={{ opacity: showReply ? 1 : 0, y: showReply || reducedMotion ? 0 : 12, filter: showReply ? 'blur(0px)' : 'blur(5px)' }}
                  transition={{ duration: reducedMotion ? 0 : 0.85, ease: EASE }}
                  aria-hidden={!showReply}
                >
                  <span className="intercom-showcase__avatar intercom-showcase__avatar--receptionist">
                    {avatarFailed ? 'M' : <img src={MAGGIE_AVATAR} alt="" loading="lazy" onError={() => setAvatarFailed(true)} />}
                  </span>
                  <div><span className="intercom-showcase__speaker">MAGGIE <VoiceAccent /></span><p>{example.response}</p></div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
