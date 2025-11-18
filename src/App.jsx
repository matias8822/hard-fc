import { useEffect, useMemo, useRef, useState } from "react";
import LOGO_IMG from "./assets/hard_fc_logo.png";
import FieldSVG from "./FieldSVG"; // ruta correcta (mismo folder que App.jsx)

// ================== Config ===================
const ALLOWED_NUMBERS = [1, 2, 3, 4, 5, 7, 9, 10];

// Y fijo por línea (en %)
const Y = { FWD: 28, MID: 50.5, DEF: 70, GK: 90.5 };

const px = (n) => `${n}px`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const PRESETS_KEY = "alineador8v8_presets_v1";
const MATCHES_KEY = "alineador8v8_matches_v1"; // presets de PARTIDOS (A+B)

// Tamaños compactos
const PLAYER_SIZE = 60;
const FIELD_HEIGHT = "min(72dvh, calc(100dvh - 240px))"; // dvh + margen de seguridad
const FIELD_MAX_W = "min(92vw, 620px)";
// Calidad / tamaño por plataforma
const EXPORT_WIDTH   = isiOS() ? 1600 : 2400;          // iPhone más chico
const EXPORT_DPR     = isiOS() ? 1 : Math.max(1, Math.floor(window.devicePixelRatio || 1));
const EXPORT_MIME    = isiOS() ? "image/jpeg" : "image/png"; // iPhone = JPG liviano
const EXPORT_QUALITY = isiOS() ? 0.90 : 0.92;          // calidad JPG (PNG ignora este valor)
const NUM_OFFSET   = -0.50; // número más arriba (negativo = sube)
const NAME_OFFSET  =  0.38; // nombre más abajo (positivo = baja)
const NAME_SCALE   =  0.90; // escala del font del nombre (0.9 = 90%)
const DBL_TAP_MS   = 650;   // ventana de doble tap/click más amplia
const EXPORT_REF_FIELD_PX = 620; // ancho de referencia para exportar (igual a maxWidth)
const EXPORT_PLAYER_MULTIPLIER_DESKTOP = 1.8; // tamaño en PNG desde compu
const EXPORT_PLAYER_MULTIPLIER_MOBILE  = 1.8; // tamaño en PNG desde celular

function isMobile() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobileUA = /Mobile/i.test(ua);
  return (isIOS || isAndroid || isMobileUA);
}

function isiOS() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS
}

async function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

// Abre en nueva pestaña (fiable en Safari/iOS) para que el usuario guarde desde el visor
async function openInNewTab(blob) {
  const dataUrl = await blobToDataURL(blob);
  const w = window.open();
  if (w) {
    w.document.write(`<html><head><title>PNG</title></head><body style="margin:0;background:#111;display:grid;place-items:center;height:100vh">
      <img src="${dataUrl}" alt="Alineación" style="max-width:100vw;max-height:100vh"/>
      </body></html>`);
    w.document.close();
  } else {
    // fallback duro
    location.href = dataUrl;
  }
}

