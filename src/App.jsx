import { useEffect, useMemo, useRef, useState } from "react";
import FIELD_IMG from "./assets/cancha.png";
import LOGO_IMG from "./assets/hard_fc_logo.png";

// ================== Config ===================
const ALLOWED_NUMBERS = [1, 2, 3, 4, 5, 7, 9, 10];

// Y fijo por línea (en %)
const Y = {
  FWD: 31.5,
  MID: 52.8,
  DEF: 73.6,
  GK: 91.8,
};

const px = (n) => `${n}px`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const PRESETS_KEY = "alineador8v8_presets_v1";

// Tamaños compactos para que todo quepa
const PLAYER_SIZE = 56;
const FIELD_HEIGHT = "min(72vh, calc(100vh - 220px))";
const FIELD_MAX_W = "min(92vw, 620px)";

// ========= helpers de nombre (auto-fit dentro del círculo) =========
const NAME_CHAR_W = 0.60; // ancho aprox. de un carácter respecto de font-size

function splitBalancedByWords(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  let best = { l1: words[0], l2: words.slice(1).join(" ") };
  let bestDiff = Math.abs(best.l1.length - best.l2.length);
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ");
    const l2 = words.slice(i).join(" ");
    const diff = Math.abs(l1.length - l2.length);
    if (diff < bestDiff) {
      best = { l1, l2 };
      bestDiff = diff;
    }
  }
  return [best.l1, best.l2];
}

// Devuelve {font, lines[]} donde lines son 1–3 renglones ya cortados para que entren
function fitNameIntoCircle(nameRaw) {
  const name = (nameRaw || "").trim();
  const maxW = PLAYER_SIZE - 8;      // ancho interno
  const maxH = PLAYER_SIZE - 28;     // alto disponible debajo del número

  let lines = [];
  if (!name) lines = [""];
  else {
    const split = splitBalancedByWords(name);
    if (split) {
      lines = split; // 2 líneas por palabras
    } else if (name.length > 9) {
      const mid = Math.ceil(name.length / 2); // una sola palabra larga → 2 líneas
      lines = [name.slice(0, mid), name.slice(mid)];
    } else {
      lines = [name]; // 1 línea
    }
  }

  if (lines.length === 2 && Math.max(lines[0].length, lines[1].length) > 14) {
    const n = name.replace(/\s+/g, " ");
    const a = Math.ceil(n.length / 3);
    const b = Math.ceil((n.length - a) / 2);
    lines = [n.slice(0, a), n.slice(a, a + b), n.slice(a + b)];
  }

  const longest = Math.max(...lines.map((s) => s.length || 1));
  let font = Math.min(16, Math.floor(maxW / (Math.max(1, longest) * NAME_CHAR_W)));
  const lineH = Math.ceil(font * 1.08);
  if (lineH * lines.length > maxH) {
    font = Math.floor(maxH / (lines.length * 1.08));
  }
  font = Math.max(10, font);

  if (lineH * lines.length > maxH && lines.length < 3) {
    const n = name.replace(/\s+/g, "");
    const a = Math.ceil(n.length / 3);
    const b = Math.ceil((n.length - a) / 2);
    lines = [n.slice(0, a), n.slice(a, a + b), n.slice(a + b)];
    const longest3 = Math.max(...lines.map((s) => s.length || 1));
    font = Math.min(
      font,
      Math.floor(maxW / (longest3 * NAME_CHAR_W)),
      Math.floor(maxH / (3 * 1.08))
    );
    font = Math.max(9, font);
  }

  return { font, lines };
}

