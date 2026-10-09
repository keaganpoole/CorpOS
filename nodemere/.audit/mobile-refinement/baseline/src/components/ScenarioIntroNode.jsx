import React, { useCallback, useEffect, useState } from 'react';
import './ScenarioIntroNode.css';

/**
 * The original Scenarios quantum intro node, extracted so other focused flows
 * can use the exact same animation and replay behavior.
 */
export default function ScenarioIntroNode({
  nodeId = 'node-1',
  nodeRef,
  circleRef,
  onPointerDown,
  onActivate,
  ariaLabel = 'Begin scenario',
}) {
  const [quantumOrbits, setQuantumOrbits] = useState({});

  // Trigger quantum orbit rings on an unconfigured node.
  const triggerQuantumOrbit = useCallback((introNodeId) => {
    const rings = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      size: 140 + i * 18,
      delay: i * 0.05,
    }));
    setQuantumOrbits((prev) => ({ ...prev, [introNodeId]: rings }));
    setTimeout(() => {
      setQuantumOrbits((prev) => {
        const next = { ...prev };
        delete next[introNodeId];
        return next;
      });
    }, 1500);
  }, []);

  // Fire orbit rings once as intro — rings FIRST, then circle fades in.
  useEffect(() => {
    const timer = setTimeout(() => triggerQuantumOrbit(nodeId), 200);
    return () => clearTimeout(timer);
  }, [nodeId, triggerQuantumOrbit]);

  return (
    <div className="sb-quantum-centering" aria-label={ariaLabel}>
      <div className="sb-quantum-container-fade">
        <div
          className="sb-builder-node"
          ref={nodeRef}
          onPointerDown={onPointerDown}
          onClick={onActivate}
          role={onActivate ? 'button' : undefined}
          tabIndex={onActivate ? 0 : undefined}
          onKeyDown={onActivate ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onActivate(event);
            }
          } : undefined}
        >
          <div className="sb-quantum-composition">
            <div className="sb-quantum-orbits">
              {(quantumOrbits[nodeId] || []).map((ring) => (
                <div
                  key={ring.id}
                  className="sb-quantum-orbit-ring"
                  style={{ width: ring.size, height: ring.size, animationDelay: `${ring.delay}s` }}
                />
              ))}
            </div>
            <div className="sb-quantum-circle" ref={circleRef} />
            <div className="sb-quantum-arrow" />
            <div className="sb-quantum-cta-text">Click it. Click it real good.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
