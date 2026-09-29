import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import './IntercomShowcase.css';

const EXAMPLES = [
  {
    label: 'Confirm an appointment',
    request: 'Did Laura ever confirm her appointment for tomorrow?',
    response: 'Not yet. She was still figuring out childcare. Want me to call and check?',
  },
  {
    label: 'Follow up with a lead',
    request: 'Can you call Jason? He filled out the form about replacing his roof this morning.',
    response: 'Absolutely. I’ll call him and see what he’s looking to have done.',
  },
  {
    label: 'Check unpaid invoices',
    request: 'Do we still have anything unpaid from August?',
    response: 'Three invoices. Northstar worries me most. Sarah said the $1,200 was going out Monday, but we still don’t have it. Want me to call her?',
  },
  {
    label: 'Re-engage a client',
    request: 'Have we not heard from anyone in a while?',
    response: 'Rachel at Oak Street Dental. They normally book monthly, but it’s been almost seven weeks. Want me to check in with her?',
  },
  {
    label: 'Move an appointment',
    request: 'Can you call Frank and see if he’d be okay coming in earlier tomorrow?',
    response: 'Yeah. We have a 2:00 open now, and he originally wanted something earlier. I’ll offer it to him.',
  },
  {
    label: 'Clarify an estimate',
    request: 'Why hasn’t Daniel accepted the estimate yet?',
    response: 'I think it’s the price. He asked me twice if the $6,200 included materials. Want me to call and see what’s holding him back?',
  },
  {
    label: 'Plan tomorrow',
    request: 'Anything I should know about tomorrow?',
    response: 'Laura still hasn’t confirmed, and Jason wants an earlier spot. Want me to call Laura, and if she cancels, offer it to Jason?',
  },
];
const MAGGIE_AVATAR = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public/avatars/maggie.png';
const USER_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80',
];
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
                  <span className="intercom-showcase__avatar intercom-showcase__avatar--user">
                    <img src={USER_AVATARS[index]} alt="" loading="lazy" />
                  </span>
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
