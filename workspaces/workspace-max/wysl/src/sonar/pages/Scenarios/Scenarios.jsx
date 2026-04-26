import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Phone,
  Bell,
  Zap,
  Plus,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  MessageSquare,
  Calendar,
  Layers,
  DollarSign,
  Share2,
  Mail,
  Tag,
  Clock,
  Trash2,
  RefreshCw,
  Repeat,
  Target,
  Check,
  Eye,
  EyeOff,
  Pencil,
  GitBranch,
  Sparkles,
  Filter,
  Database,
  Hash,
} from 'lucide-react';
import './Scenarios.css';
import AetherEdgeLogic from './AetherEdgeLogic';
import VariablesPane, { getVariableRef, parseVariables, renderVarChipsHTML, TABLE_COLORS, TABLE_LABELS } from './VariablesPane';
import { supabase } from '../../lib/supabase';
import { LEAD_FIELDS } from '../../lib/leadSchema';
import { getContextType, buildVariableMap, getOutputVariables } from '../../lib/fieldContexts';
import { getSmartActions, getSmartActionByKey } from './smartActions';

const OPTION_ICONS = {
  phone_calls: Phone,
  text_messages: MessageSquare,
  appointments: Calendar,
  records: Layers,
  payments: DollarSign,
  text_messaging: MessageSquare,
  call_routing: Share2,
  email: Mail,
  tags: Tag,
  wait: Clock,
  router: Share2,
  intent_router: RefreshCw,
  end_call: X,
  time_schedule: Clock,
};

// Table field definitions for Update Record
const RECORD_TABLE_FIELDS = {
  People: [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'notes', label: 'Notes' },
  ],
  Appointments: [
    { key: 'client_name', label: 'Client Name' },
    { key: 'date', label: 'Date' },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status' },
    { key: 'duration', label: 'Duration' },
    { key: 'notes', label: 'Notes' },
  ],
};

const AUTOMATION_HIERARCHY = {
  TRIGGERS: [
    {
      key: 'no_trigger',
      option: 'No Trigger',
      description: 'Use a schedule instead of an event',
      accent: '#32f0d9',
      icon: Clock,
      sub_options: [],
    },
    {
      key: 'phone_calls',
      option: 'Phone Calls',
      description: 'When something happens with a call',
      accent: '#32f0d9',
      icon: OPTION_ICONS.phone_calls,
      sub_options: [
        { key: 'incoming_call', name: 'Incoming Call', description: 'When a new call arrives' },
        { key: 'call_answered', name: 'Call Answered', description: 'When someone answers a call' },
        { key: 'missed_call', name: 'Missed Call', description: 'When a call goes unanswered' },
        { key: 'call_failed', name: 'Call Failed', description: 'When a call cannot connect' },
        { key: 'voicemail_received', name: 'Voicemail Received', description: 'When a caller leaves a voicemail' },
      ],
    },
    {
      key: 'text_messages',
      option: 'Text Messages',
      description: 'When something happens with SMS',
      accent: '#32f0d9',
      icon: OPTION_ICONS.text_messages,
      sub_options: [
        { key: 'sms_received', name: 'SMS Received', description: 'When a message is received' },
        { key: 'sms_sent', name: 'SMS Sent', description: 'When a message is sent' },
        { key: 'sms_failed', name: 'SMS Failed', description: 'When message delivery fails' },
        { key: 'customer_replied', name: 'Customer Replied', description: 'When a customer responds' },
      ],
    },
    {
      key: 'appointments',
      option: 'Appointments',
      description: 'When something happens with an appointment',
      accent: '#32f0d9',
      icon: OPTION_ICONS.appointments,
      sub_options: [
        { key: 'appointment_created', name: 'Appointment Created', description: 'Create a new appointment' },
        { key: 'appointment_updated', name: 'Appointment Updated', description: 'When appointment details change' },
        { key: 'appointment_cancelled', name: 'Appointment Cancelled', description: 'When an appointment is cancelled' },
        { key: 'appointment_rescheduled', name: 'Appointment Rescheduled', description: 'When an appointment time changes' },
        { key: 'appointment_confirmed', name: 'Appointment Confirmed', description: 'When an appointment gets confirmed' },
        { key: 'appointment_soon', name: 'Appointment Soon', description: 'When appointment time is near' },
        { key: 'appointment_completed', name: 'Appointment Completed', description: 'When an appointment completes' },
        { key: 'appointment_missed', name: 'Appointment Missed', description: "When a customer doesn't show" },
      ],
    },
    {
      key: 'records',
      option: 'Records',
      description: 'When something happens to a record',
      accent: '#32f0d9',
      icon: OPTION_ICONS.records,
      sub_options: [
        { key: 'record_created', name: 'Record Created', description: 'When a new customer record is created' },
        { key: 'record_updated', name: 'Record Updated', description: 'When a customer record is updated' },
        { key: 'record_deleted', name: 'Record Deleted', description: 'When a customer record is deleted' },
      ],
    },
    {
      key: 'payments',
      option: 'Payments',
      description: 'When something happens with a payment',
      accent: '#32f0d9',
      icon: OPTION_ICONS.payments,
      sub_options: [
        { key: 'invoice_created', name: 'Invoice Created', description: 'When a new invoice is created' },
        { key: 'invoice_paid', name: 'Invoice Paid', description: 'When an invoice is paid' },
        { key: 'payment_failed', name: 'Payment Failed', description: 'When a payment cannot process' },
        { key: 'invoice_sent', name: 'Invoice Sent', description: 'When an invoice is sent to customer' },
      ],
    },
    {
      key: 'time_schedule',
      option: 'Time & Schedule',
      description: 'When a scheduled time is reached',
      accent: '#32f0d9',
      icon: OPTION_ICONS.time_schedule,
      sub_options: [
        { key: 'specific_time', name: 'Specific Time', description: 'Run once at a specific date and time' },
        { key: 'recurring_daily', name: 'Recurring Daily', description: 'Run every day at a set time' },
        { key: 'recurring_weekly', name: 'Recurring Weekly', description: 'Run weekly on selected days' },
        { key: 'appointment_reminder', name: 'Appointment Reminder', description: 'Run before an upcoming appointment' },
      ],
    },
  ],
  ACTIONS: [
    {
      key: 'phone_calls',
      option: 'Phone Calls',
      description: 'Call or manage phone calls',
      accent: '#38bdf8',
      icon: OPTION_ICONS.phone_calls,
      sub_options: [
        { key: 'call_customer', name: 'Call Customer', description: 'Call an existing customer', configFields: [
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', placeholder: 'e.g. Be professional and offer available reschedule times...', smartActions: true },
          { key: 'first_message', label: 'First Message', type: 'first_message_textarea', placeholder: 'e.g. Hi, this is [business name] calling...', smartActions: true, toggleLabel: 'Override First Message' },
          { key: 'transfer_to', label: 'Transfer To (optional)', type: 'text', placeholder: 'Phone number to transfer after greeting' },
        ]},
        { key: 'call_phone_number', name: 'Call Phone Number', description: 'Call a specific number', configFields: [
          { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: 'e.g. +15551234567' },
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', placeholder: 'e.g. Be professional and helpful...', smartActions: true },
          { key: 'first_message', label: 'First Message', type: 'first_message_textarea', placeholder: 'e.g. Hi, this is [business name] calling...', smartActions: true, toggleLabel: 'Override First Message' },
        ]},
      ],
    },
    {
      key: 'text_messaging',
      option: 'Text Messaging',
      description: 'Send or manage SMS messages',
      accent: '#38bdf8',
      icon: OPTION_ICONS.text_messaging,
      sub_options: [
        { key: 'send_to_phone_number', name: 'Send To Phone Number', description: 'Send SMS to any number', configFields: [
          { key: 'recipient', label: 'Recipient Number', type: 'text', placeholder: 'e.g. +15551234567' },
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', placeholder: 'e.g. Be friendly and concise...', smartActions: true },
        ]},
        { key: 'send_to_customer', name: 'Send To Customer', description: 'Send SMS to an existing customer', configFields: [
          { key: 'main_content', label: 'Prompt', type: 'prompt_textarea', placeholder: 'e.g. Be friendly and helpful...', smartActions: true },
        ]},
      ],
    },
    {
      key: 'call_routing',
      option: 'Call Routing',
      description: 'Control where calls go',
      accent: '#38bdf8',
      icon: OPTION_ICONS.call_routing,
      sub_options: [
        { key: 'transfer_to_phone_number', name: 'Transfer To Phone Number', description: 'Forward call to a specific number', configFields: [
          { key: 'phone_number', label: 'Phone Number', type: 'text', placeholder: 'e.g. +15551234567' },
          { key: 'announce', label: 'Announce Before Transfer', type: 'textarea', placeholder: 'Optional message before transfer' },
        ]},
        { key: 'transfer_to_department', name: 'Transfer To Department', description: 'Route call to a department', configFields: [
          { key: 'department', label: 'Department', type: 'select', options: ['Front Desk', 'Billing', 'Support', 'Sales', 'Urgent'] },
        ]},
        { key: 'transfer_to_staff_member', name: 'Transfer To Staff Member', description: 'Send call to a staff member', configFields: [
          { key: 'staff_member', label: 'Staff Member', type: 'text', placeholder: 'Name or extension' },
        ]},
        { key: 'hang_up', name: 'Hang Up', description: 'End the current call' },
      ],
    },
    {
      key: 'records',
      option: 'Records',
      description: 'Manage customer records in the database',
      accent: '#38bdf8',
      icon: OPTION_ICONS.records,
      sub_options: [
        { key: 'search_records', name: 'Search Records', description: 'Find customer records', configFields: [
          { key: 'search_field', label: 'Search By', type: 'select', options: ['Phone', 'Email', 'Name', 'Record ID'] },
          { key: 'search_value', label: 'Search Value', type: 'text', placeholder: 'e.g. {caller_number}' },
        ]},
        { key: 'create_new_record', name: 'Create New Record', description: 'Create a new customer record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments'] },
        ]},
        { key: 'update_record', name: 'Update Record', description: 'Modify an existing customer record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments'] },
        ]},
        { key: 'delete_record', name: 'Delete Record', description: 'Permanently delete a customer record', configFields: [
          { key: 'target_table', label: 'Table', type: 'select', options: ['People', 'Appointments'] },
        ]},
      ],
    },
    {
      key: 'appointments',
      option: 'Appointments',
      description: 'Create or manage appointments',
      accent: '#38bdf8',
      icon: OPTION_ICONS.appointments,
      sub_options: [
        { key: 'create_appointment', name: 'Create Appointment', description: 'Schedule a new appointment', configFields: [] },
        { key: 'search_appointments', name: 'Search Appointments', description: 'Find existing appointments', configFields: [] },
        { key: 'update_appointment', name: 'Update Appointment', description: 'Change details of an appointment', configFields: [
          { key: 'lookup_field', label: 'Find Appointment By', type: 'select', options: ['Customer Name', 'Date', 'Appointment ID'] },
          { key: 'lookup_value', label: 'Lookup Value', type: 'text', placeholder: 'e.g. {customer_name}' },
          { key: 'field_to_update', label: 'Field to Update', type: 'select', options: ['date', 'time', 'status', 'notes', 'duration'] },
          { key: 'new_value', label: 'New Value', type: 'text', placeholder: 'New value' },
        ]},
        { key: 'delete_appointment', name: 'Delete Appointment', description: 'Cancel and remove an appointment', configFields: [
          { key: 'appointment_id', label: 'Appointment ID', type: 'text', placeholder: 'Appointment ID to cancel' },
        ]},
      ],
    },
    {
      key: 'email',
      option: 'Email',
      description: 'Manage email',
      accent: '#38bdf8',
      icon: OPTION_ICONS.email,
      sub_options: [{ key: 'send_email', name: 'Send Email', description: 'Send an email', configFields: [
        { key: 'to', label: 'To', type: 'text', placeholder: 'e.g. {customer_email}' },
        { key: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g. Appointment Confirmation' },
        { key: 'body', label: 'Body', type: 'textarea', placeholder: 'Email body with {variables}' },
      ]}],
    },
    {
      key: 'tags',
      option: 'Tags',
      description: 'Manage record tags',
      accent: '#38bdf8',
      icon: OPTION_ICONS.tags,
      sub_options: [
        { key: 'add_tag', name: 'Add Tag', description: 'Attach tag to record', configFields: [
          { key: 'tag_name', label: 'Tag Name', type: 'text', placeholder: 'e.g. VIP, Urgent, Callback' },
        ]},
        { key: 'search_tags', name: 'Search Tags', description: 'Find existing tags', configFields: [
          { key: 'search_value', label: 'Search', type: 'text', placeholder: 'Tag to search for' },
        ]},
        { key: 'update_tag', name: 'Update Tag', description: 'Update an existing tag', configFields: [
          { key: 'old_tag', label: 'Current Tag Name', type: 'text', placeholder: 'Tag to rename' },
          { key: 'new_tag', label: 'New Tag Name', type: 'text', placeholder: 'New name' },
        ]},
        { key: 'delete_tag', name: 'Delete Tag', description: 'Remove a tag permanently', configFields: [
          { key: 'tag_name', label: 'Tag Name', type: 'text', placeholder: 'Tag to remove' },
        ]},
      ],
    },
  ],
  UTILITIES: [
    { key: 'wait', option: 'Wait', description: 'Pause the workflow temporarily', icon: OPTION_ICONS.wait, accent: '#f472b6' },
    { key: 'router', option: 'Router', description: 'Send flow to different paths', icon: OPTION_ICONS.router, accent: '#f472b6' },
    { key: 'intent_router', option: 'Intent Router', description: 'Re-evaluate the conversation and choose the correct path', icon: OPTION_ICONS.intent_router, accent: '#f472b6' },
    { key: 'end_call', option: 'End Call', description: 'Immediately end the current call', icon: OPTION_ICONS.end_call, accent: '#f472b6' },
  ],
};

