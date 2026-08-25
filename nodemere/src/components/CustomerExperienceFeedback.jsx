import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, ChevronLeft, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import './CustomerExperienceFeedback.css';

const QUESTIONNAIRE_VERSION = 'customer-experience-v1';
const SNOOZE_DAYS = 7;
const STORAGE_KEY_PREFIX = 'nodemere-customer-experience-feedback';

const IMPROVEMENT_AREAS = [
  'Receptionist Catalog',
  'Call quality',
  'Setup',
  'CRM / People',
  'App navigation',
  'Scenarios and automations',
  'Speed and performance',
];

const initialAnswers = {
  overall_experience: 5,
  user_friendliness: 5,
  user_interface: 5,
  pricing_rating: 5,
  pricing_value: '',
  reliability: 5,
  improvement_areas: [],
  improvement_other: '',
  receptionist_voice: 5,
  receptionist_knowledge: 5,
  receptionist_representation: 5,
  receptionist_personality: 5,
  ai_vs_human_preference: 5,
  idea: '',
  idea_dont_know: false,
};

const QUESTION_COUNT = 9;

const shuffle = (items) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const getLocalKey = (userId, businessId) => `${STORAGE_KEY_PREFIX}:${userId}:${businessId || 'pending-business'}`;

const readLocalState = (key) => {
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

const writeLocalState = (key, nextState) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(nextState));
  } catch {
    // Local storage is only a fallback when the migration is unavailable.
  }
};

const normalizeAnswers = (storedAnswers) => ({
  ...initialAnswers,
  ...(storedAnswers && typeof storedAnswers === 'object' ? storedAnswers : {}),
  improvement_areas: Array.isArray(storedAnswers?.improvement_areas) ? storedAnswers.improvement_areas : [],
});

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
};

const getAccountAgeDays = (createdAt) => {
  if (!createdAt) return null;
  const age = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return Number.isFinite(age) ? Math.max(0, age) : null;
};

const getUsageContext = async (businessId) => {
  if (!businessId) return {};

  const countQuery = (table) => supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId);

  const results = await Promise.all([
    countQuery('people'),
    countQuery('appointments'),
    countQuery('call_logs'),
    countQuery('hired_receptionists'),
    countQuery('scenarios'),
  ]);

  const [people, appointments, calls, receptionists, scenarios] = results;
  return {
    ...(people.error ? {} : { people_count: people.count || 0 }),
    ...(appointments.error ? {} : { appointment_count: appointments.count || 0 }),
    ...(calls.error ? {} : { call_count: calls.count || 0 }),
    ...(receptionists.error ? {} : { receptionist_count: receptionists.count || 0 }),
    ...(scenarios.error ? {} : { scenario_count: scenarios.count || 0 }),
  };
};

const questionIsComplete = (questionIndex, answers) => {
  switch (questionIndex) {
    case 0:
      return Number.isInteger(answers.overall_experience);
    case 1:
      return Number.isInteger(answers.user_friendliness);
    case 2:
      return Number.isInteger(answers.user_interface);
    case 3:
      return Number.isInteger(answers.pricing_rating);
    case 4:
      return Number.isInteger(answers.reliability);
    case 5:
      return answers.improvement_areas.length > 0
        && (!answers.improvement_areas.includes('Other') || Boolean(answers.improvement_other.trim()));
    case 6:
      return [
        answers.receptionist_voice,
        answers.receptionist_knowledge,
        answers.receptionist_representation,
        answers.receptionist_personality,
      ].every(Number.isInteger);
    case 7:
      return Number.isInteger(answers.ai_vs_human_preference);
    case 8:
      return true;
    default:
      return false;
  }
};

