import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  ClipboardList,
  Users,
  BadgeCheck,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";

const C = {
  bg:           "#F0EEE9",
  bgCard:       "#FAF8F5",
  khaki:        "#B8A992",
  mocha:        "#A47864",
  mochaDeep:    "#7A5540",
  rose:         "#EAA292",
  roseDark:     "#C4705E",
  terracotta:   "#C97E59",
  terracottaDk: "#9E5D38",
  textDark:     "#3D2010",
  textBody:     "#5C3D28",
  textMuted:    "#8C7058",
  textOnDark:   "#F0EEE9",
};

/* ─── Typewriter hook ──────────────────────────────────────────── */
function useTypewriter(text: string, startDelay: number, speed = 36) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;
    timer = setTimeout(() => {
      interval = setInterval(() => {
        setCount(c => {
          if (c >= text.length) { clearInterval(interval); return c; }
          return c + 1;
        });
      }, speed);
    }, startDelay);
    return () => { clearTimeout(timer); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return text.slice(0, count);
}

/* ─── Hero animation orchestrator ─────────────────────────────── */
interface AnimState {
  calendarVisible: boolean;
  fmlaHighlighted: number;   // 0-5 (how many FMLA days lit)
  fmlaCardsVisible: boolean;
  pendingHighlighted: number; // 0-7 (how many pending days lit)
  pendingCardVisible: boolean;
}

function useHeroAnimation(): AnimState {
  const [calendarVisible,   setCalendarVisible]   = useState(false);
  const [fmlaHighlighted,   setFmlaHighlighted]   = useState(0);
  const [fmlaCardsVisible,  setFmlaCardsVisible]  = useState(false);
  const [pendingHighlighted,setPendingHighlighted] = useState(0);
  const [pendingCardVisible,setPendingCardVisible] = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const push = (fn: () => void, ms: number) => ts.push(setTimeout(fn, ms));

    // Calendar slides in
    push(() => setCalendarVisible(true), 450);

    // FMLA days 8-12 highlight one at a time (5 days × 120ms)
    for (let i = 0; i < 5; i++) {
      const step = i;
      push(() => setFmlaHighlighted(step + 1), 1350 + step * 120);
    }

    // FMLA tile + Approved badge fly in
    push(() => setFmlaCardsVisible(true), 2050);

    // Pending days: 17, 18, 22-26 (7 days × 110ms)
    for (let i = 0; i < 7; i++) {
      const step = i;
      push(() => setPendingHighlighted(step + 1), 2500 + step * 110);
    }

    // Pending card flies in
    push(() => setPendingCardVisible(true), 3350);

    return () => ts.forEach(clearTimeout);
  }, []);

  return { calendarVisible, fmlaHighlighted, fmlaCardsVisible, pendingHighlighted, pendingCardVisible };
}

/* ─── Day order for pending highlight ─────────────────────────── */
const PENDING_ORDER: Record<number, number> = {
  17: 1, 18: 2, 22: 3, 23: 4, 24: 5, 25: 6, 26: 7,
};

