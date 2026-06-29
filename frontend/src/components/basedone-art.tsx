type BasedOneArtProps = {
  animated?: boolean;
  className?: string;
};

const rainColumns = [
  { x: 18, opacity: 0.18, duration: 8.2, delay: -1.4 },
  { x: 26, opacity: 0.1, duration: 9.1, delay: -4.2 },
  { x: 34, opacity: 0.16, duration: 7.8, delay: -2.7 },
  { x: 42, opacity: 0.08, duration: 9.7, delay: -6.1 },
  { x: 50, opacity: 0.18, duration: 8.4, delay: -3.9 },
  { x: 58, opacity: 0.1, duration: 9.3, delay: -7.4 },
  { x: 66, opacity: 0.16, duration: 8.1, delay: -2.1 },
  { x: 74, opacity: 0.1, duration: 9.8, delay: -5.6 },
  { x: 82, opacity: 0.16, duration: 8.6, delay: -3.3 },
];

const rainRows = [10, 16, 23, 31, 40, 50, 61, 73, 86];

const outerNodes = {
  topLeft: { x: 37.5, y: 24.8 },
  top: { x: 50, y: 18.6 },
  topRight: { x: 62.6, y: 24.8 },
  left: { x: 31.7, y: 50 },
  right: { x: 63.2, y: 50 },
  bottomLeft: { x: 37.5, y: 75.8 },
  bottom: { x: 50, y: 82.6 },
  bottomRight: { x: 62.6, y: 75.8 },
};

const pathDefs = [
  {
    d: "M50 23.4 L50 37.5",
    key: "top",
    dots: [
      { x: 50, y: 27.1 },
      { x: 50, y: 30.6 },
      { x: 50, y: 34.0 },
    ],
  },
  {
    d: "M58 26.6 L54.1 37.4",
    key: "topRight",
    dots: [
      { x: 56.9, y: 29.7 },
      { x: 55.8, y: 32.8 },
      { x: 54.7, y: 35.8 },
    ],
  },
  {
    d: "M59.6 50 L53.7 50",
    key: "right",
    dots: [
      { x: 58.4, y: 50 },
      { x: 56.7, y: 50 },
      { x: 54.8, y: 50 },
    ],
  },
  {
    d: "M58 73.4 L54.1 62.6",
    key: "bottomRight",
    dots: [
      { x: 56.9, y: 70.3 },
      { x: 55.8, y: 67.2 },
      { x: 54.7, y: 64.2 },
    ],
  },
  {
    d: "M50 77.8 L50 63.8",
    key: "bottom",
    dots: [
      { x: 50, y: 74.2 },
      { x: 50, y: 70.6 },
      { x: 50, y: 67.0 },
    ],
  },
  {
    d: "M42 73.4 L45.9 62.6",
    key: "bottomLeft",
    dots: [
      { x: 43.1, y: 70.3 },
      { x: 44.2, y: 67.2 },
      { x: 45.3, y: 64.2 },
    ],
  },
  {
    d: "M40.4 50 L46.3 50",
    key: "left",
    dots: [
      { x: 41.6, y: 50 },
      { x: 43.4, y: 50 },
      { x: 45.2, y: 50 },
    ],
  },
  {
    d: "M42 26.6 L45.9 37.4",
    key: "topLeft",
    dots: [
      { x: 43.1, y: 29.7 },
      { x: 44.2, y: 32.8 },
      { x: 45.3, y: 35.8 },
    ],
  },
];

const coreArcs = [
  { id: "core-arc-top-left", d: "M43.1 38.8a14.4 14.4 0 0 0-5.6 6.2" },
  { id: "core-arc-top-right", d: "M56.9 38.8a14.4 14.4 0 0 1 5.6 6.2" },
  { id: "core-arc-bottom-right", d: "M56.9 60.8a14.4 14.4 0 0 0 5.6-6.2" },
  { id: "core-arc-bottom-left", d: "M43.1 60.8a14.4 14.4 0 0 1-5.6-6.2" },
];

function OuterShape({
  kind,
  x,
  y,
}: {
  kind: keyof typeof outerNodes;
  x: number;
  y: number;
}) {
  if (kind === "top") {
    return <circle cx={x} cy={y} r="3.6" fill="url(#basedoneBlue)" />;
  }

  if (kind === "topRight") {
    return <circle cx={x} cy={y} r="3.55" fill="url(#basedoneBlue)" />;
  }

  if (kind === "left") {
    return (
      <polygon
        points={`${x},${y - 4.1} ${x + 4},${y + 2.8} ${x - 4},${y + 2.8}`}
        fill="url(#basedoneBlue)"
      />
    );
  }

  if (kind === "right") {
    return (
      <polygon
        points={`${x},${y - 3.3} ${x + 3.3},${y} ${x},${y + 3.3} ${x - 3.3},${y}`}
        fill="url(#basedoneBlue)"
      />
    );
  }

  if (kind === "topLeft") {
    return (
      <rect
        x={x - 3}
        y={y - 3}
        width="6"
        height="6"
        rx="1"
        fill="url(#basedoneBlue)"
      />
    );
  }

  if (kind === "bottomLeft") {
    return <circle cx={x} cy={y} r="3.25" fill="url(#basedoneBlue)" />;
  }

  return (
    <polygon
      points={`${x - 2.7},${y - 3.9} ${x + 2.7},${y - 3.9} ${x + 4},${y - 2.6} ${x + 4},${y + 2.6} ${x + 2.7},${y + 3.9} ${x - 2.7},${y + 3.9} ${x - 4},${y + 2.6} ${x - 4},${y - 2.6}`}
      fill="url(#basedoneBlue)"
    />
  );
}

