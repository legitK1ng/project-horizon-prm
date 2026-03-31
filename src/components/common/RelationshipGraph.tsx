import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Node extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'person' | 'organization' | 'touchpoint';
  val: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
  value: number;
}

interface RelationshipGraphProps {
  data?: {
    nodes: Node[];
    links: Link[];
  };
  width?: number;
  height?: number;
}

const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ 
  data = { nodes: [], links: [] }, 
  width = 800, 
  height = 500 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "hsl(var(--surface-raised))")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value));

    const node = svg.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(drag(simulation));

    // Glow effect for nodes
    node.append("circle")
      .attr("r", d => d.val * 5)
      .attr("fill", d => {
          switch(d.type) {
              case 'person': return 'hsl(var(--horizon-primary))';
              case 'organization': return '#10b981';
              case 'touchpoint': return '#f59e0b';
              default: return '#94a3b8';
          }
      })
      .attr("filter", "drop-shadow(0 0 8px rgba(0, 87, 255, 0.3))");

    node.append("text")
      .text(d => d.name)
      .attr("x", 12)
      .attr("y", 4)
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", "currentColor")
      .style("opacity", 0.7);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x}, ${d.y})`);
    });

    function drag(sim: d3.Simulation<Node, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: any) {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return d3.drag<any, Node>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  return (
    <div className="relative w-full h-full min-h-[400px] border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden backdrop-blur-sm">
       <div className="absolute top-6 left-6 z-10">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Relationship Topology</h4>
       </div>
       <svg ref={svgRef} className="w-full h-full" viewBox={`0 0 ${width} ${height}`} />
    </div>
  );
};

export default RelationshipGraph;
