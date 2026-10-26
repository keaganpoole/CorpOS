import {
  Phone,
  User,
  Bell,
  Zap,
  Plus,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  Repeat,
  Webhook,
  Check,
  Eye,
  EyeOff,
  Copy,
  Pencil,
  GitBranch,
  Sparkles,
  Filter,
  Database,
  Hash,
  Code,
  RectangleEllipsis,
  ShieldCheck,
  Upload,
  CircleHelp,
  LockKeyhole,
} from 'lucide-react';

import React from 'react';
export default function ScenarioNode({node,selected=false,status=null,active=false,completed=false,future=false,unrelated=false,hasOutgoingNode=false}){
const Icon=node.icon, accent=node.accent, nodeRunState=status,isActive=selected,isRunActiveNode=active,isPaymentLockedNode=false;
return <div className={`sb-builder-node sb-matte-node sb-is-configured ${selected?'sb-active-node':''} ${active?'sb-run-node-active':''} ${completed?'sb-run-node-complete':''} ${future?'sb-run-node-future':''} ${unrelated?'sb-run-node-unrelated':''}`} style={{left:node.x,top:node.y}}>

                    <>
                      <div className="sb-node-inner-wrap" >
                        {/* Outer Ring / Aura — exact from concepts.txt */}
                        <div className={`sb-node-aura ${accent ? 'sb-node-custom-gradient' : ''}`}
                          style={accent ? { '--node-accent-color': accent } : {}}
                        />

                        {/* Outer Boundary Stroke — Concentric design */}
                        <div className="sb-node-ring" />

                        {/* The Primary Gradient Sphere */}
                        <div
                          className={`sb-node-sphere ${isActive ? 'sb-sphere-active' : ''} ${nodeRunState ? `is-${nodeRunState}` : ''} ${isRunActiveNode ? 'is-scenario-running' : ''}`}
                          style={{ '--node-accent-color': accent }}
                        >
                          {(nodeRunState === 'running' || isRunActiveNode) && (
                            <div className="sb-node-run-overlay" aria-hidden="true">
                              <span className="sb-node-run-wave w1" />
                              <span className="sb-node-run-wave w2" />
                              <span className="sb-node-run-wave w3" />
                            </div>
                          )}
                          {(nodeRunState === 'success' || nodeRunState === 'empty') && (
                            <div className={`sb-node-run-resolve is-${nodeRunState}`} aria-hidden="true" />
                          )}
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
                        <div className={`sb-node-icon-glass ${nodeRunState ? `is-${nodeRunState}` : ''}`}>
                          <div className={`sb-node-icon-glyph ${nodeRunState === 'success' ? 'is-hidden' : ''}`}>
                            {Icon ? <Icon size={34} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} /> : <Plus size={34} className="text-white" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} strokeWidth={1.5} />}
                          </div>
                          {nodeRunState === 'success' && (
                            <div className="sb-node-run-status is-success" aria-hidden="true">
                              <Check size={34} strokeWidth={2.8} />
                            </div>
                          )}
                          {nodeRunState === 'empty' && (
                            <div className="sb-node-run-status is-empty" aria-hidden="true">
                              <span>?</span>
                            </div>
                          )}
                        </div>

                        {/* Pulse Effect for Activity */}
                        <div className="sb-node-pulse-dot" />
                        {isRunActiveNode && <div className="sb-node-live-marker" aria-hidden="true" />}

                        {/* Add button */}
                        {!hasOutgoingNode && (
                          <button
                            className="sb-node-add"
                            type="button"
                            
                            
                            
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>

                      {/* Label below — typography from concepts.txt */}
                      <div className="sb-node-label-below">
                        <h3 className="sb-node-below-title">{node.label}</h3>
                        {node.detail && <p className="sb-node-below-desc">{node.detail}</p>}
                        {isPaymentLockedNode && (
                          <span className="sb-payment-badge-wrapper"><span className="sb-payment-unlock-badge"><LockKeyhole size={10} /> Unlock with <span className="sb-payment-pro-text">Pro</span></span></span>
                        )}
                      </div>

                      {/* Connecting Line Indicator */}
                      <div className="sb-node-connector-line" />
                    </>
</div>;}