export function BasedOneArt({
  animated = false,
  className = "",
}: BasedOneArtProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={animated ? "BasedOne loading animation" : "BasedOne cover art"}
    >
      <defs>
        <linearGradient id="basedoneBlue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2355ff" />
          <stop offset="100%" stopColor="#2f72ff" />
        </linearGradient>
        <radialGradient id="basedoneGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(42,96,255,0.15)" />
          <stop offset="100%" stopColor="rgba(42,96,255,0)" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill="#eef4ff" />
      <rect id="card-background" x="13.2" y="11.4" width="73.6" height="63.2" rx="7.2" fill="#ffffff" />
      <rect id="card-glow" x="13.2" y="11.4" width="73.6" height="63.2" rx="7.2" fill="url(#basedoneGlow)" opacity="0.42" />

      <g id="matrix-columns" opacity="0.88">
        {rainColumns.map((column, columnIndex) => (
          <g
            key={column.x}
            id={`matrix-column-${columnIndex + 1}`}
            className={animated ? "basedone-art-rain-column" : ""}
            style={
              animated
                ? ({
                    "--rain-duration": `${column.duration}s`,
                    "--rain-delay": `${column.delay}s`,
                  } as React.CSSProperties)
                : undefined
            }
          >
            <rect
              id={`matrix-column-line-${columnIndex + 1}`}
              x={column.x - 0.2}
              y="11.8"
              width="0.4"
              height="62.4"
              fill={`rgba(146, 178, 255, ${column.opacity * 0.85})`}
            />
            {rainRows.map((row, index) => {
              const size = index % 4 === 0 ? 1.55 : index % 3 === 0 ? 0.92 : 0.56;
              return (
                <rect
                  key={`${column.x}-${row}`}
                  id={`matrix-column-${columnIndex + 1}-cell-${index + 1}`}
                  x={column.x - size / 2}
                  y={row}
                  width={size}
                  height={size}
                  rx={size * 0.22}
                  fill={index % 4 === 0 ? `rgba(126, 168, 255, ${column.opacity + 0.12})` : `rgba(183, 207, 255, ${column.opacity})`}
                />
              );
            })}
          </g>
        ))}
      </g>

      <circle id="core-glow" cx="50" cy="49.8" r="14.5" fill="rgba(45,109,255,0.07)" />

      <g id="core-arcs" fill="none" stroke="url(#basedoneBlue)" strokeWidth="1.82" strokeLinecap="round">
        {coreArcs.map((arc) => (
          <path key={arc.id} id={arc.id} d={arc.d} />
        ))}
      </g>

      <g id="spokes">
        {pathDefs.map((pathDef, pathIndex) => (
          <g key={pathDef.key} id={`spoke-${pathDef.key}`}>
            <path
              id={`spoke-line-${pathDef.key}`}
              d={pathDef.d}
              fill="none"
              stroke="#2d63ff"
              strokeWidth="0.74"
              strokeLinecap="round"
              strokeDasharray="0.1 2.1"
            />

            {pathDef.dots.map((dot, dotIndex) => (
              <circle
                key={`${pathDef.key}-dot-${dotIndex + 1}`}
                id={`spoke-dot-${pathDef.key}-${dotIndex + 1}`}
                cx={dot.x}
                cy={dot.y}
                r={dotIndex === 1 ? "0.72" : "0.52"}
                fill={dotIndex === 1 ? "#5d8fff" : "#2d63ff"}
              >
                {animated ? (
                  <>
                    <animateMotion
                      path={pathDef.d}
                      dur={`${1.85 + dotIndex * 0.22}s`}
                      begin={`${pathIndex * 0.16 + dotIndex * 0.46}s`}
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0;1;1;0"
                      dur={`${1.85 + dotIndex * 0.22}s`}
                      begin={`${pathIndex * 0.16 + dotIndex * 0.46}s`}
                      repeatCount="indefinite"
                    />
                  </>
                ) : null}
              </circle>
            ))}
          </g>
        ))}
      </g>

      <g id="outer-nodes">
        {(Object.entries(outerNodes) as Array<[keyof typeof outerNodes, { x: number; y: number }]>).map(
          ([kind, point]) => (
            <g key={kind} id={`outer-node-${kind}`}>
              <OuterShape kind={kind} x={point.x} y={point.y} />
            </g>
          ),
        )}
      </g>

      <rect id="core-square" x="44.4" y="44.2" width="11.2" height="11.2" rx="2.2" fill="url(#basedoneBlue)">
        {animated ? (
          <animate
            attributeName="opacity"
            values="1;0.92;1"
            dur="3.4s"
            repeatCount="indefinite"
          />
        ) : null}
      </rect>
    </svg>
  );
}