// ============ Layout por formación ============
function buildLayout(formation) {
  const X = { farL: 12, L: 20, LM: 30, C: 50, RM: 70, R: 80, farR: 88 };
  const P = {};
  P[1] = { x: X.C, y: Y.GK };

  if (formation === "3-3-1") {
    P[3] = { x: X.L, y: Y.DEF };
    P[2] = { x: X.C, y: Y.DEF };
    P[4] = { x: X.R, y: Y.DEF };
    P[7] = { x: X.L, y: Y.MID };
    P[5] = { x: X.C, y: Y.MID };
    P[10] = { x: X.R, y: Y.MID };
    P[9] = { x: X.C, y: Y.FWD };
  }

  if (formation === "3-2-2") {
    P[3] = { x: X.L, y: Y.DEF };
    P[2] = { x: X.C, y: Y.DEF };
    P[4] = { x: X.R, y: Y.DEF };
    P[5] = { x: X.LM, y: Y.MID };
    P[10] = { x: X.RM, y: Y.MID };
    P[7] = { x: X.LM, y: Y.FWD };
    P[9] = { x: X.RM, y: Y.FWD };
  }

  if (formation === "2-3-2") {
    P[3] = { x: X.L, y: Y.DEF };
    P[4] = { x: X.R, y: Y.DEF };
    P[5] = { x: X.L, y: Y.MID };
    P[2] = { x: X.C, y: Y.MID };
    P[10] = { x: X.R, y: Y.MID };
    P[7] = { x: X.LM, y: Y.FWD };
    P[9] = { x: X.RM, y: Y.FWD };
  }

  if (formation === "2-2-3") {
    P[3] = { x: 30, y: Y.DEF };
    P[2] = { x: 70, y: Y.DEF };
    P[5] = { x: 35, y: Y.MID };
    P[4] = { x: 65, y: Y.MID };
    P[7] = { x: 20, y: Y.FWD };
    P[10] = { x: 50, y: Y.FWD };
    P[9] = { x: 80, y: Y.FWD };
  }

  return P;
}

