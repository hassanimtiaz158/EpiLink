const CX = 250;
const CY = 250;
const R = 210;
const RINGS = [40, 80, 120, 160, 200];

const diseases = [
  { name: "CHOLERA", val: 205, color: "#ef4444", x: 355, y: 130 },
  { name: "MALARIA", val: 145, color: "#f59e0b", x: 160, y: 230 },
  { name: "COVID-19", val: 89, color: "#f59e0b", x: 325, y: 260 },
  { name: "INFLUENZA", val: 450, color: "#3b82f6", x: 380, y: 370 },
  { name: "DENGUE", val: 339, color: "#ef4444", x: 120, y: 340 },
  { name: "HEPATITIS", val: 67, color: "#3b82f6", x: 180, y: 400 },
];

const SWEEP_60 = `M${CX},${CY} L${CX},${CY - R} A${R},${R} 0 0,1 ${CX + 182},${CY - 105} Z`;
const SWEEP_30 = `M${CX},${CY} L${CX},${CY - R} A${R},${R} 0 0,1 ${CX + 105},${CY - 182} Z`;

export default function RadarGraphic() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <style>{`
        @keyframes sweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:.5; } 50% { opacity:1; } }
        .sweep-g { transform-box: view-box; transform-origin: ${CX}px ${CY}px; animation: sweep 6s linear infinite; }
        .cp { animation: pulse 2s ease-in-out infinite; }
      `}</style>
      <svg viewBox="0 0 500 500" className="w-full h-auto">
        <rect width="500" height="500" fill="#0a0f1a" rx="16" />

        {RINGS.map((r) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
        ))}

        <line x1={CX - R} y1={CY} x2={CX + R} y2={CY} stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
        <line x1={CX} y1={CY - R} x2={CX} y2={CY + R} stroke="rgba(148,163,184,0.08)" strokeWidth="0.5" />
        <line x1={CX - 148} y1={CY - 148} x2={CX + 148} y2={CY + 148} stroke="rgba(148,163,184,0.05)" strokeWidth="0.5" />
        <line x1={CX + 148} y1={CY - 148} x2={CX - 148} y2={CY + 148} stroke="rgba(148,163,184,0.05)" strokeWidth="0.5" />

        <g className="sweep-g">
          <path d={SWEEP_60} fill="rgba(56,189,248,0.06)" />
          <path d={SWEEP_30} fill="rgba(56,189,248,0.18)" />
        </g>

        {diseases.map((d) => {
          const isRight = d.x > CX;
          return (
            <g key={d.name}>
              <circle cx={d.x} cy={d.y} r="10" fill={d.color} opacity="0.12" />
              <circle cx={d.x} cy={d.y} r="4.5" fill={d.color} />
              <text
                x={isRight ? d.x + 12 : d.x - 12}
                y={d.y - 8}
                fill="rgba(255,255,255,0.55)"
                fontSize="8"
                fontFamily="ui-monospace,monospace"
                textAnchor={isRight ? "start" : "end"}
              >
                {d.name} {d.val}
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r="6" fill="rgba(239,68,68,0.25)" />
        <circle cx={CX} cy={CY} r="3" fill="#ef4444" className="cp" />
        <circle cx={CX} cy={CY} r="1.5" fill="#fff" />

        <text x={CX + 12} y={CY + 3} fill="rgba(255,255,255,0.35)" fontSize="7.5" fontFamily="ui-monospace,monospace">
          100% &middot; CASES: 762
        </text>

        <text x="16" y="24" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="ui-monospace,monospace">
          26.84&deg;N, 31.23&deg;E
        </text>

        <g transform="translate(300,20)">
          <circle cx="0" cy="0" r="3.5" fill="#ef4444" />
          <text x="8" y="3" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="ui-monospace,monospace">CRITICAL</text>
          <circle cx="75" cy="0" r="3.5" fill="#f59e0b" />
          <text x="83" y="3" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="ui-monospace,monospace">ELEVATED</text>
          <circle cx="155" cy="0" r="3.5" fill="#3b82f6" />
          <text x="163" y="3" fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="ui-monospace,monospace">MONITORING</text>
        </g>

        <rect x="0.5" y="0.5" width="499" height="499" rx="16" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
      </svg>
    </div>
  );
}
