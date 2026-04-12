import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Network } from 'lucide-react';

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
  height = 400,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const simulation = d3.forceSimulation<Node>(data.nodes)
      .force('link', d3.forceLink<Node, Link>(data.links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<Node>().radius(d => d.val * 8 + 4));

    const link = svg.append('g')
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.2)
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value) + 0.5);

    const node = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .call(drag(simulation) as any);

    node.append('circle')
      .attr('r', d => d.val * 6 + 4)
      .attr('fill', d => {
        switch (d.type) {
          case 'person': return 'hsl(221,100%,55%)';
          case 'organization': return '#10b981';
          case 'touchpoint': return '#f59e0b';
          default: return '#94a3b8';
        }
      })
      .attr('fill-opacity', 0.85)
      .attr('stroke', 'white')
      .attr('stroke-width', 1.5)
      .attr('filter', 'drop-shadow(0 2px 6px rgba(0,87,255,0.2))');

    node.append('text')
      .text(d => d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name)
      .attr('x', d => d.val * 6 + 8)
      .attr('y', 4)
      .style('font-size', '9px')
      .style('font-weight', '700')
      .style('fill', 'currentColor')
      .style('opacity', 0.65)
      .style('pointer-events', 'none');

    // Tooltip
    node.append('title').text(d => d.name);

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => {
        const r = d.val * 6 + 4;
        const x = Math.max(r, Math.min(width - r, d.x ?? 0));
        const y = Math.max(r, Math.min(height - r, d.y ?? 0));
        return `translate(${x},${y})`;
      });
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
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height]);

  const isEmpty = data.nodes.length === 0;

  return (
    <div className="relative w-full min-h-[320px] border border-slate-100 dark:border-slate-800 rounded-3xl bg-slate-50/50 dark:bg-slate-950/20 overflow-hidden backdrop-blur-sm">
      <div className="absolute top-6 left-6 z-10">
        <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">Relationship Topology</h4>
      </div>

      {isEmpty ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Network size={32} className="opacity-25" />
          <p className="text-xs font-semibold">Add contacts to see your network</p>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`0 0 ${width} ${height}`}
          style={{ minHeight: 320 }}
        />
      )}
    </div>
  );
};

export default RelationshipGraph;
