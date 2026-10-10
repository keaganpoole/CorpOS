import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Copy, Phone, Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CubePreloader from './CubePreloader';

const PHONE_PROVIDERS = [
  { id: 'verizon', label: 'Verizon', category: 'Wireless', summary: 'Forward with a dialing code.', logo: '/provider-logos/verizon.ico', darkName: '#FF5A58', lightName: '#D90000' },
  { id: 'att', label: 'AT&T', category: 'Wireless', summary: 'Set forwarding on your phone.', logo: '/provider-logos/att.ico', darkName: '#5BC4F1', lightName: '#007DBA' },
  { id: 'tmobile', label: 'T-Mobile', category: 'Wireless', summary: 'Use short codes for each call type.', logo: '/provider-logos/tmobile.ico', darkName: '#FF5BB2', lightName: '#C40068' },
  { id: 'xfinity-mobile', label: 'Xfinity Mobile', category: 'Wireless', summary: 'Forward from your mobile line.', logo: '/provider-logos/xfinity.ico', darkName: '#F5F5F5', lightName: '#161616' },
  { id: 'comcast', label: 'Xfinity Voice', category: 'Home phone', summary: 'Set forwarding in the Xfinity app.', logo: '/provider-logos/xfinity.ico', darkName: '#F5F5F5', lightName: '#161616' },
  { id: 'spectrum-mobile', label: 'Spectrum Mobile', category: 'Wireless', summary: 'Forward with a dialing code.', logo: '/provider-logos/spectrum.ico', darkName: '#63B7E6', lightName: '#00699C' },
  { id: 'ringcentral', label: 'RingCentral', category: 'Phone system', summary: 'Use RingCentral call handling.', logo: '/provider-logos/ringcentral.ico', darkName: '#FF9A5D', lightName: '#C85412' },
  { id: 'zoom-phone', label: 'Zoom Phone', category: 'Phone system', summary: 'Add an external forwarding number.', logo: '/provider-logos/zoom.ico', darkName: '#8AB7FF', lightName: '#1A6FD2' },
  { id: 'visible', label: 'Visible', category: 'Wireless', summary: 'Forward all calls with a dialing code.', logo: '/provider-logos/visible.svg', darkName: '#F5F5F5', lightName: '#161616' },
  { id: 'nextiva', label: 'Nextiva', category: 'Phone system', summary: 'Forward calls to your direct line.', logo: '/provider-logos/nextiva.png', darkName: '#79B5FF', lightName: '#0066CC' },
  { id: '8x8', label: '8x8', category: 'Phone system', summary: 'Set forwarding in Admin Console.', logo: '/provider-logos/eightxeight.ico', darkName: '#FF7777', lightName: '#D52B32' },
  { id: 'vonage-business', label: 'Vonage Business', category: 'Phone system', summary: 'Forward calls in your account.', logo: '/provider-logos/vonage.ico', darkName: '#FF9B69', lightName: '#D9531E' },
  { id: 'ooma-office', label: 'Ooma Office', category: 'Phone system', summary: 'Forward calls from an extension.', logo: '/provider-logos/ooma.ico', darkName: '#8ECD75', lightName: '#548A37' },
  { id: 'frontier', label: 'Frontier Phone', category: 'Home phone', summary: 'Forward calls from your phone line.', logo: '/provider-logos/frontier.ico', darkName: '#FF6686', lightName: '#D6003D' },
  { id: 'cox-voice', label: 'Cox Voice', category: 'Home phone', summary: 'Choose all or unanswered calls.', logo: '/provider-logos/cox.ico', darkName: '#75D8E9', lightName: '#0084A6' },
  { id: 'optimum-business', label: 'Optimum Business', category: 'Business phone', summary: 'Forward calls from your business line.', logo: '/provider-logos/optimum.ico', darkName: '#F2F2F2', lightName: '#222222' },
  { id: 'other', label: 'Other provider', category: 'More options', summary: 'Find your provider’s forwarding setting.' },
];

const availableProviderId = (providerId) => PHONE_PROVIDERS.some((provider) => provider.id === providerId) ? providerId : '';

const SLIDE = { choice: 0, number: 1, share: 2, provider: 3, test: 4, callerId: 5 };

const PROVIDER_SUPPORT = {
  tmobile: 'https://www.t-mobile.com/support/plans-features/self-service-short-codes',
  verizon: 'https://www.verizon.com/support/knowledge-base-181139/',
  att: 'https://www.att.com/support/article/wireless/KM1011513/',
  'xfinity-mobile': 'https://www.xfinity.com/support/articles/how-to-use-call-forwarding',
  comcast: 'https://www.xfinity.com/support/articles/forward-calls-with-call-forwarding/',
  'spectrum-mobile': 'https://www.spectrum.net/support/mobile/spectrum-mobile-call-forwarding',
  ringcentral: 'https://support.ringcentral.com/shared/content/app/setting-up-user-call-forwarding-in-the-ringcentral-app-desktop-a.html',
  'zoom-phone': 'https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0069132',
  visible: 'https://www.visible.com/content/value/visible/en/help/about-visible/plan-features.html',
  nextiva: 'https://help.nextiva.com/article/call-forwarding-always-np3',
  '8x8': 'https://help.8x8.com/docs/set-up-call-forwarding-in-8x8-admin-console',
  'vonage-business': 'https://businesssupport.vonage.com/articles/Answer/Call-Forwarding-24813?lob=Essentials',
  'ooma-office': 'https://support.ooma.com/office/yealink-ip-phone-with-programmable-buttons-use-guide/',
  frontier: 'https://frontier.com/helpcenter/phone/calling-features',
  'cox-voice': 'https://www.cox.com/residential/phone/learn/voice-features-and-settings.html',
  'optimum-business': 'https://static.tvlistings.optimum.net/ool/static/prod/downloads/user-guides/en/CS-21683-Optimum-Business-Phone-East-Rebrand.pdf',
};

