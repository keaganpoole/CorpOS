import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import './IntercomShowcase.css';

const EXAMPLES = [
  {
    label: 'Confirm an appointment',
    industry: 'Dental',
    receptionist: 'maggie',
    request: 'Did Laura ever confirm her appointment for tomorrow?',
    response: 'Not yet. She was still figuring out childcare. Want me to call and check?',
  },
  {
    label: 'Follow up with a lead',
    industry: 'Roofing',
    receptionist: 'brice',
    request: 'Can you call Jason? He filled out the form about replacing his roof this morning.',
    response: 'Absolutely. I’ll call him and see what he’s looking to have done.',
  },
  {
    label: 'Check unpaid invoices',
    industry: 'HVAC',
    receptionist: 'nikki',
    request: 'Do we still have anything unpaid from August?',
    response: 'Three invoices. Northstar worries me most. Sarah said the $1,200 was going out Monday, but we still don’t have it. Want me to call her?',
  },
  {
    label: 'Re-engage a client',
    industry: 'Marketing agency',
    receptionist: 'kayla',
    request: 'Have we not heard from anyone in a while?',
    response: 'Rachel at Oak Street Dental. They normally book monthly, but it’s been almost seven weeks. Want me to check in with her?',
  },
  {
    label: 'Move an appointment',
    industry: 'Chiropractic',
    receptionist: 'chloe',
    request: 'Can you call Frank and see if he’d be okay coming in earlier tomorrow?',
    response: 'Yeah. We have a 2:00 open now, and he originally wanted something earlier. I’ll offer it to him.',
  },
  {
    label: 'Clarify an estimate',
    industry: 'General contracting',
    receptionist: 'brian',
    request: 'Why hasn’t Daniel accepted the estimate yet?',
    response: 'I think it’s the price. He asked me twice if the $6,200 included materials. Want me to call and see what’s holding him back?',
  },
  {
    label: 'Plan tomorrow',
    industry: 'Salon',
    receptionist: 'paige',
    request: 'Anything I should know about tomorrow?',
    response: 'Laura still hasn’t confirmed, and Jason wants an earlier spot. Want me to call Laura, and if she cancels, offer it to Jason?',
  },

  // HVAC
  {
    label: 'Recover a lead',
    industry: 'HVAC',
    receptionist: 'bonnie',
    request: 'Whatever happened with that guy whose AC went out yesterday?',
    response: 'Ethan. We couldn’t get there soon enough, so he was calling around. Want me to check if he still needs someone?',
  },

  // Dental
  {
    label: 'Fill a cancellation',
    industry: 'Dental',
    receptionist: 'maggie',
    request: 'Any chance we can fill that cancellation this afternoon?',
    response: 'Probably. Nicole asked me yesterday to call if a cleaning opened up. Want me to offer her the 3:30?',
  },

  // Auto repair
  {
    label: 'Update a customer',
    industry: 'Auto repair',
    receptionist: 'brian',
    request: 'Can you call Trevor and let him know his truck won’t be ready today?',
    response: 'Yep. Do you want me to tell him tomorrow morning, or just say we’ll call as soon as it’s ready?',
  },

  // Salon
  {
    label: 'Explain a slow week',
    industry: 'Salon',
    receptionist: 'paige',
    request: 'Why has this week been so slow?',
    response: 'We’ve had nine cancellations, which is almost double normal. Most of them were color appointments.',
  },

  // Plumbing
  {
    label: 'Prioritize an emergency',
    industry: 'Plumbing',
    receptionist: 'nikki',
    request: 'Who was the customer with water coming through their ceiling?',
    response: 'Rachel Bennett. She shut the water off, but it’s still leaking upstairs. Want me to move her ahead of the non-emergency calls?',
  },

  // Roofing
  {
    label: 'Recover an estimate',
    industry: 'Roofing',
    receptionist: 'brice',
    request: 'Do we have any big estimates sitting out there?',
    response: "The biggest is Jordan’s roof at $14,600. He sounded ready to move forward but wanted to talk it over with his wife. What's the plan?",
  },

  // Cleaning
  {
    label: 'Find recurring customers',
    industry: 'Cleaning',
    receptionist: 'piper',
    request: 'Do we have anyone booking cleanings regularly who isn’t on a recurring plan?',
    response: 'Four customers. Hannah’s booked us five times in three months. Want me to ask if she’d rather reserve every other Friday?',
  },
  {
    label: 'Review new bookings',
    industry: 'Cleaning',
    receptionist: 'bonnie',
    request: 'Did we pick up anything new yesterday?',
    response: 'Three new cleanings. One caller only spoke Spanish, so I started speaking Spanish with her and got her first cleaning booked for Friday. She said another company couldn’t help her, so she was really appreciative and said she’d mention us going the extra mile in her review.',
  },

  // Landscaping
  {
    label: 'Recover the schedule',
    industry: 'Landscaping',
    receptionist: 'brian',
    request: 'How bad did yesterday’s rain mess up the schedule?',
    response: 'We had to push six jobs. I can fit four back in this week, but two will need to move to Monday.',
  },
  {
    label: 'Head out early',
    industry: 'Landscaping',
    receptionist: 'bonnie',
    request: 'How are we looking?',
    response: 'We’re good. Tyler has one yard left, Jake should finish around 4:30, and tomorrow’s all set. You said you wanted to get the boat out this week, right? It’s supposed to rain Friday and most of the weekend, so honestly, go. Today’s probably your best shot. I’ve got everything here.',
  },

  // Med spa
  {
    label: 'Recover a cancellation',
    industry: 'Med spa',
    receptionist: 'kayla',
    request: 'Did Olivia say why she canceled?',
    response: 'She said the $500 deposit was more than she expected. She still sounded interested, though. Want me to call and go over her options?',
  },

  // Law office
  {
    label: 'Qualify an inquiry',
    industry: 'Law office',
    receptionist: 'nikki',
    request: 'Can you call Derek Pompano about his custody case and ask him to send over the judge’s most recent custody order?',
    response: 'On it. I’ll get the details, check for conflicts, and ask him to securely send the custody order before we schedule anything.',
  },

  // Pest control
  {
    label: 'Spot a repeat issue',
    industry: 'Pest control',
    receptionist: 'brice',
    request: 'Why are we going back to the Parkers again?',
    response: 'Same ant problem. This is their third call in six weeks, and it’s always been around the kitchen. Want me to call Luis to let him know before he goes?',
  },

  // Property management
  {
    label: 'Handle an urgent request',
    industry: 'Property management',
    receptionist: 'kayla',
    request: 'What’s going on at the Wilson apartment?',
    response: 'Their refrigerator stopped cooling last night. They have medication that needs to stay cold, so I moved their request to urgent.',
  },

  // Garage door service
  {
    label: 'Recover missed calls',
    industry: 'Garage door service',
    receptionist: 'brian',
    request: 'Did we miss anybody while everyone was out this morning?',
    response: 'Five calls. Three were existing customers, but two were new jobs. One has a garage door stuck open right now. Want me to call him first?',
  },

  // Home services
  {
    label: 'Find lost jobs',
    industry: 'Home services',
    receptionist: 'brice',
    request: 'What are we losing the most jobs over lately?',
    response: 'Wait time. Six callers this month went somewhere else because we couldn’t get there soon enough. Price only came up twice.',
  },

  // Chiropractic
  {
    label: 'Bring a customer back',
    industry: 'Chiropractic',
    receptionist: 'chloe',
    request: 'Who hasn’t been back in that normally comes pretty regularly?',
    response: 'Marcus stands out. He usually comes every two weeks, but it’s been almost six. Want me to check in with him?',
  },

  // Electrical
  {
    label: 'Route a service call',
    industry: 'Electrical',
    receptionist: 'nikki',
    request: 'Can you call David back about that electrical issue?',
    response: 'Yep. I’ll find out what’s happening, whether he’s lost power completely, and get him to the right electrician. David Jensen, right?',
  },

  // Auto detailing
  {
    label: 'Spot an upsell',
    industry: 'Auto detailing',
    receptionist: 'paige',
    request: 'What did Alex book for Saturday?',
    response: 'Just the interior detail. He asked about ceramic coating last time, though. Want me to see if he still wants pricing on it?',
  },

  // Dog grooming
  {
    label: 'Catch up overnight',
    industry: 'Dog grooming',
    receptionist: 'bonnie',
    request: 'Did we get any calls overnight?',
    response: 'Four. I booked two dogs for grooming, including Bailey with Jenna since she usually handles anxious dogs. One caller said she’d check her schedule and call back.',
  },

  // Optometry
  {
    label: 'Check the weekend',
    industry: 'Optometry',
    receptionist: 'piper',
    request: 'Anything happen over the weekend?',
    response: 'A few things. I booked three eye exams, moved Dennis Silvia to Tuesday, and got a new patient in with Dr. Howard since he had an opening Wednesday afternoon.',
  },

  // Lawn & outdoor services
  {
    label: 'Start the day',
    industry: 'Lawn & outdoor',
    receptionist: 'brian',
    request: 'What am I walking into today?',
    response: 'Busy one. I booked four jobs overnight, and I put the Henderson cleanup with Tyler since he’s already working two houses nearby. Mrs. Bennett wants to move her 10:00, which might actually work in our favor with rain coming this afternoon. Jake has an opening around noon too. Want me to start moving the outdoor jobs earlier?',
  }
];
const ASSET_ROOT = 'https://grpgmhhtmfiwukncucaq.supabase.co/storage/v1/object/public';
const RECEPTIONISTS = {
  bonnie: { name: 'Bonnie', avatar: `${ASSET_ROOT}/avatars/bonnie2.png`, banner: `${ASSET_ROOT}/banners/bonnie_001.png` },
  brian: { name: 'Brian', avatar: `${ASSET_ROOT}/avatars/brian4.png`, banner: `${ASSET_ROOT}/banners/brian-banner.png` },
  brice: { name: 'Brice', avatar: `${ASSET_ROOT}/avatars/bryce1.png`, banner: `${ASSET_ROOT}/banners/bryce_banner3.png` },
  chloe: { name: 'Chloe', avatar: `${ASSET_ROOT}/avatars/chloe4.png`, banner: `${ASSET_ROOT}/banners/chloe_banner1.png` },
  kayla: { name: 'Kayla', avatar: `${ASSET_ROOT}/avatars/kayla3.png`, banner: `${ASSET_ROOT}/banners/kayla-banner.png` },
  maggie: { name: 'Maggie', avatar: `${ASSET_ROOT}/avatars/maggie.png`, banner: `${ASSET_ROOT}/banners/maggie_001.png` },
  nikki: { name: 'Nikki', avatar: `${ASSET_ROOT}/avatars/nikki6.png`, banner: `${ASSET_ROOT}/banners/nikki-banner2.png` },
  paige: { name: 'Paige', avatar: `${ASSET_ROOT}/avatars/paige.png`, banner: `${ASSET_ROOT}/banners/paige_banner2.png` },
  piper: { name: 'Piper', avatar: `${ASSET_ROOT}/avatars/piper2.png`, banner: `${ASSET_ROOT}/banners/piper_banner1.png` },
};
const USER_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1557862921-37829c790f19?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1542206395-9feb3edaa68d?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1546967191-fdfb13ed6b1e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=160&q=80',
  'https://images.unsplash.com/photo-1548142813-c348350df52b?auto=format&fit=crop&w=160&q=80',
];
const EASE = [0.22, 1, 0.36, 1];
const REPLY_MS = 1900;
const responsePauseMs = (response) => Math.min(18000, Math.max(10500, 7600 + response.split(/\s+/).length * 150));

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
  const elapsedRef = useRef(0);
  const running = inView && pageVisible && !reducedMotion;
  const example = EXAMPLES[index];
  const receptionist = RECEPTIONISTS[example.receptionist];
  const cycleMs = responsePauseMs(example.response);

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
      if (elapsedRef.current >= cycleMs) {
        elapsedRef.current = 0;
        setReplyVisible(false);
        setIndex((previous) => (previous + 1) % EXAMPLES.length);
      } else if (elapsedRef.current >= REPLY_MS) {
        setReplyVisible(true);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [cycleMs, running]);

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
                  <div>
                    <span className="intercom-showcase__speaker">
                      YOU
                      <span className="intercom-showcase__industry"><i aria-hidden="true" />{example.industry}</span>
                    </span>
                    <p>{example.request}</p>
                  </div>
                </div>
                <motion.div
                  className="intercom-showcase__line intercom-showcase__line--reply"
                  initial={false}
                  animate={{ opacity: showReply ? 1 : 0, y: showReply || reducedMotion ? 0 : 12, filter: showReply ? 'blur(0px)' : 'blur(5px)' }}
                  transition={{ duration: reducedMotion ? 0 : 0.85, ease: EASE }}
                  aria-hidden={!showReply}
                >
                  <span className="intercom-showcase__reply-banner" style={{ backgroundImage: `url(${receptionist.banner})` }} aria-hidden="true" />
                  <span className="intercom-showcase__reply-scrim" aria-hidden="true" />
                  <span className="intercom-showcase__avatar intercom-showcase__avatar--receptionist">
                    <img src={receptionist.avatar} alt="" loading="lazy" />
                  </span>
                  <div><span className="intercom-showcase__speaker">{receptionist.name.toUpperCase()} <VoiceAccent /></span><p>{example.response}</p></div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
