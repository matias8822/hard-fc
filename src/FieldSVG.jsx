// src/FieldSVG.jsx
export default function FieldSVG({ className, showWatermarks = true, style = {} }) {
  const W = 2000, H = 3000;
  const STROKE = 8, R_OUT = 60, M = 70;
  const AREA_W = 1200, AREA_H = 420, SIX_W = 720, SIX_H = 180;
  const CIRCLE_R = 280, PEN_SPOT_R = 12, D_R = 200;

  const X_LEFT = (W - AREA_W) / 2;
  const X_LEFT_6 = (W - SIX_W) / 2;
  const TOP_AREA_LINE_Y = M + AREA_H;
  const BOTTOM_AREA_LINE_Y = H - M - AREA_H;

  return (
    <svg
      className={className}
      style={style}                                 // 👈 tamaño inline
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"         // 👈 ocupa todo el contenedor
      role="img"
      aria-label="Cancha HARD FC"
    >
      <defs>
        <linearGradient id="stripeLight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#41A71D" />
          <stop offset="100%" stopColor="#41A71D" />
        </linearGradient>
        <linearGradient id="stripeDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0D8E0F" />
          <stop offset="100%" stopColor="#0D8E0F" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} rx={R_OUT} ry={R_OUT} fill="#0D8E0F" />

      {Array.from({ length: 20 }).map((_, i) => (
        <rect key={i} x="0" y={(i * H) / 20} width={W} height={H / 20}
              fill={i % 2 ? "url(#stripeLight)" : "url(#stripeDark)"} />
      ))}

      <g stroke="#fff" strokeWidth={STROKE} fill="none">
        <rect x={M} y={M} width={W - 2*M} height={H - 2*M} rx={R_OUT - 10} ry={R_OUT - 10} />
        <line x1={M} y1={H/2} x2={W - M} y2={H/2} />
        <circle cx={W/2} cy={H/2} r={CIRCLE_R} />
      </g>

      <g fill="#fff">
        <circle cx={W/2} cy={H/2} r={PEN_SPOT_R} />
        <circle cx={W/2} cy={TOP_AREA_LINE_Y - 50} r={PEN_SPOT_R} />
        <circle cx={W/2} cy={BOTTOM_AREA_LINE_Y + 50} r={PEN_SPOT_R} />
      </g>

      <g stroke="#fff" strokeWidth={STROKE} fill="none">
        <rect x={X_LEFT}   y={M}               width={AREA_W} height={AREA_H} />
        <rect x={X_LEFT_6} y={M}               width={SIX_W}  height={SIX_H} />
        <path d={`M ${W/2 - D_R} ${TOP_AREA_LINE_Y} A ${D_R} ${D_R} 0 0 0 ${W/2 + D_R} ${TOP_AREA_LINE_Y}`} />

        <rect x={X_LEFT}   y={H - M - AREA_H} width={AREA_W} height={AREA_H} />
        <rect x={X_LEFT_6} y={H - M - SIX_H}  width={SIX_W}  height={SIX_H} />
        <path d={`M ${W/2 - D_R} ${BOTTOM_AREA_LINE_Y} A ${D_R} ${D_R} 0 0 1 ${W/2 + D_R} ${BOTTOM_AREA_LINE_Y}`} />

        <path d={`M ${M} ${M + 52} A 52 52 0 0 1 ${M + 52} ${M}`} />
        <path d={`M ${W - M - 52} ${M} A 52 52 0 0 1 ${W - M} ${M + 52}`} />
        <path d={`M ${M} ${H - M - 52} A 52 52 0 0 0 ${M + 52} ${H - M}`} />
        <path d={`M ${W - M - 52} ${H - M} A 52 52 0 0 0 ${W - M} ${H - M - 52}`} />
      </g>

      {showWatermarks && (
        <g opacity="0.14">
          <text x={W - 200} y={M + 180} textAnchor="middle" fontSize="100" fontWeight="800" fill="#c8facc">HARD F.C.</text>
          <text x={200} y={H - M - 100} textAnchor="middle" fontSize="100" fontWeight="800" fill="#c8facc">HARD F.C.</text>
        </g>
      )}
    </svg>
  );
}