const PANEL_CATEGORY_LABELS = {
  TRIGGERS: 'Triggers',
  ACTIONS: 'Actions',
  UTILITIES: 'Utilities',
};

const CATEGORY_META = {
  TRIGGERS: { detail: 'Trigger', type: 'trigger', icon: Bell, accent: '#32f0d9' },
  ACTIONS: { detail: 'Action', type: 'action', icon: Phone, accent: '#38bdf8' },
  UTILITIES: { detail: 'Utility', type: 'utility', icon: Zap, accent: '#f472b6' },
};

const PANEL_CATEGORIES = ['TRIGGERS', 'ACTIONS', 'UTILITIES'];

const INITIAL_NODE = { id: 'node-1', x: 200, y: 300, configured: false, label: 'Start Flow' };

const sbLabelStyle = { fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 4, display: 'block' };
const sbInputStyle = { width: '100%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#e4e4e7', outline: 'none', boxSizing: 'border-box' };

export default function ScenariosPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'builder'
  const [scenarios, setScenarios] = useState([]); // List of saved scenarios
  const [nodes, setNodes] = useState([INITIAL_NODE]);
  const [edges, setEdges] = useState([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [viewportReady, setViewportReady] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState('node-1');
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0 });
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');
  const [panelStage, setPanelStage] = useState('options');
  const [activeOption, setActiveOption] = useState(null);
  const [panelCategory, setPanelCategory] = useState('TRIGGERS');
  const [panelIntent, setPanelIntent] = useState(false);
  const [initialPulse, setInitialPulse] = useState(true);
  const [initialFocusSet, setInitialFocusSet] = useState(false);
  const [initialNodeShifted, setInitialNodeShifted] = useState(false);
  const [logicPanel, setLogicPanel] = useState(null);
  const [logicContextType, setLogicContextType] = useState('default');
  const [logicAvailableVars, setLogicAvailableVars] = useState([]);
  const [logicFallbackAction, setLogicFallbackAction] = useState('');
  const [logicIsFallback, setLogicIsFallback] = useState(false);
  const [appointmentConfig, setAppointmentConfig] = useState({});
  const [scheduleConfig, setScheduleConfig] = useState({});
  const [varsPane, setVarsPane] = useState({ visible: false, fieldKey: '', fieldLabel: '', fieldType: 'text' });
  const [hoveredTableColor, setHoveredTableColor] = useState('');
  const [actionConfig, setActionConfig] = useState(null);
  const [edgeRules, setEdgeRules] = useState([
    { id: 1, variable: 'status', operator: 'equals', value: '', logic: 'and' },
  ]);
  const edgeRulesRef = useRef(edgeRules);
  const restoringFromNodeRef = useRef(false);

  // Trigger quantum orbit rings on an unconfigured node
  const triggerQuantumOrbit = useCallback((nodeId) => {
    const rings = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      size: 140 + i * 18,
      delay: i * 0.05,
    }));
    setQuantumOrbits(prev => ({ ...prev, [nodeId]: rings }));
    setTimeout(() => {
      setQuantumOrbits(prev => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
    }, 1500);
  }, []);
  
  // Save scenario modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  
  // Track currently loaded scenario
  const [currentScenario, setCurrentScenario] = useState(null);
  
  // Bottom toolbar state
  const [noTriggerActive, setNoTriggerActive] = useState(false);
  const [scenarioIsActive, setScenarioIsActive] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [recurringSchedule, setRecurringSchedule] = useState({ frequency: 'once', interval: 1, time: '09:00' });
  const [scenarioNotes, setScenarioNotes] = useState('');
  
  // Fade-in animation state
  const [nodesOpacity, setNodesOpacity] = useState(1);
  const [quantumOrbits, setQuantumOrbits] = useState({}); // { [nodeId]: [ring configs] }

  // Fetch scenarios from Supabase on mount
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const { data, error } = await supabase
          .from('scenarios')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (error) {
          // Handle case where table doesn't exist yet
          if (error.code === 'PGRST205') {
            console.log('[Scenarios] Table not found. Run SQL in Supabase to create scenarios table.');
            setScenarios([]);
          } else {
            console.error('[Scenarios] Error fetching scenarios:', error);
          }
          return;
        }
        
        if (data) {
          setScenarios(data);
          console.log('[Scenarios] Loaded', data.length, 'scenarios');
        }
      } catch (err) {
        console.error('[Scenarios] Exception fetching scenarios:', err);
      }
    };
    
    fetchScenarios();
  }, []);

  const builderRef = useRef(null);
  const canvasRef = useRef(null);
  const nodeRefs = useRef({});
  const introCircleRef = useRef(null);
  const circleRefs = useRef({}); // per-node circle element refs

  const dragRef = useRef({ id: null, moved: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0, scale: 1 });
  const panRef = useRef(null);
  const nodeIdCounter = useRef(1);
  const edgeIdCounter = useRef(1);
  
  // Keep ref in sync with state
  useEffect(() => {
    edgeRulesRef.current = edgeRules;
  }, [edgeRules]);

  // Auto-save config to node on every field change
  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !actionConfig) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, actionConfig: { ...actionConfig } } : n));
  }, [actionConfig]);

  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !appointmentConfig?.key) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, appointmentConfig: { ...appointmentConfig } } : n));
  }, [appointmentConfig]);

  useEffect(() => {
    if (restoringFromNodeRef.current) { restoringFromNodeRef.current = false; return; }
    if (!selectedNodeId || !scheduleConfig?.key) return;
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, scheduleConfig: { ...scheduleConfig } } : n));
  }, [scheduleConfig]);

  const nodeMap = useMemo(() => nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {}), [nodes]);
  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;

  const isPrimaryNode = selectedNodeId === INITIAL_NODE.id;

  useEffect(() => {
    if (!selectedNodeId) return;
    const defaultCategory = isPrimaryNode ? selectedNode?.categoryType || 'TRIGGERS' : 'ACTIONS';
    const node = nodeMap[selectedNodeId];
    const hasSavedConfig = node?.actionConfig?._fields?.length || node?.appointmentConfig?.key || node?.scheduleConfig?.key;
    // If node has saved config, let openSelectionPanel restore it — preserve config stages
    if (hasSavedConfig) {
      setPanelStage(prev => {
        if (['actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(prev)) return prev;
        return 'options';
      });
    } else {
      // New/unconfigured node — clear stale config from previous node
      setActionConfig(null);
      setAppointmentConfig({});
      setScheduleConfig({});
      setPanelStage('options');
    }
    setActiveOption(null);
    setPanelSearch('');
    setPanelCategory(defaultCategory);
  }, [selectedNodeId, selectedNode?.categoryType, isPrimaryNode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInitialPulse(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useLayoutEffect(() => {
    if (initialFocusSet) return;
    setView({ x: 0, y: 0, scale: 1 });
    setInitialFocusSet(true);
    setViewportReady(true);
  }, [initialFocusSet]);

  // Fire orbit rings once as intro — rings FIRST, then circle fades in
  useEffect(() => {
    if (nodes.length === 1 && !nodes[0].configured) {
      const timer = setTimeout(() => triggerQuantumOrbit(nodes[0].id), 200);
      return () => clearTimeout(timer);
    }
  }, [nodes.length]);

  const formatScheduleDisplay = (config) => {
    const { frequency, interval, time, daysOfWeek } = config;
    const timeStr = time ? ` at ${time}` : '';
    switch (frequency) {
      case 'once': return 'Run once';
      case 'hourly': return `Every ${interval}h`;
      case 'daily': return `Every ${interval}d${timeStr}`;
      case 'weekly': {
        const days = daysOfWeek?.length ? ` (${daysOfWeek.join(', ')})` : '';
        return `Every ${interval}w${days}${timeStr}`;
      }
      case 'monthly': return `Every ${interval}mo${timeStr}`;
      case 'yearly': return `Every ${interval}yr${timeStr}`;
      default: return 'Run once';
    }
  };

  const handleToggleRecurring = async () => {
    const newActive = !scenarioIsActive;
    setScenarioIsActive(newActive);
    // Persist to Supabase if editing existing scenario
    if (currentScenario?.id) {
      await supabase.from('scenarios').update({ is_active: newActive }).eq('id', currentScenario.id);
    }
  };

  const optionsForCategory = AUTOMATION_HIERARCHY[panelCategory] || [];
  const normalizedPanelSearch = panelSearch.trim().toLowerCase();
  const filteredOptions = useMemo(
    () =>
      optionsForCategory.filter((option) => {
        const optionLabel = option.option.toLowerCase();
        return !normalizedPanelSearch || optionLabel.includes(normalizedPanelSearch);
      }),
    [normalizedPanelSearch, optionsForCategory]
  );
  const filteredSubOptions = useMemo(
    () =>
      (activeOption?.sub_options ?? []).filter((sub) => {
        const subLabel = sub.name.toLowerCase();
        return !normalizedPanelSearch || subLabel.includes(normalizedPanelSearch);
      }),
    [activeOption, normalizedPanelSearch]
  );
  const categoryMeta = CATEGORY_META[panelCategory] || CATEGORY_META.TRIGGERS;
  const hasConfiguredTrigger = nodes.some(n => n.categoryType === 'TRIGGERS' && n.configured);
  const visibleCategories = !hasConfiguredTrigger
    ? ['TRIGGERS']
    : isPrimaryNode
      ? PANEL_CATEGORIES
      : PANEL_CATEGORIES.filter((category) => category !== 'TRIGGERS');
  const BannerIcon = activeOption?.icon || categoryMeta.icon;
  const bannerCategoryLabel = (PANEL_CATEGORY_LABELS[panelCategory] || panelCategory).toUpperCase();
  const showNodeConfigText = !['subOptions', 'actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(panelStage);

  // Handle variable insertion — inserts {{table.field}} syntax for rendering
  const handleInsertVariable = (varRef, fieldLabel, color) => {
    if (!varsPane.fieldKey) return;
    setActionConfig(prev => {
      const current = prev[varsPane.fieldKey] || '';
      const newVal = current ? `${current} ${varRef}` : varRef;
      return { ...prev, [varsPane.fieldKey]: newVal };
    });
  };

  // Find the trigger key from parent node for smart actions
  const findParentTriggerKey = useCallback((nodeId) => {
    const parentEdge = edges.find(e => e.to === nodeId);
    if (!parentEdge) return null;
    const parentNode = nodeMap[parentEdge.from];
    if (!parentNode || parentNode.categoryType !== 'TRIGGERS') return null;
    const allTriggers = AUTOMATION_HIERARCHY.TRIGGERS.flatMap(t => t.sub_options || []);
    const trigger = allTriggers.find(t => t.name === parentNode.label);
    return trigger?.key || null;
  }, [edges, nodeMap]);

  // Get the action key from the current action config
  const currentActionKey = actionConfig?._key || null;

  // Handle smart action insertion — inserts delimited token into raw value,
  // overlay renders the display text as a styled chip
  const handleInsertSmartAction = (smartAction, fieldKey) => {
    const token = `{smart:${smartAction.key}}`;
    setActionConfig(prev => {
      const current = prev[fieldKey] || '';
      const newVal = current ? `${current} \x1E${smartAction.instruction}\x1E` : `\x1E${smartAction.instruction}\x1E`;
      return { ...prev, [fieldKey]: newVal };
    });
  };


  // Convert smart action display text back to tokens before saving
  // Uses sequential parsing to handle adjacent delimited strings correctly
  const syncFieldTokens = (fieldKey) => {
    setActionConfig(prev => {
      const val = prev[fieldKey];
      if (!val || typeof val !== 'string') return prev;
      const triggerKey = findParentTriggerKey(selectedNodeId);
      const actions = getSmartActions(triggerKey, currentActionKey);
      const lookup = {};
      actions.forEach(a => { lookup[a.instruction] = a.key; });

      let result = '';
      let i = 0;
      while (i < val.length) {
        if (val.charCodeAt(i) === 0x1E) {
          const end = val.indexOf('\x1E', i + 1);
          if (end !== -1) {
            const displayText = val.substring(i + 1, end);
            result += lookup[displayText] ? `{smart:${lookup[displayText]}}` : displayText;
            i = end + 1;
          } else { result += val[i]; i++; }
        } else { result += val[i]; i++; }
      }
      return { ...prev, [fieldKey]: result };
    });
  };

  // Simple HTML escape for chip display text
  const escapeHTML = (str) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  // Render chips for prompt_textarea fields — sequential parsing for correct handling
  const renderFieldChipsHTML = (value) => {
    if (!value || typeof value !== 'string') return '';
    const triggerKey = findParentTriggerKey(selectedNodeId);
    const actions = getSmartActions(triggerKey, currentActionKey);
    const tokenLookup = {};
    actions.forEach(a => { tokenLookup[`{smart:${a.key}}`] = a.instruction; });

    let result = '';
    let i = 0;
    while (i < value.length) {
      if (value.charCodeAt(i) === 0x1E) {
        const end = value.indexOf('\x1E', i + 1);
        if (end !== -1) {
          result += escapeHTML(value.substring(i + 1, end));
          i = end + 1;
        } else { result += escapeHTML(value[i]); i++; }
      } else if (value.substring(i, i + 7) === '{smart:') {
        const end = value.indexOf('}', i);
        if (end !== -1) {
          const token = value.substring(i, end + 1);
          const instruction = tokenLookup[token];
          result += instruction
            ? escapeHTML(instruction)
            : escapeHTML(token);
          i = end + 1;
        } else { result += escapeHTML(value[i]); i++; }
      } else if (value.substring(i, i + 2) === '{{') {
        const end = value.indexOf('}}', i);
        if (end !== -1) {
          const ref = value.substring(i + 2, end);
          const parts = ref.split('.');
          if (parts.length === 2) {
            const color = TABLE_COLORS[parts[0]] || '#a78bfa';
            const tableLabel = TABLE_LABELS[parts[0]] || parts[0];
            result += `<span class="sb-var-chip" style="background:${color}18;color:${color};border:1px solid ${color}25;display:inline;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;line-height:1.6;vertical-align:baseline;">${tableLabel}.${parts[1]}</span>`;
          } else { result += escapeHTML(value.substring(i, end + 2)); }
          i = end + 2;
        } else { result += escapeHTML(value[i]); i++; }
      } else {
        // Handle newlines as <br> for the overlay
        if (value[i] === '\n') { result += '<br>'; }
        else { result += escapeHTML(value[i]); }
        i++;
      }
    }
    return result;
  };

  const repositionPanel = useCallback(() => {
    if (!selectedNodeId) {
      setIsPanelVisible(false);
      setPanelIntent(false);
      return;
    }
    const nodeEl = nodeRefs.current[selectedNodeId];
    const pageRect = builderRef.current?.getBoundingClientRect();
    if (!nodeEl || !pageRect) {
      setIsPanelVisible(false);
      setPanelIntent(false);
      return;
    }
    const rect = nodeEl.getBoundingClientRect();
    const panelWidth = 400;
    const panelHeight = 640;
    
    let left = rect.right - pageRect.left + 40;
    if (left + panelWidth > pageRect.width) {
      left = rect.left - pageRect.left - panelWidth - 40;
    }
    
    const top = Math.max(
      20,
      Math.min(pageRect.height - panelHeight - 20, rect.top - pageRect.top + rect.height / 2 - panelHeight / 2)
    );
    setPanelStyle({ top, left });
    if (panelIntent) {
      setIsPanelVisible(true);
    } else {
      setIsPanelVisible(false);
    }
  }, [selectedNodeId, panelIntent]);

  useLayoutEffect(() => {
    repositionPanel();
  }, [selectedNodeId, nodes, view.x, view.y, repositionPanel]);

  // Measure each node's actual circle center in canvas coordinates (no state mutation)
  const circleCenterRef = useRef({});
  useLayoutEffect(() => {
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    nodes.forEach(node => {
      const circleEl = circleRefs.current[node.id];
      if (!circleEl) return;
      const rect = circleEl.getBoundingClientRect();
      circleCenterRef.current[node.id] = {
        cx: (rect.left + rect.width / 2 - canvasRect.left - view.x) / view.scale,
        cy: (rect.top + rect.height / 2 - canvasRect.top - view.y) / view.scale,
        r: (rect.height / 2) / view.scale,
      };
    });
  }, [nodes, nodesOpacity, view.x, view.y, view.scale]);

  const openSelectionPanel = useCallback(
    (nodeId) => {
      setPanelIntent(true);
      // If this is the initial node and it's still unconfigured (in CSS overlay),
      // use the intro circle element's center for positioning — not the full wrapper
      // which includes arrow + CTA text
      if (nodeId === INITIAL_NODE.id && !nodeMap[nodeId]?.configured) {
        let circleCenterX, circleCenterY;
        if (introCircleRef.current) {
          const circleRect = introCircleRef.current.getBoundingClientRect();
          circleCenterX = circleRect.left + circleRect.width / 2;
          circleCenterY = circleRect.top + circleRect.height / 2;
        } else {
          const builderRect = builderRef.current?.getBoundingClientRect();
          circleCenterX = builderRect ? builderRect.left + builderRect.width / 2 : window.innerWidth / 2;
          circleCenterY = builderRect ? builderRect.top + builderRect.height / 2 : window.innerHeight / 2;
        }
        // Convert circle center to canvas coordinates (undo viewport transform)
        const canvasX = (circleCenterX - view.x) / view.scale;
        const canvasY = (circleCenterY - view.y) / view.scale;
        setNodes((prev) =>
          prev.map((node) =>
            node.id === INITIAL_NODE.id ? { ...node, x: canvasX, y: canvasY } : node
          )
        );
        setInitialNodeShifted(true);
      }
      setSelectedNodeId(nodeId);
      setLogicPanel(null);
      
      // If this node has a schedule config, show the schedule config form
      const node = nodeMap[nodeId];
      if (node?.scheduleConfig) {
        restoringFromNodeRef.current = true;
        setScheduleConfig({ ...node.scheduleConfig });
        setPanelStage('scheduleConfig');
      }
      // If this node has an appointment config, show the config form
      else if (node?.appointmentConfig) {
        restoringFromNodeRef.current = true;
        setAppointmentConfig({ ...node.appointmentConfig });
        setPanelStage('appointmentConfig');
      }
      // If this node has an action config, show the action config form
      else if (node?.actionConfig?._fields?.length) {
        restoringFromNodeRef.current = true;
        setActionConfig({ ...node.actionConfig });
        setPanelStage('actionConfig');
      }
    },
    [initialNodeShifted, nodeMap, view.x, view.y]
  );

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (dragRef.current.id) {
        event.preventDefault();
        const node = nodeMap[dragRef.current.id];
        if (!node) return;
        const dx = (event.clientX - dragRef.current.startX) / dragRef.current.scale;
        const dy = (event.clientY - dragRef.current.startY) / dragRef.current.scale;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragRef.current.id
              ? { ...n, x: dragRef.current.nodeX + dx, y: dragRef.current.nodeY + dy }
              : n
          )
        );
        if (Math.abs(event.clientX - dragRef.current.startX) > 3 || Math.abs(event.clientY - dragRef.current.startY) > 3) {
          dragRef.current.moved = true;
        }
        return;
      }

      if (!panRef.current) return;
      const dx = event.clientX - panRef.current.startX;
      const dy = event.clientY - panRef.current.startY;
      setView((prev) => ({
        ...prev,
        x: panRef.current.originX + dx,
        y: panRef.current.originY + dy,
      }));
    };

    const handlePointerUp = () => {
      if (dragRef.current.id) {
        if (!dragRef.current.moved) {
          openSelectionPanel(dragRef.current.id);
        }
        dragRef.current = { id: null, moved: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0, scale: 1 };
      }
      panRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [nodeMap, openSelectionPanel, view.x, view.y, view.scale, triggerQuantumOrbit]);

  const handleNodePointerDown = (nodeId, event) => {
    event.stopPropagation();
    event.preventDefault();
    const node = nodeMap[nodeId];
    if (!node) return;
    dragRef.current = {
      id: nodeId,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
      scale: view.scale,
    };
  };

  const handleCanvasPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target.closest('.sb-builder-node')) return;
    event.preventDefault();
    panRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    };
  };

  const handleWheel = (event) => {
    event.preventDefault();
    const rate = -event.deltaY / 500;
    setView((prev) => {
      const scale = Math.min(1.4, Math.max(0.6, prev.scale + rate));
      return { ...prev, scale };
    });
  };

  const canAddChild = (node) => {
    if (!node.configured) return false;
    if (node.type === 'router') return true;
    return !edges.some((edge) => edge.from === node.id);
  };

  const handleAddNode = (nodeId) => {
    const parent = nodeMap[nodeId];
    if (!parent) return;
    if (!canAddChild(parent)) return;
    const nextId = `node-${nodeIdCounter.current + 1}`;
    nodeIdCounter.current += 1;
    const siblingCount = edges.filter((edge) => edge.from === nodeId).length;
    const yOffset = siblingCount * 120 - (parent.type === 'router' ? 60 : 0);
    // Configured nodes have the sphere at the top of the node div (above label + connector).
    // The node div center (parent.y) is below the sphere center by ~54px.
    // Offset so the child's node div center aligns with the parent's sphere center.
    // Use the parent node's measured circle center Y (from useLayoutEffect)
    // instead of node.div.center (parent.y) which doesn't match the sphere center
    const measured = circleCenterRef.current[nodeId];
    const parentCircleY = measured ? measured.cy : parent.y;
    const newNode = {
      id: nextId,
      x: parent.x + 280,
      y: parentCircleY + yOffset,
      configured: false,
      label: 'New Step',
    };
    const nextEdgeId = `edge-${edgeIdCounter.current + 1}`;
    edgeIdCounter.current += 1;
    setNodes((prev) => [...prev, newNode]);
    setEdges((prev) => [...prev, { id: nextEdgeId, from: nodeId, to: nextId, filter: null }]);
    setSelectedNodeId(nextId);
    setLogicPanel(null);
  };

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId)
    );
    setSelectedNodeId(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    setPanelStage('options');
    setActiveOption(null);
    setActionConfig(null);
    setAppointmentConfig({});
    setScheduleConfig({});
    setEdgeRules([{ id: 1, variable: 'status', operator: 'equals', value: '', logic: 'and' }]);
  }, [selectedNodeId]);

  const addEdgeRule = useCallback((logicType = 'and') => {
    setEdgeRules((prev) => [
      ...prev,
      { id: Date.now(), variable: 'status', operator: 'equals', value: '', logic: logicType },
    ]);
  }, []);

  const removeEdgeRule = useCallback((ruleId) => {
    setEdgeRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  }, []);

  const updateEdgeRule = useCallback((ruleId, field, value) => {
    setEdgeRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
    );
  }, []);

  const saveLogicPanel = useCallback(() => {
    const currentEdgeRules = edgeRulesRef.current;
    setEdges((prevEdges) => {
      if (logicPanel && logicPanel.edgeId) {
        // Handle fallback edge save
        if (logicIsFallback) {
          return prevEdges.map((edge) =>
            edge.id === logicPanel.edgeId
              ? { ...edge, filter: { type: 'fallback', fallbackAction: logicFallbackAction, label: 'Fallback' } }
              : edge
          );
        }
        
        // Check if rule has variable and operator, and value is required (not empty string for operators that need values)
        const hasValidRules = currentEdgeRules.some(rule => {
          if (!rule.variable || !rule.operator) return false;
          // Operators that don't require a value
          const noValueOperators = ['is_empty', 'is_not_empty'];
          if (noValueOperators.includes(rule.operator)) return true;
          // Other operators require a value
          return rule.value !== '' && rule.value !== null && rule.value !== undefined;
        });
        return prevEdges.map((edge) =>
          edge.id === logicPanel.edgeId
            ? { ...edge, filter: hasValidRules ? { label: 'Condition', rules: currentEdgeRules } : null }
            : edge
        );
      }
      return prevEdges;
    });
    setLogicPanel(null);
    setLogicIsFallback(false);
    setLogicFallbackAction('');
  }, [logicPanel, logicIsFallback, logicFallbackAction]);

  const closeLogicPanel = useCallback(() => {
    setLogicPanel(null);
  }, []);

  // Snap the intro node from overlay center to matching canvas position
  const snapIntroNodePosition = useCallback(() => {
    if (!introCircleRef.current) return;
    const circleRect = introCircleRef.current.getBoundingClientRect();
    const cx = circleRect.left + circleRect.width / 2;
    const cy = circleRect.top + circleRect.height / 2;
    const canvasX = (cx - view.x) / view.scale;
    const canvasY = (cy - view.y) / view.scale;
    setNodes(prev => prev.map(n =>
      n.id === INITIAL_NODE.id ? { ...n, x: canvasX, y: canvasY } : n
    ));
  }, [view.x, view.y, view.scale]);

  const finalizeSelection = (label, detail, icon, categoryType, accentColor) => {
    if (!selectedNodeId) return;
    const meta = CATEGORY_META[categoryType] || CATEGORY_META.TRIGGERS;
    const nodeType =
      categoryType === 'UTILITIES'
        ? label.toLowerCase() === 'router'
          ? 'router'
          : label.toLowerCase() === 'end call'
            ? 'end_call'
          : 'utility'
        : meta.type;
    // Snap intro node to overlay center before configuring
    if (selectedNodeId === INITIAL_NODE.id) {
      snapIntroNodePosition();
    }
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              configured: true,
              label,
              detail: detail || meta.detail,
              icon: icon || meta.icon,
              type: nodeType,
              category: meta.detail,
              accent: accentColor || meta.accent,
              categoryType,
            }
          : node
      )
    );
    setSelectedNodeId(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    // Show toolbar for "No Trigger" option
    if (label === 'No Trigger') {
      setNoTriggerActive(true);
    }
  };

  const handleOptionClick = (option) => {
    const optionIcon = option.icon || categoryMeta.icon;
    const optionAccent = option.accent || categoryMeta.accent;
    if (option.sub_options?.length) {
      setActiveOption({ ...option, accent: optionAccent });
      setPanelStage('subOptions');
      return;
    }
    finalizeSelection(option.option, option.description, optionIcon, panelCategory, optionAccent);
  };

  const APPOINTMENT_CONFIG_ACTIONS = new Set([
    'create_appointment', 'search_appointments', 'update_appointment', 'delete_appointment',
  ]);
  const TIME_CONFIG_ACTIONS = new Set([
    'specific_time', 'recurring_daily', 'recurring_weekly', 'appointment_reminder',
  ]);

  const handleSubOptionClick = (subOption) => {
    const subIcon = activeOption?.icon || categoryMeta.icon;
    const subAccent = activeOption?.accent || categoryMeta.accent;
    const meta = CATEGORY_META[panelCategory] || CATEGORY_META.TRIGGERS;
    const currentNodeId = selectedNodeId; // Capture before finalizeSelection clears it
    
    // Check if this action needs config BEFORE finalizing
    const needsAppointmentConfig = APPOINTMENT_CONFIG_ACTIONS.has(subOption.key);
    const needsActionConfig = subOption.configFields && subOption.configFields.length > 0;
    
    if (needsAppointmentConfig || needsActionConfig) {
      // Snap intro node to overlay center before configuring
      if (currentNodeId === INITIAL_NODE.id) {
        snapIntroNodePosition();
      }
      // Configure the node but DON'T close the panel yet
      const nodeType = 'action';
      setNodes((prev) =>
        prev.map((node) =>
          node.id === currentNodeId
            ? {
                ...node,
                configured: true,
                label: subOption.name,
                detail: subOption.description,
                icon: subIcon,
                type: nodeType,
                category: meta.detail,
                accent: subAccent,
                categoryType: panelCategory,
                subOptionKey: subOption.key,
                categoryKey: activeOption?.key || '',
              }
            : node
        )
      );
      
      if (needsAppointmentConfig) {
        const initApptConfig = {
          key: subOption.key,
          client_name: '',
          date: '',
          time: '',
          duration: 30,
          status: 'pending',
          assigned_receptionist: '',
          notes: '',
        };
        restoringFromNodeRef.current = true;
        setAppointmentConfig(initApptConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, appointmentConfig: initApptConfig } : n));
        setPanelStage('appointmentConfig');
      } else if (TIME_CONFIG_ACTIONS.has(subOption.key)) {
        const initSchedConfig = {
          key: subOption.key,
          date: '',
          time: '09:00',
          days_of_week: [],
          reminder_minutes: 30,
          timezone: 'America/New_York',
        };
        restoringFromNodeRef.current = true;
        setScheduleConfig(initSchedConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, scheduleConfig: initSchedConfig } : n));
        setPanelStage('scheduleConfig');
      } else {
        const initialConfig = { _key: subOption.key, _fields: subOption.configFields };
        subOption.configFields.forEach(f => { initialConfig[f.key] = ''; });
        restoringFromNodeRef.current = true;
        setActionConfig(initialConfig);
        setNodes(prev => prev.map(n => n.id === currentNodeId ? { ...n, actionConfig: initialConfig } : n));
        setPanelStage('actionConfig');
      }
      // Keep panel open — don't call finalizeSelection
      return;
    }
    
    // No config needed — finalize normally (closes panel)
    finalizeSelection(subOption.name, subOption.description, subIcon, panelCategory, subAccent);
    
    // Store subOptionKey and categoryKey on node
    setNodes((prev) =>
      prev.map((node) =>
        node.id === currentNodeId
          ? { ...node, subOptionKey: subOption.key, categoryKey: activeOption?.key || '' }
          : node
      )
    );
  };

  const handleBackToOptions = () => {
    setPanelStage('options');
    setActiveOption(null);
  };

  const handleEdgeLogicClick = (edge, event) => {
    event.stopPropagation();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const top = canvasRect.top + view.y + midY * view.scale;
    const left = canvasRect.left + view.x + midX * view.scale;
    
    // Determine context type from source node
    const ctxType = getContextType(from);
    setLogicContextType(ctxType);
    
    // Build available variables from previous nodes
    const vars = buildVariableMap(nodes, edges, edge.from);
    setLogicAvailableVars(vars);
    
    // Check if this is a fallback edge
    const isFallbackEdge = edge.filter?.type === 'fallback';
    setLogicIsFallback(isFallbackEdge);
    setLogicFallbackAction(edge.filter?.fallbackAction || '');
    
    // Load existing filter rules into edgeRules state
    const newRules = edge.filter && edge.filter.rules 
      ? edge.filter.rules.map(r => ({ ...r, logic: r.logic || 'and' }))
      : [{ id: Date.now(), variable: 'status', operator: 'equals', value: '', logic: 'and' }];
    
    // Update the ref immediately
    edgeRulesRef.current = newRules;
    setEdgeRules(newRules);
    
    setLogicPanel({ edgeId: edge.id, top, left });
  };

  const handlePagePointerDown = (event) => {
    if (
      event.target.closest('.sb-selection-panel') ||
      event.target.closest('.aether-logic-wrapper') ||
      event.target.closest('.sb-node-add') ||
      event.target.closest('.sb-variables-pane') ||
      event.target.closest('.sb-vars-field')
    )
      return;
    if (!event.target.closest('.sb-builder-node')) {
      setSelectedNodeId(null);
      setIsPanelVisible(false);
      setPanelIntent(false);
    }
    setLogicPanel(null);
    setVarsPane(prev => ({ ...prev, visible: false }));
  };

  const handleCreateScenario = () => {
    // Reset builder state to initial state
    setEdges([]);
    setView({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId('node-1');
    setEdgeRules([{ id: 1, variable: 'status', operator: 'equals', value: '', logic: 'and' }]);
    setLogicPanel(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    setPanelStage('options');
    setActiveOption(null);
    setInitialFocusSet(false);
    setViewportReady(false);
    
    // Clear current scenario
    setCurrentScenario(null);
    
    // Clear current scenario ID
    window.selectedScenarioForDelete = null;
    
    // Switch to builder view
    setViewMode('builder');
    setNodes([INITIAL_NODE]);
    setNodesOpacity(1);
    
    // Reset toolbar state
    setNoTriggerActive(false);
    setScenarioIsActive(true);
    setRecurringSchedule({ frequency: 'once', interval: 1, time: '09:00' });
    setScenarioNotes('');
  };

  const handleBackToList = () => {
    setViewMode('list');
  };

  const handleLoadScenario = (scenario) => {
    try {
      // Parse nodes and edges from JSON
      const nodesData = typeof scenario.nodes_data === 'string' 
        ? JSON.parse(scenario.nodes_data) 
        : scenario.nodes_data;
      const edgesData = typeof scenario.edges_data === 'string' 
        ? JSON.parse(scenario.edges_data) 
        : scenario.edges_data;
      
      // Set nodes and edges from scenario data
      setNodes(nodesData || [INITIAL_NODE]);
      setEdges(edgesData || []);
      
      // Calculate center position for nodes
      if (nodesData && nodesData.length > 0) {
        // Calculate bounding box
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        nodesData.forEach(node => {
          minX = Math.min(minX, node.x);
          maxX = Math.max(maxX, node.x);
          minY = Math.min(minY, node.y);
          maxY = Math.max(maxY, node.y);
        });
        
        // Calculate center offset
        const nodesWidth = maxX - minX + 220; // Include node width
        const nodesHeight = maxY - minY + 80; // Include node height
        const centerX = nodesWidth / 2;
        const centerY = nodesHeight / 2;
        
        // Center the view on the nodes (adjusted for live pulse panel)
        const viewX = -centerX + window.innerWidth / 2;
        const viewY = -centerY + window.innerHeight / 2;
        
        setView({ x: viewX, y: viewY, scale: 1 });
      } else {
        setView({ x: 0, y: 0, scale: 1 });
      }
      
      setSelectedNodeId(nodesData?.[0]?.id || 'node-1');
      setLogicPanel(null);
      setIsPanelVisible(false);
      setPanelIntent(false);
      
      // Track current scenario for save logic
      setCurrentScenario(scenario);
      
      // Load toolbar state
      if (scenario.schedule_config) {
        setRecurringSchedule(scenario.schedule_config);
      }
      setScenarioNotes(scenario.notes || '');
      setScenarioIsActive(scenario.is_active !== false); // default true
      // Show toolbar if any node has "No Trigger" or if schedule/notes exist
      const hasNoTrigger = nodesData?.some(n => n.label === 'No Trigger');
      setNoTriggerActive(hasNoTrigger || !!scenario.schedule_config || !!scenario.notes);
      
      // Switch to builder view
      setViewMode('builder');
      
      // Trigger fade-in animation
      setNodesOpacity(0);
      setTimeout(() => {
        setNodesOpacity(1);
      }, 50);
      
      console.log('[Scenarios] Loaded scenario:', scenario.name);
    } catch (err) {
      console.error('[Scenarios] Error loading scenario:', err);
    }
  };

  const handleSaveScenario = () => {
    // If editing existing scenario, save directly without modal
    if (currentScenario) {
      handleConfirmSaveScenario();
      return;
    }
    
    // If creating new scenario, show modal
    setScenarioName(`Scenario ${scenarios.length + 1}`);
    setScenarioDescription('');
    setShowSaveModal(true);
  };

  const handleConfirmSaveScenario = async () => {
    const scenarioData = {
      name: scenarioName 
        ? scenarioName.charAt(0).toUpperCase() + scenarioName.slice(1) 
        : `Scenario ${scenarios.length + 1}`,
      description: scenarioDescription 
        ? scenarioDescription.charAt(0).toUpperCase() + scenarioDescription.slice(1) 
        : '',
      nodes_data: nodes.map(n => ({
        id: n.id,
        x: n.x,
        y: n.y,
        type: n.type,
        label: n.label,
        detail: n.detail,
        configured: n.configured,
        accent: n.accent,
        icon: n.icon?.name,
        appointmentConfig: n.appointmentConfig || null,
        scheduleConfig: n.scheduleConfig || null,
        actionConfig: n.actionConfig || null,
        subOptionKey: n.subOptionKey || null,
        categoryKey: n.categoryKey || null,
      })),
      edges_data: edges.map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        filter: e.filter
      })),
      status: 'active',
      is_active: scenarioIsActive,
      schedule_config: recurringSchedule,
      notes: scenarioNotes,
    };
    
    let result;
    
    if (currentScenario) {
      // Update existing scenario
      const { data, error } = await supabase
        .from('scenarios')
        .update(scenarioData)
        .eq('id', currentScenario.id)
        .select()
        .single();
      
      result = { data, error };
    } else {
      // Insert new scenario
      const { data, error } = await supabase
        .from('scenarios')
        .insert(scenarioData)
        .select();
      
      result = { data: data?.[0], error };
    }
    
    const { data, error } = result;
    
    if (error) {
      console.error('[Scenarios] Error saving scenario:', error);
      setShowSaveModal(false);
      return;
    }
    
    console.log('[Scenarios] Scenario saved:', data);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }
    
    // Close modal and switch back to list view
    setShowSaveModal(false);
    setScenarioName('');
    setScenarioDescription('');
    setCurrentScenario(null);
    setViewMode('list');
  };

  const handleCancelSaveScenario = () => {
    setShowSaveModal(false);
    setScenarioName('');
    setScenarioDescription('');
  };

  const handleEditScenario = (scenario) => {
    // Load scenario and show save modal with current values
    handleLoadScenario(scenario);
    setScenarioName(scenario.name);
    setScenarioDescription(scenario.description || '');
    setShowSaveModal(true);
  };

  const handleDeleteScenario = (scenario) => {
    // Show custom confirmation modal
    console.log('[Scenarios] Deleting scenario:', scenario.name);
    window.selectedScenarioForDelete = scenario;
    setDeleteConfirmModal(true);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmModal(false);
    window.selectedScenarioForDelete = null;
  };

  const handleConfirmDelete = async () => {
    const scenario = window.selectedScenarioForDelete;
    if (!scenario) return;

    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', scenario.id);
    
    if (error) {
      console.error('[Scenarios] Error deleting scenario:', error);
      setDeleteConfirmModal(false);
      return;
    }
    
    console.log('[Scenarios] Deleted scenario:', scenario.name);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }
    
    // If we deleted the currently loaded scenario, go back to list
    if (currentScenario?.id === scenario.id) {
      setCurrentScenario(null);
      setViewMode('list');
    }
    
    setDeleteConfirmModal(false);
    window.selectedScenarioForDelete = null;
  };

  const handleToggleScenarioStatus = async (scenario) => {
    const newStatus = scenario.status === 'active' ? 'disabled' : 'active';
    
    const { error } = await supabase
      .from('scenarios')
      .update({ status: newStatus })
      .eq('id', scenario.id);
    
    if (error) {
      console.error('[Scenarios] Error updating scenario status:', error);
      return;
    }
    
    console.log('[Scenarios] Updated scenario status:', scenario.name, '->', newStatus);
    
    // Refresh the scenarios list
    const { data: updatedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .order('updated_at', { ascending: false });
    
    if (updatedScenarios) {
      setScenarios(updatedScenarios);
    }
  };

  // List View Component
  const renderListView = () => (
    <div className="scenario-list-page">
      <div className="scenario-list-header">
        <div className="scenario-list-title-group">
          <h1 className="scenario-list-title">Scenarios</h1>
          <p className="scenario-list-subtitle">Automate your workflows with conditional logic</p>
        </div>
        <button className="create-scenario-btn" onClick={handleCreateScenario}>
          <Plus size={18} />
          Create Scenario
        </button>
      </div>
      
      <div className="scenario-list-content">
        {scenarios.length === 0 ? (
          <div className="scenario-empty-state">
            <div className="scenario-empty-icon">
              <Target size={48} />
            </div>
            <h3 className="scenario-empty-title">No scenarios yet</h3>
            <p className="scenario-empty-description">
              Create your first scenario to automate workflows based on lead conditions.
            </p>
            <button className="create-scenario-btn" onClick={handleCreateScenario}>
              <Plus size={18} />
              Create Your First Scenario
            </button>
          </div>
        ) : (
          <div className="scenario-grid">
            {scenarios.map((scenario) => (
              <div 
                key={scenario.id} 
                className={`scenario-card ${scenario.status === 'disabled' ? 'scenario-disabled' : ''}`}
              >
                <div 
                  className="scenario-card-content"
                  onClick={() => handleLoadScenario(scenario)}
                >
                  <div className="scenario-card-header">
                    <h3 className="scenario-card-title">{scenario.name}</h3>
                    <span className={`scenario-card-status ${scenario.status}`}>
                      {scenario.status === 'active' ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="scenario-card-description">{scenario.description}</p>
                  <div className="scenario-card-footer">
                    <span className="scenario-card-date">
                      {new Date(scenario.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="scenario-card-actions">
                  <button 
                    className="scenario-action-btn toggle"
                    onClick={(e) => { e.stopPropagation(); handleToggleScenarioStatus(scenario); }}
                    title={scenario.status === 'active' ? 'Disable scenario' : 'Enable scenario'}
                  >
                    {scenario.status === 'active' ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button 
                    className="scenario-action-btn edit"
                    onClick={(e) => { e.stopPropagation(); handleEditScenario(scenario); }}
                    title="Edit scenario"
                  >
                    <Pencil size={14} />
                  </button>
                  <button 
                    className="scenario-action-btn delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario); }}
                    title="Delete scenario"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderBuilderView = () => (
    <div className="scenario-builder-page" ref={builderRef} onPointerDown={handlePagePointerDown}>
      <div className="sb-canvas-wrapper">
        <div
          className="sb-canvas"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
        >
          <div className="sb-canvas-grid" />
          
          {/* Quantum Reveal label — shown when initial node is unconfigured */}
          {nodes.length === 1 && !nodes[0].configured && (
            <>
              <div className="sb-quantum-label">QUANTUM REVEAL</div>
              <div className="sb-quantum-hint">Tap to configure</div>
            </>
          )}
          <div
            className="sb-canvas-viewport"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              opacity: viewportReady ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}
          >
            <svg className="sb-canvas-connections">
              <defs>
                <marker id="sb-arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="rgba(255,255,255,0.2)" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const from = nodeMap[edge.from];
                const to = nodeMap[edge.to];
                if (!from || !to) return null;
                const isDraft = !nodeMap[edge.to]?.configured;
                const isFallback = edge.filter?.type === 'fallback';
                // For unconfigured nodes, edge should target circle bottom (center + radius)
                // Configured nodes already have node.y near sphere bottom due to label+connector below
                const fromMeasured = circleCenterRef.current[edge.from];
                const toMeasured = circleCenterRef.current[edge.to];
                const fromY = !from.configured && fromMeasured ? fromMeasured.cy + fromMeasured.r : from.y;
                const toY = !to.configured && toMeasured ? toMeasured.cy + toMeasured.r : to.y;
                const dx = to.x - from.x;
                const path = `M ${from.x} ${fromY} C ${from.x + dx/2} ${fromY}, ${from.x + dx/2} ${toY}, ${to.x} ${toY}`;

                return (
                  <path
                    key={edge.id}
                    d={path}
                    className={`sb-edge-line ${isDraft ? 'sb-edge-draft' : ''} ${isFallback ? 'sb-edge-fallback' : ''}`}
                    fill="none"
                    markerEnd={!isDraft ? "url(#sb-arrowhead)" : ""}
                    style={isFallback ? { stroke: '#f59e0b', strokeDasharray: '8 4', strokeWidth: '2px' } : {}}
                  />
                );
              })}
            </svg>
            
            {edges.map((edge) => {
              const from = nodeMap[edge.from];
              const to = nodeMap[edge.to];
              if (!from || !to) return null;
              const fromMeasuredPin = circleCenterRef.current[edge.from];
              const toMeasuredPin = circleCenterRef.current[edge.to];
              const fromYPin = !from.configured && fromMeasuredPin ? fromMeasuredPin.cy + fromMeasuredPin.r : from.y;
              const toYPin = !to.configured && toMeasuredPin ? toMeasuredPin.cy + toMeasuredPin.r : to.y;
              const midX = (from.x + to.x) / 2;
              const midY = (fromYPin + toYPin) / 2;
              const isFallback = edge.filter?.type === 'fallback';
              return (
                <div
                  key={`filter-${edge.id}`}
                  className={`sb-filter-pin ${edge.filter ? 'has-filter' : ''} ${isFallback ? 'sb-filter-fallback' : ''}`}
                  style={{ left: midX, top: midY }}
                  onClick={(event) => { setVarsPane(prev => ({ ...prev, visible: false })); handleEdgeLogicClick(edge, event); }}
                >
                  <div className="sb-filter-label">
                    {isFallback ? (
                      <><GitBranch size={10} /> Fallback</>
                    ) : edge.filter ? (
                      <Zap size={10} />
                    ) : (
                      <Filter size={12} />
                    )}
                  </div>
                  <div className="sb-filter-dot" />
                </div>
              );
            })}
            
            {nodes.map((node) => {
              // Skip initial unconfigured node — rendered in centering overlay
              if (node.id === INITIAL_NODE.id && !node.configured) return null;
              const Icon = node.icon || null;
              const isActive = selectedNodeId === node.id;
              const accent = node.accent || '#e11d48';
              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current[node.id] = el;
                    else delete nodeRefs.current[node.id];
                  }}
                  className={`sb-builder-node ${node.type === 'router' ? 'router-node' : ''} ${
                    isActive ? 'sb-active-node' : ''
                  } ${node.configured ? 'sb-is-configured' : 'sb-is-placeholder'}`}
                  style={{ left: node.x, top: node.y, opacity: nodesOpacity, transition: 'opacity 0.3s ease' }}
                  onPointerDown={(event) => handleNodePointerDown(node.id, event)}
                >
                  {node.configured ? (
                    <>
                      <div className="sb-node-inner-wrap" ref={(el) => { if (el) circleRefs.current[node.id] = el.querySelector('.sb-node-sphere') || el; }}>
                        {/* Outer Ring / Aura — exact from concepts.txt */}
                        <div className={`sb-node-aura ${accent ? 'sb-node-custom-gradient' : ''}`}
                          style={accent ? { '--node-accent-color': accent } : {}}
                        />

                        {/* Outer Boundary Stroke — Concentric design */}
                        <div className="sb-node-ring" />

                        {/* The Primary Gradient Sphere */}
                        <div
                          className={`sb-node-sphere ${isActive ? 'sb-sphere-active' : ''}`}
                          style={{ '--node-accent-color': accent }}
                        >
                          <div className="sb-node-specular" />
                          <div className="sb-node-dots">
                            <svg width="100%" height="100%">
                              <pattern id={`grid-${node.id}`} width="12" height="12" patternUnits="userSpaceOnUse">
                                <circle cx="1" cy="1" r="0.6" fill="white" />
                              </pattern>
                              <rect width="100%" height="100%" fill={`url(#grid-${node.id})`} />
                            </svg>
                          </div>
                          <div className="sb-node-core-shadow" />
                        </div>

                        {/* Icon Container with Glassmorphism */}
                        <div className="sb-node-icon-glass">
                          {Icon ? <Icon size={42} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} /> : <Plus size={42} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} />}
                        </div>

                        {/* Pulse Effect for Activity */}
                        <div className="sb-node-pulse-dot" />

                        {/* Add button */}
                        <button className="sb-node-add" type="button" onClick={() => handleAddNode(node.id)}>
                          <Plus size={13} />
                        </button>
                      </div>

                      {/* Label below — typography from concepts.txt */}
                      <div className="sb-node-label-below">
                        <h3 className="sb-node-below-title">{node.label}</h3>
                        {node.detail && <p className="sb-node-below-desc">{node.detail}</p>}
                      </div>

                      {/* Connecting Line Indicator */}
                      <div className="sb-node-connector-line" />
                    </>
                  ) : (
                    <div className="sb-node-inner-wrap" ref={(el) => { if (el) circleRefs.current[node.id] = el.querySelector('.sb-quantum-circle') || el; }}>
                      <div className="sb-quantum-circle" style={{ width: '100%', height: '100%', opacity: 1, transform: 'scale(1)', animation: 'quantum-breathe 6s 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Centered overlay for initial unconfigured node */}
          {nodes.length === 1 && !nodes[0].configured && (
            <div className="sb-quantum-centering">
              <div className="sb-quantum-container-fade">
              <div
                className={`sb-builder-node ${selectedNodeId === nodes[0].id ? 'sb-active-node' : ''}`}
                ref={(el) => { if (el) nodeRefs.current[nodes[0].id] = el; }}
                onPointerDown={(event) => handleNodePointerDown(nodes[0].id, event)}
              >
                <div className="sb-quantum-composition">
                  <div className="sb-quantum-orbits">
                    {(quantumOrbits[nodes[0].id] || []).map(ring => (
                      <div key={ring.id} className="sb-quantum-orbit-ring"
                        style={{ width: ring.size, height: ring.size, animationDelay: `${ring.delay}s` }} />
                    ))}
                  </div>
                  <div className="sb-quantum-circle" ref={introCircleRef} />
                  <div className="sb-quantum-arrow" />
                  <div className="sb-quantum-cta-text">Click it. Click it real good.</div>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>

        {isPanelVisible && selectedNodeId && (
          <div className="sb-selection-panel" style={panelStyle}>
            <div className="sb-panel-inner">
              <div className="sb-panel-header">
                <div>
                  {showNodeConfigText && (
                    <>
                      <p className="sb-panel-label">Node Config</p>
                      <h3 className="sb-panel-title">Add Component</h3>
                    </>
                  )}
                </div>
                <div className="sb-panel-header-controls">
                  <button type="button" className="sb-panel-delete" onClick={handleDeleteNode}>
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="sb-panel-close"
                    onClick={() => {
                      setSelectedNodeId(null);
                      setIsPanelVisible(false);
                      setPanelIntent(false);
                    }}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {panelStage === 'subOptions' && activeOption && (
                <>
                  <div
                    className="sb-active-banner sleek-cyber"
                    style={{ borderLeft: `4px solid ${categoryMeta.accent}` }}
                  >
                    <div className="sb-cyber-inner">
                      <div className="sb-cyber-header">
                        <div
                          className="sb-cyber-pill"
                          style={{ backgroundColor: `${categoryMeta.accent}20`, color: categoryMeta.accent }}
                        >
                          {bannerCategoryLabel}
                        </div>
                        <button type="button" className="sb-cyber-back" onClick={handleBackToOptions}>
                          <ChevronLeft size={14} /> Change Selection
                        </button>
                      </div>
                      <div className="sb-cyber-main">
                        <div
                          className="sb-cyber-icon-box"
                          style={{
                            background: `linear-gradient(135deg, ${categoryMeta.accent}40, transparent)`,
                          }}
                        >
                          <BannerIcon size={24} style={{ color: categoryMeta.accent }} />
                        </div>
                        <div className="sb-cyber-title-group">
                          <h2 className="sb-cyber-title">{activeOption.option}</h2>
                          <p className="sb-cyber-desc">{activeOption.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="sb-panel-subheader">Select an action for {activeOption.option}</p>
                </>
              )}
              {!['actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(panelStage) && (
                <>
                  <div className="sb-panel-search">
                    <Search className="sb-panel-search-icon" size={16} />
                    <input
                      type="text"
                      value={panelSearch}
                      onChange={(event) => setPanelSearch(event.target.value)}
                      placeholder="Search options..."
                    />
                  </div>
                  <div className="sb-panel-tabs">
                    {visibleCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        className={`sb-panel-tab ${panelCategory === category ? 'active' : ''}`}
                        onClick={() => {
                          setPanelCategory(category);
                          setPanelStage('options');
                          setActiveOption(null);
                        }}
                      >
                        {PANEL_CATEGORY_LABELS[category] || category}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {/* Action banner — persists across all config stages */}
              {['actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(panelStage) && selectedNode && (
                <div
                  className="sb-active-banner sleek-cyber"
                  style={{ borderLeft: `4px solid ${selectedNode.accent || categoryMeta.accent}` }}
                >
                  <div className="sb-cyber-inner">
                    <div className="sb-cyber-header">
                      <div
                        className="sb-cyber-pill"
                        style={{ backgroundColor: `${selectedNode.accent || categoryMeta.accent}20`, color: selectedNode.accent || categoryMeta.accent }}
                      >
                        {selectedNode.category || categoryMeta.detail}
                      </div>
                      <button
                        type="button"
                        className="sb-cyber-back"
                        onClick={() => { setPanelStage('options'); }}
                      >
                        <ChevronLeft size={14} /> Back
                      </button>
                    </div>
                    <div className="sb-cyber-main">
                      <div
                        className="sb-cyber-icon-box"
                        style={{
                          background: `linear-gradient(135deg, ${selectedNode.accent || categoryMeta.accent}40, transparent)`,
                        }}
                      >
                        {selectedNode.icon && typeof selectedNode.icon === 'function'
                          ? <selectedNode.icon size={24} style={{ color: selectedNode.accent || categoryMeta.accent }} />
                          : <Phone size={24} style={{ color: selectedNode.accent || categoryMeta.accent }} />}
                      </div>
                      <div className="sb-cyber-title-group">
                        <h2 className="sb-cyber-title">{selectedNode.label}</h2>
                        <p className="sb-cyber-desc">Configure {selectedNode.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="sb-panel-actions">
                {panelStage === 'actionConfig' && actionConfig ? (
                  /* Staged Action Config Form */
                  <div className="sb-action-config-form">
                    <div className="sb-action-config-header">
                      <h4 className="sb-action-config-title">Configure Action</h4>
                      <button type="button" className="sb-action-config-close" onClick={() => { setPanelStage('options'); setActionConfig(null); }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="sb-action-config-fields">
                      {actionConfig._fields.map((field) => {
                        const rawVal = actionConfig[field.key] || '';

                        return (
                          <div key={field.key} className="sb-action-config-field">
                            <label className="sb-action-field-label">
                              {field.key === 'target_table' && <Database size={11} style={{ marginRight: 4, opacity: 0.5, display: 'inline', verticalAlign: -1 }} />}
                              {field.label}
                            </label>
                            {field.type === 'select' ? (
                              <select
                                className="sb-input-field sb-select-field"
                                value={actionConfig[field.key] || ''}
                                onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                              >
                                <option value="">Select...</option>
                                {(field.options || []).map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === 'prompt_textarea' ? (
                              /* Prompt textarea — no toggle, suggested smart actions above */
                              <div className="sb-prompt-textarea-wrap">
                                {/* Suggested smart actions row */}
                                <div className="sb-suggested-actions-row">
                                  {getSmartActions(findParentTriggerKey(selectedNodeId), currentActionKey).map(action => (
                                    <button
                                      key={action.key}
                                      type="button"
                                      className="sb-suggested-action-chip"
                                      onClick={() => handleInsertSmartAction(action, field.key)}
                                      title={action.description}
                                    >
                                      <Sparkles size={10} />
                                      {action.name}
                                    </button>
                                  ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                  <textarea
                                    className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                    value={rawVal}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}

                                    placeholder=""
                                    rows={4}
                                    style={{
                                      resize: 'none',
                                      ...(rawVal.includes('{{') || rawVal.includes('\x1E') ? { color: 'transparent' } : {}),
                                      ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                        borderColor: hoveredTableColor,
                                        boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                        '--hover-glow-color': `${hoveredTableColor}20`,
                                        '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                      } : {}),
                                    }}
                                  />
                                  {/* Chip overlay */}
                                  {(rawVal.includes('{{') || rawVal.includes('\x1E')) && (
                                    <div
                                      className="sb-var-chip-overlay"
                                      style={{
                                        position: 'absolute', inset: 0, pointerEvents: 'none',
                                        display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                        fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                        fontFamily: 'Inter, sans-serif', lineHeight: '1.5', wordBreak: 'break-word',
                                        whiteSpace: 'pre-wrap',
                                      }}
                                      dangerouslySetInnerHTML={{ __html: renderFieldChipsHTML(rawVal.replace(/\n$/, '')) }}
                                    />
                                  )}
                                </div>
                              </div>
                            ) : field.type === 'first_message_textarea' ? (
                              /* First Message — hidden behind a toggle */
                              <div className="sb-first-message-wrap">
                                <label className="sb-first-message-toggle">
                                  <input
                                    type="checkbox"
                                    checked={!!actionConfig[`${field.key}_enabled`]}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [`${field.key}_enabled`]: e.target.checked }))}
                                  />
                                  <span className="sb-first-message-toggle-label">{field.toggleLabel || 'Override First Message'}</span>
                                </label>
                                {actionConfig[`${field.key}_enabled`] && (
                                  <div style={{ marginTop: 8 }}>
                                    {/* Business variable buttons */}
                                    <div className="sb-suggested-actions-row" style={{ marginBottom: 6 }}>
                                      {['name', 'city', 'state'].map(fKey => (
                                        <button
                                          key={fKey}
                                          type="button"
                                          className="sb-suggested-action-chip sb-chip-grey"
                                          onClick={() => {
                                            const varRef = `{{businesses.${fKey}}}`;
                                            setActionConfig(prev => {
                                              const current = prev[field.key] || '';
                                              return { ...prev, [field.key]: current ? `${current} ${varRef}` : varRef };
                                            });
                                          }}
                                        >
                                          {{ name: 'Name', city: 'City', state: 'State' }[fKey]}
                                        </button>
                                      ))}
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                      <textarea
                                        className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                        value={rawVal}
                                        onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                        onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                        placeholder={field.placeholder || ''}
                                        rows={3}
                                        style={{
                                          resize: 'none',
                                          ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                          ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                            borderColor: hoveredTableColor,
                                            boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                          } : {}),
                                        }}
                                      />
                                      {rawVal.includes('{{') && (
                                        <div
                                          className="sb-var-chip-overlay"
                                          style={{
                                            position: 'absolute', inset: 0, pointerEvents: 'none',
                                            display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                            fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                            fontFamily: 'Inter, sans-serif', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                          }}
                                          dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : field.type === 'textarea' ? (
                              <div style={{ position: 'relative' }}>
                                <textarea
                                  className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                  value={rawVal}
                                  onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                  placeholder={field.placeholder || ''}
                                  rows={3}
                                  style={{
                                    resize: 'none',
                                    ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                    ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                      borderColor: hoveredTableColor,
                                      boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      '--hover-glow-color': `${hoveredTableColor}20`,
                                      '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                    } : {}),
                                  }}
                                />
                                {rawVal.includes('{{') && (
                                  <div
                                    className="sb-var-chip-overlay"
                                    style={{
                                      position: 'absolute', inset: 0, pointerEvents: 'none',
                                      display: 'flex', alignItems: 'flex-start', padding: '10px 14px',
                                      fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                      fontFamily: 'Inter, sans-serif', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                  />
                                )}
                              </div>
                            ) : (
                              <div style={{ position: 'relative' }}>
                                <input
                                  className={`sb-input-field${varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? ' sb-input-glow' : ''}`}
                                  type="text"
                                  value={rawVal}
                                  onChange={e => setActionConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                                  onFocus={() => setVarsPane({ visible: true, fieldKey: field.key, fieldLabel: field.label, fieldType: field.type })}
                                  placeholder={field.placeholder || ''}
                                  style={{
                                    ...(rawVal.includes('{{') ? { color: 'transparent' } : {}),
                                    ...(varsPane.visible && hoveredTableColor && field.key === varsPane.fieldKey ? {
                                      borderColor: hoveredTableColor,
                                      boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      '--hover-glow-color': `${hoveredTableColor}20`,
                                      '--hover-glow-color-strong': `${hoveredTableColor}40`,
                                    } : {}),
                                  }}
                                />
                                {rawVal.includes('{{') && (
                                  <div
                                    className="sb-var-chip-overlay"
                                    style={{
                                      position: 'absolute', inset: 0, pointerEvents: 'none',
                                      display: 'flex', alignItems: 'center', padding: '0 10px',
                                      fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                      whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(rawVal) }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Table-specific fields — dynamic based on selected table */}
                    {actionConfig.target_table && (
                      <div className="sb-record-fields-section">
                        {/* Record ID — first field after table */}
                        <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <label className="sb-record-label" style={{ display: 'block' }}><Hash size={11} className="sb-record-label-icon" style={{ marginRight: 4, display: 'inline', verticalAlign: -1 }} />Record ID</label>
                          <div style={{ position: 'relative' }}>
                            <input
                              className="sb-input-field"
                              type="text"
                              value={actionConfig.record_lookup_value || ''}
                              onChange={e => setActionConfig(prev => ({ ...prev, record_lookup_value: e.target.value }))}
                              onFocus={() => setVarsPane({ visible: true, fieldKey: 'record_lookup_value', fieldLabel: 'Record ID', fieldType: 'text' })}
                              placeholder=""
                              style={{
                                ...(actionConfig.record_lookup_value?.includes('{{') ? { color: 'transparent' } : {}),
                                ...(varsPane.visible && hoveredTableColor && 'record_lookup_value' === varsPane.fieldKey ? {
                                  borderColor: hoveredTableColor,
                                  boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                } : {}),
                              }}
                            />
                            {(actionConfig.record_lookup_value || '').includes('{{') && (
                              <div
                                className="sb-var-chip-overlay"
                                style={{
                                  position: 'absolute', inset: 0, pointerEvents: 'none',
                                  display: 'flex', alignItems: 'center', padding: '0 10px',
                                  fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                  whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                }}
                                dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(actionConfig.record_lookup_value) }}
                              />
                            )}
                          </div>
                        </div>

                        {/* Field inputs — shown for create and update actions */}
                        {(actionConfig._key === 'update_record' || actionConfig._key === 'create_new_record') && (
                        <div className="sb-record-fields-grid">
                          {RECORD_TABLE_FIELDS[actionConfig.target_table].map((field) => {
                            const fieldKey = `field_${field.key}`;
                            const val = actionConfig[fieldKey] || '';
                            return (
                              <div key={field.key} className="sb-record-field">
                                <label className="sb-record-label">{field.label}</label>
                                <div style={{ position: 'relative' }}>
                                  <input
                                    className="sb-input-field"
                                    type="text"
                                    value={val}
                                    onChange={e => setActionConfig(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                    onFocus={() => setVarsPane({ visible: true, fieldKey, fieldLabel: field.label, fieldType: 'text' })}
                                    placeholder=""
                                    style={{
                                      ...(val.includes('{{') ? { color: 'transparent' } : {}),
                                      ...(varsPane.visible && hoveredTableColor && fieldKey === varsPane.fieldKey ? {
                                        borderColor: hoveredTableColor,
                                        boxShadow: `0 0 0 1px ${hoveredTableColor}40`,
                                      } : {}),
                                    }}
                                  />
                                  {val.includes('{{') && (
                                    <div
                                      className="sb-var-chip-overlay"
                                      style={{
                                        position: 'absolute', inset: 0, pointerEvents: 'none',
                                        display: 'flex', alignItems: 'center', padding: '0 10px',
                                        fontSize: 12, color: '#e4e4e7', overflow: 'hidden',
                                        whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
                                      }}
                                      dangerouslySetInnerHTML={{ __html: renderVarChipsHTML(val) }}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        )}
                      </div>
                    )}

                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'appointmentConfig' ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0 }}>Configure Appointment</h4>
                      <button type="button" onClick={() => { setPanelStage('options'); setAppointmentConfig({}); }}
                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginBottom: 14, fontWeight: 600 }}>
                      {appointmentConfig.key === 'create_appointment' && 'Set up the appointment details. Fields can reference variables like {caller_name}.'}
                      {appointmentConfig.key === 'search_appointments' && 'Define search criteria to find appointments.'}
                      {appointmentConfig.key === 'update_appointment' && 'Select appointment fields to update.'}
                      {appointmentConfig.key === 'delete_appointment' && 'Set cancellation criteria.'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Client Name */}
                      {(appointmentConfig.key === 'create_appointment') && (
                        <div>
                          <label style={sbLabelStyle}>Client Name</label>
                          <input type="text" value={appointmentConfig.client_name || ''}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, client_name: e.target.value })}
                            placeholder="e.g. {caller_name} or Maria Santos"
                            style={sbInputStyle} />
                        </div>
                      )}
                      {/* Date */}
                      {(appointmentConfig.key === 'create_appointment' || appointmentConfig.key === 'search_appointments') && (
                        <div>
                          <label style={sbLabelStyle}>Date</label>
                          <input type="date" value={appointmentConfig.date || ''}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, date: e.target.value })}
                            style={sbInputStyle} />
                        </div>
                      )}
                      {/* Time */}
                      {appointmentConfig.key === 'create_appointment' && (
                        <div>
                          <label style={sbLabelStyle}>Time</label>
                          <input type="time" value={appointmentConfig.time || ''}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, time: e.target.value })}
                            style={sbInputStyle} />
                        </div>
                      )}
                      {/* Duration */}
                      {appointmentConfig.key === 'create_appointment' && (
                        <div>
                          <label style={sbLabelStyle}>Duration</label>
                          <select value={appointmentConfig.duration || 30}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, duration: Number(e.target.value) })}
                            style={sbInputStyle}>
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                          </select>
                        </div>
                      )}
                      {/* Status filter for search */}
                      {appointmentConfig.key === 'search_appointments' && (
                        <div>
                          <label style={sbLabelStyle}>Status Filter</label>
                          <select value={appointmentConfig.status || 'any'}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, status: e.target.value })}
                            style={sbInputStyle}>
                            <option value="any">Any Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      )}
                      {/* Notes */}
                      {appointmentConfig.key === 'create_appointment' && (
                        <div>
                          <label style={sbLabelStyle}>Notes</label>
                          <textarea value={appointmentConfig.notes || ''}
                            onChange={e => setAppointmentConfig({ ...appointmentConfig, notes: e.target.value })}
                            placeholder="e.g. {caller_reason} or Website consultation"
                            rows={2}
                            style={{ ...sbInputStyle, resize: 'none' }} />
                        </div>
                      )}
                    </div>
                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'scheduleConfig' ? (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 800, color: '#fff', margin: 0 }}>Schedule</h4>
                      <button type="button" onClick={() => { setPanelStage('options'); setScheduleConfig({}); }}
                        style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div style={{ fontSize: 10, color: '#71717a', marginBottom: 14, fontWeight: 600 }}>
                      {scheduleConfig.key === 'specific_time' && 'Set a specific date and time to trigger this flow once.'}
                      {scheduleConfig.key === 'recurring_daily' && 'This flow will run every day at the specified time.'}
                      {scheduleConfig.key === 'recurring_weekly' && 'Select days of the week and a time to run this flow.'}
                      {scheduleConfig.key === 'appointment_reminder' && 'Trigger this flow a set number of minutes before an appointment.'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Date picker for specific_time */}
                      {scheduleConfig.key === 'specific_time' && (
                        <div>
                          <label style={sbLabelStyle}>Date</label>
                          <input type="date" value={scheduleConfig.date || ''}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, date: e.target.value })}
                            style={sbInputStyle} />
                        </div>
                      )}
                      {/* Time picker for all except appointment_reminder */}
                      {scheduleConfig.key !== 'appointment_reminder' && (
                        <div>
                          <label style={sbLabelStyle}>Time</label>
                          <input type="time" value={scheduleConfig.time || '09:00'}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                            style={sbInputStyle} />
                        </div>
                      )}
                      {/* Timezone */}
                      {scheduleConfig.key !== 'appointment_reminder' && (
                        <div>
                          <label style={sbLabelStyle}>Timezone</label>
                          <select value={scheduleConfig.timezone || 'America/New_York'}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, timezone: e.target.value })}
                            style={sbInputStyle}>
                            <option value="America/New_York">Eastern Time</option>
                            <option value="America/Chicago">Central Time</option>
                            <option value="America/Denver">Mountain Time</option>
                            <option value="America/Los_Angeles">Pacific Time</option>
                          </select>
                        </div>
                      )}
                      {/* Days of week for recurring_weekly */}
                      {scheduleConfig.key === 'recurring_weekly' && (
                        <div>
                          <label style={sbLabelStyle}>Days</label>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                              const isSelected = (scheduleConfig.days_of_week || []).includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const current = scheduleConfig.days_of_week || [];
                                    const updated = isSelected
                                      ? current.filter(d => d !== day)
                                      : [...current, day];
                                    setScheduleConfig({ ...scheduleConfig, days_of_week: updated });
                                  }}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: 6,
                                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                    background: isSelected ? 'rgba(56,189,248,0.15)' : 'rgba(0,0,0,0.4)',
                                    color: isSelected ? '#38bdf8' : '#71717a',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* Minutes before for appointment_reminder */}
                      {scheduleConfig.key === 'appointment_reminder' && (
                        <div>
                          <label style={sbLabelStyle}>Minutes Before Appointment</label>
                          <select value={scheduleConfig.reminder_minutes || 30}
                            onChange={e => setScheduleConfig({ ...scheduleConfig, reminder_minutes: Number(e.target.value) })}
                            style={sbInputStyle}>
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={120}>2 hours</option>
                            <option value={1440}>1 day</option>
                          </select>
                        </div>
                      )}
                    </div>
                    {/* Config auto-saves to node on every field change — no Save button needed */}
                  </div>
                ) : panelStage === 'options' ? (
                  filteredOptions.length === 0 ? (
                    <div className="sb-panel-empty" style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No components found</div>
                  ) : (
                    filteredOptions.map((option, index) => {
                      const hasChildren = option.sub_options?.length > 0;
                      const OptionIcon = option.icon || categoryMeta.icon;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          className="sb-panel-action-card"
                          style={{ animationDelay: `${index * 0.04}s` }}
                          onClick={() => handleOptionClick(option)}
                        >
                          <div
                            className="sb-panel-action-icon"
                            style={{ backgroundColor: `${categoryMeta.accent}15`, color: categoryMeta.accent }}
                          >
                            <OptionIcon size={20} />
                          </div>
                          <div className="sb-panel-action-info">
                            <strong className="sb-panel-action-label">{option.option}</strong>
                            <span className="sb-panel-action-detail">{option.description}</span>
                          </div>
                          {hasChildren && <ChevronRight size={18} style={{ opacity: 0.4, marginLeft: 'auto' }} />}
                        </button>
                      );
                    })
                  )
                ) : filteredSubOptions.length === 0 ? (
                  <div className="sb-panel-empty" style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No components found</div>
                ) : (
                  filteredSubOptions.map((subOption, index) => {
                    const SubIcon = activeOption?.icon || categoryMeta.icon;
                    return (
                      <button
                        key={subOption.key}
                        type="button"
                        className="sb-panel-action-card"
                        style={{ animationDelay: `${index * 0.04}s` }}
                        onClick={() => handleSubOptionClick(subOption)}
                      >
                        <div
                        className="sb-panel-action-icon"
                        style={{ backgroundColor: `${categoryMeta.accent}15`, color: categoryMeta.accent }}
                      >
                        <SubIcon size={20} />
                      </div>
                      <div className="sb-panel-action-info">
                        <strong className="sb-panel-action-label">{subOption.name}</strong>
                        <span className="sb-panel-action-detail">{subOption.description}</span>
                      </div>
                      <ChevronRight size={18} style={{ opacity: 0.4, marginLeft: 'auto' }} />
                    </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Variables pane — rendered outside selection panel (overflow: hidden clips it otherwise) */}
        {['actionConfig', 'appointmentConfig', 'scheduleConfig'].includes(panelStage) && (
          <VariablesPane
            visible={varsPane.visible}
            targetFieldKey={varsPane.fieldKey}
            fieldLabel={varsPane.fieldLabel}
            onInsertVariable={handleInsertVariable}
            onInsertSmartAction={handleInsertSmartAction}
            smartActions={getSmartActions(findParentTriggerKey(selectedNodeId), currentActionKey)}
            onTableHover={(color) => setHoveredTableColor(color)}
            onClose={() => { setVarsPane({ visible: false, fieldKey: '', fieldLabel: '', fieldType: 'text' }); setHoveredTableColor(''); }}
            nodes={nodes}
            edges={edges}
            currentNodeId={selectedNodeId}
            style={{
              position: 'absolute',
              top: panelStyle.top,
              left: Math.max(10, (panelStyle.left || 0) - 228 - 8),
              height: 640,
            }}
          />
        )}

        {logicPanel && (
          <AetherEdgeLogic
            style={{ top: logicPanel.top, left: logicPanel.left }}
            conditions={edgeRules}
            onAddRule={() => addEdgeRule('and')}
            onAddOrRule={() => addEdgeRule('or')}
            onRemoveRule={removeEdgeRule}
            onUpdateRule={updateEdgeRule}
            onSave={saveLogicPanel}
            onClose={closeLogicPanel}
            contextType={logicContextType}
            availableVariables={logicAvailableVars}
            fallbackAction={logicFallbackAction}
            onFallbackChange={(val) => setLogicFallbackAction(val)}
            isFallback={logicIsFallback}
            onToggleFallback={(val) => setLogicIsFallback(val)}
          />
        )}
        
        {/* Back button for builder view */}
        <button 
          className="back-to-list-btn" 
          onClick={handleBackToList}
          style={{ position: 'absolute', top: 16, left: 16, zIndex: 100 }}
        >
          <ChevronLeft size={16} />
          Back to Scenarios
        </button>
        
        {/* Save button for builder view */}
        <button 
          className="save-scenario-btn" 
          onClick={handleSaveScenario}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 100 }}
        >
          <Check size={16} />
          {currentScenario ? 'Save' : 'Save Scenario'}
        </button>
        
        {/* Bottom Toolbar — shown after intro node is configured */}
        {nodes[0]?.configured && (
          <div className="sb-bottom-toolbar">
            <div className="sb-toolbar-inner">
            {/* Power toggle */}
            <div className="sb-toolbar-toggle-group">
              <button
                type="button"
                className={`sb-toolbar-switch ${scenarioIsActive ? 'active' : ''}`}
                onClick={handleToggleRecurring}
              >
                <div className="sb-toolbar-switch-thumb" />
              </button>
            </div>
            
            {/* Schedule — only for No Trigger */}
            {noTriggerActive && (
              <button
                type="button"
                className="sb-toolbar-schedule"
                onClick={() => setShowScheduleModal(true)}
              >
                <Clock size={12} />
                <span>{formatScheduleDisplay(recurringSchedule)}</span>
              </button>
            )}
            
            {/* Notes */}
            <button
              type="button"
              className="sb-toolbar-icon-btn"
              onClick={() => setShowNotesModal(true)}
              title="Notes"
            >
              <Pencil size={13} />
            </button>
          </div>
        </div>
        )}
        
        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="sb-schedule-modal-overlay" onClick={() => setShowScheduleModal(false)}>
            <div className="sb-schedule-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-schedule-modal-header">
                <div className="sb-schedule-modal-title">
                  <Clock size={14} />
                  Schedule
                </div>
                <button type="button" className="sb-schedule-modal-close" onClick={() => setShowScheduleModal(false)}>
                  <X size={14} />
                </button>
              </div>
              
              <div className="sb-schedule-modal-body">
                {/* Frequency dropdown */}
                <div className="sb-schedule-field">
                  <label className="sb-schedule-label">Frequency</label>
                  <select
                    className="sb-input-field sb-select-field"
                    value={recurringSchedule.frequency}
                    onChange={e => setRecurringSchedule(prev => ({ ...prev, frequency: e.target.value }))}
                  >
                    <option value="once">Run Once</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                
                {/* Scheduling options — hidden for "Run Once" */}
                {recurringSchedule.frequency !== 'once' && (
                <>
                {/* Interval */}
                <div className="sb-schedule-field">
                  <label className="sb-schedule-label">
                    Every
                  </label>
                  <div className="sb-schedule-input-row">
                    <input
                      className="sb-input-field sb-schedule-num-input"
                      type="number"
                      min={1}
                      max={recurringSchedule.frequency === 'hourly' ? 24 : recurringSchedule.frequency === 'daily' ? 365 : 52}
                      value={recurringSchedule.interval}
                      onChange={e => setRecurringSchedule(prev => ({ ...prev, interval: Math.max(1, parseInt(e.target.value) || 1) }))}
                    />
                    <span className="sb-schedule-unit">
                      {recurringSchedule.frequency === 'hourly' ? 'hours' :
                       recurringSchedule.frequency === 'daily' ? 'days' :
                       recurringSchedule.frequency === 'weekly' ? 'weeks' :
                       recurringSchedule.frequency === 'monthly' ? 'months' : 'years'}
                    </span>
                  </div>
                </div>
                
                {/* Time picker (not for hourly) */}
                {recurringSchedule.frequency !== 'hourly' && (
                  <div className="sb-schedule-field">
                    <label className="sb-schedule-label">Time</label>
                    <input
                      className="sb-input-field"
                      type="time"
                      value={recurringSchedule.time}
                      onChange={e => setRecurringSchedule(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                )}
                
                {/* Days of week (weekly only) */}
                {recurringSchedule.frequency === 'weekly' && (
                  <div className="sb-schedule-field">
                    <label className="sb-schedule-label">Days</label>
                    <div className="sb-schedule-days">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => {
                        const isSelected = (recurringSchedule.daysOfWeek || []).includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`sb-schedule-day-btn ${isSelected ? 'active' : ''}`}
                            onClick={() => {
                              setRecurringSchedule(prev => {
                                const current = prev.daysOfWeek || [];
                                const updated = isSelected ? current.filter(d => d !== day) : [...current, day];
                                return { ...prev, daysOfWeek: updated };
                              });
                            }}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
              
              <div className="sb-schedule-modal-footer">
                <button className="sb-schedule-cancel-btn" onClick={() => setShowScheduleModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Notes Modal */}
        {showNotesModal && (
          <div className="sb-notes-modal-overlay" onClick={() => setShowNotesModal(false)}>
            <div className="sb-notes-modal" onClick={e => e.stopPropagation()}>
              <div className="sb-notes-modal-header">
                <div className="sb-notes-modal-title">
                  <Pencil size={14} />
                  Notes
                </div>
                <button type="button" className="sb-notes-modal-close" onClick={() => setShowNotesModal(false)}>
                  <X size={14} />
                </button>
              </div>
              
              <div className="sb-notes-modal-body">
                <textarea
                  className="sb-input-field sb-notes-textarea"
                  value={scenarioNotes}
                  onChange={e => setScenarioNotes(e.target.value)}
                  placeholder="Add notes about this scenario..."
                  rows={6}
                />
              </div>
              
              <div className="sb-notes-modal-footer">
                <button className="sb-schedule-cancel-btn" onClick={() => setShowNotesModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
        {showSaveModal && (
          <div className="save-scenario-modal-overlay">
            <div className="save-scenario-modal">
              <div className="save-scenario-modal-header">
                <h3>Save Scenario</h3>
                <button className="modal-close-btn" onClick={handleCancelSaveScenario}>
                  <X size={18} />
                </button>
              </div>
              
              <div className="save-scenario-modal-body">
                <div className="form-group">
                  <label htmlFor="scenario-name">Scenario Name</label>
                  <input
                    id="scenario-name"
                    type="text"
                    className="sb-input-field"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Enter scenario name..."
                    autoFocus
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="scenario-description">Description (optional)</label>
                  <textarea
                    id="scenario-description"
                    className="sb-input-field"
                    value={scenarioDescription}
                    onChange={(e) => setScenarioDescription(e.target.value)}
                    placeholder="Describe what this scenario does..."
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="save-scenario-modal-footer">
                <button className="modal-cancel-btn" onClick={handleCancelSaveScenario}>
                  Cancel
                </button>
                <button className="modal-save-btn" onClick={handleConfirmSaveScenario}>
                  <Check size={16} />
                  Save Scenario
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="scenarios-container">
      {viewMode === 'list' ? renderListView() : renderBuilderView()}
      
      {/* Delete Confirmation Modal - Rendered at root level */}
      {deleteConfirmModal && (
        <div className="delete-confirm-overlay" onClick={handleCancelDelete}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">
                <Trash2 size={20} />
              </div>
              <h3 className="delete-confirm-title">Delete Scenario</h3>
            </div>
            
            <p className="delete-confirm-message">
              Are you sure you want to delete "{window.selectedScenarioForDelete?.name}"? 
              This action cannot be undone.
            </p>
            
            <div className="delete-confirm-actions">
              <button className="delete-cancel-btn" onClick={handleCancelDelete}>
                Cancel
              </button>
              <button className="delete-confirm-btn" onClick={handleConfirmDelete}>
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
