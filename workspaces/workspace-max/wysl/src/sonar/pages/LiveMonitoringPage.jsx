import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as d3 from 'd3';
import { sankey, sankeyJustify, sankeyLinkHorizontal } from 'd3-sankey';
import {
  Activity,
  CalendarDays,
  CreditCard,
  Phone,
  UserRoundPlus,
} from 'lucide-react';

const COLORS = {
  source: '#00f2ff',
  middle: '#7000ff',
  target: '#ff00d4',
  text: '#ffffff',
};

const OPACITY = {
  linkInitial: 0.24,
  linkHover: 0.54,
  linkDimmed: 0.045,
  nodeDimmed: 0.18,
};

const analyticsSeed = [
  { label: 'Total Calls', value: 3872, delta: '+12.8%', icon: Phone, series: [18, 27, 31, 24, 39, 42, 40, 55, 61, 59] },
  { label: 'Appointments', value: 2434, delta: '+8.4%', icon: CalendarDays, series: [20, 27, 30, 26, 39, 37, 47, 46, 58, 57] },
  { label: 'New Customers', value: 3218, delta: '+5.9%', icon: UserRoundPlus, series: [31, 29, 30, 36, 35, 34, 41, 40, 42, 53] },
  { label: 'Revenue', value: 68886, prefix: '$', delta: '+18.2%', icon: CreditCard, series: [21, 25, 27, 24, 35, 40, 42, 39, 44, 56] },
];

const sankeyData = {
  nodes: [
    { name: 'Incoming Calls', category: 'source', color: '#e4e4e7' },
    { name: 'Outgoing Calls', category: 'source', color: '#a1a1aa' },
    { name: 'Records', category: 'middle', color: '#32f0d9' },
    { name: 'Appointments', category: 'middle', color: '#38bdf8' },
    { name: 'Payments', category: 'middle', color: '#f59e0b' },
    { name: 'Record Created', category: 'target', color: '#32f0d9' },
    { name: 'Record Updated', category: 'target', color: '#32f0d9' },
    { name: 'Appointment Created', category: 'target', color: '#38bdf8' },
    { name: 'Appointment Updated', category: 'target', color: '#38bdf8' },
    { name: 'Appointment Cancelled', category: 'target', color: '#38bdf8' },
    { name: 'Payment Received', category: 'target', color: '#f59e0b' },
    { name: 'Invoice Sent', category: 'target', color: '#f59e0b' },
  ],
  links: [
    { source: 0, target: 2, value: 88 },
    { source: 0, target: 3, value: 176 },
    { source: 0, target: 4, value: 72 },
    { source: 1, target: 2, value: 56 },
    { source: 1, target: 3, value: 104 },
    { source: 1, target: 4, value: 48 },
    { source: 2, target: 5, value: 82 },
    { source: 2, target: 6, value: 62 },
    { source: 3, target: 7, value: 162 },
    { source: 3, target: 8, value: 78 },
    { source: 3, target: 9, value: 40 },
    { source: 4, target: 10, value: 74 },
    { source: 4, target: 11, value: 46 },
  ],
};

const nodeColor = (node) => node.color || COLORS[node.category];

const formatValue = (item, value) => {
  const body = Math.round(value).toLocaleString();
  return `${item.prefix || ''}${body}`;
};

