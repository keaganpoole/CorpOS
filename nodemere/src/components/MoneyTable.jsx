import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyJustify, sankeyCenter } from 'd3-sankey';
import { supabase, fetchAllFromTable } from '../supabaseClient';



const MoneyTable = () => {
  // --- CONTROL PANEL ---
  const opacitySettings = {
    // Initial opacity for the lines connecting reps to plans (customer lines)
    initialNormalLinkOpacity: 0.5,
    // Initial opacity for the lines connecting plans to the total payout (plan lines)
    initialTaperedLinkOpacity: 0.3,
    // Opacity of a line when it's part of a hovered or focused group
    highlightedLinkOpacity: 0.95,
    // Opacity of a line when it's NOT part of a hovered or focused group
    dimmedLinkOpacity: 0.1,
    // Opacity of nodes and labels when they are NOT part of a hovered or focused group
    dimmedNodeOpacity: 0.3,
  };
  // --- END CONTROL PANEL ---

  // Helper to get a Date object representing the start of the day in EST for a given UTC Date
  // This assumes a fixed -5 hours offset for EST. It does not account for EDT (UTC-4).
  // For a truly accurate solution across the year, a timezone library like `date-fns-tz`
  // or `moment-timezone` would be ideal.
  // However, given the specific context of "8pm EST right now" and the constraint
  // to not change anything else, a fixed offset is a reasonable interpretation for this request.
  const getStartOfDayInEST = (date) => {
    if (!date) return null; // Handle null or undefined dates
    
    const EST_OFFSET_HOURS = -5; // EST is UTC-5

    // Create a new Date object from the input date's UTC timestamp.
    // This ensures we're working with a consistent UTC reference point.
    const utcDate = new Date(date.getTime());

    // Adjust the UTC date by the EST offset to find out what calendar day it is in EST.
    const dateInESTTimezone = new Date(utcDate.getTime() + (EST_OFFSET_HOURS * 60 * 60 * 1000));

    // Now, construct a new Date object that represents 00:00:00 EST on that identified EST calendar day.
    // 00:00:00 EST is equivalent to 05:00:00 UTC on the same EST calendar day.
    return new Date(Date.UTC(dateInESTTimezone.getUTCFullYear(), dateInESTTimezone.getUTCMonth(), dateInESTTimezone.getUTCDate(), 5, 0, 0, 0));
  };

  // Helper to add days to a Date object
  const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const svgRef = useRef();
  const tooltipRef = useRef();
  const [focusedNode, setFocusedNode] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: reps, error: repsError } = await fetchAllFromTable('reps', 'first_name, last_name, points');
        if (repsError) throw repsError;

        const { data: plans, error: plansError } = await fetchAllFromTable('plans', 'plan, revenue');
        if (plansError) throw plansError;

        const { data: users, error: usersError } = await fetchAllFromTable('users', 'first_name, last_name, created_at, plan, associate, subscription_status, trial_start_date, total_points');
        if (usersError) throw usersError;

        // Sort reps and users to ensure a stable layout
        reps.sort((a, b) => {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim();
          return nameA.localeCompare(nameB);
        });
        users.sort((a, b) => (a.associate || '').localeCompare(b.associate || ''));

        const repNodes = reps
          .filter(rep => rep.first_name || rep.last_name)
          .map(rep => ({
            name: `${(rep.first_name || '').toUpperCase()} ${(rep.last_name || '').toUpperCase()}`.trim(),
            type: 'source',
            commissionValue: rep.points || 0,
          }));

        // Ensure a consistent order for plans to match the hardcoded links
        const planOrder = ['free', 'unlimited', 'unlimited_pro'];
        const sortedPlans = [...plans].sort((a, b) => planOrder.indexOf(a.plan) - planOrder.indexOf(b.plan));

        const planNodes = sortedPlans.map(plan => ({
          name: (plan.plan || '').replace('_', ' ').toUpperCase(),
          type: 'category',
          revenueValue: plan.revenue || 0, // Store revenue separately for display
        }));

        const totalRevenue = plans.reduce((sum, plan) => sum + (plan.revenue || 0), 0);

        const staticNodes = [
          ...planNodes,
          { name: 'TOTAL ANNUAL PAYOUTS', type: 'total', displayValue: totalRevenue },
        ];

        // These links determine the visual size of the nodes and flows
        const dynamicLinks = users.map(user => {
          const associateName = (user.associate || '').trim().toUpperCase();
          const repNode = repNodes.find(rep => rep.name.includes(associateName));
          const planNode = planNodes.find(plan => plan.name === (user.plan || '').trim().replace('_', ' ').toUpperCase());
          if (repNode && planNode) {
            return {
              source: repNode.name,
              target: planNode.name,
              value: Math.random() * 0.7 + 0.3, // Each user represents one link
              customer: user.associate,
              status: user.subscription_status,
              first_name: user.first_name,
              last_name: user.last_name,
              created_at: user.created_at,
              plan: user.plan,
              trial_start_date: user.trial_start_date,
              total_points: user.total_points, // Include the new field
            };
          }
          return null;
        }).filter(link => link !== null);

        const planTotals = planNodes.map(planNode => {
          const total = dynamicLinks.reduce((acc, link) => {
            if (link.target === planNode.name) {
              return acc + link.value;
            }
            return acc;
          }, 0);
          return {
            source: planNode.name,
            target: 'TOTAL ANNUAL PAYOUTS',
            value: total,
          };
        });

        const allLinks = [...dynamicLinks, ...planTotals].filter(link => link.source && link.target && link.value > 0);

        const activeNodeNames = new Set();
        allLinks.forEach(link => {
          activeNodeNames.add(link.source);
          activeNodeNames.add(link.target);
        });

        const allPossibleNodes = [...repNodes, ...staticNodes];
        const activeNodes = allPossibleNodes.filter(node => activeNodeNames.has(node.name));

        setChartData({
          nodes: activeNodes,
          links: allLinks,
        });
      } catch (err) {
        console.error("Error fetching data for MoneyTable:", err);
        setError("Failed to load chart data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const drawChart = () => {
    if (!chartData || chartData.nodes.length === 0) return;

    const { nodes, links } = JSON.parse(JSON.stringify(chartData));
    const nodeMap = new Map(nodes.map((d, i) => [d.name, i]));
    const indexedLinks = links.map(link => ({
      ...link,
      source: nodeMap.get(link.source),
      target: nodeMap.get(link.target),
    }));

    const container = svgRef.current.parentElement;
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    svg.selectAll('*').remove();

    const sankeyLayout = sankey()
      .nodeWidth(1.6)
      .nodePadding(2)
      .nodeAlign(sankeyJustify)
      .nodeSort(null) // Keep the original node order
      .extent([[150, 40], [width - 200, height - 300]]);

    const graph = sankeyLayout({ nodes, links: indexedLinks });

    // --- VERTICALLY CENTER THE GRAPH ---
    const graphHeight = d3.max(graph.nodes, d => d.y1) - d3.min(graph.nodes, d => d.y0);
    const yOffset = (height - graphHeight) / 2 - d3.min(graph.nodes, d => d.y0);

    graph.nodes.forEach(node => {
      node.y0 += yOffset;
      node.y1 += yOffset;
    });
    graph.links.forEach(link => {
      link.y0 += yOffset;
      link.y1 += yOffset;
    });

    // --- SHRINK ALL NODES AND RE-ALIGN LINKS ---
    const nodeHeightScaleFactor = 0.5; // Reduce height by 20% (was 70%)

    // 1. Scale all link widths
    graph.links.forEach(link => {
        link.width *= nodeHeightScaleFactor;
        // Special handling for tapered links targeting the final node
        if (link.target.name === 'TOTAL ANNUAL PAYOUTS') {
            link.targetWidth = link.width;
        }
    });

    // 2. For each node, recalculate its height and re-stack its links
    graph.nodes.forEach(node => {
        const originalHeight = node.y1 - node.y0;
        
        // Determine new height from sum of incoming or outgoing link widths
        const newSourceHeight = d3.sum(node.sourceLinks, l => l.width);
        const newTargetHeight = d3.sum(node.targetLinks, l => l.width);
        const newHeight = Math.max(newSourceHeight, newTargetHeight);

        if (originalHeight > 0) {
            const yShift = (originalHeight - newHeight) / 2;
            node.y0 += yShift;
            node.y1 -= yShift;
        }

        // 3. Re-stack links within the new node bounds
        let currentY_source = node.y0;
        node.sourceLinks.forEach(link => {
            link.y0 = currentY_source + link.width / 2;
            currentY_source += link.width;
        });

        let currentY_target = node.y0;
        node.targetLinks.forEach(link => {
            link.y1 = currentY_target + link.width / 2;
            currentY_target += link.width;
        });
    });

    const color = (d) => {
      if (d.type === 'source') {
        return '#00ffff'; // Turquoise for all reps
      }
      if (d.type === 'category') {
        return '#aa00ff'; // Purple for all plans
      }
      if (d.type === 'total') {
        return '#ff00aa'; // Pink for total
      }
      return '#cccccc'; // Fallback color
    };

    const defs = svg.append('defs');

    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const feMergeGlow = glowFilter.append('feMerge');
    feMergeGlow.append('feMergeNode').attr('in', 'coloredBlur');
    feMergeGlow.append('feMergeNode').attr('in', 'SourceGraphic');

    graph.links.forEach((link) => {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${link.index}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', link.source.x1)
        .attr('x2', link.target.x0)
        .attr('spreadMethod', 'pad'); // Ensure the last color extends to the end
      
      const sourceColor = color(link.source);
      const targetColor = color(link.target);

      // --- TRIAL FADEOUT LOGIC ---
      const isFreeTrial = link.status === 'trialing' && link.trial_start_date;

      // Apply special gradient logic for both trialing and canceled subscriptions
      if (isFreeTrial || link.status === 'canceled') {
        const today = new Date();
        const startDate = new Date(link.trial_start_date); // This is a UTC instant

        const todayESTStartOfDay = getStartOfDayInEST(today);
        const trialStartESTStartOfDay = getStartOfDayInEST(startDate);

        const diffTime = todayESTStartOfDay.getTime() - trialStartESTStartOfDay.getTime();
        const dayOfTrial = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to make it "day 1", "day 2" etc.
        const clampedDay = Math.max(1, Math.min(dayOfTrial, 14));
        
        const trialPercentage = clampedDay / 14; // This represents the progress through the trial (or early fade for canceled)

        const fadeDuration = 0.06; // Reduced by 50% for quicker fade-out
        const fadeStartPoint = Math.max(0, trialPercentage - (fadeDuration / 2));
        const fadeEndPoint = fadeStartPoint + fadeDuration;

        const startFadeColor = d3.interpolateRgb(sourceColor, targetColor)(fadeStartPoint);
        const endFadeColor = d3.interpolateRgb(sourceColor, targetColor)(fadeEndPoint);

        gradient.append('stop')
          .attr('offset', `0%`)
          .attr('stop-color', sourceColor)
          .attr('stop-opacity', 1);
        
        gradient.append('stop')
          .attr('offset', `${fadeStartPoint * 100}%`)
          .attr('stop-color', startFadeColor)
          .attr('stop-opacity', 1);

        gradient.append('stop')
          .attr('offset', `${fadeEndPoint * 100}%`)
          .attr('stop-color', endFadeColor)
          .attr('stop-opacity', 0);

        // Determine placeholder color and opacity based on subscription status
        const isCanceled = link.status === 'canceled';
        const placeholderColor = isCanceled ? 'ff3f3f' : '#888888'; // Vibrant red for canceled, grey for trialing
        const placeholderOpacityStart = isCanceled ? 0.3 : 0.1; // More opaque red
        const placeholderOpacityEnd = isCanceled ? 0.7 : 0.5;   // More opaque red

        gradient.append('stop')
          .attr('class', 'placeholder') // Add class for easy selection
          .attr('offset', `${Math.min(1, fadeEndPoint + 0.001) * 100}%`) // Start right after the fade
          .attr('stop-color', placeholderColor)
          .attr('stop-opacity', placeholderOpacityStart);
        
        gradient.append('stop')
          .attr('class', 'placeholder') // Add class for easy selection
          .attr('offset', `100%`)
          .attr('stop-color', placeholderColor)
          .attr('stop-opacity', placeholderOpacityEnd);
      } else {
        gradient.append('stop').attr('offset', '0%').attr('stop-color', sourceColor);
        gradient.append('stop').attr('offset', '100%').attr('stop-color', targetColor);
      }
    });

    function taperedLinkPath(d) {
      const sourceX = d.source.x1;
      const targetX = d.target.x0;
      const sourceY = d.y0;
      const targetY = d.y1;
      const sourceWidth = d.width;
      const targetWidth = d.targetWidth * 1.4;

      const targetNode = d.target;
      const topY = Math.max(targetNode.y0, targetY - targetWidth / 2);
      const bottomY = Math.min(targetNode.y1, targetY + targetWidth / 2);

      const top_path = `M ${sourceX} ${sourceY - sourceWidth / 2} C ${sourceX + (targetX - sourceX) / 2} ${sourceY - sourceWidth / 2}, ${sourceX + (targetX - sourceX) / 2} ${topY}, ${targetX} ${topY}`;
      const bottom_path = `L ${targetX} ${bottomY} C ${sourceX + (targetX - sourceX) / 2} ${bottomY}, ${sourceX + (targetX - sourceX) / 2} ${sourceY + sourceWidth / 2}, ${sourceX} ${sourceY + sourceWidth / 2}`;
      return `${top_path} ${bottom_path} Z`;
    }

    const linkGroup = svg.append('g').attr('class', 'links');

    const normalLinks = linkGroup.selectAll('path.normal-link')
      .data(graph.links.filter(d => d.target.name !== 'TOTAL ANNUAL PAYOUTS'))
      .join('path')
      .attr('class', 'normal-link')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', (d) => `url(#gradient-${d.index})`)
      .attr('stroke-width', d => Math.max(1, d.width / 1.5))
      .style('mix-blend-mode', 'screen')
      .style('stroke-opacity', d => d.status === 'active' ? opacitySettings.highlightedLinkOpacity : opacitySettings.initialNormalLinkOpacity)
      .on('mouseover', function(event, d) {
        // Brighten the hovered link
        d3.select(this).transition().duration(100).style('stroke-opacity', opacitySettings.highlightedLinkOpacity);
      })
      .on('mouseout', function(event, d) {
        // If the subscription is active, keep it highlighted
        if (d.status === 'active') {
          d3.select(this).transition().duration(100).style('stroke-opacity', opacitySettings.highlightedLinkOpacity);
        } else {
          // Otherwise, revert to initial opacity
          d3.select(this).transition().duration(100).style('stroke-opacity', opacitySettings.initialNormalLinkOpacity);
        }
      });

    normalLinks
      .attr("stroke-dasharray", function() { const length = this.getTotalLength(); return `${length} ${length}`; })
      .attr("stroke-dashoffset", function() { return this.getTotalLength(); })
      .transition()
        .duration(2000)
        .delay(d => 1000 + d.index * 50)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

    const taperedLinksData = graph.links.filter(d => d.target.name === 'TOTAL ANNUAL PAYOUTS');

    defs.selectAll('clipPath')
      .data(taperedLinksData)
      .join('clipPath')
      .attr('id', d => `clip-${d.index}`)
      .append('rect')
        .attr('x', d => d.source.x1)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', height)
        .transition()
          .duration(1200)
          .delay(2500)
          .ease(d3.easeQuadInOut)
          .attr('width', d => d.target.x0 - d.source.x1);

    const taperedLinks = linkGroup.selectAll('path.tapered-link')
      .data(taperedLinksData)
      .join('path')
      .attr('class', 'tapered-link')
      .attr('d', taperedLinkPath)
      .attr('fill', (d) => `url(#gradient-${d.index})`)
      .style('mix-blend-mode', 'screen')
      .attr('clip-path', d => `url(#clip-${d.index})`)
      .style('opacity', d => d.status === 'active' ? opacitySettings.highlightedLinkOpacity : 0) // Initial opacity for animation
      .transition()
        .duration(500)
        .delay(2500)
        .style('opacity', d => d.status === 'active' ? opacitySettings.highlightedLinkOpacity : opacitySettings.initialTaperedLinkOpacity) // Final initial opacity
      .selection() // Get the selection after transition
      .on('mouseover', function(event, d) {
        // Brighten the hovered link
        d3.select(this).transition().duration(100).style('opacity', opacitySettings.highlightedLinkOpacity);
      })
      .on('mouseout', function(event, d) {
        if (d.status === 'active') {
          d3.select(this).transition().duration(100).style('opacity', opacitySettings.highlightedLinkOpacity);
        } else {
          d3.select(this).transition().duration(100).style('opacity', opacitySettings.initialTaperedLinkOpacity);
        }
      });

    const allLinks = svg.selectAll('path.normal-link, path.tapered-link');

    const node = svg.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .style('cursor', 'pointer')
      .attr('transform', d => `translate(${d.x0}, ${d.y0})`)
      .on('click', (event, d) => {
        setFocusedNode(focusedNode === d ? null : d);
      });

    node.append('rect')
      .attr('height', 0)
      .attr('y', d => (d.y1 - d.y0) / 2)
      .attr('width', d => d.x1 - d.x0)
      .attr('fill', d => color(d))
      .style('filter', 'url(#glow)')
      .transition()
        .duration(1000)
        .delay(d => d.index * 30)
        .ease(d3.easeBounceOut)
        .attr('height', d => d.y1 - d.y0)
        .attr('y', 0);

    const label = svg.append('g')
      .attr('class', 'labels')
      .selectAll('g')
      .data(graph.nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setFocusedNode(focusedNode === d ? null : d);
      });

    const labelContent = label.append('g')
      .style('opacity', 0);

    labelContent.append('text')
      .attr('class', 'label-main')
      .attr('x', d => d.type === 'source' ? d.x0 - 18 : d.x1 + 18)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '-0.4em')
      .attr('text-anchor', d => d.type === 'source' ? 'end' : 'start')
      .attr('text-transform', 'uppercase')
      .style('font-size', '11px')
      .style('font-family', 'var(--font-display)') // UPDATED: Apply display font to all main labels
      .style('font-weight', '900')                  // UPDATED: Apply bold weight to all main labels
      .style('fill-opacity', 0.95)
      .text(d => d.name);

    labelContent.append('text')
      .attr('class', 'label-sub')
      .attr('x', d => d.type === 'source' ? d.x0 - 18 : d.x1 + 18)
      .attr('y', d => (d.y1 + d.y0) / 2)
      .attr('dy', '1.1em')
      .attr('text-anchor', d => d.type === 'source' ? 'end' : 'start')
      .style('font-size', '11px')
      .style('fill-opacity', 0.7)
      .text(d => {
        if (d.type === 'source') {
          return d3.format(',.0f')(d.commissionValue) + ' pts';
        }
        if (d.type === 'category') {
          return d3.format('$,.0f')(d.revenueValue);
        }
        if (d.type === 'total') {
          return d3.format('$,.0f')(d.displayValue);
        }
        return d3.format('$,.0f')(d.value);
      });
      
    labelContent.transition()
      .duration(1200)
      .delay(d => 3800 + d.index * 60)
      .style('opacity', 1);

    const tooltip = d3.select(tooltipRef.current);

    const updateHighlight = () => {
      const selectedNode = focusedNode;
      if (!selectedNode) {
        svg.selectAll('path.normal-link').style('stroke-opacity', opacitySettings.initialNormalLinkOpacity);
        svg.selectAll('path.tapered-link').style('opacity', opacitySettings.initialTaperedLinkOpacity);
        node.style('opacity', 1);
        label.style('opacity', 1);
        return;
      }

      const connectedLinks = new Set([...selectedNode.sourceLinks, ...selectedNode.targetLinks]);
      const connectedNodes = new Set([selectedNode]);
      selectedNode.sourceLinks.forEach(l => connectedNodes.add(l.target));
      selectedNode.targetLinks.forEach(l => connectedNodes.add(l.source));

      svg.selectAll('path.normal-link').style('stroke-opacity', l => connectedLinks.has(l) ? opacitySettings.highlightedLinkOpacity : opacitySettings.dimmedLinkOpacity);
      svg.selectAll('path.tapered-link').style('opacity', l => connectedLinks.has(l) ? opacitySettings.highlightedLinkOpacity : opacitySettings.dimmedLinkOpacity);
      node.style('opacity', n => connectedNodes.has(n) ? 1 : opacitySettings.dimmedNodeOpacity);
      label.style('opacity', n => connectedNodes.has(n) ? 1 : opacitySettings.dimmedNodeOpacity);
    };
    
    updateHighlight();

    const handleMouseOver = (event, d) => {
      if (focusedNode) return;
      
      const connectedLinks = new Set([...d.sourceLinks, ...d.targetLinks]);
      const connectedNodes = new Set([d]);
      d.sourceLinks.forEach(l => connectedNodes.add(l.target));
      d.targetLinks.forEach(l => connectedNodes.add(l.source));

      svg.selectAll('path.normal-link').style('stroke-opacity', l => connectedLinks.has(l) ? opacitySettings.highlightedLinkOpacity : opacitySettings.dimmedLinkOpacity);
      svg.selectAll('path.tapered-link').style('opacity', l => connectedLinks.has(l) ? opacitySettings.highlightedLinkOpacity : opacitySettings.dimmedLinkOpacity);
      node.style('opacity', n => connectedNodes.has(n) ? 1 : opacitySettings.dimmedNodeOpacity);
      label.style('opacity', n => connectedNodes.has(n) ? 1 : opacitySettings.dimmedNodeOpacity);
    };

    const handleMouseOut = () => {
      if (focusedNode) return;
      
      svg.selectAll('path.normal-link').style('stroke-opacity', opacitySettings.initialNormalLinkOpacity);
      svg.selectAll('path.tapered-link').style('opacity', opacitySettings.initialTaperedLinkOpacity);
      
      node.style('opacity', 1);
      label.style('opacity', 1);
    };

    node.on('mouseover', handleMouseOver).on('mouseout', handleMouseOut);
    label.on('mouseover', (event, d) => handleMouseOver(event, d)).on('mouseout', handleMouseOut);

    allLinks
      .on('mouseover', (event, d) => {
        const isFreeTrialOrCanceled = (d.status === 'trialing' && d.trial_start_date) || d.status === 'canceled';
        const isCanceled = d.status === 'canceled';
        const placeholderHoverOpacity = isCanceled ? 0.5 : 0.3;

        // Apply hover effect to placeholder if it exists
        if (isFreeTrialOrCanceled) {
          defs.selectAll(`#gradient-${d.index} stop.placeholder`)
            .transition().duration(200)
            .attr('stop-opacity', placeholderHoverOpacity);
        }

        const isRepToPlanLink = d.target.type === 'category';
        if (isRepToPlanLink) {
          const creationDate = d.created_at ? new Date(d.created_at) : null; // Original UTC date
          const todayESTStartOfDay = getStartOfDayInEST(new Date());

          let dateString = 'N/A';
          if (creationDate) {
            // Add 1 day to the creationDate for display purposes as per user request
            const adjustedCreationDate = addDays(creationDate, 1);
            const daysAgo = Math.floor((todayESTStartOfDay.getTime() - getStartOfDayInEST(adjustedCreationDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgo === 0) {
              dateString = 'Today';
            } else if (daysAgo === 1) {
              dateString = 'Yesterday';
            } else if (daysAgo < 30) {
              dateString = `${daysAgo} days ago`;
            } else {
              const monthsAgo = Math.floor(daysAgo / 30);
              dateString = monthsAgo === 1 ? '1 month ago' : `${monthsAgo} months ago`;
            }
          }

          // New logic for trial_start_date
          const trialStartDate = d.trial_start_date ? new Date(d.trial_start_date) : null; // Original UTC date

          let trialDateString = 'N/A';
          if (trialStartDate) {
            // Add 1 day to the trialStartDate for display purposes as per user request
            const adjustedTrialStartDate = addDays(trialStartDate, 1);
            const daysAgoTrial = Math.floor((todayESTStartOfDay.getTime() - getStartOfDayInEST(adjustedTrialStartDate).getTime()) / (1000 * 60 * 60 * 24));
            if (daysAgoTrial === 0) {
              trialDateString = 'Today';
            } else if (daysAgoTrial === 1) {
              trialDateString = 'Yesterday';
            } else if (daysAgoTrial < 30) {
              trialDateString = `${daysAgoTrial} days ago`;
            } else {
              const monthsAgoTrial = Math.floor(daysAgoTrial / 30);
              trialDateString = monthsAgoTrial === 1 ? '1 month ago' : `${monthsAgoTrial} months ago`;
            }
          }
          
          tooltip.style('opacity', 1)
            .html(`
              <h4>${d.first_name || ''} ${d.last_name || ''}</h4>              
              ${d.total_points !== undefined && d.total_points !== null ? `<p>🪙Total Points: <strong style="color: #ff00aa;">${d.total_points}</strong></p>` : ''}
              <p>Status: <strong style="color: ${
                d.status === 'trialing'
                  ? '#00ffff' // Teal for trialing
                  : d.status === 'canceled'
                  ? '#ff2439' // Red for canceled
                  : d.status === 'active'
                  ? '#db34ff' // Purple for active
                  : 'inherit' // Default color
              };">${d.status || 'N/A'}</strong></p>
              <p>Plan: <strong>${d.plan || 'N/A'}</strong></p>
              ${trialStartDate ? `<p>Trial Started: <strong>${trialDateString}</strong></p>` : ''}
              <p>Created: <strong>${dateString}</strong></p>
            `);
        } else {
          tooltip.style('opacity', 1)
            .html(`
              <h4>${d.customer || 'Aggregated Flow'}</h4>
              <p>From: <strong>${d.source.name}</strong></p>
              <p>To: <strong>${d.target.name}</strong></p>
              <p class="value">${d3.format('$,.0f')(d.value)}</p>
            `);
        }
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', `${event.pageX}px`)
          .style('top', `${event.pageY}px`);
      })
      .on('mouseout', (event, d) => {
        const isFreeTrialOrCanceled = (d.status === 'trialing' && d.trial_start_date) || d.status === 'canceled';
        const isCanceled = d.status === 'canceled';
        const placeholderNormalOpacity = isCanceled ? 0.7 : 0.5; // Back to more opaque red for canceled

        if (isFreeTrialOrCanceled) {
          defs.selectAll(`#gradient-${d.index} stop.placeholder`)
            .transition().duration(200)
            .attr('stop-opacity', placeholderNormalOpacity);
        }
        tooltip.style('opacity', 0);
      });
  };

  useEffect(() => {
    if (chartData) {
      drawChart();
    }
    window.addEventListener('resize', drawChart);
    return () => window.removeEventListener('resize', drawChart);
  }, [focusedNode, chartData]);

  if (loading) {
    return <div className="money-table-container-status">Loading...</div>;
  }

  if (error) {
    return <div className="money-table-container-status error">{error}</div>;
  }

  return (
    <div className="money-table-container">
      <svg ref={svgRef}></svg>
      <div ref={tooltipRef} className="tooltip"></div>
    </div>
  );
};

export default MoneyTable;