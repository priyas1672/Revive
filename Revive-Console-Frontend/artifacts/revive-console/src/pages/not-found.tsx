import { ArrowUpRight, Link2, Radar } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <main className="not-found"><div className="not-found-mark"><Radar size={24} /></div><span className="eyebrow">REVIVE CONSOLE · 404</span><h1>This route went <em>off-script.</em></h1><p>There is no operation at this address. Return to the overview to pick up the queue.</p><Link href="/" className="button button-primary" data-testid="link-not-found-home">Return to overview <ArrowUpRight size={14} /></Link><Link2 className="not-found-line" size={130} /></main>;
}