const nationalForwardingNumber = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const getProviderGuide = (providerId, mode, forwardingNumber) => {
  const number = nationalForwardingNumber(forwardingNumber);
  const destination = number.length === 10 ? number : forwardingNumber;
  const missed = mode === 'missed';

  switch (providerId) {
    case 'tmobile':
      return missed
        ? {
            steps: [
              `No answer: dial **61*1${destination}#`,
              `Busy: dial **67*1${destination}#`,
              `Unreachable: dial **62*1${destination}#`,
            ],
            note: 'Press Call after each code and wait for confirmation.',
          }
        : {
            steps: [
              `Dial **21*1${destination}#`,
              'Press Call and wait for confirmation.',
            ],
            note: 'All calls go straight to the receptionist.',
          };
    case 'verizon':
      return {
        steps: [
          `Dial ${missed ? '*71' : '*72'}${destination}`,
          'Press Call and wait for the confirmation beeps.',
        ],
        note: missed
          ? 'Covers unanswered and busy calls.'
          : 'All calls go straight to the receptionist.',
      };
    case 'att':
      return {
        steps: missed
          ? [
              'Open Call forwarding in Phone settings.',
              `Choose When unanswered, enter ${destination}, and save.`,
              'Add busy and unreachable rules if available.',
            ]
          : [
              'Open Call forwarding in Phone settings.',
              `Choose Always forward, enter ${destination}, and turn it on.`,
            ],
        note: missed
          ? 'Available options vary by device.'
          : 'Available options vary by device.',
      };
    case 'xfinity-mobile':
      return {
        steps: [
          `Dial ${missed ? '*71' : '*72'}${destination}`,
          'Press Call and wait for confirmation.',
        ],
        note: missed ? 'Unanswered calls forward after your phone rings.' : 'All calls forward immediately.',
      };
    case 'comcast':
      return {
        steps: [
          'In the Xfinity app, open Services → Home Phone → View Xfinity Voice features → Call Forwarding.',
          `Under Basic Call Forwarding, enter ${destination} and select Update.`,
        ],
        note: 'Basic Call Forwarding sends all calls.',
      };
    case 'spectrum-mobile':
      return {
        steps: [
          `Dial ${missed ? '*71' : '*72'}${destination}`,
          'Press Call and wait for the confirmation tone and message.',
        ],
        note: missed ? 'Covers busy and unanswered calls.' : 'All calls forward immediately.',
      };
    case 'ringcentral':
      return {
        steps: missed
          ? [
              'Open Settings → Phone → Call handling → Edit → Missed calls.',
              `Forward to external number: enter ${destination} and save.`,
            ]
          : [
              'Open Settings → Phone → Call handling.',
              `Turn on Forward all calls, enter ${destination}, and save.`,
            ],
        note: missed ? 'Check work and after-hours schedules if you use both.' : 'This overrides normal call handling.',
      };
    case 'zoom-phone':
      return {
        steps: [
          'In the Zoom web portal, open Zoom Phone → Settings.',
          'Under Business Hours, edit Call Handling and choose Add Phone Number.',
          `Enter ${destination} as the external number, then save.`,
        ],
        note: 'Requires a direct number and admin permission. Check Closed Hours separately.',
      };
    case 'visible':
      return {
        steps: [
          `Dial *72${destination} on your Visible phone.`,
          'Press Call and wait for confirmation.',
        ],
        note: 'All calls forward immediately. Visible’s *71 is for busy calls, not unanswered calls.',
      };
    case 'nextiva':
      return {
        steps: [
          'Dial *72 on your Nextiva phone.',
          `When prompted, enter ${destination}, then press #.`,
          'Wait for the confirmation message.',
        ],
        note: 'Covers direct calls to your user line, not call groups or queues.',
      };
    case '8x8':
      return {
        steps: [
          'In 8x8 Admin Console, edit your extension under Users.',
          `Under Call forwarding rules, choose ${missed ? 'When User does not Answer' : 'Forward all Calls'}.`,
          `Enter ${forwardingNumber} as the external number, then save.`,
        ],
        note: 'For ring groups or auto attendants, ask your admin to update the route.',
      };
    case 'vonage-business':
      return {
        steps: [
          'In your Vonage online account, open Settings → Call Forwarding.',
          `Select Forward All Calls, enter ${destination}, and save.`,
        ],
        note: 'For a main company number, an admin may need to update its call routing.',
      };
    case 'ooma-office':
      return {
        steps: [
          'On your Ooma Office extension, dial *72.',
          `At the prompt, enter ${destination} followed by #.`,
        ],
        note: 'This forwards an extension. An admin may need to update routing for a main number.',
      };
    case 'frontier':
      return {
        steps: [
          'From your Frontier phone, dial *72.',
          `Follow the prompts to forward calls to ${destination}.`,
        ],
        note: 'Feature availability varies by Frontier phone plan and area.',
      };
    case 'cox-voice':
      return missed
        ? {
            steps: [
              'From your Cox Voice phone, dial *92.',
              `Follow the prompts for ring count, then enter ${destination}.`,
            ],
            note: 'This forwards unanswered calls. Busy-line forwarding is a separate setting.',
          }
        : {
            steps: [
              `From your Cox Voice phone, dial *72${destination}.`,
              'Listen for the confirmation dial tone.',
            ],
            note: 'Cox Voice is now part of Spectrum.',
          };
    case 'optimum-business':
      return {
        steps: [
          'From your Optimum Business phone, dial *72.',
          `At the dial tone, enter ${destination}.`,
          'If the destination answers, forwarding is active.',
        ],
        note: 'If unanswered, use the guide’s confirmation method. Continental US only.',
      };
    default:
      return {
        steps: [
          'Open Call forwarding in your provider settings.',
          `Choose missed or all calls, enter ${destination}, and save.`,
        ],
        note: 'Use your provider’s help page if these options differ.',
      };
  }
};