async function shareOrDownload(blob, filename, fallbackText = "") {
  // 🖥️ En desktop: descargar
  if (!isMobile()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  // 📱 En móvil: intentar share con archivos
  const extFromType =
    blob.type === "image/jpeg" ? "jpg" :
    blob.type === "image/png"  ? "png" : "bin";

  const safeName = filename.replace(/\.(png|jpg|jpeg)$/i, `.${extFromType}`);
  const file = new File([blob], safeName, { type: blob.type || "application/octet-stream" });

  if (!(isSecureContext && navigator.share && navigator.canShare && navigator.canShare({ files: [file] }))) {
    alert("Este navegador no permite compartir archivos de imagen. Abrí la página en Safari/Chrome con HTTPS.");
    return;
  }

  try {
    await navigator.share({
      files: [file],
      title: "Alineación HARD F.C.",
      text: fallbackText || "Formación lista para el partido 💪",
    });
  } catch (err) {
    console.warn("navigator.share falló o fue cancelado:", err);
  }
}

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";          // 👈 ayuda a que decode() funcione bien
    // img.crossOrigin = "anonymous"; // activar SOLO si servís el logo desde otro dominio/CDN con CORS
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// ========= helpers de nombre =========
const NAME_CHAR_W = 0.6;

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

function fitNameIntoCircle(nameRaw) {
  const name = (nameRaw || "").trim();
  const maxW = PLAYER_SIZE - 8;
  const maxH = PLAYER_SIZE - 28;

  let lines = [];
  if (!name) lines = [""];
  else {
    const split = splitBalancedByWords(name);
    if (split) lines = split;
    else if (name.length > 9) {
      const mid = Math.ceil(name.length / 2);
      lines = [name.slice(0, mid), name.slice(mid)];
    } else {
      lines = [name];
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
  if (lineH * lines.length > maxH) font = Math.floor(maxH / (lines.length * 1.08));
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

  if (formation === "3-2-2") {
    P[3] = { x: X.L, y: Y.DEF };
    P[2] = { x: X.C, y: Y.DEF };
    P[4] = { x: X.R, y: Y.DEF };
    P[10] = { x: X.LM, y: Y.MID };
    P[5] = { x: X.RM, y: Y.MID };
    P[9] = { x: X.LM, y: Y.FWD };
    P[7] = { x: X.RM, y: Y.FWD };
  }

  if (formation === "3-3-1") {
    P[3] = { x: X.L, y: Y.DEF };
    P[2] = { x: X.C, y: Y.DEF };
    P[4] = { x: X.R, y: Y.DEF };
    P[10] = { x: X.L, y: Y.MID };
    P[5] = { x: X.C, y: Y.MID };
    P[7] = { x: X.R, y: Y.MID };
    P[9] = { x: X.C, y: Y.FWD };
  }

  if (formation === "2-3-2") {
    P[3] = { x: 30, y: Y.DEF };
    P[4] = { x: 70, y: Y.DEF };
    P[10] = { x: X.L, y: Y.MID };
    P[2] = { x: X.C, y: Y.MID };
    P[5] = { x: X.R, y: Y.MID };
    P[9] = { x: X.LM, y: Y.FWD };
    P[7] = { x: X.RM, y: Y.FWD };
  }

  if (formation === "2-2-3") {
    P[3] = { x: 30, y: Y.DEF };
    P[2] = { x: 70, y: Y.DEF };
    P[5] = { x: 35, y: Y.MID };
    P[4] = { x: 65, y: Y.MID };
    P[9] = { x: 20, y: Y.FWD };
    P[10] = { x: 50, y: Y.FWD };
    P[7] = { x: 80, y: Y.FWD };
  }
  return P;
}

// =============== Componente App ===============
export default function App() {
  // === MODO ===
  const [mode, setMode] = useState("single"); // "single" | "match"

  // === Single team (modo clásico)
  const [formation, setFormation] = useState("3-2-2");
  const [players, setPlayers] = useState([]); // {num, name, x, y}
  const [nameInput, setNameInput] = useState("");
  const [dragging, setDragging] = useState(null); // {num, startX, startY, moved}
  const [presetName, setPresetName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  // === Match (dos equipos)
  const [matchName, setMatchName] = useState("");
  const [activeTeam, setActiveTeam] = useState("A"); // "A" | "B"
  const [teamA, setTeamA] = useState({ formation: "3-2-2", players: [] });
  const [teamB, setTeamB] = useState({ formation: "3-2-2", players: [] });
  // Nombres visibles de los equipos (match)
  const [teamNames, setTeamNames] = useState({ A: "Equipo A", B: "Equipo B" });
  const [editingTeam, setEditingTeam] = useState(null); // "A" | "B" | null



  // === Match: selección de partido guardado ===
const [selectedMatch, setSelectedMatch] = useState("");

// Lista de partidos guardados (en localStorage)
const matches = useMemo(() => {
  try {
    const raw = localStorage.getItem(MATCHES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}, [selectedMatch, matchName, teamA, teamB, activeTeam]);

  const fieldRef = useRef(null);
  const layout = useMemo(() => buildLayout(formation), [formation]);

  // 👉 NUEVO: recordamos último click para detectar doble click
  const lastClick = useRef({ num: null, ts: 0 });

  // Efecto: single → al cambiar layout, realinear
  useEffect(() => {
    if (mode !== "single") return;
    setPlayers((prev) =>
      prev.map((p) => (layout[p.num] ? { ...p, ...layout[p.num] } : p))
    );
  }, [layout, mode]);

  // 👉 NUEVO: recordar última formación (single)
  useEffect(() => {
    const f = localStorage.getItem("alineador8v8_last_formation");
    if (f) setFormation(f);
  }, []);

  useEffect(() => {
    if (mode === "single") {
      localStorage.setItem("alineador8v8_last_formation", formation);
    }
  }, [formation, mode]);

  // 👉 NUEVO: sincronizar presets entre pestañas con evento "storage"
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === PRESETS_KEY || e.key === MATCHES_KEY) {
        setSelectedPreset((prev) => prev); // fuerza re-render
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ------ presets (single)
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
  if (!name) return alert("Poné un nombre para el plantel.");

  const all = { ...(presets || {}) };

  // 👇 Si ya existe → preguntar si sobrescribir
  if (all[name]) {
    const ok = confirm(`El plantel "${name}" ya existe.\n\n¿Querés sobrescribirlo?`);
    if (!ok) return;
  }

  // Guardar / Sobrescribir
  all[name] = {
    formation,
    players,
    ts: Date.now(),
  };

  localStorage.setItem(PRESETS_KEY, JSON.stringify(all));

  setSelectedPreset(name);
  setPresetName(""); // limpiar input

  alert(`Plantel "${name}" guardado ✔️`);
};

const loadPreset = () => {
  const data = (presets || {})[selectedPreset];
  if (!data) return alert("Elegí un plantel para cargar.");

  // Cargar formación + jugadores
  setFormation(data.formation || "3-2-2");

  const fixed = (data.players || []).map((p) => {
    const pos = buildLayout(data.formation || "3-2-2")[p.num] || { x: 50, y: 50 };
    return { ...p, x: pos.x, y: pos.y };
  });
  setPlayers(fixed);

  // 👇 NUEVO: mostrar el nombre en el input
  setPresetName(selectedPreset);
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
    if (confirm("¿Limpiar la cancha y quitar a todos los jugadores?")) setPlayers([]);
  };

  // ------ altas/bajas (single)
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

  // ====== MATCH: helpers equipo activo ======
  function getActiveTeam() {
    return activeTeam === "A" ? teamA : teamB;
  }
  function setActiveTeamState(next) {
    if (activeTeam === "A") setTeamA(next);
    else setTeamB(next);
  }
  function setActiveFormation(f) {
    const t = getActiveTeam();
    const newLayout = buildLayout(f);
    const fixed = t.players.map((p) => (newLayout[p.num] ? { ...p, ...newLayout[p.num] } : p));
    setActiveTeamState({ ...t, formation: f, players: fixed });
  }
  function resetActivePositions() {
    const t = getActiveTeam();
    const newLayout = buildLayout(t.formation);
    const fixed = t.players.map(p => ({ ...p, ...newLayout[p.num] }));
    setActiveTeamState({ ...t, players: fixed });
  }
  function clearActiveField() {
    const t = getActiveTeam();
    if (!t.players.length) return;
    if (confirm(`¿Limpiar la cancha del equipo ${activeTeam}?`)) {
      setActiveTeamState({ ...t, players: [] });
    }
  }
  function addPlayerActive(num, nameFromInput="") {
    const t = getActiveTeam();
    if (t.players.find(p => p.num === num)) return;
    const pos = buildLayout(t.formation)[num] || { x: 50, y: 50 };
    const name =
      nameFromInput.trim() ||
      (num === 1
        ? "Arquero"
        : [5, 10].includes(num)
        ? "Mediocampista"
        : [7, 9].includes(num)
        ? "Delantero"
        : "Defensor");
    const next = [...t.players, { num, name, x: pos.x, y: pos.y }].sort((a,b)=>a.num-b.num);
    setActiveTeamState({ ...t, players: next });
  }
  function removePlayerActive(num) {
    const t = getActiveTeam();
    setActiveTeamState({ ...t, players: t.players.filter(p => p.num !== num) });
  }

  // ------ drag libre X/Y + click corto (doble click para eliminar)
  const onPointerDown = (e, num) => {
    e.preventDefault(); // evita scroll en mobile
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({ num, startX: e.clientX, startY: e.clientY, moved: false });
  };

  const rafRef = useRef(null);

  const onPointerMove = (e) => {
    if (!dragging) return;
    if (rafRef.current) return; // ya hay un frame en cola

    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX, clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const dx = Math.abs(clientX - dragging.startX);
      const dy = Math.abs(clientY - dragging.startY);
      const moved = dragging.moved || dx > 2 || dy > 2;
      const xPct = clamp(((clientX - rect.left) / rect.width) * 100, 2, 98);
      const yPct = clamp(((clientY - rect.top) / rect.height) * 100, 2, 98);

      if (mode === "single") {
        setPlayers(prev =>
          prev.map(p => (p.num === dragging.num ? { ...p, x: xPct, y: yPct } : p))
        );
      } else {
        const t = getActiveTeam();
        const next = t.players.map(p => (p.num === dragging.num ? { ...p, x: xPct, y: yPct } : p));
        setActiveTeamState({ ...t, players: next });
      }

      setDragging(d => ({ ...d, moved }));
    });
  };

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const onPointerUp = () => {
    if (!dragging) return;
    const d = dragging;
    setDragging(null);

    if (!d.moved) {
      const now = Date.now();
      if (lastClick.current.num === d.num && now - lastClick.current.ts < DBL_TAP_MS) {
        // segundo click rápido sobre el mismo jugador -> eliminar
        if (mode === "single") removePlayer(d.num);
        else removePlayerActive(d.num);
        lastClick.current = { num: null, ts: 0 };
      } else {
        // primer click: guardamos y esperamos el segundo
        lastClick.current = { num: d.num, ts: now };
      }
    }
  };

  // 👉 NUEVO: para cortar drag si el navegador cancela o si el puntero sale de la cancha
  const onPointerCancel = () => setDragging(null);
  const onPointerLeave  = () => { if (dragging) setDragging(null); };

  function slugifyTeamName(name) {
    if (!name) return "";
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca acentos
      .replace(/[^a-zA-Z0-9\s_-]/g, "")                 // saca símbolos raros
      .trim()
      .replace(/\s+/g, "-")                              // espacios → guiones
      .toUpperCase();                                    // opcional: mayúsculas
  }

  function slugifyMatchName(name) {
    if (!name) return "";
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s_-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .toUpperCase();
  }

function parseDateFromName(name) {
  if (!name) return null;
  const trimmed = name.trim();

  // 1) Formato DD/MM o DD-MM → usa año actual
  let m = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})$/);
  if (m) {
    const [, d, mo] = m;
    const year = new Date().getFullYear();
    const date = new Date(year, Number(mo) - 1, Number(d));
    const ts = date.getTime();
    return isNaN(ts) ? null : ts;
  }

  // 2) Formato DD/MM/YYYY o DD-MM-YYYY
  m = trimmed.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    let year = Number(y);
    if (y.length === 2) year += 2000; 
    const date = new Date(year, Number(mo) - 1, Number(d));
    const ts = date.getTime();
    return isNaN(ts) ? null : ts;
  }

  return null;
}

  // ===== Export (single, tu versión) =====
  const exportPNG = async () => {
    try {
      const wrapper = fieldRef.current; // <div ref={fieldRef}> contenedor de la cancha
      if (!wrapper) return;

      // 1) Tomar el <svg> de la cancha que ya renderizás
      const svgEl = wrapper.querySelector("svg");
      if (!svgEl) {
        alert("No encontré el SVG de la cancha");
        return;
      }
      const svgMarkup = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // 2) Tamaño final del PNG (2:3)
      const targetWidth  = EXPORT_WIDTH;
      const targetHeight = Math.round(targetWidth * 3 / 2);

      // 3) Cargar el SVG como imagen
      const fieldImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.decoding = "async";
        img.src = svgUrl;
      });

      // 4) Canvas destino y dibujar la cancha (con DPR para nitidez)
      const canvas = document.createElement("canvas");
      const dpr = EXPORT_DPR;
      canvas.width = targetWidth * dpr;
      canvas.height = targetHeight * dpr;
      const ctx = canvas.getContext("2d");

      // Escalamos todo el contexto al DPR y luego trabajamos en coordenadas "CSS"
      ctx.scale(dpr, dpr);

      // Para que el export respete los px lógicos al crear el blob, seteamos el tamaño CSS
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2.5;

      // ¡Atención! Ahora usás targetWidth/targetHeight normales para todo
      ctx.drawImage(fieldImg, 0, 0, targetWidth, targetHeight);

      // ------- Marcas de agua con el LOGO (forzadas en la exportación) -------
      try {
        const logoImg = await loadImage(LOGO_IMG);
        try { if (logoImg.decode) await logoImg.decode(); } catch {}

        const imgW = logoImg.width || logoImg.naturalWidth;
        const imgH = logoImg.height || logoImg.naturalHeight;
        if (!imgW || !imgH) throw new Error("Logo sin dimensiones (no cargó)");

        const margin = Math.round(targetWidth * 0.02);
        const wmW = Math.round(targetWidth * 0.18); // 18% del ancho
        const ratio = imgH / imgW;
        const wmH = Math.round(wmW * ratio);

        ctx.save();
        ctx.globalAlpha = 0.16;

        // Superior derecha
        ctx.drawImage(
          logoImg,
          targetWidth - margin - wmW,
          margin,
          wmW,
          wmH
        );

        // Inferior izquierda
        ctx.drawImage(
          logoImg,
          margin,
          targetHeight - margin - wmH,
          wmW,
          wmH
        );

        ctx.restore();
      } catch (e) {
        console.warn("No pude dibujar el watermark del logo:", e);
      }

      // 5) Dibujar jugadores
      const scaleRef = targetWidth / EXPORT_REF_FIELD_PX;
      const m = isMobile() ? EXPORT_PLAYER_MULTIPLIER_MOBILE : EXPORT_PLAYER_MULTIPLIER_DESKTOP;
      const size = Math.round(PLAYER_SIZE * m * scaleRef);
      const r = Math.round(size / 2);
      const playerScale = size / PLAYER_SIZE;
      const numFontPx = Math.max(14, Math.round(22 * playerScale));

      players.forEach((p) => {
        const x = Math.round((p.x / 100) * targetWidth);
        const y = Math.round((p.y / 100) * targetHeight);

        // sombra
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 18 * playerScale;
        ctx.shadowOffsetY = 6 * playerScale;

        // relleno radial
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
        if (p.num === 1) { grad.addColorStop(0, "#fecaca"); grad.addColorStop(1, "#ef4444"); }
        else             { grad.addColorStop(0, "#b7ff6e"); grad.addColorStop(1, "#39ff14"); }
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // borde
        ctx.shadowColor = "transparent";
        ctx.lineWidth = Math.max(2, Math.round(2.2 * playerScale));
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.stroke();
        ctx.restore();

        // Número (más arriba)
        ctx.fillStyle = "#0b1020";
        ctx.font = `bold ${numFontPx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = Math.max(1, Math.round(1 * playerScale));
        const numY = y + r * NUM_OFFSET;
        ctx.strokeText(String(p.num), x, numY);
        ctx.fillText(String(p.num), x, numY);

        // === Tunables rápidos ===
        const NAME_FONT_BOOST   = 1.20;
        const NAME_Y_LIFT_R     = 0.20;
        const NAME_LINE_H_MUL   = 0.80;

        // Nombre (simple, negro sólido)
        const fitted = fitNameIntoCircle(p.name);
        const exportFont = Math.max(
          8,
          Math.round(fitted.font * playerScale * NAME_SCALE * NAME_FONT_BOOST)
        );
        const lineH = Math.round(exportFont * NAME_LINE_H_MUL);

        ctx.font = `900 ${exportFont}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle   = "#000000";

        const nameCenterY = y + r * (NAME_OFFSET - NAME_Y_LIFT_R);
        const totalH = lineH * fitted.lines.length;
        const startY = Math.round(nameCenterY - (totalH - lineH) / 2);

        fitted.lines.forEach((ln, i) => {
          const yy = startY + i * lineH;
          ctx.fillText(ln, x, yy);
        });
      });

      // 6) Dibujar nombre del plantel si hay uno seleccionado
      const teamName = selectedPreset || presetName || "";
      const teamSlug = slugifyTeamName(teamName);
      if (teamName) {
        ctx.save();
        const fontSize = Math.round(23 * scaleRef * 1.4);
        ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = Math.max(5, Math.round(5 * scaleRef));

        const posY = Math.round(targetHeight * 0.095);
        ctx.strokeText(teamName, targetWidth / 2, posY);
        ctx.fillText(teamName, targetWidth / 2, posY);

        ctx.restore();
      }

      URL.revokeObjectURL(svgUrl);

      // Compartir/descargar
      let blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), EXPORT_MIME, EXPORT_QUALITY);
      });

      if (!blob) {
        const dataUrl = canvas.toDataURL(EXPORT_MIME, EXPORT_QUALITY);
        const parts = dataUrl.split(',');
        const mimeString = parts[0].split(':')[1].split(';')[0];
        const byteString = atob(parts[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
        blob = new Blob([ab], { type: mimeString });
      }

      const filename = (() => {
        const teamName = selectedPreset || presetName || "";
        const teamSlug = slugifyTeamName(teamName);
        const base = teamSlug ? `Alineacion_${formation}_${teamSlug}` : `Alineacion_${formation}_HD`;
        const ext  = EXPORT_MIME === "image/jpeg" ? "jpg" : "png";
        return `${base}.${ext}`;
      })();

      await shareOrDownload(blob, filename, "Formación lista para el partido 💪");
    } catch (e) {
      console.error("Export falló:", e);
      alert("No pude exportar el PNG (mirá la consola para el error).");
    }
  };

  // ===== Export genérica por equipo (para modo MATCH) =====
  const exportPNGFor = async (playersArg, formationArg, titleText, paletteKey = "A") => {
    try {
      const wrapper = fieldRef.current;
      if (!wrapper) return;

      // 1) SVG cancha
      const svgEl = wrapper.querySelector("svg");
      if (!svgEl) {
        alert("No encontré el SVG de la cancha");
        return;
      }
      const svgMarkup = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      // 2) Tamaño final
      const targetWidth  = EXPORT_WIDTH;
      const targetHeight = Math.round(targetWidth * 3 / 2);

      // 3) Cargar SVG como imagen
      const fieldImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.decoding = "async";
        img.src = svgUrl;
      });

      // 4) Canvas + DPR
      const canvas = document.createElement("canvas");
      const dpr = EXPORT_DPR;
      canvas.width = targetWidth * dpr;
      canvas.height = targetHeight * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2.5;

      ctx.drawImage(fieldImg, 0, 0, targetWidth, targetHeight);

      // Watermarks
      try {
        const logoImg = await loadImage(LOGO_IMG);
        try { if (logoImg.decode) await logoImg.decode(); } catch {}
        const imgW = logoImg.width || logoImg.naturalWidth;
        const imgH = logoImg.height || logoImg.naturalHeight;
        if (!imgW || !imgH) throw new Error("Logo sin dimensiones");
        const margin = Math.round(targetWidth * 0.02);
        const wmW = Math.round(targetWidth * 0.18);
        const ratio = imgH / imgW;
        const wmH = Math.round(wmW * ratio);
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.drawImage(logoImg, targetWidth - margin - wmW, margin, wmW, wmH);
        ctx.drawImage(logoImg, margin, targetHeight - margin - wmH, wmW, wmH);
        ctx.restore();
      } catch (e) {
        console.warn("No pude dibujar el watermark:", e);
      }

      // 5) Jugadores (paleta por equipo)
      const playersLocal = playersArg || [];
      const scaleRef = targetWidth / EXPORT_REF_FIELD_PX;
      const m = isMobile() ? EXPORT_PLAYER_MULTIPLIER_MOBILE : EXPORT_PLAYER_MULTIPLIER_DESKTOP;
      const size = Math.round(PLAYER_SIZE * m * scaleRef);
      const r = Math.round(size / 2);
      const playerScale = size / PLAYER_SIZE;
      const numFontPx = Math.max(14, Math.round(22 * playerScale));

      const getGradStops = (num) => {
        if (num === 1) {
          return paletteKey === "B"
            ? ["#c7d2fe", "#3b82f6"] // GK azul
            : ["#fecaca", "#ef4444"]; // GK rojo
        }
        return paletteKey === "B"
          ? ["#bfdbfe", "#3b82f6"] // campo azul
          : ["#b7ff6e", "#39ff14"]; // campo verde
      };

      playersLocal.forEach((p) => {
        const x = Math.round((p.x / 100) * targetWidth);
        const y = Math.round((p.y / 100) * targetHeight);

        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 18 * playerScale;
        ctx.shadowOffsetY = 6 * playerScale;

        const [c0, c1] = getGradStops(p.num);
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
        grad.addColorStop(0, c0); grad.addColorStop(1, c1);
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.lineWidth = Math.max(2, Math.round(2.2 * playerScale));
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.stroke();
        ctx.restore();

        // Número
        ctx.fillStyle = "#0b1020";
        ctx.font = `bold ${numFontPx}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = Math.max(1, Math.round(1 * playerScale));
        const numY = y + r * NUM_OFFSET;
        ctx.strokeText(String(p.num), x, numY);
        ctx.fillText(String(p.num), x, numY);

        // Nombre
        const NAME_FONT_BOOST   = 1.20;
        const NAME_Y_LIFT_R     = 0.20;
        const NAME_LINE_H_MUL   = 0.80;
        const fitted = fitNameIntoCircle(p.name);
        const exportFont = Math.max(8, Math.round(fitted.font * playerScale * NAME_SCALE * NAME_FONT_BOOST));
        const lineH = Math.round(exportFont * NAME_LINE_H_MUL);

        ctx.font = `900 ${exportFont}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle   = "#000000";

        const nameCenterY = y + r * (NAME_OFFSET - NAME_Y_LIFT_R);
        const totalH = lineH * fitted.lines.length;
        const startY = Math.round(nameCenterY - (totalH - lineH) / 2);

        fitted.lines.forEach((ln, i) => {
          const yy = startY + i * lineH;
          ctx.fillText(ln, x, yy);
        });
      });

      // 6) Título (titleText)
      if (titleText) {
        ctx.save();
        const fontSize = Math.round(28 * (targetWidth / EXPORT_REF_FIELD_PX) * 1.7);
        ctx.font = `900 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.lineWidth = Math.max(5, Math.round(5 * (targetWidth / EXPORT_REF_FIELD_PX)));
        const posY = Math.round(targetHeight * 0.095);
        ctx.strokeText(titleText, targetWidth / 2, posY);
        ctx.fillText(titleText, targetWidth / 2, posY);
        ctx.restore();
      }

      URL.revokeObjectURL(svgUrl);

      // 7) Descarga / Share
      await new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) return resolve();
          const ext  = EXPORT_MIME === "image/jpeg" ? "jpg" : "png";
          await shareOrDownload(blob, `${titleText || "Alineacion"}.${ext}`, "Formación lista 💪");
          resolve();
        }, EXPORT_MIME, EXPORT_QUALITY);
      });
    } catch (e) {
      console.error("Export falló:", e);
      alert("No pude exportar el PNG (mirá la consola para el error).");
    }
  };

  // ===== Guardar partido / Export ambos =====
const saveMatch = () => {
  const name = (matchName || "").trim();
  if (!name) return alert("Poné un nombre para el partido (Ej. Sábado 16hs).");

  const payload = {
    teamA,
    teamB,
    teamNames,   // 👈 guarda también los nombres visibles
    ts: Date.now(),
  };

  try {
    const raw = localStorage.getItem(MATCHES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[name] = payload;
    localStorage.setItem(MATCHES_KEY, JSON.stringify(all));
    alert(`Partido "${name}" guardado ✔️`);
    setMatchName(""); // limpiar input
  } catch (e) {
    console.error(e);
    alert("No pude guardar el partido.");
  }
};

const loadMatch = () => {
  const data = (matches || {})[selectedMatch];
  if (!data) return alert("Elegí un partido para cargar.");

  setTeamA({
    formation: data.teamA?.formation || "3-2-2",
    players: Array.isArray(data.teamA?.players) ? data.teamA.players : [],
  });
  setTeamB({
    formation: data.teamB?.formation || "3-2-2",
    players: Array.isArray(data.teamB?.players) ? data.teamB.players : [],
  });

  // 👇 restaura nombres si estaban guardados
  if (data.teamNames) setTeamNames({ A: data.teamNames.A || "Equipo A", B: data.teamNames.B || "Equipo B" });

  setMatchName(selectedMatch);
  setActiveTeam("A");
};

const deleteMatch = () => {
  const name = selectedMatch;
  if (!name) return alert("Elegí un partido para borrar.");
  if (!confirm(`¿Borrar el partido "${name}"?`)) return;

  try {
    const raw = localStorage.getItem(MATCHES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    delete all[name];
    localStorage.setItem(MATCHES_KEY, JSON.stringify(all));
    setSelectedMatch("");
    alert(`Partido "${name}" borrado ✔️`);
  } catch (e) {
    console.error(e);
    alert("No pude borrar el partido.");
  }
};

const exportBothPNG = async () => {
const base = slugifyMatchName(matchName); // puede ser "" si está vacío
const nameA = slugifyTeamName(teamNames.A || "Equipo A");
const nameB = slugifyTeamName(teamNames.B || "Equipo B");

// 👇 construimos los nombres sin guiones sobrantes
const fileA = base ? `${base}_${nameA}` : `${nameA}`;
const fileB = base ? `${base}_${nameB}` : `${nameB}`;

await exportPNGFor(teamA.players, teamA.formation, fileA, "A");
await exportPNGFor(teamB.players, teamB.formation, fileB, "B");
};

  // ------- estilos globales (controles iguales + select oscuro) -------
  const PlayerStyles = () => (
    <style>{`
      html, body { margin: 0; }

      .player {
        transition: transform .14s ease, box-shadow .14s ease, filter .14s ease;
        touch-action: none;
      }
      .player:hover { transform: translate(-50%, -50%) scale(1.045); box-shadow: 0 12px 22px rgba(0,0,0,.55), inset 0 0 22px rgba(255,255,255,.45); filter: saturate(1.08); }
      .player--dragging { transform: translate(-50%, -50%) scale(0.98)!important; box-shadow: 0 6px 14px rgba(0,0,0,.5), inset 0 0 16px rgba(255,255,255,.35); cursor: grabbing!important; }

      .btn { padding: 7px 11px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); color:#fff; font-weight:700; cursor:pointer; }
      .btn:disabled { opacity:.55; cursor:not-allowed; }
      .btn--primary { background: linear-gradient(180deg,#60a5fa,#3b82f6); border-color: rgba(59,130,246,.4); color:#061326; }
      .btn--warn    { background: linear-gradient(180deg,#fde68a,#f59e0b); border-color: rgba(250,204,21,.4); color:#332100; }
      .btn--danger  { background: linear-gradient(180deg,#fca5a5,#ef4444); border-color: rgba(239,68,68,.45); color:#2b0a0a; }
      .btn--neutral { background: linear-gradient(180deg,#e5e7eb,#d1d5db); border-color: rgba(255,255,255,.35); color:#0a0f1a; }
      .btn--success { background: linear-gradient(180deg,#22c55e,#16a34a); border-color: rgba(34,197,94,.4); color:#04120a; }
      .chip { padding:7px 9px; width:40px; border-radius:12px; border:1px solid rgba(255,255,255,.18); font-weight:800; }

      :root { --control-h: 34px; }
      .control { height: var(--control-h); display:inline-flex; align-items:center; border-radius:10px; }
      .btn.control { padding: 0 12px; line-height: 1; }

      .select-dark {
        min-width:130px; padding:0 10px; border-radius:10px;
        border:1px solid rgba(255,255,255,.15);
        background:rgba(255,255,255,.06); color:#fff; outline:none;
        appearance:none; -webkit-appearance:none; -moz-appearance:none;
      }
      .select-dark option { background:#212532; color:#fff; }
      .select-dark option:hover, .select-dark option:checked { background:#1f2937; color:#fff; }

      @media (min-width: 900px) {
        .app-root { height: 100dvh; overflow: hidden; }
      }
      @supports not (height: 100dvh) {
        @media (min-width: 900px) {
          .app-root { height: calc(100vh - 1px); }
        }
      }

      @supports not (height: 100dvh) {
        .field-fallback { height: calc(100vh - 240px); }
      }
    `}</style>
  );

  return (
    <div
      className="app-root"
      style={{
        minHeight: "100dvh",
        background: "#0b1320",
        color: "#e9f2ff",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <PlayerStyles />

      <style>{`
        @media (max-width: 430px) {
          :root { --control-h: 32px; }

          .topbar {
            grid-template-columns: 1fr !important;
            row-gap: 8px;
            padding: 8px 10px !important;
          }

          .brand img { height: 64px !important; width: 64px !important; }
          .brand div { font-size: 18px !important; }

          .formations { 
            flex-direction: column;
            align-items: center;
            gap: 8px !important;
          }
          .formations__schemes {
            flex-wrap: nowrap !important;
            justify-content: center !important;
            overflow-x: visible !important;
            gap: 6px !important;
          }
          .formations__schemes .btn {
            padding: 0 10px !important;
            min-width: auto !important;
            flex: 0 0 auto;
            white-space: nowrap;
          }

          .formations__actions {
            justify-content: center !important;
            gap: 8px !important;
          }
          .formations__actions .btn {
            padding: 0 12px !important;
            min-width: auto !important;
          }

          .presets { 
            justify-content: stretch !important; 
            flex-wrap: wrap !important; 
            gap: 6px !important; 
          }
          .presets input.control { min-width: 160px !important; flex: 1 1 auto; }
          .presets .btn { padding: 0 10px; }
          .presets .select-dark { min-width: 120px; }

          .adder { padding: 0 10px !important; }
          .adder input { width: 160px !important; }
          .chip { width: 36px; padding: 6px 0; }

          .field-watermark { opacity: .14 !important; width: 22% !important; }

          .adder {
            position: sticky;
            top: 0;
            z-index: 7;
            background: linear-gradient(180deg, rgba(20,24,38,.97) 0%, rgba(20,24,38,.92) 100%);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            border-bottom: 1px solid rgba(255,255,255,.08);
            padding: 8px 12px !important;
            box-shadow: 0 6px 16px rgba(0,0,0,.25);
          }
        }

        @media (max-width: 360px) {
          .formations__schemes .btn { padding: 0 8px !important; min-width: auto !important; }
          .formations__actions .btn { padding: 0 10px !important; }
          .presets input.control { min-width: 130px !important; }
          .adder input { width: 140px !important; }
          .chip { width: 32px; padding: 5px 0; font-size: 13px; }
          .brand img { height: 54px !important; width: 54px !important; }
          .brand div { font-size: 16px !important; }
        }
      `}</style>

      {/* Top bar */}
      <div
        className="topbar"
        style={{
          zIndex: 5,
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: px(6),
          padding: "0px 6px",
          background:
            "linear-gradient(180deg, rgba(20,24,38,.95) 0%, rgba(20,24,38,.85) 100%)",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          backdropFilter: "blur(6px)",
        }}
      >
        {/* Marca */}
        <div className="brand" style={{ display: "flex", alignItems: "center", gap: px(8) }}>
          <img
            src={LOGO_IMG}
            alt="HARD F.C."
            style={{ height: 64, width: 64, objectFit: "contain" }}
          />
          <div style={{ fontSize: "18px", fontWeight: 800 }}>
            HARD F.C. — Alineador 8v8
          </div>
        </div>

        {/* Selector de Modo */}
        <div style={{ display:"flex", alignItems:"center", gap: 8, justifyContent:"center" }}>
          <label style={{ opacity:.85, fontWeight:700 }}>Modo:</label>
          <select
            className="select-dark control"
            value={mode}
            onChange={(e)=> setMode(e.target.value)}
            title="Elegir modo"
            style={{ minWidth: 160 }}
          >
            <option value="single">Un equipo</option>
            <option value="match">Dos equipos (A y B)</option>
          </select>
        </div>

        {/* Presets / PNG en modo SINGLE */}
        {mode === "single" ? (
          <div
            className="presets"
            style={{
              display: "flex",
              gap: px(8),
              justifyContent: "flex-end",
              alignItems: "center",
              flexWrap: "nowrap",
            }}
          >
            <input
              className="control"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Nombre plantel"
              style={{
                minWidth: px(210),
                padding: "0 10px",
                borderRadius: px(10),
                border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.06)",
                color: "#fff",
                outline: "none",
              }}
            />

            <button className="btn btn--success control" onClick={savePreset} title="Guardar plantel">
              Guardar
            </button>

            <select
              className="select-dark control"
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              title="Elegir plantel guardado"
            >
              <option value="">Cargar…</option>
              {Object.keys(presets)
                .sort((a, b) => {
                  const da = parseDateFromName(a);
                  const db = parseDateFromName(b);

                  // ambos tienen fecha → ordenar por fecha ascendente
                  if (da !== null && db !== null) return da - db;

                  // uno tiene fecha, otro no → el que tiene va primero
                  if (da !== null && db === null) return -1;
                  if (da === null && db !== null) return 1;

                  // ninguno tiene fecha → ordenar por fecha de guardado
                  const ta = presets[a]?.ts ?? 0;
                  const tb = presets[b]?.ts ?? 0;
                  if (ta !== tb) return ta - tb;

                  return a.localeCompare(b);
                })
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>

            <button className="btn btn--primary control" onClick={loadPreset} title="Cargar plantel seleccionado">
              Cargar
            </button>

            <button className="btn btn--danger control" onClick={deletePreset} title="Borrar plantel seleccionado">
              Borrar
            </button>

            <button className="btn btn--neutral control" onClick={exportPNG} title="Exportar PNG">
              PNG
            </button>
          </div>
        ) : (
          // En modo MATCH, este panel derecho lo usamos para nada (queda vacío para balancear la grid)
          <div />
        )}
      </div>

      {/* ======= CONTENIDO SEGÚN MODO ======= */}
      {mode === "single" ? (
        <>
          {/* Formaciones (SINGLE) */}
          <div
            className="formations"
            style={{
              display: "flex",
              marginTop: px(18),
              gap: px(6),
              justifyContent: "center",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Fila 1: SOLO las formaciones */}
            <div
              className="formations__row formations__schemes"
              style={{ display: "flex", gap: px(6), justifyContent: "center", flexWrap: "wrap" }}
            >
              {["3-2-2", "3-3-1", "2-3-2", "2-2-3"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormation(f)}
                  className="btn control"
                  style={{
                    border:
                      formation === f
                        ? "1px solid rgba(255,255,255,.9)"
                        : "1px solid rgba(255,255,255,.2)",
                    background:
                      formation === f
                        ? "linear-gradient(180deg,#3b82f6,#2563eb)"
                        : "rgba(255,255,255,.05)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Fila 2: Acciones */}
            <div
              className="formations__row formations__actions"
              style={{ display: "flex", gap: px(6), justifyContent: "center", flexWrap: "wrap" }}
            >
              <button onClick={resetPositions} className="btn btn--warn control">
                Reiniciar posiciones
              </button>
              <button onClick={clearField} className="btn btn--danger control">
                Limpiar cancha
              </button>
            </div>
          </div>

          {/* Alta rápida + Números (SINGLE) */}
          <div
            className="adder"
            style={{
              maxWidth: px(1000),
              margin: "10px auto 0",
              padding: "0 12px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: px(10),
            }}
          >
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Nombre del jugador (opcional)"
              style={{
                width: "180px",
                padding: "9px 10px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.06)",
                color: "#fff",
                outline: "none",
                textAlign: "left",
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
                    className="chip"
                    style={{
                      background: used
                        ? "rgba(255,255,255,.12)"
                        : "linear-gradient(180deg,#a7f3d0,#34d399)",
                      color: used ? "rgba(255,255,255,.5)" : "#062414",
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

          {/* Cancha (SINGLE) */}
          <div style={{ display: "grid", placeItems: "center", marginTop: px(18), padding: "0 12px 14px" }}>
            <div
              ref={fieldRef}
              role="img"
              aria-label={`Cancha con ${players.length} jugadores en formación ${formation}`}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onPointerLeave={onPointerLeave}
              style={{
                height: FIELD_HEIGHT,
                aspectRatio: "2 / 3",
                maxWidth: FIELD_MAX_W,
                position: "relative",
                borderRadius: px(16),
                overflow: "hidden",
                boxShadow: "0 16px 36px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.08)",
                background: "transparent",
              }}
            >
              {/* SVG como fondo absoluto */}
              <FieldSVG
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                  zIndex: 0,
                }}
              />

              {/* Marca de agua inferior izquierda */}
              <img
                className="field-watermark"
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
              {/* Marca de agua superior derecha */}
              <img
                className="field-watermark"
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
                const draggingThis = dragging?.num === p.num;
                return (
                  <div
                    key={p.num}
                    role="button"
                    tabIndex={0}
                    aria-label={`Jugador ${p.num}, ${p.name || 'sin nombre'}, posición X ${Math.round(p.x)}%, Y ${Math.round(p.y)}%`}
                    onPointerDown={(e) => onPointerDown(e, p.num)}
                    className={`player ${draggingThis ? "player--dragging" : ""}`}
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
                    title="Arrastrá para mover. Doble click rápido para eliminar."
                  >
                    {(() => {
                      // ========== CONTROLES SOLO DOM (modificá estos) ==========
                      // Número
                      const NUM_FONT_PX_DOM = 24;
                      const NUM_OFFSET_DOM  = -0.60;

                      // Nombre
                      const NAME_SCALE_DOM        = 0.95;
                      const NAME_FONT_BOOST_DOM   = 1.25;
                      const NAME_LINE_H_MUL_DOM   = 0.80;
                      const NAME_SHIFT_R_DOM      = 0.30;
                      // ==========================================================
                      const r = PLAYER_SIZE / 2;

                      // ---------- Número ----------
                      const numOffsetPx = Math.round(r * NUM_OFFSET_DOM);

                      // ---------- Nombre ----------
                      const { font, lines } = fitNameIntoCircle(p.name || "");
                      const nameFont = Math.max(
                        8,
                        Math.round(font * NAME_SCALE_DOM * NAME_FONT_BOOST_DOM)
                      );
                      const lineH   = Math.round(nameFont * NAME_LINE_H_MUL_DOM);
                      const totalH  = lineH * lines.length;

                      const centerShiftPx   = Math.round(r * NAME_SHIFT_R_DOM);
                      const startYOffsetPx  = centerShiftPx - Math.round((totalH - lineH) / 2);

                      const nameBoxMaxW = PLAYER_SIZE - 6;

                      return (
                        <>
                          {/* Número (DOM) */}
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: `translate(-50%, calc(-50% + ${numOffsetPx}px))`,
                              fontSize: `${NUM_FONT_PX_DOM}px`,
                              fontWeight: 900,
                              color: "#0b1020",
                              pointerEvents: "none",
                              textAlign: "center",
                            }}
                          >
                            {p.num}
                          </div>

                          {/* Nombre (DOM) */}
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: `translate(calc(-50% - 2.5px), calc(-50% + ${startYOffsetPx}px))`,
                              width: `${nameBoxMaxW}px`,
                              textAlign: "center",
                              color: "#000",
                              pointerEvents: "none",
                              fontWeight: 900,
                            }}
                            title={p.name}
                          >
                            {lines.map((ln, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: `${nameFont}px`,
                                  lineHeight: `${lineH}px`,
                                  whiteSpace: "nowrap",
                                  wordBreak: "normal",
                                  overflow: "visible",
                                  margin: 0,
                                  padding: 0,
                                }}
                              >
                                {ln}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
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
              Arrastrá libre (X/Y). <b>Doble click</b> rápido sobre un jugador = eliminar.
            </div>
          </div>
        </>
      ) : (
        <>
          {/* === MODO MATCH === */}

{/* Header partido */}
<div
  style={{
    maxWidth: 1000,
    margin: "6px auto 0",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
    flexWrap: "wrap",
  }}
>
  {/* Selector de partido guardado */}
  <select
    className="select-dark control"
    value={selectedMatch}
    onChange={(e) => setSelectedMatch(e.target.value)}
    title="Elegir partido guardado"
    style={{ minWidth: 220 }}
  >
    <option value="">Cargar partido…</option>
    {Object.keys(matches).map((name) => (
      <option key={name} value={name}>
        {name}
      </option>
    ))}
  </select>

  <button
    className="btn btn--primary control"
    onClick={loadMatch}
    title="Cargar partido seleccionado"
    disabled={!selectedMatch}
  >
    Cargar
  </button>

  <button
    className="btn btn--danger control"
    onClick={deleteMatch}
    title="Borrar partido seleccionado"
    disabled={!selectedMatch}
  >
    Borrar
  </button>

  {/* Nombre del partido nuevo / actual */}
  <input
    className="control"
    value={matchName}
    onChange={(e) => setMatchName(e.target.value)}
    placeholder="Nombre del partido (ej. Sábado 16hs)"
    style={{
      minWidth: "260px",
      padding: "0 10px",
      borderRadius: "10px",
      border: "1px solid rgba(255,255,255,.15)",
      background: "rgba(255,255,255,.06)",
      color: "#fff",
      outline: "none",
    }}
  />

  <button className="btn btn--success control" onClick={saveMatch}>
    Guardar partido
  </button>

  <button className="btn btn--neutral control" onClick={exportBothPNG}>
    Exportar ambos PNG
  </button>
</div>

{/* Tabs A/B con renombrado inline (doble click) */}
<div
  style={{
    display: "flex",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  }}
>
  {["A", "B"].map((t) => {
    const isActive = activeTeam === t;
    const isEditing = editingTeam === t;
    const commonBtn = {
      minWidth: 130,
      border: isActive ? "1px solid rgba(255,255,255,.9)" : "1px solid rgba(255,255,255,.2)",
      background: isActive
        ? "linear-gradient(180deg,#a7f3d0,#34d399)"
        : "rgba(255,255,255,.06)",
      color: isActive ? "#062414" : "#e9f2ff",
    };

    return (
      <button
        key={t}
        className="btn control"
        onClick={() => setActiveTeam(t)}
        onDoubleClick={() => setEditingTeam(t)} // 👈 doble click para editar
        style={commonBtn}
        title="Doble click para renombrar"
      >
        {isEditing ? (
          <input
            autoFocus
            value={teamNames[t]}
            onChange={(e) =>
              setTeamNames((s) => ({ ...s, [t]: e.target.value }))
            }
            onBlur={() => setEditingTeam(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                // cancelar cambios: opcional, acá solo sacamos el foco
                e.currentTarget.blur();
              }
            }}
            style={{
              width: 110,
              border: "none",
              outline: "none",
              textAlign: "center",
              background: "transparent",
              color: "inherit",
              fontWeight: 800,
            }}
            placeholder={`Equipo ${t}`}
          />
        ) : (
          (teamNames[t] || `Equipo ${t}`)
        )}
      </button>
    );
  })}
</div>

          {/* Formaciones + Acciones (equipo activo) */}
          <div
            className="formations"
            style={{ display:"flex", gap: 6, justifyContent:"center", flexWrap:"wrap", alignItems:"center", marginTop: 6 }}
          >
            <div className="formations__row formations__schemes"
                 style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
              {["3-2-2", "3-3-1", "2-3-2", "2-2-3"].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFormation(f)}
                  className="btn control"
                  style={{
                    border:
                      getActiveTeam().formation === f
                        ? "1px solid rgba(255,255,255,.9)"
                        : "1px solid rgba(255,255,255,.2)",
                    background:
                      getActiveTeam().formation === f
                        ? "linear-gradient(180deg,#3b82f6,#2563eb)"
                        : "rgba(255,255,255,.05)",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="formations__row formations__actions"
                 style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap" }}>
              <button onClick={resetActivePositions} className="btn btn--warn control">Reiniciar posiciones</button>
              <button onClick={clearActiveField} className="btn btn--danger control">Limpiar cancha</button>
            </div>
          </div>

          {/* Alta rápida + Números (equipo activo) */}
          <div className="adder"
               style={{ maxWidth: 1000, margin:"6px auto 0", padding:"0 12px",
                        display:"flex", justifyContent:"center", alignItems:"center", gap:10 }}
          >
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={`Nombre del jugador (${teamNames[activeTeam] || `Equipo ${activeTeam}`})`}
              style={{
                width: "180px",
                padding: "9px 10px",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,.15)",
                background: "rgba(255,255,255,.06)",
                color: "#fff",
                outline: "none",
                textAlign: "left",
              }}
            />
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {ALLOWED_NUMBERS.map((n) => {
                const used = getActiveTeam().players.some((p) => p.num === n);
                return (
                  <button
                    key={n}
                    onClick={() => { addPlayerActive(n, nameInput); setNameInput(""); }}
                    disabled={used}
                    className="chip"
                    style={{
                      background: used ? "rgba(255,255,255,.12)" : "linear-gradient(180deg,#a7f3d0,#34d399)",
                      color: used ? "rgba(255,255,255,.5)" : "#062414",
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

          {/* Cancha (equipo activo) */}
          <div style={{ display:"grid", placeItems:"center", marginTop: 6, padding:"0 12px 14px" }}>
            <div
              ref={fieldRef}
              role="img"
              aria-label={`Cancha Equipo ${activeTeam} con ${getActiveTeam().players.length} jugadores en formación ${getActiveTeam().formation}`}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onPointerLeave={onPointerLeave}
              style={{
                height: FIELD_HEIGHT,
                aspectRatio: "2 / 3",
                maxWidth: FIELD_MAX_W,
                position: "relative",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 16px 36px rgba(0,0,0,.45), inset 0 0 0 2px rgba(255,255,255,.08)",
                background: "transparent",
              }}
            >
              <FieldSVG style={{ position:"absolute", inset:0, width:"100%", height:"100%", display:"block", zIndex:0 }} />

              {/* Watermarks */}
              <img className="field-watermark" src={LOGO_IMG} alt="HARD FC"
                   style={{ position:"absolute", left:8, bottom:8, width:"18%", maxWidth:120, opacity:.18,
                            filter:"drop-shadow(0 3px 6px rgba(0,0,0,.5))", pointerEvents:"none", userSelect:"none" }} />
              <img className="field-watermark" src={LOGO_IMG} alt="HARD FC"
                   style={{ position:"absolute", right:8, top:8, width:"18%", maxWidth:120, opacity:.18,
                            filter:"drop-shadow(0 3px 6px rgba(0,0,0,.5))", pointerEvents:"none", userSelect:"none" }} />

              {getActiveTeam().players.map((p) => {
                const draggingThis = dragging?.num === p.num;
                const isB = activeTeam === "B";
                return (
                  <div
                    key={`${activeTeam}-${p.num}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Jugador ${p.num}, ${p.name || 'sin nombre'}, posición X ${Math.round(p.x)}%, Y ${Math.round(p.y)}%`}
                    onPointerDown={(e) => onPointerDown(e, p.num)}
                    className={`player ${draggingThis ? "player--dragging" : ""}`}
                    style={{
                      position:"absolute",
                      left:`${p.x}%`, top:`${p.y}%`,
                      transform:"translate(-50%,-50%)",
                      width: px(PLAYER_SIZE),
                      height: px(PLAYER_SIZE),
                      borderRadius:"50%",
                      border: "2px solid rgba(255,255,255,.9)",
                      background:
                        p.num === 1
                          ? (isB
                              ? "radial-gradient(circle at 30% 30%, #c7d2fe, #3b82f6)"
                              : "radial-gradient(circle at 30% 30%, #fecaca, #ef4444)")
                          : (isB
                              ? "radial-gradient(circle at 30% 30%, #bfdbfe, #3b82f6)"
                              : "radial-gradient(circle at 30% 30%, #b7ff6e, #39ff14)"),
                      boxShadow: "0 8px 16px rgba(0,0,0,.45), inset 0 0 18px rgba(255,255,255,.35)",
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
                    title="Arrastrá para mover. Doble click rápido para eliminar."
                  >
                    {(() => {
                      const NUM_FONT_PX_DOM = 24;
                      const NUM_OFFSET_DOM  = -0.60;

                      const NAME_SCALE_DOM        = 0.95;
                      const NAME_FONT_BOOST_DOM   = 1.25;
                      const NAME_LINE_H_MUL_DOM   = 0.80;
                      const NAME_SHIFT_R_DOM      = 0.30;

                      const r = PLAYER_SIZE / 2;
                      const numOffsetPx = Math.round(r * NUM_OFFSET_DOM);

                      const { font, lines } = fitNameIntoCircle(p.name || "");
                      const nameFont = Math.max(8, Math.round(font * NAME_SCALE_DOM * NAME_FONT_BOOST_DOM));
                      const lineH   = Math.round(nameFont * NAME_LINE_H_MUL_DOM);
                      const totalH  = lineH * lines.length;

                      const centerShiftPx   = Math.round(r * NAME_SHIFT_R_DOM);
                      const startYOffsetPx  = centerShiftPx - Math.round((totalH - lineH) / 2);
                      const nameBoxMaxW = PLAYER_SIZE - 6;

                      return (
                        <>
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: `translate(-50%, calc(-50% + ${numOffsetPx}px))`,
                              fontSize: `${NUM_FONT_PX_DOM}px`,
                              fontWeight: 900,
                              color: "#0b1020",
                              pointerEvents: "none",
                              textAlign: "center",
                            }}
                          >
                            {p.num}
                          </div>

                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: "50%",
                              transform: `translate(calc(-50% - 2.5px), calc(-50% + ${startYOffsetPx}px))`,
                              width: `${nameBoxMaxW}px`,
                              textAlign: "center",
                              color: "#000",
                              pointerEvents: "none",
                              fontWeight: 900,
                            }}
                            title={p.name}
                          >
                            {lines.map((ln, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: `${nameFont}px`,
                                  lineHeight: `${lineH}px`,
                                  whiteSpace: "nowrap",
                                  wordBreak: "normal",
                                  overflow: "visible",
                                  margin: 0,
                                  padding: 0,
                                }}
                              >
                                {ln}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>

            <div style={{
              marginTop: 6,
              fontSize: "12.5px",
              color: "rgba(255,255,255,.85)",
              background: "rgba(0,0,0,.35)",
              padding: "5px 8px",
              borderRadius: 8,
              userSelect: "none",
            }}>
              {teamNames[activeTeam] || `Equipo ${activeTeam}`}: Arrastrá libre (X/Y). <b>Doble click</b> rápido para eliminar.
            </div>
          </div>
        </>
      )}
    </div>
  );
}

//Cada cambio es:
//git add .
//git commit -m "cambio X"
//git push

//git restore src/App.jsx

//-------MEJORASS---------//
//*FOTOS A LOS JUGADORES PREDETERMINADOS
//*EQUIPOS A Y B