const sparklinePoints = (series) => {
  const width = 116;
  const height = 42;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const points = series.map((point, index) => {
    const x = (index / (series.length - 1)) * width;
    const y = height - ((point - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const lastY = points[points.length - 1].split(',')[1];
  return { points: points.join(' '), area: `0,44 ${points.join(' ')} 116,44`, lastY };
};

function AnalyticsCard({ item, value, index }) {
  const Icon = item.icon;
  const line = sparklinePoints(item.series);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className="live-stat-card"
    >
      <div className="live-stat-head">
        <p className="live-stat-label">{item.label}</p>
        <div className="live-stat-icon">
          <Icon size={15} />
        </div>
      </div>
      <div className="live-stat-value-row">
        <span className="live-stat-value">{formatValue(item, value)}</span>
        <span className="live-stat-delta">{item.delta}</span>
      </div>
      <div className="live-stat-chart-row">
        <svg className="live-stat-line" viewBox="0 0 116 44" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={`live-stat-fill-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00d69b" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#00d69b" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon className="live-stat-line-fill" points={line.area} fill={`url(#live-stat-fill-${index})`} />
          <polyline className="live-stat-line-shadow" points={line.points} />
          <polyline className="live-stat-line-path" points={line.points} />
          <circle className="live-stat-line-dot" cx="116" cy={line.lastY} r="2.5" />
        </svg>
        <span className="live-stat-menu">...</span>
      </div>
    </motion.div>
  );
}

function RealtimeSankey() {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return undefined;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(target);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!dimensions.width || !dimensions.height) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const isCompact = dimensions.width < 760;
    const margin = {
      top: isCompact ? 34 : 62,
      right: isCompact ? 112 : 190,
      bottom: isCompact ? 38 : 70,
      left: isCompact ? 112 : 190,
    };
    const width = Math.max(320, dimensions.width - margin.left - margin.right);
    const height = Math.max(320, dimensions.height - margin.top - margin.bottom);

    const defs = svg.append('defs');

    const glow = defs.append('filter')
      .attr('id', 'live-monitoring-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');

    glow.append('feGaussianBlur')
      .attr('stdDeviation', '2.6')
      .attr('result', 'blur');

    glow.append('feComposite')
      .attr('in', 'SourceGraphic')
      .attr('in2', 'blur')
      .attr('operator', 'over');

    const layout = sankey()
      .nodeWidth(2)
      .nodePadding(isCompact ? 24 : 38)
      .nodeAlign(sankeyJustify)
      .nodeSort(null)
      .extent([[0, 0], [width, height]]);

    const graph = layout({
      nodes: sankeyData.nodes.map((node) => ({ ...node })),
      links: sankeyData.links.map((link) => ({ ...link })),
    });

    graph.links.forEach((link, index) => {
      const flowColor = nodeColor(link.target);

      const gradient = defs.append('linearGradient')
        .attr('id', `live-monitoring-gradient-${index}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', link.source.x1)
        .attr('x2', link.target.x0)
        .attr('y1', link.y0)
        .attr('y2', link.y1);

      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', flowColor)
        .attr('stop-opacity', 0.28);

      gradient.append('stop')
        .attr('offset', '50%')
        .attr('stop-color', flowColor)
        .attr('stop-opacity', 0.82);

      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', flowColor)
        .attr('stop-opacity', 1);
    });

    const field = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const linkGroup = field.append('g')
      .attr('fill', 'none')
      .selectAll('g')
      .data(graph.links)
      .join('g')
      .style('mix-blend-mode', 'screen');

    const paths = linkGroup.append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (_, index) => `url(#live-monitoring-gradient-${index})`)
      .attr('stroke-width', (link) => Math.max(1, link.width))
      .attr('stroke-opacity', OPACITY.linkInitial)
      .attr('class', 'live-monitoring-sankey-link')
      .style('cursor', 'pointer');

    paths.each(function animatePath(_, index) {
      const length = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${length} ${length}`)
        .attr('stroke-dashoffset', length)
        .transition()
        .duration(1400)
        .delay(index * 28)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);
    });

    const node = field.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .attr('transform', (item) => `translate(${item.x0},${item.y0})`);

    node.append('rect')
      .attr('height', 0)
      .attr('y', (item) => (item.y1 - item.y0) / 2)
      .attr('width', (item) => item.x1 - item.x0)
      .attr('fill', (item) => nodeColor(item))
      .style('filter', 'url(#live-monitoring-glow)')
      .transition()
      .duration(900)
      .delay((_, index) => 180 + index * 28)
      .ease(d3.easeCubicOut)
      .attr('height', (item) => item.y1 - item.y0)
      .attr('y', 0);

    node.append('text')
      .attr('x', (item) => {
        if (item.category === 'source') return -16;
        if (item.category === 'target') return 16;
        return item.x0 < width / 2 ? 16 : -16;
      })
      .attr('y', (item) => (item.y1 - item.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (item) => {
        if (item.category === 'source') return 'end';
        if (item.category === 'target') return 'start';
        return item.x0 < width / 2 ? 'start' : 'end';
      })
      .text((item) => item.name)
      .style('fill', COLORS.text)
      .style('font-family', 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif')
      .style('font-size', isCompact ? '9px' : '11px')
      .style('font-weight', '700')
      .style('text-transform', 'uppercase')
      .style('letter-spacing', '0')
      .style('opacity', 0)
      .transition()
      .duration(700)
      .delay(900)
      .style('opacity', 0.9);

    const tooltip = d3.select(tooltipRef.current);

    node
      .on('mouseenter', (event, hoveredNode) => {
        const connectedLinks = new Set([...hoveredNode.sourceLinks, ...hoveredNode.targetLinks]);

        paths.transition().duration(180)
          .style('stroke-opacity', (link) => connectedLinks.has(link) ? OPACITY.linkHover : OPACITY.linkDimmed);

        node.transition().duration(180)
          .style('opacity', (candidate) => {
            const connected = candidate === hoveredNode
              || hoveredNode.sourceLinks.some((link) => link.target === candidate)
              || hoveredNode.targetLinks.some((link) => link.source === candidate);
            return connected ? 1 : OPACITY.nodeDimmed;
          });
      })
      .on('mouseleave', () => {
        paths.transition().duration(180).style('stroke-opacity', OPACITY.linkInitial);
        node.transition().duration(180).style('opacity', 1);
      });

    paths
      .on('mouseenter', (event, link) => {
        d3.select(event.currentTarget).transition().duration(160)
          .style('stroke-opacity', OPACITY.linkHover);

        tooltip
          .style('opacity', 1)
          .html(`
            <div style="font-weight:800;color:${nodeColor(link.source)}">${link.source.name}</div>
            <div style="margin:5px 0;color:#555">to</div>
            <div style="font-weight:800;color:${nodeColor(link.target)}">${link.target.name}</div>
            <div style="margin-top:9px;font-size:14px;font-weight:900;color:#fff">${link.value} calls</div>
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX + 14}px`)
          .style('top', `${event.pageY - 18}px`);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).transition().duration(160)
          .style('stroke-opacity', OPACITY.linkInitial);
        tooltip.style('opacity', 0);
      });
  }, [dimensions]);

  return (
    <section ref={containerRef} className="live-sankey-shell">
      <svg ref={svgRef} className="h-full w-full overflow-visible" />
      <div ref={tooltipRef} className="live-sankey-tooltip" />
    </section>
  );
}

export default function LiveMonitoringPage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 2300);
    return () => clearInterval(timer);
  }, []);

  const analytics = useMemo(() => analyticsSeed.map((item, index) => {
    const wave = Math.sin((tick + index * 1.7) * 0.74);
    const lift = Math.max(0, Math.round((wave + 1) * (index + 2)));
    return { ...item, liveValue: item.value + tick * (index + 1) + lift };
  }), [tick]);

  return (
    <div className="h-full overflow-hidden bg-[#020202] text-white relative">
      <style>{`
        .live-monitor-grid {
          background: #020202;
        }

        .live-monitor-grid,
        .live-monitor-grid * {
          letter-spacing: 0 !important;
        }

        .live-stat-card {
          position: relative;
          min-height: 146px;
          overflow: hidden;
          border-radius: 10px;
          border: 1px solid #1f1f22;
          background: #070707;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.025), 0 22px 48px rgba(0,0,0,0.34);
          padding: 16px;
        }

        .live-stat-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.018), transparent 52%);
          pointer-events: none;
        }

        .live-stat-head {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .live-stat-icon {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 8px;
          color: #a1a1aa;
          border: 1px solid #27272a;
          background: linear-gradient(180deg, rgba(39,39,42,0.62), rgba(24,24,27,0.35));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.055);
        }

        .live-stat-label {
          color: #7c7c84;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          line-height: 1;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .live-stat-value-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }

        .live-stat-value {
          display: block;
          color: #ffffff;
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
          white-space: nowrap;
        }

        .live-stat-delta {
          color: #18d79d;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          border-radius: 5px;
          background: rgba(0,214,155,0.12);
          padding: 4px 6px;
          line-height: 1;
        }

        .live-stat-chart-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 26px;
        }

        .live-stat-line {
          width: 116px;
          height: 44px;
          flex: 0 1 116px;
          overflow: visible;
        }

        .live-stat-line-fill {
          opacity: 1;
        }

        .live-stat-line-path,
        .live-stat-line-shadow {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .live-stat-line-shadow {
          stroke: #00d69b;
          stroke-width: 4;
          opacity: 0.14;
          filter: blur(2px);
        }

        .live-stat-line-path {
          stroke: #00d69b;
          stroke-width: 2;
          opacity: 1;
        }

        .live-stat-line-dot {
          fill: #00d69b;
          filter: drop-shadow(0 0 6px #00d69b);
        }

        .live-stat-menu {
          color: #52525b;
          font-size: 16px;
          font-weight: 900;
          line-height: 1;
          transform: translateY(-2px);
        }

        .live-sankey-shell {
          position: relative;
          min-height: 0;
          flex: 1;
          overflow: visible;
          border: 0;
          background: #020202;
          box-shadow: none;
          user-select: none;
        }

        .live-monitoring-sankey-link {
          transition: stroke-opacity 180ms ease;
        }

        .live-sankey-tooltip {
          pointer-events: none;
          position: fixed;
          z-index: 50;
          min-width: 140px;
          opacity: 0;
          border-radius: 9px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(9,9,11,0.92);
          box-shadow: 0 0 30px rgba(0,0,0,0.8);
          color: white;
          padding: 14px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          backdrop-filter: blur(18px);
          transition: opacity 160ms ease;
        }
      `}</style>

      <div className="live-monitor-grid h-full overflow-auto custom-scrollbar px-7 py-5">
        <div className="min-h-full flex flex-col gap-4">
          <header className="shrink-0 flex items-center gap-4">
            <div className="p-2.5 bg-cyan-500/5 rounded-xl border border-cyan-500/10 shadow-[0_0_20px_rgba(34,211,238,0.08)]">
              <Activity className="text-cyan-300" size={22} />
            </div>
            <div>
              <h1 className="text-[28px] font-black text-white leading-none">Live Monitoring</h1>
              <p className="text-[9px] font-black text-zinc-600 uppercase mt-1">Operational nervous system</p>
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
            {analytics.map((item, index) => (
              <AnalyticsCard key={item.label} item={item} value={item.liveValue} index={index} />
            ))}
          </section>

          <RealtimeSankey />
        </div>
      </div>
    </div>
  );
}