/* ─── Animated hero illustration ──────────────────────────────── */
function HeroIllustration({ anim }: { anim: AnimState }) {
  const { fmlaHighlighted, fmlaCardsVisible, pendingHighlighted, pendingCardVisible } = anim;

  const days = Array.from({ length: 35 }, (_, i) => i + 1);
  const leaveA = new Set([8, 9, 10, 11, 12]);
  const leaveB = new Set([17, 18]);
  const leaveC = new Set([22, 23, 24, 25, 26]);

  return (
    <svg viewBox="0 0 460 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg">
      <defs>
        <filter id="shadow" x="-15%" y="-15%" width="130%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor={C.mocha} floodOpacity="0.14" />
        </filter>
      </defs>

      {/* Glow orbs */}
      <ellipse cx="360" cy="70" rx="90" ry="90" fill={C.terracotta} opacity="0.09" />
      <ellipse cx="100" cy="270" rx="70" ry="70" fill={C.rose} opacity="0.13" />

      {/* Main calendar card */}
      <rect x="14" y="20" width="432" height="298" rx="16" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" />

      {/* Header bar */}
      <rect x="14" y="20" width="432" height="46" rx="16" fill={C.terracotta} />
      <rect x="14" y="52" width="432" height="14" fill={C.terracotta} />
      <text x="148" y="48" textAnchor="middle" fontSize="13" fontWeight="700" fill="white" fontFamily="Roboto">Leave Calendar</text>

      {/* Day-of-week headers */}
      {["S","M","T","W","T","F","S"].map((d, i) => (
        <text key={i} x={50 + i * 33} y="88" textAnchor="middle" fontSize="9" fontWeight="600" fill={C.textMuted} fontFamily="Roboto">{d}</text>
      ))}
      <line x1="26" y1="96" x2="270" y2="96" stroke={C.khaki} strokeWidth="0.8" opacity="0.6" />

      {/* Day cells — animated highlights */}
      {days.map((day, i) => {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const cx = 50 + col * 33;
        const cy = 114 + row * 36;

        const isA = leaveA.has(day);
        const isB = leaveB.has(day);
        const isC = leaveC.has(day);
        const isToday = day === 15;

        const fmlaActive    = isA && fmlaHighlighted    >= (day - 7);
        const pendingActive = (isB || isC) && pendingHighlighted >= (PENDING_ORDER[day] ?? 99);

        const bgFill = isToday
          ? C.terracotta
          : (isB || isC) ? C.rose + "44"
          : C.terracotta + "33";

        const textFill = isToday ? "white"
          : fmlaActive    ? C.terracottaDk
          : pendingActive ? C.roseDark
          : C.textDark;

        const showRect = isToday || fmlaActive || pendingActive;

        return (
          <g key={day}>
            <rect
              x={cx - 13} y={cy - 13} width={26} height={26}
              rx={isToday ? 13 : 5}
              fill={bgFill}
              style={{ opacity: showRect ? 1 : 0, transition: "opacity 0.22s ease" }}
            />
            <text
              x={cx} y={cy + 5}
              textAnchor="middle" fontSize="10"
              fill={textFill}
              fontWeight={isToday ? "700" : "400"}
              fontFamily="Roboto"
            >
              {day <= 30 ? day : ""}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <circle cx="30" cy="300" r="5" fill={C.terracotta} opacity="0.8" />
      <text x="40" y="304" fontSize="9" fill={C.textMuted} fontFamily="Roboto">Approved</text>
      <circle cx="108" cy="300" r="5" fill={C.rose} opacity="0.8" />
      <text x="118" y="304" fontSize="9" fill={C.textMuted} fontFamily="Roboto">Pending Review</text>
      <circle cx="210" cy="300" r="5" fill={C.terracotta} />
      <text x="220" y="304" fontSize="9" fill={C.textMuted} fontFamily="Roboto">Today</text>

      {/* ── FMLA card + Approved badge (phase 2) ── */}
      <g style={{
        opacity: fmlaCardsVisible ? 1 : 0,
        transform: fmlaCardsVisible ? "translateX(0)" : "translateX(18px)",
        transition: "opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)",
        transformBox: "fill-box" as React.CSSProperties["transformBox"],
        transformOrigin: "right center",
      }}>
        {/* FMLA tile */}
        <rect x="278" y="48" width="152" height="84" rx="12" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#shadow)" />
        <rect x="286" y="58" width="30" height="30" rx="7" fill={C.terracotta} opacity="0.18" />
        <text x="301" y="79" textAnchor="middle" fontSize="15" fill={C.terracottaDk}>📋</text>
        <text x="324" y="70" fontSize="9" fontWeight="700" fill={C.textDark} fontFamily="Roboto">FMLA</text>
        <text x="324" y="81" fontSize="8" fill={C.textMuted} fontFamily="Roboto">12 weeks</text>
        <rect x="286" y="96" width="130" height="5" rx="2.5" fill={C.khaki} opacity="0.38" />
        <rect x="286" y="105" width="95" height="5" rx="2.5" fill={C.khaki} opacity="0.24" />
        <rect x="286" y="114" width="112" height="5" rx="2.5" fill={C.khaki} opacity="0.19" />

        {/* Approved badge */}
        <rect x="278" y="148" width="152" height="62" rx="12" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#shadow)" />
        <circle cx="298" cy="168" r="9" fill={C.terracotta} opacity="0.2" />
        <polyline points="293,168 297,172 304,163" stroke={C.terracottaDk} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="314" y="165" fontSize="9" fontWeight="700" fill={C.textDark} fontFamily="Roboto">Approved</text>
        <text x="314" y="176" fontSize="8" fill={C.textMuted} fontFamily="Roboto">Jun 8 – 12</text>
        <rect x="288" y="185" width="128" height="5" rx="2.5" fill={C.khaki} opacity="0.28" />
        <rect x="288" y="194" width="90" height="5" rx="2.5" fill={C.khaki} opacity="0.19" />
      </g>

      {/* ── Pending review tile (phase 4) ── */}
      <g style={{
        opacity: pendingCardVisible ? 1 : 0,
        transform: pendingCardVisible ? "translateX(0)" : "translateX(18px)",
        transition: "opacity 0.55s cubic-bezier(0.34,1.56,0.64,1), transform 0.55s cubic-bezier(0.34,1.56,0.64,1)",
        transformBox: "fill-box" as React.CSSProperties["transformBox"],
        transformOrigin: "right center",
      }}>
        <rect x="278" y="226" width="152" height="54" rx="12" fill={C.rose} opacity="0.14" stroke={C.rose} strokeWidth="1" filter="url(#shadow)" />
        <circle cx="298" cy="249" r="7" fill={C.rose} opacity="0.5" />
        <text x="298" y="253" textAnchor="middle" fontSize="9" fill={C.roseDark}>!</text>
        <text x="312" y="245" fontSize="8" fontWeight="700" fill={C.roseDark} fontFamily="Roboto">Pending Review</text>
        <text x="312" y="256" fontSize="8" fill={C.textBody} fontFamily="Roboto">Jun 17 – 18</text>
        <rect x="288" y="265" width="120" height="4" rx="2" fill={C.rose} opacity="0.22" />
      </g>
    </svg>
  );
}

/* ─── Leave Journey illustration — three cascading story cards ── */
function WorksIllustration() {
  return (
    <svg viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg">
      <defs>
        <filter id="c1" x="-8%" y="-8%" width="116%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={C.mocha} floodOpacity="0.18" />
        </filter>
        <filter id="c2" x="-8%" y="-8%" width="116%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={C.mocha} floodOpacity="0.14" />
        </filter>
        <filter id="c3" x="-8%" y="-8%" width="116%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={C.mocha} floodOpacity="0.10" />
        </filter>
      </defs>

      {/* Ambient glows */}
      <ellipse cx="420" cy="80"  rx="120" ry="120" fill={C.terracotta} opacity="0.07" />
      <ellipse cx="60"  cy="300" rx="90"  ry="90"  fill={C.rose}       opacity="0.10" />

      {/* ══ Card 1 — bottom (Employee Request) ══ */}
      <rect x="56" y="210" width="370" height="108" rx="18" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#c3)" />

      {/* Avatar */}
      <circle cx="92" cy="256" r="22" fill={C.khaki} opacity="0.35" />
      <circle cx="92" cy="248" r="9"  fill={C.mocha}    opacity="0.7"  />
      <ellipse cx="92" cy="270" rx="13" ry="8" fill={C.mocha} opacity="0.5" />

      {/* Employee info */}
      <text x="124" y="244" fontSize="11" fontWeight="700" fill={C.textDark}  fontFamily="Roboto">Jane Smith</text>
      <text x="124" y="258" fontSize="9"  fontWeight="400" fill={C.textMuted} fontFamily="Roboto">Employee · Store #14</text>

      {/* Leave type chip */}
      <rect x="124" y="266" width="80" height="18" rx="9" fill={C.mocha + "30"} />
      <text x="164" y="278" textAnchor="middle" fontSize="8" fontWeight="600" fill={C.mochaDeep} fontFamily="Roboto">Medical Leave</text>

      {/* Date range */}
      <rect x="290" y="236" width="118" height="40" rx="10" fill={C.bg} stroke={C.khaki} strokeWidth="1" />
      <text x="349" y="251" textAnchor="middle" fontSize="8"  fontWeight="600" fill={C.textMuted} fontFamily="Roboto">REQUESTED</text>
      <text x="349" y="266" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={C.textDark}  fontFamily="Roboto">Jun 8 – Jul 2</text>

      {/* Step label */}
      <rect x="68" y="300" width="90" height="14" rx="7" fill={C.khaki + "44"} />
      <text x="113" y="310" textAnchor="middle" fontSize="7.5" fontWeight="600" fill={C.textMuted} fontFamily="Roboto" letterSpacing="0.5">STEP 1 · SUBMITTED</text>

      {/* ══ Card 2 — middle (LeaveIQ Analysis) ══ */}
      <rect x="36" y="120" width="370" height="110" rx="18" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#c2)" />

      {/* Header strip */}
      <rect x="36" y="120" width="370" height="36" rx="18" fill={C.terracotta + "18"} />
      <rect x="36" y="140"  width="370" height="16"  fill={C.terracotta + "18"} />
      <circle cx="60" cy="138" r="10" fill={C.terracotta + "40"} />
      <text x="60" y="143" textAnchor="middle" fontSize="11" fill={C.terracottaDk}>✦</text>
      <text x="78" y="135" fontSize="10" fontWeight="700" fill={C.terracottaDk} fontFamily="Roboto">LeaveIQ Analysis</text>
      <text x="78" y="148" fontSize="8"  fontWeight="400" fill={C.textMuted}    fontFamily="Roboto">Regulatory check complete</text>

      {/* 3 eligibility items in a row */}
      {[
        { label: "FMLA",  sub: "12 wks", x: 56,  pass: true  },
        { label: "CFRA",  sub: "Eligible", x: 174, pass: true  },
        { label: "PDL",   sub: "N/A",     x: 292, pass: false },
      ].map(({ label, sub, x, pass }) => (
        <g key={label}>
          <rect x={x} y="168" width="90" height="44" rx="10"
            fill={pass ? C.terracotta + "12" : C.rose + "14"}
            stroke={pass ? C.terracotta + "40" : C.rose + "35"}
            strokeWidth="1"
          />
          <circle cx={x + 16} cy="183" r="7"
            fill={pass ? C.terracotta + "30" : C.rose + "30"} />
          {pass ? (
            <polyline points={`${x+11},183 ${x+15},187 ${x+22},178`}
              stroke={C.terracottaDk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <line x1={x+11} y1={179} x2={x+21} y2={187} stroke={C.roseDark} strokeWidth="1.5" strokeLinecap="round" />
              <line x1={x+21} y1={179} x2={x+11} y2={187} stroke={C.roseDark} strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
          <text x={x + 30} y="184" fontSize="9"  fontWeight="700" fill={C.textDark}  fontFamily="Roboto">{label}</text>
          <text x={x + 30} y="196" fontSize="8"   fontWeight="400" fill={C.textMuted} fontFamily="Roboto">{sub}</text>
        </g>
      ))}

      {/* Step label */}
      <rect x="48" y="218" width="100" height="14" rx="7" fill={C.terracotta + "20"} />
      <text x="98" y="228" textAnchor="middle" fontSize="7.5" fontWeight="600" fill={C.terracottaDk} fontFamily="Roboto" letterSpacing="0.5">STEP 2 · ANALYZED</text>

      {/* ══ Card 3 — top front (HR Approved + Notice Sent) ══ */}
      <rect x="16" y="22" width="370" height="118" rx="18" fill={C.terracottaDk} filter="url(#c1)" />

      {/* Big approve badge */}
      <circle cx="66" cy="81" r="32" fill="white" opacity="0.10" />
      <circle cx="66" cy="81" r="22" fill="white" opacity="0.14" />
      <polyline points="54,81 63,90 80,70"
        stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {/* Approve text */}
      <text x="108" y="65" fontSize="18" fontWeight="800" fill="white" fontFamily="Roboto">Approved</text>
      <text x="108" y="83" fontSize="9"  fontWeight="400" fill={C.bg + "cc"} fontFamily="Roboto">HR Decision · FMLA Leave Granted</text>

      {/* Notice sent chip */}
      <rect x="108" y="92" width="116" height="22" rx="11" fill="white" opacity="0.15" />
      <text x="165" y="107" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="white" fontFamily="Roboto">✉ Notice sent to employee</text>

      {/* Date chip */}
      <rect x="282" y="58" width="90" height="46" rx="12" fill="white" opacity="0.12" />
      <text x="327" y="76"  textAnchor="middle" fontSize="8"   fontWeight="600" fill={C.bg + "bb"} fontFamily="Roboto">APPROVED</text>
      <text x="327" y="91"  textAnchor="middle" fontSize="9.5" fontWeight="700" fill="white"       fontFamily="Roboto">12 weeks</text>
      <text x="327" y="103" textAnchor="middle" fontSize="7.5" fontWeight="400" fill={C.bg + "99"} fontFamily="Roboto">Jun 8 – Sep 2</text>

      {/* Step label */}
      <rect x="28" y="122" width="104" height="14" rx="7" fill="white" opacity="0.12" />
      <text x="80" y="132" textAnchor="middle" fontSize="7.5" fontWeight="600" fill={C.bg + "cc"} fontFamily="Roboto" letterSpacing="0.5">STEP 3 · RESOLVED</text>

      {/* Connecting dashed arrows between cards */}
      <line x1="180" y1="140" x2="180" y2="120"
        stroke={C.khaki} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
      <polygon points="175,122 185,122 180,114" fill={C.khaki} opacity="0.45" />

      <line x1="200" y1="230" x2="200" y2="210"
        stroke={C.khaki} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.4" />
      <polygon points="195,212 205,212 200,204" fill={C.khaki} opacity="0.35" />
    </svg>
  );
}

/* ─── Blinking cursor ──────────────────────────────────────────── */
function Cursor({ visible }: { visible: boolean }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(iv);
  }, []);
  if (!visible) return null;
  return (
    <span
      style={{
        display: "inline-block",
        width: "3px",
        height: "1em",
        background: C.terracottaDk,
        verticalAlign: "text-bottom",
        borderRadius: "1px",
        marginLeft: "2px",
        opacity: blink ? 1 : 0,
        transition: "opacity 0.1s",
      }}
    />
  );
}

/* ─── Heading text constants ───────────────────────────────────── */
const LINE1 = "Leave Management";
const LINE2 = "Simple. Smart.";
const SUBTEXT = "An intelligent solution for streamlined leave of absence management — compliant HR and informed employees.";

const LINE1_LEN  = LINE1.length;
const LINE2_LEN  = LINE2.length;
const HEADING_LEN = LINE1_LEN + 1 + LINE2_LEN; // +1 for the space/newline between

/* ─── Landing page ─────────────────────────────────────────────── */
export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Heading types in first (both parts), then subtext
  const headingTyped  = useTypewriter(LINE1 + " " + LINE2, 0,    42);
  const subtextTyped  = useTypewriter(SUBTEXT, HEADING_LEN * 42 + 180, 20);
  const anim          = useHeroAnimation();

  // Derived display values
  const h1Chars    = headingTyped.length;
  const line1Shown = headingTyped.slice(0, LINE1_LEN);
  const line2Shown = h1Chars > LINE1_LEN + 1
    ? headingTyped.slice(LINE1_LEN + 1)
    : "";

  const headingDone = h1Chars >= HEADING_LEN;
  const subtextDone = subtextTyped.length >= SUBTEXT.length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "Roboto, sans-serif", color: C.textDark }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ background: `${C.bg}f5`, borderColor: C.khaki }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/leavara-logo.png" alt="Leavara" className="h-8 w-8 object-contain" />
            <span className="font-bold text-lg" style={{ color: C.textDark }}>
              Leavara <span style={{ color: C.terracottaDk }}>LeaveIQ</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: C.textBody }}>
            <a href="#features" className="hover:opacity-70 transition-opacity">Features</a>
            <a href="#how-it-works" className="hover:opacity-70 transition-opacity">How It Works</a>
            <a href="#compliance" className="hover:opacity-70 transition-opacity">Why LeaveIQ</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/interest"
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: C.terracotta }}
            >
              Get Started
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)} style={{ color: C.textBody }}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t px-6 py-4 flex flex-col gap-4 text-sm font-medium" style={{ background: C.bg, borderColor: C.khaki, color: C.textBody }}>
            <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How It Works</a>
            <a href="#compliance" onClick={() => setMobileOpen(false)}>Why LeaveIQ</a>
            <Link href="/interest" onClick={() => setMobileOpen(false)} className="mt-2 text-center py-2.5 rounded-lg font-semibold text-white" style={{ background: C.terracotta }}>
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #ede8df 60%, ${C.bg} 100%)` }}
      >
        <div className="absolute top-[-80px] right-[-80px] w-[500px] h-[500px] rounded-full blur-[110px] pointer-events-none" style={{ background: C.terracotta + "22" }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-[350px] h-[350px] rounded-full blur-[90px] pointer-events-none" style={{ background: C.rose + "44" }} />
        <div className="absolute top-[30%] left-[30%] w-[200px] h-[200px] rounded-full blur-[70px] pointer-events-none" style={{ background: C.rose + "22" }} />

        <div className="relative max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-12 items-center">

          {/* Left: typed heading + subtext */}
          <div>
            <h1
              className="text-4xl sm:text-5xl font-bold leading-tight mb-4"
              style={{ color: C.textDark, minHeight: "4.5rem" }}
            >
              {line1Shown}
              {line2Shown && (
                <>
                  {" "}
                  <span style={{ color: C.terracottaDk }}>{line2Shown}</span>
                </>
              )}
              <Cursor visible={!headingDone} />
            </h1>

            <p
              className="text-lg mb-8 leading-relaxed"
              style={{ color: C.textBody, minHeight: "5rem" }}
            >
              {subtextTyped}
              <Cursor visible={headingDone && !subtextDone} />
            </p>

            <div
              className="flex flex-wrap gap-3 transition-all duration-500"
              style={{ opacity: subtextDone ? 1 : 0, transform: subtextDone ? "translateY(0)" : "translateY(8px)" }}
            >
              <Link
                href="/interest"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                style={{ background: C.terracotta }}
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Right: animated calendar illustration */}
          <div
            className="flex justify-center"
            style={{
              opacity:    anim.calendarVisible ? 1 : 0,
              transform:  anim.calendarVisible ? "translateX(0)" : "translateX(72px)",
              transition: "opacity 0.7s cubic-bezier(0.34,1.56,0.64,1), transform 0.7s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <HeroIllustration anim={anim} />
          </div>
        </div>
      </section>

      {/* ── FEATURES STRIP ── */}
      <section id="features" className="border-y" style={{ background: C.khaki + "33", borderColor: C.khaki }}>
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            {
              icon: <ClipboardList className="w-6 h-6" style={{ color: C.terracottaDk }} />,
              bg: C.terracotta + "22",
              title: "Automated Eligibility Checks",
              desc: "Instantly determine leave eligibility based on applicable federal and state laws.",
              highlight: false,
            },
            {
              icon: <BadgeCheck className="w-6 h-6" style={{ color: C.roseDark }} />,
              bg: C.rose + "44",
              title: "HR Recommendations",
              desc: "Deterministic analysis with clear recommendations for HR review.",
              highlight: true,
            },
            {
              icon: <MessageSquare className="w-6 h-6" style={{ color: C.roseDark }} />,
              bg: C.rose + "33",
              title: "Employee Guidance",
              desc: "Clear, timely communication for employees through every step.",
              highlight: false,
            },
          ].map((f) => (
            <div
              key={f.title}
              className="flex gap-4 items-start p-4 rounded-xl border"
              style={{
                background: f.highlight ? C.rose + "18" : "transparent",
                borderColor: f.highlight ? C.rose + "66" : "transparent",
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: f.bg }}>
                {f.icon}
              </div>
              <div>
                <h3 className="font-bold text-base mb-1" style={{ color: C.textDark }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-20" style={{ background: C.bg }}>
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div className="flex justify-center order-2 md:order-1">
            <WorksIllustration />
          </div>
          <div className="order-1 md:order-2">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: C.textDark }}>
              Simplify Leave Management{" "}
              <span style={{ color: C.terracottaDk }}>with Intelligence</span>
            </h2>
            <p className="mb-8" style={{ color: C.textBody }}>
              Stay compliant and efficient with Leavara LeaveIQ.
            </p>
            <div className="space-y-4">
              {[
                { text: "Ensure Compliance with State & Federal Leave Laws", rose: false },
                { text: "Track and Manage Leaves Seamlessly", rose: true },
                { text: "Guide Employees Through Every Step", rose: false },
                { text: "Deterministic Eligibility — No Guesswork", rose: true },
                { text: "HR Always Makes the Final Decision", rose: false },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" style={{ color: item.rose ? C.rose : C.terracotta }} />
                  <span className="text-sm font-medium" style={{ color: C.textDark }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE ── */}
      <section id="compliance" style={{ background: C.mochaDeep }}>
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-2" style={{ color: C.textOnDark }}>
            Why Choose Leavara LeaveIQ?
          </h2>
          <p className="mb-12 text-sm" style={{ color: C.khaki }}>
            Built for HR teams who need accuracy, compliance, and confidence.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck className="w-8 h-8" style={{ color: C.terracotta }} />,
                title: "Compliance Assured",
                desc: "Always aligned with applicable federal and state leave regulations.",
              },
              {
                icon: <BadgeCheck className="w-8 h-8" style={{ color: C.terracotta }} />,
                title: "HR Empowerment",
                desc: "Clear analysis with HR decisions — never automated approvals.",
              },
              {
                icon: <Users className="w-8 h-8" style={{ color: C.rose }} />,
                title: "Employee Support",
                desc: "Better guidance through Ava, less confusion for your team.",
                roseCard: true,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center gap-4 p-6 rounded-2xl border"
                style={{
                  background: (item as { roseCard?: boolean }).roseCard ? C.rose + "22" : C.mocha + "33",
                  borderColor: (item as { roseCard?: boolean }).roseCard ? C.rose + "66" : C.mocha + "55",
                }}
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: (item as { roseCard?: boolean }).roseCard ? C.rose + "33" : C.terracotta + "22" }}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg" style={{ color: C.textOnDark }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.khaki }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-20 text-center" style={{ background: C.khaki + "25" }}>
        <div className="max-w-xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-3" style={{ color: C.textDark }}>
            Ready to Transform Your Leave Management?
          </h2>
          <p className="mb-8" style={{ color: C.textBody }}>
            Tell us about your organization and we'll show you how LeaveIQ can help.
          </p>
          <Link
            href="/interest"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
            style={{ background: C.terracotta }}
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-8" style={{ background: C.terracotta, borderColor: C.terracotta }}>
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: C.textOnDark }}>
          <div className="flex items-center gap-2">
            <img src="/leavara-logo.png" alt="Leavara" className="h-5 w-5 object-contain" />
            <span className="font-semibold">Leavara LeaveIQ</span>
          </div>
          <span style={{ color: C.bg + "bb" }}>© {new Date().getFullYear()} Leavara, LLC · All rights reserved.</span>
          <div className="flex gap-5" style={{ color: C.bg + "bb" }}>
            <Link href="/login" className="hover:opacity-70 transition-opacity">Log In</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
