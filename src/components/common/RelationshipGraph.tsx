import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Contact, CallRecord } from "../../types";

interface RelationshipGraphProps {
  contacts: Contact[];
  calls: CallRecord[];
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

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ contacts, calls }) => {
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
      .attr("height", "100%");

    // REQ-028: Construct nodes from contacts and their organizations
    const nodes: Node[] = contacts.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      type: "contact",
      group: 1
    }));

    // Add unique organizations as nodes
    const orgs = [...new Set(contacts.map(c => c.org).filter(Boolean))];
    orgs.forEach(org => {
      nodes.push({
        id: `org-${org}`,
        name: org!,
        type: "org",
        group: 2
      });
    });

    // Create links between contacts and their organizations
    const links: Link[] = contacts
      .filter(c => c.org)
      .map(c => ({
        source: c.id,
        target: `org-${c.org}`,
        value: 1
      }));

    // Force simulation
    const simulation = d3.forceSimulation<Node>(nodes)
      .force("link", d3.forceLink<Node, Link>(links).id(d => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30)); // Prevent overlapping

    // Draw links
    const link = svg.append("g")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-opacity", 0.4)
      .attr("stroke-width", d => Math.sqrt(d.value));

    // Draw nodes
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .call(d3.drag<SVGGElement, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    node.append("circle")
      .attr("r", d => d.type === "org" ? 12 : 8)
      .attr("fill", d => d.type === "org" ? "#3b82f6" : "#10b981")
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("class", "shadow-sm transform group-hover:scale-110 transition-transform");

    node.append("text")
      .text(d => d.name)
      .attr("x", 12)
      .attr("y", 4)
      .attr("font-size", d => d.type === "org" ? "10px" : "8px")
      .attr("class", "fill-slate-500 dark:fill-slate-400 font-bold uppercase tracking-tighter pointer-events-none select-none shadow-sm");

    simulation.on("tick", () => {
      // REQ-028: Clamp nodes within bounds
      link
        .attr("x1", (d: any) => Math.max(20, Math.min(width - 20, d.source.x)))
        .attr("y1", (d: any) => Math.max(20, Math.min(height - 20, d.source.y)))
        .attr("x2", (d: any) => Math.max(20, Math.min(width - 20, d.target.x)))
        .attr("y2", (d: any) => Math.max(20, Math.min(height - 20, d.target.y)));

      node
        .attr("transform", (d: any) => {
            const x = Math.max(20, Math.min(width - 20, d.x));
            const y = Math.max(20, Math.min(height - 20, d.y));
            return `translate(${x},${y})`;
        });
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
  }, [contacts, calls]);

  if (!contacts || contacts.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-800 animate-pulse">
           <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full" />
        </div>
        <h4 className="font-semibold text-slate-700 dark:text-slate-300">Quiet Network</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-[200px]">
          Sync your contacts to see your relational surface mapped in 3D.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full cursor-grab active:cursor-grabbing">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default RelationshipGraph;