export const FORWARDING_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ForwardNumberModal = ({ agent = null, authSession, onClose, onSaved, preview = false }) => {
  const previewMode = import.meta.env.DEV && preview;
  const [slide, setSlide] = useState(previewMode ? SLIDE.provider : SLIDE.choice);
  const [connectionChoice, setConnectionChoice] = useState(null);
  const [loading, setLoading] = useState(!previewMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [forwardingMode, setForwardingMode] = useState('all');
  const [providerPage, setProviderPage] = useState(0);
  const [providerSearch, setProviderSearch] = useState('');
  const [compactGuide, setCompactGuide] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [copied, setCopied] = useState(false);
  const [entryId, setEntryId] = useState(null);
  const [businessId, setBusinessId] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [twilioNumber, setTwilioNumber] = useState('');
  const [twilioNumberStatus, setTwilioNumberStatus] = useState(previewMode ? 'active' : '');
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
  const [forwardingTargetNumber, setForwardingTargetNumber] = useState(previewMode ? '+12025550147' : '');
  const [savedEntries, setSavedEntries] = useState([]);
  const [sourceNumber, setSourceNumber] = useState(previewMode ? '(202) 555-0100' : '');
  const [sourceLabel, setSourceLabel] = useState('');
  const [forwardingStatus, setForwardingStatus] = useState('draft');
  const [callerIdStatus, setCallerIdStatus] = useState('not_started');
  const [callerIdMessage, setCallerIdMessage] = useState('');
  const [callerIdValidationCode, setCallerIdValidationCode] = useState('');
  const [callerIdStarting, setCallerIdStarting] = useState(false);
  const [callerIdReturnSlide, setCallerIdReturnSlide] = useState(SLIDE.test);
  const [verifyCallerIdEnabled, setVerifyCallerIdEnabled] = useState(false);
  const [isAddingNewNumber, setIsAddingNewNumber] = useState(false);
  const [isReplacingTargetNumber, setIsReplacingTargetNumber] = useState(false);
  const verificationWatchCleanupRef = useRef(null);
  const handleClose = () => {
    verificationWatchCleanupRef.current?.();
    onClose();
  };
  const forwardingNumber = forwardingTargetNumber || '';
  const hasTargetNumber = Boolean(forwardingNumber);
  const targetLineReady = hasTargetNumber && String(twilioNumberStatus || '').toLowerCase() === 'active';
  const needsTargetNumberSelection = !targetLineReady || isReplacingTargetNumber;
  const totalSlides = connectionChoice === 'direct' ? 3 : verifyCallerIdEnabled ? 6 : 5;
  const selectedProvider = PHONE_PROVIDERS.find((provider) => provider.id === selectedProviderId) || PHONE_PROVIDERS[PHONE_PROVIDERS.length - 1];
  const providerPageSize = compactGuide ? 1 : 3;
  const providerSearchTerm = providerSearch.trim().toLowerCase();
  const matchingProviders = PHONE_PROVIDERS.filter((provider) =>
    `${provider.label} ${provider.category} ${provider.id === 'comcast' ? 'Comcast' : ''}`.toLowerCase().includes(providerSearchTerm));
  const providerPageCount = Math.ceil(matchingProviders.length / providerPageSize);
  const visibleProviders = matchingProviders.slice(providerPage * providerPageSize, (providerPage + 1) * providerPageSize);
  const providerGuide = getProviderGuide(selectedProvider.id, forwardingMode, forwardingNumber);
  const providerSupportUrl = selectedProvider.id === 'ringcentral' && forwardingMode === 'all'
    ? 'https://support.ringcentral.com/content/dam/support/us/en/pdf/get-started/v2/RCA_Configuring_Your_Extensions_Call_Handling_Settings.pdf'
    : PROVIDER_SUPPORT[selectedProvider.id];

  useEffect(() => {
    const updateGuideLayout = () => setCompactGuide(window.innerWidth < 640);
    window.addEventListener('resize', updateGuideLayout);
    return () => window.removeEventListener('resize', updateGuideLayout);
  }, []);

  useEffect(() => {
    const selectedIndex = matchingProviders.findIndex((provider) => provider.id === selectedProviderId);
    if (selectedIndex >= 0) setProviderPage(Math.floor(selectedIndex / providerPageSize));
  }, [selectedProviderId, providerPageSize, providerSearch]);

  const targetQualitySteps = [
    'Reserving your number',
    'Checking call quality',
    'Connecting it to your receptionist',
  ];
  const modalTitle =
    slide === SLIDE.choice
      ? 'How will customers call your receptionist?'
      : slide === SLIDE.number
      ? targetQualityState === 'running'
        ? 'Checking this number.'
        : targetQualityState === 'passed'
          ? 'Number connected.'
          : needsTargetNumberSelection
            ? 'Choose your receptionist number.'
            : connectionChoice === 'direct' ? 'Your receptionist number.' : 'Connect your business line.'
      : slide === SLIDE.share
        ? 'Copy this number.'
        : slide === SLIDE.provider
          ? 'Turn on call forwarding.'
          : slide === SLIDE.test
            ? forwardingStatus === 'verified'
              ? 'Forwarding verified.'
              : 'Listening for your test call.'
            : callerIdStatus === 'verified'
            ? 'Caller ID verified.'
            : 'Use your business number for outbound calls.';
  const slideDescription =
    slide === SLIDE.choice
      ? 'Choose whether to share a new number or keep using your existing business number.'
      : slide === SLIDE.number
      ? targetQualityState === 'running'
        ? 'We’re checking the selected number before making it your active receptionist line.'
        : targetQualityState === 'passed'
          ? connectionChoice === 'direct' ? 'Place a test call before sharing this number with customers.' : 'This number is connected. Continue to set up call forwarding.'
          : needsTargetNumberSelection
            ? connectionChoice === 'direct' ? 'Pick the number customers will call to reach your receptionist.' : 'Pick the receptionist number your business line will forward calls to.'
            : connectionChoice === 'direct' ? 'You can share this number with customers now, or replace it.' : 'Choose the business line to connect to this receptionist number.'
      : slide === SLIDE.share
        ? connectionChoice === 'direct' ? 'Share this number with customers so they can call your receptionist directly.' : 'Keep this receptionist number handy for the next step.'
        : slide === SLIDE.provider
          ? `Choose who handles ${sourceNumber || 'your business number'} and follow the matching steps.`
          : slide === SLIDE.test
            ? forwardingStatus === 'verified'
              ? 'Your business line is connected and ready to route calls to your receptionist.'
              : 'Place a test call using the forwarding option you just set up.'
            : `Verify ${sourceNumber || 'your business number'} so outbound calls can display it as the caller ID. This step is optional.`;
  const forwardingSteps = [
    {
      label: 'Phone number setup',
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
  const selectedExistingEntryIsVerified = selectedExistingEntry?.status === 'verified'
    && Boolean(selectedExistingEntry.target_number)
    && nationalForwardingNumber(selectedExistingEntry.target_number) === nationalForwardingNumber(forwardingNumber);
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
    setSelectedProviderId(availableProviderId(option.provider));
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
    setSelectedProviderId('');
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

      if (data?.provisioned) {
        setTwilioNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTwilioNumberStatus(data?.twilio_number_status || 'active');
        setTwilioNumberLabel(data?.twilio_number_label || selectedTargetNumber.friendly_name || '');
        setForwardingTargetNumber(data?.twilio_number || selectedTargetNumber.phone_number);
        setTargetQualityState('passed');
        setTargetQualityMessage(data?.message || 'This receptionist number is connected. Place a test call before sharing it.');
        return;
      }

      setTargetQualityState('failed');
      setTargetQualityMessage(data?.message || 'We couldn’t connect that number. Pick another one and try again.');
    } catch (err) {
      setTargetQualityState('failed');
      setTargetQualityMessage(err.message || 'We couldn’t connect that number. Pick another one and try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (previewMode) return undefined;
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
          areaCode: '',
          contains: '',
        });

        if (currentEntry) {
          setEntryId(currentEntry.id || null);
          setSourceNumber(currentEntry.source_number || data?.business_phone || '');
          setSourceLabel(currentEntry.source_label || '');
          setSelectedProviderId(availableProviderId(currentEntry.provider));
          setForwardingStatus(currentEntry.status || 'draft');
          applyCallerIdEntryState(currentEntry);
          setIsAddingNewNumber(false);
          setSlide(SLIDE.choice);
        } else {
          setEntryId(null);
          setSourceNumber(data?.business_phone || '');
          setSourceLabel(data?.business_phone ? 'Business Line' : '');
          setSelectedProviderId('');
          setForwardingStatus('draft');
          applyCallerIdEntryState(null);
          setIsAddingNewNumber(false);
          setSlide(SLIDE.choice);
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
  }, [authSession?.access_token, previewMode]);

  useEffect(() => {
    if (slide !== SLIDE.number || !needsTargetNumberSelection || targetQualityState === 'running') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      loadAvailableTargetNumbers(targetSearch);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [slide, needsTargetNumberSelection, targetSearch, targetQualityState]);

  useEffect(() => {
    if (targetQualityState !== 'running') return undefined;

    const timer = window.setInterval(() => {
      setTargetQualityStep((current) => (current + 1) % targetQualitySteps.length);
    }, 1100);

    return () => window.clearInterval(timer);
  }, [targetQualityState]);

  useEffect(() => {
    const needsForwardingWatch = slide === SLIDE.test && forwardingStatus !== 'verified';
    const needsCallerIdWatch = verifyCallerIdEnabled && slide === SLIDE.callerId && callerIdStatus === 'pending';
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
            && slide === SLIDE.test
            && matchingEntry.status === 'verified'
            && matchingEntry?.caller_id_verification_status !== 'verified'
          ) {
            setCallerIdReturnSlide(SLIDE.test);
            setSlide(SLIDE.callerId);
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

    const stopVerificationWatch = () => {
      active = false;
      window.clearInterval(pollingTimer);
      supabase.removeChannel(channel);
    };
    verificationWatchCleanupRef.current = stopVerificationWatch;

    return () => {
      stopVerificationWatch();
      if (verificationWatchCleanupRef.current === stopVerificationWatch) {
        verificationWatchCleanupRef.current = null;
      }
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
    if (previewMode) {
      setError('Preview only. No forwarding settings or phone numbers were changed.');
      return;
    }
    if (slide === SLIDE.choice) {
      if (!connectionChoice) return;
      setError('');
      setSlide(SLIDE.number);
      return;
    }
    if (slide === SLIDE.number && (needsTargetNumberSelection || targetQualityState === 'passed')) {
      if (targetQualityState === 'passed') {
        setTargetQualityState('idle');
        setTargetQualityMessage('');
        setIsReplacingTargetNumber(false);
        if (connectionChoice === 'direct') setSlide(SLIDE.share);
        return;
      }
      await claimSelectedTargetNumber();
      return;
    }

    if (!hasTargetNumber) {
      setError('Choose a receptionist number before continuing.');
      return;
    }

    if (slide === SLIDE.number) {
      if (connectionChoice === 'direct') {
        setError('');
        setSlide(SLIDE.share);
        return;
      }
      if (!normalizedSourceNumber) {
        setError('Choose or enter the business number you want to forward.');
        return;
      }
      if (selectedExistingEntryIsVerified) {
        const saved = await saveForwarding({ status: 'verified' });
        if (saved) {
          if (verifyCallerIdEnabled && saved?.caller_id_verification_status !== 'verified') {
            setCallerIdReturnSlide(SLIDE.number);
            setSlide(SLIDE.callerId);
          } else {
            handleClose();
          }
        }
        return;
      }
      setError('');
      setSlide(SLIDE.share);
      return;
    }

    if (slide === SLIDE.share) {
      if (connectionChoice === 'direct') {
        handleClose();
        return;
      }
      setError('');
      setSlide(SLIDE.provider);
      return;
    }

    if (slide === SLIDE.provider) {
      if (!selectedProviderId) {
        setError('Choose who handles your business number to see the setup steps.');
        return;
      }
      const saved = await saveForwarding({ status: 'pending_test', confirmedEnabled: true });
      if (saved) setSlide(SLIDE.test);
      return;
    }

    if (slide === SLIDE.test) {
      if (forwardingStatus !== 'verified') {
        setError('Finish the quick test call first so we know forwarding is working.');
        return;
      }
      if (verifyCallerIdEnabled) {
        setCallerIdReturnSlide(SLIDE.test);
        setSlide(SLIDE.callerId);
        return;
      }
      handleClose();
      return;
    }

    handleClose();
  };

  const goBack = () => {
    if (previewMode) {
      setError('Preview only. No forwarding settings or phone numbers were changed.');
      return;
    }
    if (slide === SLIDE.number && targetQualityState === 'passed') {
      setTargetQualityState('idle');
      setTargetQualityMessage('');
      setIsReplacingTargetNumber(Boolean(targetLineReady));
      return;
    }
    if (slide === SLIDE.callerId) {
      setSlide(callerIdReturnSlide);
      return;
    }
    if (slide === SLIDE.number) {
      setConnectionChoice(null);
      setSlide(SLIDE.choice);
      return;
    }
    setSlide((current) => Math.max(current - 1, 0));
  };

  const changeProviderPage = (page) => {
    setProviderPage(page);
    setSelectedProviderId('');
    setError('');
  };

  const revealMoreTargetNumbers = (event) => {
    const element = event.currentTarget;
    const reachedEnd = element.scrollTop + element.clientHeight >= element.scrollHeight - 72;
    if (reachedEnd && targetNumbersVisibleCount < availableTargetNumbers.length) {
      setTargetNumbersVisibleCount((current) => Math.min(current + 25, availableTargetNumbers.length));
    }
  };

  const renderSlide = () => {
    if (slide === SLIDE.choice) {
      const choices = [
        { id: 'direct', title: targetLineReady ? 'Use your Nodemere number' : 'Get a new number', description: 'Give customers a Nodemere number to call your receptionist directly.' },
        { id: 'forward', title: 'Keep your business number', description: 'Get a receptionist number and forward calls from the number customers already know.' },
      ];
      return (
        <div className="grid gap-4 sm:grid-cols-2" role="group" aria-label="How to connect your phone number">
          {choices.map((choice, index) => {
            const active = connectionChoice === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                aria-label={`${choice.title}. ${choice.description}`}
                aria-pressed={active}
                onClick={() => { setConnectionChoice(choice.id); setError(''); setSlide(SLIDE.number); }}
                className="phone-choice-card flex min-h-[240px] flex-col rounded-[8px] border p-5 text-left sm:min-h-[360px] sm:p-7"
              >
                <span className="relative z-10 flex items-start gap-3 sm:gap-6">
                  <span aria-hidden="true" data-number={index + 1} className="phone-choice-card__number shrink-0 text-[48px] leading-none tracking-[-0.06em] sm:text-[72px]">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-col pt-1 sm:pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-60">
                      {choice.id === 'direct' ? 'Direct line' : 'Call forwarding'}
                    </span>
                    <span className="mt-2 text-base font-semibold leading-5 tracking-[-0.04em] sm:mt-3 sm:text-lg sm:leading-6">{choice.title}</span>
                  </span>
                </span>
                <span className="relative z-10 mt-4 max-w-[290px] text-[13px] leading-5 opacity-75 sm:mt-8 sm:text-sm sm:leading-6">{choice.description}</span>
                <span className="relative z-10 mt-auto pt-4 text-xs font-semibold opacity-75 sm:pt-8">
                  {active ? 'Selected' : 'Choose this option →'}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    if (slide === SLIDE.number) {
      if (needsTargetNumberSelection || targetQualityState !== 'idle') {
        if (targetQualityState === 'running' || targetQualityState === 'passed') {
          const passed = targetQualityState === 'passed';
          return (
            <div>
              <div className="relative py-8 text-center">
                <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/[0.16] bg-white/[0.07]">
                  <div className={`absolute inset-0 rounded-full border border-white/[0.12] ${passed ? '' : 'animate-ping'}`} />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full text-white">
                    {passed ? <CheckCircle2 size={21} strokeWidth={2.5} /> : <Phone size={21} strokeWidth={2.5} />}
                  </div>
                </div>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
                  {passed
                    ? targetQualityMessage || 'This receptionist number is connected. Place a test call before sharing it.'
                    : `We’re testing ${selectedTargetNumber?.phone_number || 'this number'} before switching your active receptionist number.`}
                </p>
              </div>

              <div className="border-t border-white/[0.08] py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-600">
                    {passed ? 'Ready' : targetQualitySteps[targetQualityStep]}
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
          <div className="max-h-[52vh] space-y-4 overflow-y-auto custom-scrollbar">
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
                  placeholder="123"
                  className="h-11 w-full rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-white/20 focus:bg-white/[0.055]"
                />
              </label>
            </div>

            <div className="space-y-2">
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
                            ? 'border-white/20 bg-white/[0.03] text-white'
                            : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/[0.14] hover:text-white'
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
        <div className="p-0">
          {targetLineReady && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
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
          {connectionChoice === 'forward' && <div className={`${targetLineReady ? 'mt-3 border-t border-white/[0.06] pt-3' : ''} min-w-0 space-y-2`}>
            {sourceOptions.map((option) => {
                const active = sourceNumber === option.source_number;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectSourceOption(option)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-white/20 bg-white/[0.03] text-white'
                        : 'border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/[0.14] hover:text-white'
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
          </div>}

        </div>
      );
    }

    if (slide === SLIDE.share) {
      return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.03] px-5 py-4">
            <div className="min-w-0">
              <p className="break-words text-3xl font-semibold tracking-[-0.04em] text-white">
                {forwardingNumber || 'Number pending'}
              </p>
            </div>
            <button
              type="button"
              onClick={copyForwardingNumber}
              disabled={!hasTargetNumber}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-zinc-300 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Copy number"
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={17} />}
            </button>
        </div>
      );
    }

    if (slide === SLIDE.provider) {
      const modeAvailable = !['comcast', 'zoom-phone', 'visible', 'nextiva', 'vonage-business', 'ooma-office', 'frontier', 'optimum-business'].includes(selectedProvider.id);
      return (
        <div>
          <div className="mb-4 flex justify-end" role="search">
            <div className="relative w-full sm:w-[260px]">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700" />
              <input
                type="text"
                aria-label="Search carriers"
                value={providerSearch}
                onChange={(event) => {
                  setProviderSearch(event.target.value);
                  setProviderPage(0);
                  setSelectedProviderId('');
                  setError('');
                }}
                placeholder="Search carriers..."
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] py-2 pl-9 pr-8 text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700 focus:!outline-none"
              />
              {providerSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setProviderSearch('');
                    setProviderPage(0);
                  }}
                  aria-label="Clear carrier search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-700 transition-colors hover:text-white"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>
          {matchingProviders.length === 0 ? (
            <div className="flex h-[350px] items-center justify-center rounded-[26px] border border-white/[0.12] bg-white/[0.035] px-6 text-center text-sm text-zinc-500 sm:h-[392px]">
              No carriers found. Try another name.
            </div>
          ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="group" aria-label="Choose phone provider">
            {visibleProviders.map((provider) => {
              const active = selectedProviderId === provider.id;
              return (
                <article
                  key={provider.id}
                  onClick={!active ? () => {
                    setSelectedProviderId(provider.id);
                    setError('');
                  } : undefined}
                  className={`flex h-[350px] min-w-0 flex-col rounded-[26px] border p-5 transition-colors sm:h-[392px] ${active
                    ? 'border-white bg-white text-black'
                    : 'cursor-pointer border-white/[0.12] bg-white/[0.035] text-white hover:border-white/30'}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProviderId(active ? '' : provider.id);
                      setError('');
                    }}
                    aria-expanded={active}
                    className="w-full text-left"
                  >
                    <span className={`inline-block text-[10px] font-semibold uppercase tracking-[0.14em] ${active
                      ? 'text-black/55'
                      : 'text-zinc-500'}`}>{provider.category}</span>
                    <span className="mt-5 flex items-center gap-2.5 text-2xl font-semibold tracking-[-0.05em] sm:text-[26px]">
                      <span style={provider.darkName ? { color: active ? provider.lightName : provider.darkName } : undefined}>{provider.label}</span>
                      {provider.logo && <img src={provider.logo} alt="" aria-hidden="true" className="h-6 w-6 shrink-0 object-contain" />}
                    </span>
                  </button>

                  {active ? (
                    <div className="mt-5 flex min-h-0 flex-1 flex-col">
                      {modeAvailable && (
                        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Forwarding behavior">
                          {[
                            { id: 'all', label: 'All calls' },
                            { id: 'missed', label: 'Missed' },
                          ].map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setForwardingMode(mode.id)}
                              aria-pressed={forwardingMode === mode.id}
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${forwardingMode === mode.id
                                ? 'bg-black text-white'
                                : 'bg-black/[0.06] text-black/60'}`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {providerGuide.steps.length > 0 && (
                        <ol className="space-y-2">
                          {providerGuide.steps.map((step, index) => (
                            <li key={step} className="flex gap-2 text-[13px] leading-5 text-black/80">
                              <span className="shrink-0 font-bold text-black/40">{index + 1}.</span>
                              <span className="min-w-0 break-words">{step}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                      <p className="mt-3 text-xs leading-5 text-black/55">{providerGuide.note}</p>
                      {providerSupportUrl && (
                        <a
                          href={providerSupportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-auto pt-3 text-xs font-semibold text-black/75 underline decoration-black/40 underline-offset-4 hover:text-black"
                        >
                          Official {provider.label} guide
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-1 flex-col justify-between">
                      <p className="text-sm leading-5 text-zinc-500">{provider.summary}</p>
                      <span className="text-xs font-semibold text-zinc-300">View setup →</span>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          )}
          {providerPageCount > 1 && <div className="mt-4 flex items-center justify-center gap-2" role="group" aria-label="Carrier pages">
            {compactGuide ? (
              <>
                <button type="button" onClick={() => changeProviderPage(providerPage - 1)} disabled={providerPage === 0} className="px-2 py-1 text-xs text-zinc-300 disabled:opacity-30">Previous</button>
                <span className="text-xs text-zinc-500">{providerPage + 1} of {providerPageCount}</span>
                <button type="button" onClick={() => changeProviderPage(providerPage + 1)} disabled={providerPage === providerPageCount - 1} className="px-2 py-1 text-xs text-zinc-300 disabled:opacity-30">Next</button>
              </>
            ) : Array.from({ length: providerPageCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => changeProviderPage(index)}
                aria-label={`Show carrier page ${index + 1} of ${providerPageCount}`}
                aria-current={providerPage === index ? 'page' : undefined}
                className={`h-7 w-7 rounded-full text-xs font-semibold transition ${providerPage === index
                  ? 'bg-white text-black'
                  : 'text-zinc-500 hover:bg-white/[0.08] hover:text-white'}`}
              >
                {index + 1}
              </button>
            ))}
          </div>}
        </div>
      );
    }

    if (slide === SLIDE.test) {
      const isVerified = forwardingStatus === 'verified';
      return (
      <div>
        <div className="relative flex min-h-[220px] flex-col items-center justify-center py-6 text-center">
          <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center" aria-label={isVerified ? 'Forwarding verified' : 'Listening for a test call'}>
            {isVerified ? (
              <CheckCircle2 size={38} strokeWidth={1.8} className="text-white" />
            ) : (
              <div className="flex h-12 items-center gap-1.5" aria-hidden="true">
                {[18, 32, 44, 28, 38, 22].map((height, index) => (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-zinc-400/80 animate-pulse"
                    style={{ height, animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-zinc-500">
            {isVerified
              ? `${sourceNumber || 'Your business number'} is now saved and marked as working with your dedicated business line.`
              : `Call ${sourceNumber || 'your business line'} from another phone. If you set up missed-call forwarding, let the business line ring unanswered. We’ll verify when the call reaches your receptionist.`}
          </p>
        </div>

        <div className="border-t border-white/[0.08] py-4">
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
      <div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-orange-300/15 bg-orange-300/[0.05] p-4 text-sm leading-6 text-orange-100/85">
            <p className="font-semibold text-orange-100">Outbound AI calling is limited to documented, consented operational or customer-service calls.</p>
            <p className="mt-1">Nodemere records and transcribes calls by default. Do not use this feature for telemarketing, political outreach, debt collection, or restricted industries. Every call must identify the business, disclose the AI assistant, and give any notice or opt-out required by law.</p>
            <a href="/communications-notice" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-white underline underline-offset-2">Read the communications notice</a>
          </div>

          {callerIdPending ? (
            <div className="space-y-4 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-2 text-pink-200">
                <Phone size={15} />
                <span className="text-sm font-semibold">Verification call in progress</span>
              </div>
              <p className="text-sm leading-6 text-pink-100/90">
                Answer the call to {sourceNumber || 'your business line'} and enter this code on the keypad.
              </p>
              <div className="border-t border-white/[0.08] px-4 py-4 text-center text-3xl font-semibold tracking-[0.35em] text-white">
                {callerIdValidationCode || '------'}
              </div>
            </div>
          ) : callerIdVerified ? (
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 size={15} />
                <span className="text-sm font-semibold">Outbound caller ID ready</span>
              </div>
              <p className="text-sm leading-6 text-emerald-100/90">
                Calls can now go out using {sourceNumber || 'your business number'}.
              </p>
            </div>
          ) : (
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <p className="text-sm leading-6 text-zinc-500">
                This is optional, but it helps outbound calls feel more like they’re coming from your business.
              </p>
              <button
                type="button"
                onClick={startCallerIdVerification}
                disabled={callerIdStarting}
                className="h-11 w-full rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
              {callerIdStarting ? 'Starting verification…' : 'Verify this number'}
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
                {callerIdStarting ? 'Starting verification…' : 'Try again'}
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
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 18 }}
        onClick={(e) => e.stopPropagation()}
        className={`relative max-h-[calc(100vh-24px)] w-full overflow-hidden rounded-[34px] border border-white/[0.08] bg-[#070707]/95 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl ${slide === SLIDE.provider ? 'max-w-[920px]' : slide === SLIDE.choice ? 'max-w-[800px]' : 'max-w-[700px]'}`}
      >
        <div className="pointer-events-none absolute right-[-64px] top-[-80px] h-56 w-56 rounded-full bg-white/[0.035] blur-[70px]" />

        <div className="relative max-h-[calc(100vh-24px)] overflow-y-auto p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-5">
            <div className="min-w-0 flex-1">
              <div className="flex h-4 w-full items-center gap-3 pr-8">
                <p className="shrink-0 text-[13px] font-normal leading-4 text-zinc-300">{forwardingSteps[0].label} · {slide + 1} of {totalSlides}</p>
                <div className="h-1 min-w-0 max-w-[144px] flex-1 translate-y-0 overflow-hidden rounded-full bg-white/[0.06]">
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
              onClick={handleClose}
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

          {slide !== SLIDE.choice && <div className="mt-5 space-y-3">
            {!(slide === SLIDE.number && targetQualityState === 'running') && (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  loading
                  || saving
                  || callerIdStarting
                  || targetQualityState === 'running'
                  || (slide > SLIDE.number && !hasTargetNumber)
                  || (slide === SLIDE.number && !needsTargetNumberSelection && !hasTargetNumber)
                  || (slide === SLIDE.number && needsTargetNumberSelection && targetQualityState !== 'passed' && (!selectedTargetNumber || !canPurchaseNumber))
                  || (slide === SLIDE.provider && !selectedProviderId)
                  || (slide === SLIDE.test && forwardingStatus !== 'verified')
                }
                className="mx-auto block h-12 w-full max-w-[440px] rounded-full bg-white text-sm font-bold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving
                  ? 'Saving…'
                  : slide === SLIDE.number && (needsTargetNumberSelection || targetQualityState === 'passed')
                    ? targetQualityState === 'passed'
                      ? 'Continue'
                      : 'Use this number'
                    : slide === SLIDE.number && connectionChoice === 'forward' && selectedExistingEntryIsVerified
                      ? 'Use this number'
                    : slide === SLIDE.share && connectionChoice === 'direct'
                      ? 'Finish setup'
                    : slide === SLIDE.share
                      ? 'Continue to instructions'
                      : slide === SLIDE.provider
                        ? 'I turned forwarding on'
                      : slide === SLIDE.test && verifyCallerIdEnabled
                        ? 'Continue'
                      : slide === SLIDE.test || slide === SLIDE.callerId
                        ? 'Finish setup'
                      : 'Continue'}
              </button>
            )}
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="h-11 w-full rounded-full text-sm font-normal text-zinc-500 transition hover:text-white disabled:opacity-40"
            >
              Back
            </button>
            {error && <p className="text-center text-sm text-red-400">{error}</p>}
          </div>}

        </div>
      </motion.div>
    </motion.div>
  );
};

export default ForwardNumberModal;
