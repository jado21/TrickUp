import { useEffect, useState } from 'react';

/** Original SVG sprite drawn on a 32×40 grid; no downloaded character art. */
export function AcademicGuide({ celebrating = false }: { celebrating?: boolean }) {
  return <div className={`academic-guide ${celebrating ? 'cheering' : ''}`} role="img" aria-label="Guía académico pixel art con mochila de libros">
    <svg viewBox="0 0 48 52" shapeRendering="crispEdges" aria-hidden="true">
      <ellipse className="guide-shadow" cx="25" cy="49" rx="17" ry="2" fill="#071121" />
      <g className="guide-body">
        <path fill="#091326" d="M14 4h16v4h5v6h3v14h4v13h-6v7H23v-3h-4v3H9v-8H5V25h4V13h5Z" />
        <path fill="#ffb347" d="M31 23h7v4h3v13H29V26Z" />
        <path fill="#cf793d" d="M37 27h4v13H30v-4h7Z" />
        <path fill="#eff7ef" d="M31 23h3v-8h3v12h-6Z" />
        <path fill="#42d9e8" d="M34 20h4v-7h-4Z" />
        <path fill="#124588" d="M14 30h15v11H14Z" />
        <path fill="#1c66b6" d="M14 39h7v7h-8v-3h1Zm10 0h7v5h3v3H24Z" />
        <path fill="#08182c" d="M11 45h10v4H9v-2h2Zm13 1h10v3H24Z" />
        <path fill="#13bdd6" d="M11 24h19v14H13v-4H9v-7h2Z" />
        <path fill="#74f1e9" d="M11 24h19v4H16v8h-3V27h-2Z" />
        <path fill="#117caa" d="M24 28h6v10h-8v-3h2Z" />
        <path fill="#f4be8e" d="M12 14h19v13H17v-3h-5Z" />
        <path fill="#d68b6a" d="M29 16h4v8h-4v3H17v-3h12Z" />
        <path fill="#11447d" d="M11 9h21v8H14v4h-4v-9h1Z" />
        <path fill="#2ad7e7" d="M15 5h14v4h5v4H11V9h4Z" />
        <path fill="#94f8f1" d="M15 5h14v3H15Z" />
        <path fill="#05678e" d="M26 9h8v4H23V9Z" />
        <g className="guide-eyes" fill="#10182b"><path d="M17 17h2v3h-2Zm9 0h2v3h-2Z" /></g>
        <path fill="#fff5de" d="M20 22h5v2h-5Z" />
        <path fill="#f4be8e" d="M7 29h5v7H7Zm23-3h5v7h-5Z" />
        <path fill="#ffcf67" d="M18 28h3v6h-3Z" />
      </g>
    </svg>
    <span className="guide-name">GUÍA ACADÉMICO <i /></span>
  </div>;
}

export function DialogueBubble({ message, subtitle }: { message: string; subtitle?: string }) {
  const [visible, setVisible] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? message.length : 0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setVisible(count => {
      const next = Math.min(message.length, count + 3);
      if (next === message.length) window.clearInterval(timer);
      return next;
    }), 25);
    return () => window.clearInterval(timer);
  }, [message]);
  return <div className="dialogue-bubble">
    <span className="course-kicker">TU COMPAÑERO DE AVENTURA</span>
    <p className="dialogue-message" aria-label={message}><span aria-hidden="true">{message.slice(0, visible)}<i className={visible < message.length ? 'typing-cursor' : 'typing-cursor finished'} /></span></p>
    {subtitle && <p className="dialogue-subtitle">{subtitle}</p>}
    <button className="dialogue-skip" onClick={() => setVisible(message.length)} disabled={visible >= message.length} aria-label="Mostrar diálogo completo">{visible < message.length ? 'MOSTRAR TODO' : 'DIÁLOGO COMPLETO'} <span aria-hidden="true">▾</span></button>
  </div>;
}

export function CourseCreationAnimation() {
  return <div className="course-portal" aria-hidden="true"><div className="portal-ring"><div className="portal-core" /><span className="portal-book" /></div><div className="portal-ground" />{Array.from({ length: 12 }, (_, i) => <i className={`portal-particle particle-${i % 4}`} style={{ '--index': i } as React.CSSProperties} key={i} />)}</div>;
}
