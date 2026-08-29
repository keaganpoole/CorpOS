import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Copy, Phone, Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CubePreloader from './CubePreloader';

const PHONE_PROVIDERS = [
  { id: 'verizon', label: 'Verizon' },
  { id: 'att', label: 'AT&T' },
  { id: 'tmobile', label: 'T-Mobile' },
  { id: 'comcast', label: 'Comcast / Xfinity' },
  { id: 'ringcentral', label: 'RingCentral' },
  { id: 'google', label: 'Google Voice' },
  { id: 'other', label: 'Other provider' },
];

export const FORWARDING_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ForwardNumberModal = ({ agent = null, authSession, onClose, onSaved }) => {
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState(PHONE_PROVIDERS[0].id);
  const [copied, setCopied] = useState(false);
  const [entryId, setEntryId] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');
  const [twilioNumberStatus, setTwilioNumberStatus] = useState('');
  const [twilioNumberLabel, setTwilioNumberLabel] = useState('');
  const [canPurchaseNumber, setCanPurchaseNumber] = useState(true);
  const [availableTargetNumbers, setAvailableTargetNumbers] = useState([]);
  const [targetNumbersVisibleCount, setTargetNumbersVisibleCount] = useState(10);
  const [targetNumbersLoading, setTargetNumbersLoading] = useState(false);
  const [selectedTargetNumber, setSelectedTargetNumber] = useState(null);
  const [targetSearch, setTargetSearch] = useState({
    areaCode: '',
    contains: '',
  });
  const [targetQualityState, setTargetQualityState] = useState('idle');
  const [targetQualityMessage, setTargetQualityMessage] = useState('');
  const [targetQualityStep, setTargetQualityStep] = useState(0);
  const [forwardingTargetNumber, setForwardingTargetNumber] = useState('');
  const [savedEntries, setSavedEntries] = useState([]);
  const [sourceNumber, setSourceNumber] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [forwardingStatus, setForwardingStatus] = useState('draft');
  const [callerIdStatus, setCallerIdStatus] = useState('not_started');
  const [callerIdMessage, setCallerIdMessage] = useState('');
  const [callerIdValidationCode, setCallerIdValidationCode] = useState('');
  const [callerIdStarting, setCallerIdStarting] = useState(false);
  const [verifyCallerIdEnabled, setVerifyCallerIdEnabled] = useState(false);
  const [isAddingNewNumber, setIsAddingNewNumber] = useState(false);
  const [isReplacingTargetNumber, setIsReplacingTargetNumber] = useState(false);
  const forwardingNumber = forwardingTargetNumber || '';
  const hasTargetNumber = Boolean(forwardingNumber);
  const targetLineReady = hasTargetNumber && String(twilioNumberStatus || '').toLowerCase() === 'active';
  const needsTargetNumberSelection = !targetLineReady || isReplacingTargetNumber;
  const totalSlides = verifyCallerIdEnabled ? 5 : 4;
  const selectedProvider = PHONE_PROVIDERS.find((provider) => provider.id === selectedProviderId) || PHONE_PROVIDERS[0];
  const targetQualitySteps = [
    'Reserving your number',
    'Checking call quality',
    'Connecting it to your receptionist',
  ];
  const modalTitle =
    slide === 0
      ? targetQualityState === 'running'
        ? 'Checking this number.'
        : targetQualityState === 'passed'
          ? 'Number verified.'
          : needsTargetNumberSelection
            ? 'Choose your receptionist number.'
            : 'Connect your business line.'
      : slide === 1
        ? 'Copy this number.'
        : slide === 2
          ? 'Who handles your business number?'
          : slide === 3
            ? forwardingStatus === 'verified'
              ? 'Forwarding verified.'
              : 'Listening for your test call.'
            : verifyCallerIdEnabled
              ? callerIdStatus === 'verified'
                ? 'Caller ID verified.'
                : 'Use your business number for outbound calls.'
              : 'Forwarding verified.';
  const slideDescription =
    slide === 0
      ? targetQualityState === 'running'
        ? 'We’re checking the selected number before making it your active receptionist line.'
        : targetQualityState === 'passed'
          ? 'This number passed our quality check and is ready to use. Continue to connect your business line.'
          : needsTargetNumberSelection
            ? 'Pick the receptionist number your business line will forward calls to. We’ll test it first and only switch the active number if it passes.'
            : 'Your business line currently forwards to this active receptionist number. Replace it if you need a different line.'
      : slide === 1
        ? `In your carrier or phone system settings, forward ${sourceNumber || 'your business number'} to this receptionist number.`
        : slide === 2
          ? `Open ${selectedProvider.label} settings, turn on call forwarding, and forward ${sourceNumber || 'your business number'} to ${forwardingNumber}. Save your changes.`
          : slide === 3
            ? forwardingStatus === 'verified'
              ? 'Your business line is connected and ready to route calls to your receptionist.'
              : 'After you turn forwarding on, place a quick test call so we can confirm the connection.'
            : `Verify ${sourceNumber || 'your business number'} so outbound calls can display it as the caller ID. This step is optional.`;
  const forwardingSteps = [
    {
      label: 'Number forwarding',
      title: modalTitle,
      description: slideDescription,
    },
  ];
  const normalizedSourceNumber = sourceNumber.trim();
  const sourceOptions = [];
  const seenNumbers = new Set();

  if (businessPhone) {
    seenNumbers.add(businessPhone);
    sourceOptions.push({
      id: 'business-phone',
      entryId: null,
      source_number: businessPhone,
      source_label: 'Business Line',
      provider: '',
      status: 'draft',
    });
  }

  for (const entry of savedEntries) {
    if (!entry?.source_number || seenNumbers.has(entry.source_number)) continue;
    seenNumbers.add(entry.source_number);
    sourceOptions.push({
      id: entry.id || entry.source_number,
      entryId: entry.id || null,
      source_number: entry.source_number,
      source_label: entry.source_label || entry.source_number,
      provider: entry.provider || '',
      status: entry.status || 'draft',
    });
  }

  const selectedExistingEntry = savedEntries.find((entry) => {
    if (!entry?.source_number) return false;
    if (entryId && entry.id === entryId) return true;
    return entry.source_number === normalizedSourceNumber;
  }) || null;
  const selectedExistingEntryIsVerified = selectedExistingEntry?.status === 'verified';
  const applyCallerIdEntryState = (entry) => {
    const nextStatus = entry?.caller_id_verification_status || 'not_started';
    setCallerIdStatus(nextStatus);
    setCallerIdValidationCode(entry?.caller_id_validation_code || '');
    if (nextStatus === 'verified') {
      setCallerIdMessage('Your business number is ready to show as the outbound caller ID.');
      return;
    }
    if (nextStatus === 'pending') {
      setCallerIdMessage('Answer the verification call to your business line and enter the code shown below.');
      return;
    }
    if (nextStatus === 'failed') {
      setCallerIdMessage(entry?.caller_id_failure_reason || 'We couldn’t verify that business number yet. Try again when someone can answer the line.');
      return;
    }
    setCallerIdMessage('');
  };

  const selectSourceOption = (option) => {
    setIsAddingNewNumber(false);
    setEntryId(option.entryId || null);
    setSourceNumber(option.source_number || '');
    setSourceLabel(option.source_label || '');
    if (option.provider) {
      setSelectedProviderId(option.provider);
    }
    setForwardingStatus(option.status || 'draft');
    const matchedEntry = savedEntries.find((entry) => entry?.id === option.entryId || entry?.source_number === option.source_number) || null;
    applyCallerIdEntryState(matchedEntry);
  };

  const startAddingNewNumber = () => {
    setIsAddingNewNumber(true);
    setEntryId(null);
    setSourceNumber('');
    setSourceLabel('');
    setForwardingStatus('draft');
    setCallerIdStatus('not_started');
    setCallerIdMessage('');
    setCallerIdValidationCode('');
    setSelectedProviderId(PHONE_PROVIDERS[0].id);
    setError('');
  };

  const requestForwarding = async (endpoint, options = {}) => {
    if (!authSession?.access_token) {
      throw new Error('Please log in again before editing forwarding settings.');
    }

    const response = await fetch(`${FORWARDING_API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${authSession.access_token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        message = payload?.detail || message;
      } catch {
        // Ignore JSON parsing failures and fall back to status text.
      }
      throw new Error(message);
    }

    return response.json();
  };

  const loadAvailableTargetNumbers = async (filters) => {
    if (!needsTargetNumberSelection || targetQualityState === 'running') return;

    setTargetNumbersLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.areaCode?.trim()) params.set('area_code', filters.areaCode.trim());
      if (filters.contains?.trim()) params.set('contains', filters.contains.trim());
      params.set('limit', '100');

      const data = await requestForwarding(`/businesses/me/forwarding/available-numbers?${params.toString()}`);
      const options = data?.options || [];
      setAvailableTargetNumbers(options);
      setTargetNumbersVisibleCount(Math.min(10, options.length));
      setCanPurchaseNumber(Boolean(data?.can_purchase_number));

      setSelectedTargetNumber((current) => {
        if (current) {
          const stillExists = options.find((option) => option.phone_number === current.phone_number);
          if (stillExists) return stillExists;
        }
        return options[0] || null;
      });
    } catch (err) {
      setAvailableTargetNumbers([]);
      setSelectedTargetNumber(null);
      setError(err.message || 'Failed to load available numbers.');
    } finally {
      setTargetNumbersLoading(false);
    }
  };

  const claimSelectedTargetNumber = async () => {
    if (!selectedTargetNumber?.phone_number) {
      setError('Choose a number to continue.');
      return;
    }
    if (!canPurchaseNumber) {
      setError('This business has reached its number limit.');
      return;
    }

    setSaving(true);
    setError('');
    setTargetQualityState('running');
    setTargetQualityMessage('');
    setTargetQualityStep(0);

    try {
      const data = await requestForwarding('/businesses/me/forwarding/claim-number', {
        method: 'POST',
        body: JSON.stringify({
          phone_number: selectedTargetNumber.phone_number,
          label: `${businessName || 'Business'} line`,
        }),
      });

      if (data?.verified) {
        setTwilioNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTwilioNumberStatus(data?.twilio_number_status || 'active');
        setTwilioNumberLabel(data?.twilio_number_label || selectedTargetNumber.friendly_name || '');
        setForwardingTargetNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTargetQualityState('passed');
        setTargetQualityMessage(data?.message || 'This receptionist number is ready to use.');
        return;
      }

      setTwilioNumber('');
      setTwilioNumberStatus('quality_failed');
      setTwilioNumberLabel('');
      setForwardingTargetNumber('');
      setTargetQualityState('failed');
      setTargetQualityMessage(data?.message || 'That number didn’t pass our quick quality check. Pick another one and we’ll try again.');
    } catch (err) {
      setTwilioNumber('');
      setTwilioNumberStatus('quality_failed');
      setTwilioNumberLabel('');
      setForwardingTargetNumber('');
      setTargetQualityState('failed');
      setTargetQualityMessage(err.message || 'That number didn’t pass our quick quality check. Pick another one and we’ll try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadForwardingState = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await requestForwarding('/businesses/me/forwarding');
        if (!active) return;

        const numbers = data?.forwarding_config?.numbers || [];
        const currentEntry = data?.current_entry || null;
        const verifyCallerId = Boolean(data?.verify_caller_id);

        setBusinessId(data?.business_id || null);
        setSavedEntries(numbers);
        setBusinessName(data?.business_name || '');
        setBusinessPhone(data?.business_phone || '');
        setTwilioNumber(data?.twilio_number || '');
        setTwilioNumberStatus(data?.twilio_number_status || '');
        setTwilioNumberLabel(data?.twilio_number_label || '');
        setCanPurchaseNumber(Boolean(data?.can_purchase_number));
        setVerifyCallerIdEnabled(Boolean(data?.verify_caller_id));
        setForwardingTargetNumber(data?.forwarding_target_number || '');
        setTargetQualityMessage(data?.twilio_number_quality_error || '');
        setTargetQualityState('idle');
        setIsReplacingTargetNumber(false);
        setTargetSearch({
          areaCode: data?.default_area_code || '',
          contains: '',
        });

        if (currentEntry) {
          setEntryId(currentEntry.id || null);
          setSourceNumber(currentEntry.source_number || data?.business_phone || '');
          setSourceLabel(currentEntry.source_label || '');
          setSelectedProviderId(currentEntry.provider || PHONE_PROVIDERS[0].id);
          setForwardingStatus(currentEntry.status || 'draft');
          applyCallerIdEntryState(currentEntry);
          setIsAddingNewNumber(false);
          if (currentEntry.status === 'pending_test') {
            setSlide(3);
          } else if (
            verifyCallerId
            && currentEntry.status === 'verified'
            && currentEntry.caller_id_verification_status !== 'verified'
          ) {
            setSlide(4);
          } else if (verifyCallerId && currentEntry.caller_id_verification_status === 'pending') {
            setSlide(4);
          } else {
            setSlide(0);
          }
        } else {
          setEntryId(null);
          setSourceNumber(data?.business_phone || '');
          setSourceLabel(data?.business_phone ? 'Business Line' : '');
          setSelectedProviderId(PHONE_PROVIDERS[0].id);
          setForwardingStatus('draft');
          applyCallerIdEntryState(null);
          setIsAddingNewNumber(false);
          setSlide(0);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Failed to load forwarding settings.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadForwardingState();

    return () => {
      active = false;
    };
  }, [authSession?.access_token]);

  useEffect(() => {
    if (!needsTargetNumberSelection || targetQualityState === 'running') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      loadAvailableTargetNumbers(targetSearch);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [needsTargetNumberSelection, targetSearch, targetQualityState]);

  useEffect(() => {
    if (targetQualityState !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setTargetQualityStep((current) => (current + 1) % targetQualitySteps.length);
    }, 1100);

    return () => window.clearInterval(timer);
  }, [targetQualityState]);

  useEffect(() => {
    const needsForwardingWatch = slide === 3 && forwardingStatus !== 'verified';
    const needsCallerIdWatch = verifyCallerIdEnabled && slide === 4 && callerIdStatus === 'pending';
    if ((!needsForwardingWatch && !needsCallerIdWatch) || !authSession?.access_token || !entryId || !businessId) {
      return undefined;
    }

    let active = true;

    const refreshVerificationStatus = async () => {
      try {
        const data = await requestForwarding('/businesses/me/forwarding');
        if (!active) return;

        const numbers = data?.forwarding_config?.numbers || [];
        const currentEntry = data?.current_entry || null;
        const matchingEntry = currentEntry?.id === entryId
          ? currentEntry
          : numbers.find((entry) => entry?.id === entryId) || null;

        setSavedEntries(numbers);
        if (matchingEntry?.status) {
          setForwardingStatus(matchingEntry.status);
          if (matchingEntry.status === 'verified' && onSaved) {
            onSaved(matchingEntry);
          }
          if (
            verifyCallerIdEnabled
            && slide === 3
            && matchingEntry.status === 'verified'
            && matchingEntry?.caller_id_verification_status !== 'verified'
          ) {
            setSlide(4);
          }
        }
        applyCallerIdEntryState(matchingEntry);
      } catch {
        // Keep the listening state calm; a transient polling error should not interrupt setup.
      }
    };

    // Realtime is an optimization, not the source of truth. The backend checks
    // Twilio for a recent inbound call during this request, so polling also
    // recovers when the browser misses the Supabase UPDATE event.
    refreshVerificationStatus();
    const pollingTimer = window.setInterval(refreshVerificationStatus, 4000);

    const channel = supabase
      .channel(`business-forwarding-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'businesses',
          filter: `id=eq.${businessId}`,
        },
        () => {
          refreshVerificationStatus();
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearInterval(pollingTimer);
      supabase.removeChannel(channel);
    };
  }, [slide, authSession?.access_token, entryId, forwardingStatus, callerIdStatus, onSaved, businessId]);

  const copyForwardingNumber = async () => {
    if (!hasTargetNumber || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(forwardingNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const saveForwarding = async ({ status, confirmedEnabled = false, verified = false }) => {
    setSaving(true);
    setError('');

    try {
      const data = await requestForwarding('/businesses/me/forwarding', {
        method: 'PUT',
        body: JSON.stringify({
          ...(agent?.id ? { agent_id: String(agent.id) } : {}),
          entry_id: entryId || undefined,
          source_number: sourceNumber.trim(),
          source_label: sourceLabel.trim() || undefined,
          provider: selectedProvider.id,
          provider_label: selectedProvider.label,
          status,
          confirmed_enabled: confirmedEnabled,
          verified,
        }),
      });

      const numbers = data?.forwarding_config?.numbers || [];
      const entry = data?.entry || null;

      setSavedEntries(numbers);
      if (entry?.id) setEntryId(entry.id);
      if (entry?.status) setForwardingStatus(entry.status);
      applyCallerIdEntryState(entry);
      if (entry && onSaved) onSaved(entry);

      return entry;
    } catch (err) {
      setError(err.message || 'Failed to save forwarding settings.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const startCallerIdVerification = async () => {
    setCallerIdStarting(true);
    setError('');

    try {
      const data = await requestForwarding('/businesses/me/forwarding/caller-id/start', {
        method: 'POST',
        body: JSON.stringify({
          entry_id: entryId || undefined,
          source_number: sourceNumber.trim() || undefined,
          source_label: sourceLabel.trim() || undefined,
        }),
      });

      if (data?.entry) {
        applyCallerIdEntryState(data.entry);
        if (onSaved) onSaved(data.entry);
      }
    } catch (err) {
      setError(err.message || 'Failed to start caller ID verification.');
    } finally {
      setCallerIdStarting(false);
    }
  };

  const goNext = async () => {
    if (slide === 0 && needsTargetNumberSelection) {
      if (targetQualityState === 'passed') {
        setTargetQualityState('idle');
        setTargetQualityMessage('');
        setIsReplacingTargetNumber(false);
        return;
      }
      await claimSelectedTargetNumber();
      return;
    }

    if (!hasTargetNumber) {
      setError('Assign a receptionist number before setting up forwarding.');
      return;
    }

    if (slide === 0) {
      if (!normalizedSourceNumber) {
        setError('Choose or enter the business number you want to forward.');
        return;
      }
      if (selectedExistingEntryIsVerified) {
        const saved = await saveForwarding({ status: 'verified' });
        if (saved) {
          if (verifyCallerIdEnabled && saved?.caller_id_verification_status !== 'verified') {
            setSlide(4);
          } else {
            onClose();
          }
        }
        return;
      }
      setError('');
      setSlide(1);
      return;
    }

    if (slide === 1) {
      setSlide(2);
      return;
    }

    if (slide === 2) {
      const saved = await saveForwarding({ status: 'pending_test', confirmedEnabled: true });
      if (saved) setSlide(3);
      return;
    }

    if (slide === 3) {
      if (forwardingStatus !== 'verified') {
        setError('Finish the quick test call first so we know forwarding is working.');
        return;
      }
      if (verifyCallerIdEnabled) {
        setSlide(4);
        return;
      }
      onClose();
      return;
    }

    onClose();
  };

  const goBack = () => {
    if (slide === 0 && targetQualityState === 'passed') {
      setTargetQualityState('idle');
      setTargetQualityMessage('');
      setIsReplacingTargetNumber(Boolean(targetLineReady));
      return;
    }
    setSlide((current) => Math.max(current - 1, 0));
  };

  const revealMoreTargetNumbers = (event) => {
    const element = event.currentTarget;
    const reachedEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 72;
    if (reachedEnd && targetNumbersVisibleCount < availableTargetNumbers.length) {
      setTargetNumbersVisibleCount((current) => Math.min(current + 25, availableTargetNumbers.length));
    }
  };

  const renderSlide = () => {
    if (slide === 0) {
      if (needsTargetNumberSelection || targetQualityState !== 'idle') {
        if (targetQualityState === 'running' || targetQualityState === 'passed') {
          const passed = targetQualityState === 'passed';
          return (
            <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025]">
              <div className="relative p-5 text-center">
                <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.025] shadow-[0_0_44px_rgba(255,255,255,0.05)] transition-all duration-500">
                  <span className={`absolute h-20 w-20 rounded-full border border-white/[0.14] ${passed ? '' : 'animate-ping'}`} />
                  <span className={`absolute h-14 w-14 rounded-full border border-white/[0.10] ${passed ? '' : 'animate-pulse'}`} />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-[0_0_22px_rgba(255,255,255,0.12)] transition-all duration-500">
                    {passed ? <CheckCircle2 size={21} strokeWidth={2.5} /> : <Phone size={21} strokeWidth={2.5} />}
                  </div>
                </div>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  {passed
                    ? targetQualityMessage || 'This receptionist number is ready to use.'
                    : `We’re testing ${selectedTargetNumber?.phone_number || 'this number'} before switching your active receptionist number.`}
                </p>
              </div>

              <div className="border-t border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                    {passed ? 'Verified' : targetQualitySteps[targetQualityStep]}
                  </span>
                  <div className="flex items-center gap-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className={`h-1.5 w-1.5 rounded-full ${
                          passed ? 'bg-emerald-300' : dot <= targetQualityStep ? 'bg-emerald-300' : 'bg-zinc-700'
                        } ${passed ? '' : 'transition-colors duration-300'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="max-h-[52vh] space-y-4 overflow-y-auto rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4 custom-scrollbar">
            <div className="grid gap-3 sm:grid-cols-[110px,1fr]">
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Area code</span>
                <input
                  type="text"
                  value={targetSearch.areaCode}
                  maxLength={3}
                  onChange={(event) => {
                    setTargetQualityState('idle');
                    setTargetQualityMessage('');
                    setTargetSearch((current) => ({ ...current, areaCode: event.target.value.replace(/\D/g, '').slice(0, 3) }));
                  }}
                  placeholder="207"
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/20 focus:bg-white/[0.055]"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-600">Contains</span>
                <input
                  type="text"
                  value={targetSearch.contains}
                  onChange={(event) => {
                    setTargetQualityState('idle');
                    setTargetQualityMessage('');
                    setTargetSearch((current) => ({ ...current, contains: event.target.value.replace(/[^\dA-Za-z+*$%]/g, '').slice(0, 16) }));
                  }}
                  placeholder="Ends with 22"
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/20 focus:bg-white/[0.055]"
                />
              </label>
            </div>

            <div className="space-y-2 rounded-[24px] border border-white/[0.06] bg-black/20 p-2">
              {targetNumbersLoading ? (
                <div className="flex min-h-[220px] items-center justify-center" aria-label="Loading available numbers">
                  <CubePreloader size={18} />
                </div>
              ) : availableTargetNumbers.length ? (
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar" onScroll={revealMoreTargetNumbers}>
                  {availableTargetNumbers.slice(0, targetNumbersVisibleCount).map((option) => {
                    const active = selectedTargetNumber?.phone_number === option.phone_number;
                    return (
                      <button
                        key={option.phone_number}
                        type="button"
                        onClick={() => {
                          setTargetQualityState('idle');
                          setTargetQualityMessage('');
                          setSelectedTargetNumber(option);
                        }}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-white/20 bg-white/[0.045] text-white'
                            : 'border-white/[0.08] bg-transparent text-zinc-300 hover:border-white/[0.14] hover:text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-zinc-200'}`}>
                            {option.friendly_name || option.phone_number}
                          </div>
                          <div className={`mt-1 truncate text-xs ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            {[option.phone_number, option.locality, option.region].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                        {active ? (
                          <div className="shrink-0 rounded-full p-1 text-zinc-200">
                            <CheckCircle2 size={14} />
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-6 text-center">
                  <Search size={18} className="text-zinc-700" />
                  <p className="text-sm leading-6 text-zinc-500">
                    We couldn’t find numbers that match those filters yet. Try a broader area code or clear the pattern.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {targetQualityState === 'failed' && targetQualityMessage ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/8 px-4 py-3 text-sm leading-6 text-rose-200">
                  {targetQualityMessage}
                </div>
              ) : null}
              {!canPurchaseNumber ? (
                <div className="rounded-2xl border border-white/[0.10] bg-pink-400/8 px-4 py-3 text-sm leading-6 text-pink-200">
                  This business has reached its number purchase limit right now.
                </div>
              ) : null}
            </div>
          </div>
        );
      }

      return (
        <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4">
          {targetLineReady && (
            <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.035] text-zinc-300">
                      <Phone size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Current receptionist number</p>
                      <p className="mt-1 break-words text-xl font-semibold tracking-[-0.04em] text-white">{forwardingNumber}</p>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 px-1 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                  Active
                </div>
              </div>
              {businessName || twilioNumberLabel ? (
                <p className="mt-2 pl-12 text-xs text-zinc-600">{twilioNumberLabel || businessName}</p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setIsReplacingTargetNumber(true);
                  setTargetQualityState('idle');
                  setTargetQualityMessage('');
                }}
                className="mt-4 h-10 rounded-full border border-white/[0.08] px-4 text-sm font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white"
              >
                Replace AI number
              </button>
            </div>
          )}
          <div className={`${targetLineReady ? 'mt-3 border-t border-white/[0.06] pt-3' : ''} min-w-0 space-y-2`}>
            {sourceOptions.map((option) => {
                const active = sourceNumber === option.source_number;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectSourceOption(option)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-white/20 bg-transparent text-white'
                        : 'border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/[0.14] hover:text-white'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-zinc-200'}`}>
                        {option.source_label || option.source_number}
                      </div>
                      <div className={`mt-1 truncate text-xs ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {option.source_number}
                      </div>
                    </div>
                    {option.status === 'verified' ? (
                      <div className="shrink-0 rounded-full p-1 text-zinc-300">
                        <CheckCircle2 size={14} />
                      </div>
                    ) : null}
                  </button>
                );
              })}
            <button
              type="button"
              onClick={startAddingNewNumber}
              className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${
                isAddingNewNumber
                  ? 'border-white/20 bg-white/[0.045] text-zinc-200'
                  : 'border-dashed border-white/[0.12] bg-transparent text-zinc-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <Plus size={14} />
              Use different business number
            </button>
            {isAddingNewNumber && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={sourceNumber}
                  onChange={(event) => {
                    setEntryId(null);
                    setSourceNumber(event.target.value);
                    setForwardingStatus('draft');
                  }}
                  placeholder="+1 (555) 123-4567"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/20 focus:bg-white/[0.055]"
                />
                <input
                  type="text"
                  value={sourceLabel}
                  onChange={(event) => setSourceLabel(event.target.value)}
                  placeholder="Front desk"
                  className="h-12 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/20 focus:bg-white/[0.055]"
                />
              </div>
            )}
          </div>

        </div>
      );
    }

    if (slide === 1) {
      return (
        <div className="space-y-4 rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5">
          <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
            <div className="min-w-0">
              <p className="break-words text-3xl font-semibold tracking-[-0.04em] text-white">
                {forwardingNumber || 'Number pending'}
              </p>
            </div>
            <button
              type="button"
              onClick={copyForwardingNumber}
              disabled={!hasTargetNumber}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] text-zinc-400 transition hover:border-white/20 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy number"
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={17} />}
            </button>
          </div>

        </div>
      );
    }

    if (slide === 2) {
      return (
        <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="grid max-h-[260px] grid-cols-2 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-3">
            {PHONE_PROVIDERS.map((provider) => {
              const active = selectedProviderId === provider.id;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => setSelectedProviderId(provider.id)}
                  className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
                    active
                      ? 'border-white/20 bg-white/[0.06] text-white'
                      : 'border-white/[0.08] bg-black/20 text-zinc-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {provider.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (slide === 3) {
      const isVerified = forwardingStatus === 'verified';
      return (
      <div className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-white/[0.025]">
        <div className="relative flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.025] shadow-[0_0_44px_rgba(255,255,255,0.05)] transition-all duration-500">
            <span className={`absolute h-20 w-20 rounded-full border border-white/[0.14] ${isVerified ? '' : 'animate-ping'}`} />
            <span className={`absolute h-14 w-14 rounded-full border border-white/[0.10] ${isVerified ? '' : 'animate-pulse'}`} />
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-black shadow-[0_0_22px_rgba(255,255,255,0.12)] transition-all duration-500">
              {isVerified ? <CheckCircle2 size={21} strokeWidth={2.5} /> : <Phone size={21} strokeWidth={2.5} />}
            </div>
          </div>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
            {isVerified
              ? `${sourceNumber || 'Your business number'} is now saved and marked as working with your dedicated business line.`
              : `Place a quick test call to ${sourceNumber || 'your business line'} and we’ll verify the setup automatically.`}
          </p>
        </div>

        <div className="border-t border-white/[0.06] bg-black/20 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
              {isVerified ? 'Verified' : 'Listening'}
            </span>
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className={`h-1.5 w-1.5 rounded-full ${isVerified ? 'bg-emerald-300' : 'bg-zinc-700'}`}
                  style={{ animationDelay: `${dot * 160}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      );
    }

    const callerIdVerified = callerIdStatus === 'verified';
    const callerIdPending = callerIdStatus === 'pending';
    const callerIdFailed = callerIdStatus === 'failed';
    return (
      <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.025] p-5">
        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-300/15 bg-orange-300/[0.05] p-4 text-sm leading-6 text-orange-100/85">
            <p className="font-semibold text-orange-100">Outbound AI calling is limited to documented, consented operational or customer-service calls.</p>
            <p className="mt-1">Nodemere records and transcribes calls by default. Do not use this feature for telemarketing, political outreach, debt collection, or restricted industries. Every call must identify the business, disclose the AI assistant, and give any notice or opt-out required by law.</p>
            <a href="/communications-notice" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-white underline underline-offset-2">Read the communications notice</a>
          </div>

          {callerIdPending ? (
            <div className="space-y-4 rounded-[24px] border border-white/[0.10] bg-pink-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-pink-200">
                <Phone size={15} />
                <span className="text-sm font-semibold">Verification call in progress</span>
              </div>
              <p className="text-sm leading-6 text-pink-100/90">
                Answer the call to {sourceNumber || 'your business line'} and enter this code on the keypad.
              </p>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-center text-3xl font-semibold tracking-[0.35em] text-white">
                {callerIdValidationCode || '------'}
              </div>
            </div>
          ) : callerIdVerified ? (
            <div className="space-y-3 rounded-[24px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 size={15} />
                <span className="text-sm font-semibold">Outbound caller ID ready</span>
              </div>
              <p className="text-sm leading-6 text-emerald-100/90">
                Calls can now go out using {sourceNumber || 'your business number'}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
              <p className="text-sm leading-6 text-zinc-500">
                This is optional, but it helps outbound calls feel more like they’re coming from your business.
              </p>
              <button
                type="button"
                onClick={startCallerIdVerification}
                disabled={callerIdStarting}
                className="h-11 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
              {callerIdStarting ? <span className="flex items-center justify-center" aria-label="Starting verification"><CubePreloader size={14} /></span> : 'Verify this number'}
              </button>
            </div>
          )}

          {callerIdFailed && callerIdMessage ? (
            <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/[0.06] p-4">
              <p className="text-sm leading-6 text-rose-200">{callerIdMessage}</p>
              <button
                type="button"
                onClick={startCallerIdVerification}
                disabled={callerIdStarting}
                className="mt-3 h-10 w-full rounded-full border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-white transition hover:border-white/[0.14] hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {callerIdStarting ? <span className="flex items-center justify-center" aria-label="Starting verification"><CubePreloader size={14} /></span> : 'Try again'}
              </button>
            </div>
          ) : null}

          {!callerIdPending && callerIdMessage && !callerIdFailed && !callerIdVerified ? (
            <p className="text-sm leading-6 text-zinc-500">{callerIdMessage}</p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 text-white backdrop-blur-md sm:p-8 font-sans"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[calc(100vh-24px)] w-full max-w-[700px] overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute right-[-64px] top-[-80px] h-56 w-56 rounded-full bg-white/[0.035] blur-[70px]" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex h-4 w-full items-center gap-3 pr-8">
                <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">{forwardingSteps[0].label} · {slide + 1} of {totalSlides}</p>
                <div className="h-1 min-w-0 max-w-[360px] flex-1 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full brand-gradient transition-all duration-500" style={{ width: `${((slide + 1) / totalSlides) * 100}%` }} />
                </div>
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl">{forwardingSteps[0].title}</h2>
              <p className="mt-3 max-w-none text-sm leading-6 text-zinc-500">
                {forwardingSteps[0].description}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-zinc-500 transition hover:bg-white/[0.04] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={loading ? 'loading' : slide}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.18 }}
              className=""
            >
              {loading ? (
                <div className="flex min-h-[220px] items-center justify-center" aria-label="Loading forwarding settings">
                  <CubePreloader size={18} />
                </div>
              ) : (
                renderSlide()
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 space-y-3">
            {slide === 3 && forwardingStatus === 'verified' && (
              <button
                type="button"
                onClick={goNext}
                disabled={loading || saving || callerIdStarting}
                className="mx-auto block h-12 w-full max-w-[440px] rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Finish Setup
              </button>
            )}
            {slide !== totalSlides - 1 && (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  loading
                  || saving
                  || callerIdStarting
                  || targetQualityState === 'running'
                  || (slide !== 0 && !hasTargetNumber)
                  || (slide === 0 && needsTargetNumberSelection && (!selectedTargetNumber || !canPurchaseNumber))
                  || (slide === 3 && forwardingStatus !== 'verified')
                }
                className="mx-auto block h-12 w-full max-w-[440px] rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? <span className="flex items-center justify-center" aria-label={targetQualityState === 'running' ? 'Checking number' : 'Saving'}><CubePreloader size={14} /></span>
                  : slide === 0 && needsTargetNumberSelection
                    ? targetQualityState === 'passed'
                      ? 'Continue'
                      : 'Use this number'
                    : slide === 0 && selectedExistingEntryIsVerified
                      ? 'Use this number'
                    : slide === 2
                      ? 'I turned forwarding on'
                      : slide === 3
                        ? 'Continue'
                      : 'Continue'}
              </button>
            )}
            <button
              type="button"
              onClick={slide === 0 && targetQualityState !== 'passed' ? onClose : goBack}
              disabled={saving}
              className="h-11 w-full rounded-full text-sm font-normal text-zinc-500 transition hover:text-white disabled:opacity-40"
            >
              {slide === 0 && targetQualityState !== 'passed' ? 'Close' : 'Back'}
            </button>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>

        </div>
      </motion.div>
    </motion.div>
  );
};

export default ForwardNumberModal;