// =============== Componente App ===============
export default function App() {
  const [formation, setFormation] = useState("3-3-1");
  const [players, setPlayers] = useState([]); // {num, name, x, y}
  const [nameInput, setNameInput] = useState("");
  const [dragging, setDragging] = useState(null); // {num, startX, startY, moved}
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const fieldRef = useRef(null);
  const layout = useMemo(() => buildLayout(formation), [formation]);

  useEffect(() => {
    setPlayers((prev) =>
      prev.map((p) => (layout[p.num] ? { ...p, ...layout[p.num] } : p))
    );
  }, [layout]);

  // ------ presets
  const presets = useMemo(() => {
    try {
      const raw = localStorage.getItem(PRESETS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [presetName, selectedPreset, players.length, formation]);

  const savePreset = () => {
    const name = (presetName || "").trim();
    if (!name) return alert("Poné un nombre para el plantel (Ej. HARD A).");
    const all = { ...(presets || {}) };
    all[name] = { formation, players, ts: Date.now() };
    localStorage.setItem(PRESETS_KEY, JSON.stringify(all));
    setSelectedPreset(name);
    alert(`Plantel "${name}" guardado ✔️`);
  };
  const loadPreset = () => {
    const data = (presets || {})[selectedPreset];
    if (!data) return alert("Elegí un plantel para cargar.");
    setFormation(data.formation || "3-3-1");
    const fixed = (data.players || []).map((p) => {
      const pos = buildLayout(data.formation || "3-3-1")[p.num] || { x: 50, y: 50 };
      return { ...p, x: pos.x, y: pos.y };
    });
    setPlayers(fixed);
  };
  const deletePreset = () => {
    const name = selectedPreset;
    if (!name) return alert("Elegí un plantel para borrar.");
    if (!confirm(`¿Borrar "${name}"?`)) return;
    const all = { ...(presets || {}) };
    delete all[name];
    localStorage.setItem(PRESETS_KEY, JSON.stringify(all));
    setSelectedPreset("");
  };

  const resetPositions = () =>
    setPlayers((prev) => prev.map((p) => ({ ...p, ...layout[p.num] })));

  const clearField = () => {
    if (!players.length) return;
    if (confirm("¿Limpiar la cancha y quitar a todos los jugadores?")) {
      setPlayers([]);
    }
  };

  // ------ altas/bajas
  const addPlayer = (num) => {
    if (players.find((p) => p.num === num)) return;
    const pos = layout[num] || { x: 50, y: 50 };
    const name =
      nameInput.trim() ||
      (num === 1
        ? "Arquero"
        : [5, 10].includes(num)
        ? "Mediocampista"
        : [7, 9].includes(num)
        ? "Delantero"
        : "Defensor");
    setPlayers((prev) =>
      [...prev, { num, name, x: pos.x, y: pos.y }].sort((a, b) => a.num - b.num)
    );
    setNameInput("");
  };
  const removePlayer = (num) =>
    setPlayers((prev) => prev.filter((p) => p.num !== num));

  // ------ drag libre X/Y + click corto elimina
  const onPointerDown = (e, num) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ num, startX: e.clientX, startY: e.clientY, moved: false });
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = Math.abs(e.clientX - dragging.startX);
    const dy = Math.abs(e.clientY - dragging.startY);
    const moved = dragging.moved || dx > 2 || dy > 2;
    const xPct = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 98);
    const yPct = clamp(((e.clientY - rect.top) / rect.height) * 100, 2, 98);
    setPlayers((prev) =>
      prev.map((p) => (p.num === dragging.num ? { ...p, x: xPct, y: yPct } : p))
    );
    setDragging((d) => ({ ...d, moved }));
  };
  const onPointerUp = () => {
    if (!dragging) return;
    const d = dragging;
    setDragging(null);
    if (!d.moved) removePlayer(d.num);
  };

  // ------ export PNG
  const exportPNG = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const node = fieldRef.current;
      if (!node) return;
      const canvas = await html2canvas(node, {
        backgroundColor: null,
        useCORS: true,
        scale: 2,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `alineacion_${formation}.png`;
      a.click();
    } catch (err) {
      alert("Instalá html2canvas:  npm i html2canvas");
      console.error(err);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1320",
        color: "#e9f2ff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: px(10),
          padding: "10px 14px",
          background:
            "linear-gradient(180deg, rgba(20,24,38,.95) 0%, rgba(20,24,38,.85) 100%)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: px(8) }}>
          <img
            src={LOGO_IMG}
            alt="HARD F.C."
            style={{ height: 30, width: 30, objectFit: "contain" }}
          />
        <div style={{ fontSize: "18px", fontWeight: 800 }}>
            HARD F.C. — Alineador 8v8
          </div>
        </div>

        {/* Formaciones + Reiniciar + Limpiar */}
        <div
          style={{
            display: "flex",
            gap: px(6),
            justifyContent: "center",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {["3-3-1", "3-2-2", "2-3-2", "2-2-3"].map((f) => (
            <button
              key={f}
              onClick={() => setFormation(f)}
              style={{
                padding: "5px 9px",
                borderRadius: px(10),
                border:
                  formation === f
                    ? "1px solid rgba(255,255,255,.9)"
                    : "1px solid rgba(255,255,255,.2)",
                background:
                  formation === f
                    ? "linear-gradient(180deg,#3b82f6,#2563eb)"
                    : "rgba(255,255,255,.05)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
          <button
            onClick={resetPositions}
            style={{
              padding: "5px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(250,204,21,.4)",
              background: "linear-gradient(180deg,#fde68a,#f59e0b)",
              color: "#332100",
              fontWeight: 800,
              cursor: "pointer",
              marginLeft: px(6),
            }}
            title="Volver a la ubicación por defecto de la formación"
          >
            Reiniciar posiciones
          </button>
          <button
            onClick={clearField}
            style={{
              padding: "5px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(239,68,68,.45)",
              background: "linear-gradient(180deg,#fca5a5,#ef4444)",
              color: "#2b0a0a",
              fontWeight: 800,
              cursor: "pointer",
            }}
            title="Quitar a todos los jugadores de la cancha"
          >
            Limpiar cancha
          </button>
        </div>

        {/* Presets + PNG */}
        <div
          style={{
            display: "flex",
            gap: px(6),
            justifyContent: "flex-end",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nombre plantel"
            style={{
              minWidth: px(170),
              padding: "7px 9px",
              borderRadius: px(10),
              border: "1px solid rgba(255,255,255,.15)",
              background: "rgba(255,255,255,.06)",
              color: "#fff",
              outline: "none",
            }}
          />
          <button
            onClick={savePreset}
            style={{
              padding: "7px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(34,197,94,.3)",
              background: "linear-gradient(180deg,#22c55e,#16a34a)",
              color: "#04120a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Guardar
          </button>

          <select
            value={selectedPreset}
            onChange={(e) => setSelectedPreset(e.target.value)}
            style={{
              minWidth: px(130),
              padding: "7px 9px",
              borderRadius: px(10),
              border: "1px solid rgba(255,255,255,.15)",
              background: "rgba(255,255,255,.06)",
              color: "#fff",
              outline: "none",
            }}
          >
            <option value="">Cargar…</option>
            {Object.keys(presets).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            onClick={loadPreset}
            style={{
              padding: "7px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(59,130,246,.35)",
              background: "linear-gradient(180deg,#60a5fa,#3b82f6)",
              color: "#061326",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cargar
          </button>
          <button
            onClick={deletePreset}
            style={{
              padding: "7px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(239,68,68,.35)",
              background: "linear-gradient(180deg,#fca5a5,#ef4444)",
              color: "#2b0a0a",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Borrar
          </button>
          <button
            onClick={exportPNG}
            style={{
              padding: "7px 10px",
              borderRadius: px(10),
              border: "1px solid rgba(255,255,255,.35)",
              background: "linear-gradient(180deg,#e5e7eb,#d1d5db)",
              color: "#0a0f1a",
              fontWeight: 900,
              cursor: "pointer",
            }}
            title="Exportar PNG"
          >
            PNG
          </button>
        </div>
      </div>

      {/* Alta rápida + Números */}
      <div
        style={{
          maxWidth: px(1000),
          margin: "10px auto 0",
          padding: "0 12px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: px(10),
          alignItems: "center",
        }}
      >
        <input
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Nombre del jugador (opcional)"
          style={{
            padding: "9px 10px",
            borderRadius: px(10),
            border: "1px solid rgba(255,255,255,.15)",
            background: "rgba(255,255,255,.06)",
            color: "#fff",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: px(6), flexWrap: "wrap" }}>
          {ALLOWED_NUMBERS.map((n) => {
            const used = players.some((p) => p.num === n);
            return (
              <button
                key={n}
                onClick={() => addPlayer(n)}
                disabled={used}
                style={{
                  padding: "7px 9px",
                  width: px(40),
                  borderRadius: px(12),
                  border: "1px solid rgba(255,255,255,.18)",
                  background: used
                    ? "rgba(255,255,255,.12)"
                    : "linear-gradient(180deg,#a7f3d0,#34d399)",
                  color: used ? "rgba(255,255,255,.5)" : "#062414",
                  fontWeight: 800,
                  cursor: used ? "not-allowed" : "pointer",
                }}
                title={used ? "Ya está en cancha" : "Agregar a cancha"}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cancha (doble marca de agua) */}
      <div
        style={{
          display: "grid",
          placeItems: "center",
          marginTop: px(8),
          padding: "0 12px 14px",
        }}
      >
        <div
          ref={fieldRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            height: FIELD_HEIGHT,
            aspectRatio: "2 / 3",
            maxWidth: FIELD_MAX_W,
            backgroundImage: `url(${FIELD_IMG})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: px(16),
            boxShadow:
              "0 16px 36px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={LOGO_IMG}
            alt="HARD FC"
            style={{
              position: "absolute",
              left: px(8),
              bottom: px(8),
              width: "18%",
              maxWidth: px(120),
              opacity: 0.18,
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
          <img
            src={LOGO_IMG}
            alt="HARD FC"
            style={{
              position: "absolute",
              right: px(8),
              top: px(8),
              width: "18%",
              maxWidth: px(120),
              opacity: 0.18,
              filter: "drop-shadow(0 3px 6px rgba(0,0,0,.5))",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />

          {players.map((p) => {
            const { font, lines } = fitNameIntoCircle(p.name);
            const nameBoxMaxW = PLAYER_SIZE - 6;

            return (
              <div
                key={p.num}
                onPointerDown={(e) => onPointerDown(e, p.num)}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: "translate(-50%,-50%)",
                  width: px(PLAYER_SIZE),
                  height: px(PLAYER_SIZE),
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,.9)",
                  background:
                    p.num === 1
                      ? "radial-gradient(circle at 30% 30%, #fecaca, #ef4444)"
                      : "radial-gradient(circle at 30% 30%, #b7ff6e, #39ff14)",
                  boxShadow:
                    "0 8px 16px rgba(0,0,0,.45), inset 0 0 18px rgba(255,255,255,.35)",
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  alignItems: "center",
                  justifyItems: "center",
                  padding: "3px 4px",
                  cursor: "grab",
                  userSelect: "none",
                  textAlign: "center",
                  color: "#0b1020",
                  textShadow:
                    "0 1px 0 rgba(255,255,255,.7), 0 0 6px rgba(255,255,255,.45)",
                  fontWeight: 900,
                }}
                title="Arrastrá para mover. Click rápido para eliminar."
              >
                <div style={{ fontSize: "22px", lineHeight: 1 }}>{p.num}</div>

                {/* Nombre en 1-3 líneas, sin cortar */}
                <div
                  style={{
                    display: "grid",
                    gap: "2px",
                    justifyItems: "center",
                    alignContent: "center",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    maxWidth: px(nameBoxMaxW),
                    marginTop: px(1),
                    lineHeight: 1.08,
                    fontSize: px(font),
                  }}
                  title={p.name}
                >
                  {lines.map((ln, i) => (
                    <div key={i}>{ln}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: px(6),
            fontSize: "12.5px",
            color: "rgba(255,255,255,.85)",
            background: "rgba(0,0,0,.35)",
            padding: "5px 8px",
            borderRadius: px(8),
            userSelect: "none",
          }}
        >
          Arrastrá libre (X/Y). <b>Click</b> rápido sobre un jugador = eliminar.
        </div>
      </div>
    </div>
  );
}