const CustomerExperienceFeedback = () => {
  const { session, profile } = useAuth();
  const userId = session?.user?.id || profile?.id || null;
  const [business, setBusiness] = useState(null);
  const [review, setReview] = useState(null);
  const [context, setContext] = useState({});
  const [answers, setAnswers] = useState(initialAnswers);
  const [choiceOrder, setChoiceOrder] = useState(() => shuffle(IMPROVEMENT_AREAS));
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('invite');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const localKeyRef = useRef(null);
  const completionLockRef = useRef(false);
  const persistReviewRef = useRef(null);

  const businessId = business?.id || null;
  const currentQuestionComplete = questionIsComplete(questionIndex, answers);
  const progress = ((questionIndex + 1) / QUESTION_COUNT) * 100;
  const currentQuestionLabel = `Question ${questionIndex + 1} of ${QUESTION_COUNT}`;

  const persistReview = useCallback(async (nextState, nextAnswers = answers, extra = {}) => {
    const now = new Date().toISOString();
    const localState = {
      state: nextState,
      answers: nextAnswers,
      snoozed_until: extra.snoozed_until || null,
      updated_at: now,
      completion_status: extra.completion_status || (nextState === 'completed' || nextState === 'discount_granted' ? 'completed' : 'incomplete'),
    };

    if (localKeyRef.current) writeLocalState(localKeyRef.current, localState);

    if (!businessId || !userId) return null;

    const reviewContext = extra.context || context;
    const payload = {
      user_id: userId,
      business_id: businessId,
      questionnaire_version: QUESTIONNAIRE_VERSION,
      questionnaire_state: nextState,
      completion_status: localState.completion_status,
      answers: nextAnswers,
      overall_rating: nextAnswers.overall_experience,
      pricing_value: nextAnswers.pricing_value || null,
      pricing_rating: nextAnswers.pricing_rating,
      improvement_areas: nextAnswers.improvement_areas,
      improvement_other: nextAnswers.improvement_other || null,
      receptionist_quality: {
        voice: nextAnswers.receptionist_voice,
        knowledge: nextAnswers.receptionist_knowledge,
        representation: nextAnswers.receptionist_representation,
        personality: nextAnswers.receptionist_personality,
      },
      ai_vs_human_preference: nextAnswers.ai_vs_human_preference,
      idea: nextAnswers.idea || null,
      plan: reviewContext.plan || null,
      account_age_days: reviewContext.account_age_days,
      usage_context: reviewContext.usage_context || {},
      discount_eligible: nextState === 'completed' || nextState === 'discount_granted' ? true : undefined,
      discount_granted: nextState === 'completed' || nextState === 'discount_granted' ? true : undefined,
      discount_granted_at: nextState === 'completed' || nextState === 'discount_granted' ? now : undefined,
      snoozed_until: extra.snoozed_until || null,
      updated_at: now,
    };

    Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

    try {
      let result;
      if (review?.id) {
        result = await supabase
          .from('reviews')
          .update(payload)
          .eq('id', review.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('reviews')
          .insert(payload)
          .select()
          .single();
      }
      if (result.error) throw result.error;
      if (result.data) setReview(result.data);
      return result.data || null;
    } catch (error) {
      console.warn('[Customer feedback] Could not persist review state:', error.message);
      return null;
    }
  }, [answers, businessId, context, review?.id, userId]);

  useEffect(() => {
    persistReviewRef.current = persistReview;
  }, [persistReview]);

  useEffect(() => {
    if (!isOpen || view !== 'questions' || !businessId || !persistReviewRef.current) return undefined;
    const saveTimer = window.setTimeout(() => {
      persistReviewRef.current('started', answers);
    }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [answers, businessId, isOpen, view]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (questionIndex === 5) setChoiceOrder(shuffle(IMPROVEMENT_AREAS));
  }, [questionIndex]);

  useEffect(() => {
    if (!userId || profile?.onboarded !== true) {
      setIsReady(true);
      return undefined;
    }

    let cancelled = false;
    const loadFeedback = async () => {
      setIsReady(false);
      try {
        const { data: businessData, error: businessError } = await supabase
          .from('businesses')
          .select('id, created_at')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();
        if (businessError && businessError.code !== 'PGRST116') throw businessError;

        const nextBusiness = businessData || null;
        const nextBusinessId = nextBusiness?.id || null;
        const nextLocalKey = getLocalKey(userId, nextBusinessId);
        const localState = readLocalState(nextLocalKey);
        localKeyRef.current = nextLocalKey;

        let existingReview = null;
        let existingReviews = [];
        let reviewLookupFailed = false;
        if (nextBusinessId) {
          const { data, error } = await supabase
            .from('reviews')
            .select('*')
            .eq('business_id', nextBusinessId)
            .eq('questionnaire_version', QUESTIONNAIRE_VERSION)
            .order('created_at', { ascending: false })
            .limit(50);
          if (error && error.code !== 'PGRST116') {
            reviewLookupFailed = true;
            console.warn('[Customer feedback] Review table is not available yet:', error.message);
          } else {
            existingReviews = Array.isArray(data) ? data : [];
            existingReview = existingReviews[0] || null;
          }
        }

        const createdAt = session?.user?.created_at || profile.created_at || nextBusiness?.created_at;
        const usageContext = await getUsageContext(nextBusinessId).catch(() => ({}));
        const nextContext = {
          plan: profile.plan || null,
          account_age_days: getAccountAgeDays(createdAt),
          usage_context: usageContext,
        };

        if (cancelled) return;
        setBusiness(nextBusiness);
        setContext(nextContext);
        setReview(existingReview);
        const useLocalFallback = reviewLookupFailed || !nextBusinessId;
        const storedAnswers = existingReview?.answers || (useLocalFallback ? localState?.answers : null);
        const storedState = existingReview?.questionnaire_state || (useLocalFallback ? localState?.state : null);
        setAnswers(normalizeAnswers(storedAnswers));

        const state = storedState || null;
        const hasCompletedReview = existingReviews.some((item) => (
          item.completion_status === 'completed'
          || item.questionnaire_state === 'completed'
          || item.questionnaire_state === 'discount_granted'
        ));
        const hasDeclinedReview = existingReviews.some((item) => item.questionnaire_state === 'declined');
        const localCompleted = localState?.completion_status === 'completed'
          || localState?.state === 'completed'
          || localState?.state === 'discount_granted';
        const localDeclined = localState?.state === 'declined';
        const isCompleted = hasCompletedReview
          || existingReview?.completion_status === 'completed'
          || state === 'completed'
          || state === 'discount_granted'
          || localCompleted;
        const isDeclined = hasDeclinedReview || state === 'declined' || localDeclined;
        const snoozedUntil = existingReview?.snoozed_until || (useLocalFallback ? localState?.snoozed_until : null);
        const isSnoozed = snoozedUntil && new Date(snoozedUntil).getTime() > Date.now();
        const eligibleByUsage = Number(usageContext.people_count) >= 3;
        const eligibleByAccountAge = Number(nextContext.account_age_days) >= 15;
        const isEligible = eligibleByUsage || eligibleByAccountAge;
        const shouldShow = !isCompleted && !isDeclined && isEligible && !isSnoozed;

        if (shouldShow) {
          setView('invite');
          setQuestionIndex(0);
          setDirection(1);
          setIsOpen(true);
          if (!reviewLookupFailed && persistReviewRef.current) {
            const persistedAnswers = normalizeAnswers(storedAnswers);
            if (!existingReview) {
              await persistReviewRef.current('eligible', persistedAnswers, { context: nextContext });
            }
            await persistReviewRef.current('shown', persistedAnswers, { context: nextContext });
          }
        }
      } catch (error) {
        console.warn('[Customer feedback] Could not load eligibility context:', error.message);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [profile?.created_at, profile?.onboarded, profile?.plan, session?.user?.created_at, userId]);

  const updateAnswer = useCallback((key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  }, []);

  const handleShareFeedback = async () => {
    setView('questions');
    setQuestionIndex(0);
    setDirection(1);
    await persistReview('started', answers);
  };

  const handleLater = async () => {
    await persistReview('postponed', answers, { snoozed_until: addDays(new Date(), SNOOZE_DAYS) });
    setIsOpen(false);
  };

  const handleDecline = async () => {
    await persistReview('declined', answers);
    setIsOpen(false);
  };

  const handleClose = async () => {
    if (view === 'questions') await persistReview('started', answers);
    setIsOpen(false);
  };

  const handleBack = () => {
    if (questionIndex === 0) return;
    setDirection(-1);
    setQuestionIndex((current) => current - 1);
  };

  const handleContinue = async () => {
    if (!currentQuestionComplete || isSaving) return;
    if (questionIndex < QUESTION_COUNT - 1) {
      await persistReview('started', answers);
      setDirection(1);
      setQuestionIndex((current) => current + 1);
      return;
    }

    if (completionLockRef.current) return;
    completionLockRef.current = true;
    setIsSaving(true);
    await persistReview('completed', answers, { completion_status: 'completed' });
    setView('complete');
    setIsSaving(false);
  };

  const toggleImprovementArea = (area) => {
    setAnswers((current) => {
      if (area === 'I don’t know') {
        return { ...current, improvement_areas: current.improvement_areas.includes(area) ? [] : [area], improvement_other: '' };
      }
      const next = current.improvement_areas.includes(area)
        ? current.improvement_areas.filter((item) => item !== area)
        : [...current.improvement_areas.filter((item) => item !== 'I don’t know'), area];
      return { ...current, improvement_areas: next };
    });
  };

  const questionContent = useMemo(() => {
    const ratingValueClass = (value) => (
      value > 5 ? 'text-emerald-300' : value < 5 ? 'text-rose-300' : 'text-white'
    );

    const ratingQuestion = (title, description, key, leftLabel, rightLabel) => {
      const value = answers[key] ?? 5;
      const fill = `${(value / 10) * 100}%`;
      return (
        <div className="space-y-14">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">{description}</p>
          </div>
          <div className="space-y-7">
            <div className="flex items-end justify-end">
              <span className={`text-5xl font-semibold tracking-[-0.06em] ${ratingValueClass(value)}`}>{value}</span>
            </div>
            <input
              aria-label={`${title} rating`}
              className="feedback-range"
              type="range"
              min="0"
              max="10"
              step="1"
              value={value}
              style={{ '--feedback-fill': fill }}
              onChange={(event) => updateAnswer(key, Number(event.target.value))}
            />
            <div className="flex justify-between gap-6 text-xs text-zinc-500">
              <span>{leftLabel}</span>
              <span className="text-right">{rightLabel}</span>
            </div>
          </div>
        </div>
      );
    };

    if (questionIndex === 0) return ratingQuestion('Overall Experience', 'How would you rate your overall experience so far?', 'overall_experience', 'Very Poor', 'Excellent');
    if (questionIndex === 1) return ratingQuestion('User Friendliness', 'How easy has Nodemere been to use?', 'user_friendliness', 'Very Difficult', 'Extremely Easy');
    if (questionIndex === 2) return ratingQuestion('User Interface', 'How would you rate the overall interface and design?', 'user_interface', 'Very Poor', 'Excellent');
    if (questionIndex === 4) return ratingQuestion('Reliability', 'How reliable has Nodemere been for you?', 'reliability', 'Very Unreliable', 'Extremely Reliable');

    if (questionIndex === 3) {
      const value = answers.pricing_rating ?? 5;
      const fill = `${(value / 10) * 100}%`;
      return (
        <div className="space-y-14">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Pricing &amp; Value</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">How do you feel about the value you’re getting for the price?</p>
          </div>
          <div className="space-y-7">
            <div className="flex items-end justify-end">
              <span className={`text-5xl font-semibold tracking-[-0.06em] ${ratingValueClass(value)}`}>{value}</span>
            </div>
            <input
              aria-label="Pricing and value rating"
              className="feedback-range"
              type="range"
              min="0"
              max="10"
              step="1"
              value={value}
              style={{ '--feedback-fill': fill }}
              onChange={(event) => updateAnswer('pricing_rating', Number(event.target.value))}
            />
            <div className="flex justify-between gap-6 text-xs text-zinc-500">
              <span>Too expensive</span>
              <span className="text-right">Excellent value</span>
            </div>
          </div>
        </div>
      );
    }

    if (questionIndex === 5) {
      const options = [...choiceOrder, 'Other', 'I don’t know'];
      return (
        <div className="space-y-9">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Areas for Improvement</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">What areas do you think could be improved?</p>
          </div>
          <div className="space-y-2.5">
            <p className="mb-5 text-[12px] text-zinc-600">Select all that apply</p>
            {options.map((option) => {
              const selected = answers.improvement_areas.includes(option);
              return (
                <button
                  type="button"
                  key={option}
                  aria-pressed={selected}
                  onClick={() => toggleImprovementArea(option)}
                  className={`flex min-h-12 w-full items-center justify-between rounded-2xl border px-5 text-left text-sm transition-all ${selected ? 'border-white bg-white text-black shadow-[0_0_18px_rgba(255,255,255,0.1)]' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:border-white/[0.16] hover:bg-white/[0.055] hover:text-zinc-200'}`}
                >
                  <span>{option}</span>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-black bg-black text-white' : 'border-zinc-700'}`}>
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                </button>
              );
            })}
            {answers.improvement_areas.includes('Other') ? (
              <textarea
                value={answers.improvement_other}
                onChange={(event) => updateAnswer('improvement_other', event.target.value)}
                placeholder="Tell us a little more"
                rows={3}
                autoFocus
                className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
              />
            ) : null}
          </div>
        </div>
      );
    }

    if (questionIndex === 6) {
      const qualitySliders = [
        ['Voice', 'receptionist_voice'],
        ['Knowledge', 'receptionist_knowledge'],
        ['Representation', 'receptionist_representation'],
        ['Personality', 'receptionist_personality'],
      ];
      return (
        <div className="space-y-9">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Receptionist Quality</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">How would you rate the quality of your AI receptionist?</p>
          </div>
          <div className="space-y-7">
            {qualitySliders.map(([label, key]) => {
              const value = answers[key] ?? 5;
              const fill = `${(value / 10) * 100}%`;
              return (
                <div key={key} className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-300">{label}</span>
                    <span className={`font-semibold ${ratingValueClass(value)}`}>{value}</span>
                  </div>
                  <input
                    aria-label={`${label} quality rating`}
                    className="feedback-range"
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={value}
                    style={{ '--feedback-fill': fill }}
                    onChange={(event) => updateAnswer(key, Number(event.target.value))}
                  />
                </div>
              );
            })}
            <div className="flex justify-between gap-6 text-xs text-zinc-500">
              <span>Very poor</span>
              <span className="text-right">Excellent</span>
            </div>
          </div>
        </div>
      );
    }

    if (questionIndex === 7) {
      const value = answers.ai_vs_human_preference ?? 5;
      const fill = `${(value / 10) * 100}%`;
      return (
        <div className="space-y-14">
          <div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">AI Receptionists vs. Humans</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">How much do you prefer our AI receptionists over a human receptionist?</p>
          </div>
          <div className="space-y-7">
            <div className="flex items-end justify-end">
              <span className={`text-5xl font-semibold tracking-[-0.06em] ${ratingValueClass(value)}`}>{value}</span>
            </div>
            <input
              aria-label="AI receptionist preference rating"
              className="feedback-range"
              type="range"
              min="0"
              max="10"
              step="1"
              value={value}
              style={{ '--feedback-fill': fill }}
              onChange={(event) => updateAnswer('ai_vs_human_preference', Number(event.target.value))}
            />
            <div className="flex justify-between gap-6 text-xs text-zinc-500">
              <span>Strongly prefer human</span>
              <span className="text-right">Strongly prefer Nodemere</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-9">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Let's hear it.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">If you could add or change one thing, what would it be?</p>
        </div>
        <div className="space-y-4">
          <textarea
            value={answers.idea}
            onChange={(event) => updateAnswer('idea', event.target.value)}
            placeholder="Share anything that would make Nodemere more useful for you"
            rows={6}
            autoFocus
            className="min-h-44 w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.035] px-5 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-white/[0.18]"
          />
        </div>
      </div>
    );
  }, [answers, choiceOrder, questionIndex, toggleImprovementArea, updateAnswer]);

  if (!userId || profile?.onboarded !== true || !isReady || !isOpen) return null;

  const modal = (
    <AnimatePresence>
      <motion.div
        key="customer-feedback-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/75 px-4 py-5 backdrop-blur-xl sm:px-6"
        role="presentation"
      >
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.985 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-feedback-title"
          className="relative flex max-h-[calc(100vh-40px)] min-h-[580px] w-full max-w-[780px] flex-col overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl"
        >
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-5 top-5 z-20 flex h-8 w-8 items-center justify-center text-zinc-600 transition hover:text-white"
            aria-label="Close customer experience feedback"
          >
            <X className="h-4 w-4" />
          </button>
          {view === 'invite' ? (
            <div className="relative flex flex-1 flex-col p-7 sm:p-12">
              <div className="flex items-center justify-between text-[13px] text-zinc-500">
                <span>Customer experience</span>
                  <span className="h-0.5 w-28 overflow-hidden rounded-full bg-white/[0.06]"><span className="brand-gradient block h-full w-1/6 rounded-full" /></span>
              </div>
              <div className="flex flex-1 flex-col justify-center py-12 sm:py-16">
                <div className="max-w-[560px]">
                  <h1 id="customer-feedback-title" className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">Help us make Nodemere better.</h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">A few thoughtful answers help us improve the parts of Nodemere you use every day. Completing it earns 10% off your next month.</p>
                </div>
              </div>
              <div className="space-y-3">
                <button type="button" onClick={handleShareFeedback} className="mx-auto flex h-12 w-[88%] max-w-[420px] items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]">Share Feedback <ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={handleLater} className="flex h-11 w-full items-center justify-center rounded-full text-sm font-medium text-zinc-500 transition hover:text-white">Ask Me Later</button>
                <button type="button" onClick={handleDecline} className="mx-auto block text-xs text-zinc-700 transition hover:text-zinc-400">No Thanks</button>
              </div>
            </div>
          ) : view === 'complete' ? (
            <div className="relative flex flex-1 flex-col justify-center p-7 sm:p-12">
              <div className="mx-auto w-full max-w-[560px]">
                <div className="mb-8 flex h-16 w-16 items-center justify-center">
                  <svg viewBox="0 0 32 32" className="h-16 w-16" fill="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="feedback-check-gradient" x1="0" y1="16" x2="32" y2="16" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="var(--brandGradientStart)" />
                        <stop offset="100%" stopColor="var(--brandGradientEnd)" />
                      </linearGradient>
                    </defs>
                    <path d="M6 16.5 12.5 23 26 8.5" stroke="url(#feedback-check-gradient)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 id="customer-feedback-title" className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">Thank you.</h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">Thanks for taking the time to help shape Nodemere. You’ve earned 10% off your next month.</p>
                <button type="button" onClick={() => setIsOpen(false)} className="mt-12 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 active:scale-[0.98]">Done <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative shrink-0 px-7 pt-7 sm:px-12 sm:pt-9">
                <div className="flex items-center justify-between gap-5">
                  <span className="text-[13px] font-normal leading-4 text-zinc-300">{currentQuestionLabel}</span>
                  <span className="text-[12px] text-zinc-600">Customer experience</span>
                </div>
                <div className="mt-4 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]"><div className="brand-gradient h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }} /></div>
              </div>
              <div className="relative flex min-h-0 flex-1 overflow-y-auto px-7 sm:px-12">
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  <motion.div
                    key={questionIndex}
                    custom={direction}
                    initial={{ opacity: 0, x: direction > 0 ? 18 : -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -18 : 18 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="mx-auto flex w-full max-w-[580px] flex-col justify-center py-12 sm:py-16"
                  >
                    {questionContent}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="relative flex shrink-0 items-center justify-between border-t border-white/[0.06] px-7 py-5 sm:px-12">
                <button type="button" onClick={handleBack} disabled={questionIndex === 0 || isSaving} className="flex h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-zinc-500 transition hover:text-white disabled:pointer-events-none disabled:opacity-0"><ChevronLeft className="h-4 w-4" /> Back</button>
                <button type="button" onClick={handleContinue} disabled={!currentQuestionComplete || isSaving} className="flex h-11 min-w-[150px] items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40">{isSaving ? 'Saving…' : questionIndex === QUESTION_COUNT - 1 ? 'Finish' : 'Continue'} <ArrowRight className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};

export default CustomerExperienceFeedback;
