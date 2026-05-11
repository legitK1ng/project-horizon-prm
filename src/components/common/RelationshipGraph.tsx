import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Contact, CallRecord } from "../../types";

interface RelationshipGraphProps {
  contacts: Contact[];
  calls?: CallRecord[];
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "contact" | "org";
  group: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string | Node;
  target: string | Node;
  value: number;
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ contacts }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !contacts || contacts.length === 0) return;

    const width = 800;
    const height = 450;

    // Clean up previous SVG
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .style("overflow", "visible");

    // Define Filters & Gradients for a futuristic look
    const defs = svg.append("defs");

    // Glow Filter
    const filter = defs.append("filter")
      .attr("id", "glow")
      .attr("x", "-50%")
      .attr("y", "-50%")
      .attr("width", "200%")
      .attr("height", "200%");
    
    filter.append("feGaussianBlur")
      .attr("stdDeviation", "3.5")
      .attr("result", "blur");
    
    filter.append("feComposite")
      .attr("in", "SourceGraphic")
      .attr("in2", "blur")
      .attr("operator", "over");

    // Gradient for lines
    const linkGradient = defs.append("linearGradient")
      .attr("id", "link-gradient")
      .attr("gradientUnits", "userSpaceOnUse");
    
    linkGradient.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.2);
    linkGradient.append("stop").attr("offset", "100%").attr("stop-color", "#10b981").attr("stop-opacity", 0.2);

    // Limit to top 75 contacts by call count to keep the force simulation performant
    const topContacts = [...contacts]
      .sort((a, b) => ((b as any).total_calls || 0) - ((a as any).total_calls || 0))
      .slice(0, 75);

    // REQ-028: Construct nodes from contacts and their organizations
    const nodes: Node[] = topContacts.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      type: "contact",
      group: 1
    }));

    // Add unique organizations as nodes (only from the sampled contacts)
    const orgs = [...new Set(topContacts.map(c => c.org).filter(Boolean))];
    orgs.forEach(org => {
      nodes.push({
        id: `org-${org}`,
        name: org!,
        type: "org",
        group: 2
      });
    });

    // Create links between contacts and their organizations
    const links: Link[] = topContacts
      .filter(c => c.org)
      .map(c => ({
        source: c.id,
        target: `org-${c.org}`,
        value: 1
      }));

    // Force simulation — alphaDecay raised to converge ~3× faster than default
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40))
      .alphaDecay(0.05); // default 0.0228 — higher = fewer ticks = faster settle

    // Draw links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "url(#link-gradient)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .attr("class", "animate-pulse");

    // Draw nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "cursor-pointer")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Outer glow for nodes
    node.append("circle")
      .attr("r", d => d.type === "org" ? 18 : 12)
      .attr("fill", d => d.type === "org" ? "rgba(59, 130, 246, 0.1)" : "rgba(16, 185, 129, 0.1)")
      .attr("stroke", d => d.type === "org" ? "#3b82f6" : "#10b981")
      .attr("stroke-width", 1)
      .style("filter", "url(#glow)");

    // Inner core
    node.append("circle")
      .attr("r", d => d.type === "org" ? 6 : 4)
      .attr("fill", d => d.type === "org" ? "#3b82f6" : "#10b981")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Labels with better typography
    node.append("text")
      .text(d => d.name)
      .attr("x", 20)
      .attr("y", 4)
      .attr("font-size", d => d.type === "org" ? "11px" : "9px")
      .attr("class", "fill-slate-900 dark:fill-white font-black uppercase tracking-widest pointer-events-none select-none text-glow");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    return () => { simulation.stop(); };
  }, [contacts]); // calls unused in effect body; contacts drives the graph

  if (!contacts || contacts.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800 animate-pulse">
           <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest text-xs">Awaiting Matrix Ingestion</h4>
      </div>
    );
  }

  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing overflow-visible">
      <svg ref={svgRef} className="drop-shadow-2xl"></svg>
    </div>
  );
};

export default RelationshipGraph;
