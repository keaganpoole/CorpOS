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
} from 'lucide-react';
import './Scenarios.css';
import AetherEdgeLogic from './AetherEdgeLogic';
import { supabase } from '../../lib/supabase';

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
};

const AUTOMATION_HIERARCHY = {
  TRIGGERS: [
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
  ],
  ACTIONS: [
    {
      key: 'phone_calls',
      option: 'Phone Calls',
      description: 'Call or manage phone calls',
      accent: '#38bdf8',
      icon: OPTION_ICONS.phone_calls,
      sub_options: [
        { key: 'call_customer', name: 'Call Customer', description: 'Call an existing customer' },
        { key: 'call_phone_number', name: 'Call Phone Number', description: 'Call a specific number' },
      ],
    },
    {
      key: 'text_messaging',
      option: 'Text Messaging',
      description: 'Send or manage SMS messages',
      accent: '#38bdf8',
      icon: OPTION_ICONS.text_messaging,
      sub_options: [
        { key: 'send_to_phone_number', name: 'Send To Phone Number', description: 'Send SMS to any number' },
        { key: 'send_to_customer', name: 'Send To Customer', description: 'Send SMS to an existing customer' },
      ],
    },
    {
      key: 'call_routing',
      option: 'Call Routing',
      description: 'Control where calls go',
      accent: '#38bdf8',
      icon: OPTION_ICONS.call_routing,
      sub_options: [
        { key: 'transfer_to_phone_number', name: 'Transfer To Phone Number', description: 'Forward call to a specific number' },
        { key: 'transfer_to_department', name: 'Transfer To Department', description: 'Route call to a department' },
        { key: 'transfer_to_staff_member', name: 'Transfer To Staff Member', description: 'Send call to a staff member' },
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
        { key: 'search_records', name: 'Search Records', description: 'Find customer records' },
        { key: 'create_new_record', name: 'Create New Record', description: 'Create a new customer record' },
        { key: 'update_record', name: 'Update Record', description: 'Modify an existing customer record' },
        { key: 'delete_record', name: 'Delete Record', description: 'Permanently delete a customer record' },
      ],
    },
    {
      key: 'appointments',
      option: 'Appointments',
      description: 'Create or manage appointments',
      accent: '#38bdf8',
      icon: OPTION_ICONS.appointments,
      sub_options: [
        { key: 'create_appointment', name: 'Create Appointment', description: 'Schedule a new appointment' },
        { key: 'search_appointments', name: 'Search Appointments', description: 'Find existing appointments' },
        { key: 'update_appointment', name: 'Update Appointment', description: 'Change details of an appointment' },
        { key: 'delete_appointment', name: 'Delete Appointment', description: 'Cancel and remove an appointment' },
      ],
    },
    {
      key: 'email',
      option: 'Email',
      description: 'Manage email',
      accent: '#38bdf8',
      icon: OPTION_ICONS.email,
      sub_options: [{ key: 'send_email', name: 'Send Email', description: 'Send an email' }],
    },
    {
      key: 'tags',
      option: 'Tags',
      description: 'Manage record tags',
      accent: '#38bdf8',
      icon: OPTION_ICONS.tags,
      sub_options: [
        { key: 'add_tag', name: 'Add Tag', description: 'Attach tag to record' },
        { key: 'search_tags', name: 'Search Tags', description: 'Find existing tags' },
        { key: 'update_tag', name: 'Update Tag', description: 'Update an existing tag' },
        { key: 'delete_tag', name: 'Delete Tag', description: 'Remove a tag permanently' },
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
const INITIAL_NODE_SHIFT = 140;

export default function ScenariosPage() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'builder'
  const [scenarios, setScenarios] = useState([]); // List of saved scenarios
  const [nodes, setNodes] = useState([INITIAL_NODE]);
  const [edges, setEdges] = useState([]);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
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
  const [edgeRules, setEdgeRules] = useState([
    { id: 1, variable: 'status', operator: 'equals', value: '' },
  ]);
  const edgeRulesRef = useRef(edgeRules);
  
  // Save scenario modal state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
  
  // Track currently loaded scenario
  const [currentScenario, setCurrentScenario] = useState(null);
  
  // Fade-in animation state
  const [nodesOpacity, setNodesOpacity] = useState(1);

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
  const dragRef = useRef({ id: null, moved: false, startX: 0, startY: 0, nodeX: 0, nodeY: 0, scale: 1 });
  const panRef = useRef(null);
  const nodeIdCounter = useRef(1);
  const edgeIdCounter = useRef(1);
  
  // Keep ref in sync with state
  useEffect(() => {
    edgeRulesRef.current = edgeRules;
  }, [edgeRules]);

  const nodeMap = useMemo(() => nodes.reduce((acc, node) => ({ ...acc, [node.id]: node }), {}), [nodes]);
  const selectedNode = selectedNodeId ? nodeMap[selectedNodeId] : null;

  const isPrimaryNode = selectedNodeId === INITIAL_NODE.id;

  useEffect(() => {
    if (!selectedNodeId) return;
    const defaultCategory = isPrimaryNode ? selectedNode?.categoryType || 'TRIGGERS' : 'ACTIONS';
    setPanelStage('options');
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
    const builderRect = builderRef.current?.getBoundingClientRect();
    const startNode = nodeMap[INITIAL_NODE.id];
    if (!builderRect || !startNode) return;
    const targetScale = 1.15;
    const centerX = builderRect.width / 2;
    const centerY = builderRect.height / 2;
    setView({
      x: centerX / targetScale - startNode.x,
      y: centerY / targetScale - startNode.y,
      scale: targetScale,
    });
    setInitialFocusSet(true);
  }, [initialFocusSet, nodeMap]);

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
  const visibleCategories = isPrimaryNode
    ? PANEL_CATEGORIES
    : PANEL_CATEGORIES.filter((category) => category !== 'TRIGGERS');
  const BannerIcon = activeOption?.icon || categoryMeta.icon;
  const bannerCategoryLabel = (PANEL_CATEGORY_LABELS[panelCategory] || panelCategory).toUpperCase();
  const showNodeConfigText = panelStage !== 'subOptions';

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
    const panelWidth = 480;
    const panelHeight = 760;
    
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

  const openSelectionPanel = useCallback(
    (nodeId) => {
      setPanelIntent(true);
      if (nodeId === INITIAL_NODE.id && !initialNodeShifted) {
        setNodes((prev) =>
          prev.map((node) =>
            node.id === INITIAL_NODE.id ? { ...node, x: node.x - INITIAL_NODE_SHIFT } : node
          )
        );
        setInitialNodeShifted(true);
      }
      setSelectedNodeId(nodeId);
      setLogicPanel(null);
    },
    [initialNodeShifted]
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
  }, [nodeMap, openSelectionPanel, view.x, view.y, view.scale]);

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
    const newNode = {
      id: nextId,
      x: parent.x + 280,
      y: parent.y + yOffset,
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
  }, [selectedNodeId]);

  const addEdgeRule = useCallback(() => {
    setEdgeRules((prev) => [
      ...prev,
      { id: Date.now(), variable: 'status', operator: 'equals', value: '' },
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
  }, [logicPanel]);

  const closeLogicPanel = useCallback(() => {
    setLogicPanel(null);
  }, []);

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

  const handleSubOptionClick = (subOption) => {
    const subIcon = activeOption?.icon || categoryMeta.icon;
    const subAccent = activeOption?.accent || categoryMeta.accent;
    finalizeSelection(subOption.name, subOption.description, subIcon, panelCategory, subAccent);
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
    
    // Load existing filter rules into edgeRules state
    const newRules = edge.filter && edge.filter.rules 
      ? edge.filter.rules 
      : [{ id: Date.now(), variable: 'status', operator: 'equals', value: '' }];
    
    // Update the ref immediately
    edgeRulesRef.current = newRules;
    setEdgeRules(newRules);
    
    setLogicPanel({ edgeId: edge.id, top, left });
  };

  const handlePagePointerDown = (event) => {
    if (
      event.target.closest('.sb-selection-panel') ||
      event.target.closest('.aether-logic-wrapper') ||
      event.target.closest('.sb-node-add')
    )
      return;
    if (!event.target.closest('.sb-builder-node')) {
      setSelectedNodeId(null);
      setIsPanelVisible(false);
      setPanelIntent(false);
    }
    setLogicPanel(null);
  };

  const handleCreateScenario = () => {
    // Reset builder state to initial state
    setNodes([INITIAL_NODE]);
    setEdges([]);
    setView({ x: 0, y: 0, scale: 1 });
    setSelectedNodeId('node-1');
    setEdgeRules([{ id: 1, variable: 'status', operator: 'equals', value: '' }]);
    setLogicPanel(null);
    setIsPanelVisible(false);
    setPanelIntent(false);
    setPanelStage('options');
    setActiveOption(null);
    
    // Clear current scenario
    setCurrentScenario(null);
    
    // Switch to builder view with fade-in
    setViewMode('builder');
    setNodesOpacity(0);
    setTimeout(() => {
      setNodesOpacity(1);
    }, 50);
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
        
        // Center the view on the nodes
        const viewX = -centerX + 400; // Center in canvas
        const viewY = -centerY + 300;
        
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
        icon: n.icon?.name
      })),
      edges_data: edges.map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        filter: e.filter
      })),
      status: 'active'
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
        .select()
        .single();
      
      result = { data, error };
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

  const builderView = (
    <div className="scenario-builder-page" ref={builderRef} onPointerDown={handlePagePointerDown}>
      <div className="sb-canvas-wrapper">
        <div
          className="sb-canvas"
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onWheel={handleWheel}
        >
          <div className="sb-canvas-grid" />
          <div
            className="sb-canvas-viewport"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
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
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const path = `M ${from.x} ${from.y} C ${from.x + dx/2} ${from.y}, ${from.x + dx/2} ${to.y}, ${to.x} ${to.y}`;

                return (
                  <path
                    key={edge.id}
                    d={path}
                    className={`sb-edge-line ${isDraft ? 'sb-edge-draft' : ''}`}
                    fill="none"
                    markerEnd={!isDraft ? "url(#sb-arrowhead)" : ""}
                  />
                );
              })}
            </svg>
            
            {edges.map((edge) => {
              const from = nodeMap[edge.from];
              const to = nodeMap[edge.to];
              if (!from || !to) return null;
              const midX = (from.x + to.x) / 2;
              const midY = (from.y + to.y) / 2;
              return (
                <div
                  key={`filter-${edge.id}`}
                  className={`sb-filter-pin ${edge.filter ? 'has-filter' : ''}`}
                  style={{ left: midX, top: midY }}
                  onClick={(event) => handleEdgeLogicClick(edge, event)}
                >
                  <div className="sb-filter-label">
                    {edge.filter ? (
                      <Zap size={10} />
                    ) : (
                      'Condition'
                    )}
                  </div>
                  <div className="sb-filter-dot" />
                </div>
              );
            })}
            
            {nodes.map((node) => {
              const Icon = node.icon;
              const isActive = selectedNodeId === node.id;
              const isInitialNode = node.id === INITIAL_NODE.id && initialPulse;
              return (
                <div
                  key={node.id}
                  ref={(el) => {
                    if (el) nodeRefs.current[node.id] = el;
                    else delete nodeRefs.current[node.id];
                  }}
                  className={`sb-builder-node ${node.type === 'router' ? 'router-node' : ''} ${
                    isActive ? 'sb-active-node' : ''
                  } ${node.configured ? 'sb-is-configured' : 'sb-is-placeholder'} ${isInitialNode ? 'sb-initial-pulse' : ''}`}
                  style={{ left: node.x, top: node.y, opacity: nodesOpacity, transition: 'opacity 0.3s ease' }}
                  onPointerDown={(event) => handleNodePointerDown(node.id, event)}
                >
                  {isInitialNode && <div className="sb-aether-track" />}
                  
                  <div className="sb-node-glow" style={{ background: node.accent }} />
                  <div
                    className="sb-node-core"
                    style={{ '--node-accent': node.accent || 'var(--sb-accent-primary)' }}
                  >
                    <div className="sb-node-icon-wrapper" style={{ color: node.accent }}>
                      {Icon ? <Icon size={22} /> : <Plus size={22} />}
                    </div>
                    <div className="sb-node-content">
                      <p className="sb-node-category">{node.detail || 'Step'}</p>
                      <h4 className="sb-node-title">{node.label}</h4>
                    </div>
                    {node.configured && (
                      <button className="sb-node-add" type="button" onClick={() => handleAddNode(node.id)}>
                        <Plus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
              <div className="sb-panel-actions">
                {panelStage === 'options' ? (
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

        {logicPanel && (
          <AetherEdgeLogic
            style={{ top: logicPanel.top, left: logicPanel.left }}
            conditions={edgeRules}
            onAddRule={addEdgeRule}
            onRemoveRule={removeEdgeRule}
            onUpdateRule={updateEdgeRule}
            onSave={saveLogicPanel}
            onClose={closeLogicPanel}
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
        
        {/* Save Scenario Modal */}
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
      {viewMode === 'list' ? renderListView() : builderView}
      
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
