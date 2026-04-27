import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Menu,
  X,
  CheckCircle2,
  ShieldCheck,
  BadgeCheck,
  Users,
  BarChart3,
  Target,
  Star,
  TrendingUp,
  ClipboardList,
  MessageSquare,
  Zap,
  ChevronDown,
} from "lucide-react";

/* ─── Brand palette ─────────────────────────────────────────────── */
const C = {
  bg:           "#F0EEE9",
  bgCard:       "#FAF8F5",
  khaki:        "#B8A992",
  mocha:        "#A47864",
  mochaDeep:    "#7A5540",
  terracotta:   "#C97E59",
  terracottaDk: "#9E5D38",
  rose:         "#EAA292",
  roseDark:     "#C4705E",
  textDark:     "#3D2010",
  textBody:     "#5C3D28",
  textMuted:    "#8C7058",
  textOnDark:   "#F0EEE9",
  // PerformIQ accent — teal
  perf:         "#2E7B7B",
  perfLight:    "#5BA8A8",
  perfDark:     "#1E5555",
  perfBg:       "#EBF5F5",
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

/* ─── Blinking cursor ──────────────────────────────────────────── */
function Cursor({ visible, color }: { visible: boolean; color?: string }) {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setBlink(b => !b), 530);
    return () => clearInterval(iv);
  }, []);
  if (!visible) return null;
  return (
    <span style={{
      display: "inline-block", width: "3px", height: "0.9em",
      background: color ?? C.terracottaDk, verticalAlign: "text-bottom",
      borderRadius: "1px", marginLeft: "2px",
      opacity: blink ? 1 : 0, transition: "opacity 0.1s",
    }} />
  );
}

/* ─── LeaveIQ Hero Illustration ────────────────────────────────── */
function LeaveIQIllustration() {
  const [visible, setVisible] = useState(false);
  const [dotsLit, setDotsLit] = useState(0);
  const [cardVisible, setCardVisible] = useState(false);

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => ts.push(setTimeout(fn, ms));
    t(() => setVisible(true), 300);
    for (let i = 0; i < 5; i++) t(() => setDotsLit(i + 1), 900 + i * 140);
    t(() => setCardVisible(true), 1700);
    return () => ts.forEach(clearTimeout);
  }, []);

  const days = Array.from({ length: 35 }, (_, i) => i + 1);
  const approved = new Set([8, 9, 10, 11, 12]);

  return (
    <svg viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md">
      <defs>
        <filter id="ls1"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={C.mocha} floodOpacity="0.16" /></filter>
        <filter id="ls2"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={C.terracottaDk} floodOpacity="0.25" /></filter>
      </defs>

      {/* Glow orbs */}
      <ellipse cx="360" cy="50" rx="80" ry="80" fill={C.terracotta} opacity="0.08" />
      <ellipse cx="60" cy="240" rx="60" ry="60" fill={C.rose} opacity="0.12" />

      {/* Calendar card */}
      <g style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "all 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <rect x="10" y="10" width="260" height="240" rx="14" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#ls1)" />
        <rect x="10" y="10" width="260" height="42" rx="14" fill={C.terracotta} />
        <rect x="10" y="38" width="260" height="14" fill={C.terracotta} />
        <text x="140" y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="Roboto">Leave Calendar — June</text>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <text key={i} x={33 + i * 34} y="70" textAnchor="middle" fontSize="8.5" fontWeight="600" fill={C.textMuted} fontFamily="Roboto">{d}</text>
        ))}
        <line x1="18" y1="78" x2="262" y2="78" stroke={C.khaki} strokeWidth="0.8" opacity="0.5" />
        {days.map((day, i) => {
          const col = i % 7, row = Math.floor(i / 7);
          const cx = 33 + col * 34, cy = 98 + row * 34;
          const isApproved = approved.has(day);
          const isToday = day === 15;
          const lit = isApproved && dotsLit >= (day - 7);
          return (
            <g key={day}>
              {(isToday || lit) && (
                <rect x={cx - 12} y={cy - 12} width={24} height={24}
                  rx={isToday ? 12 : 5}
                  fill={isToday ? C.terracotta : C.terracotta + "30"}
                  style={{ opacity: 1, transition: "all 0.2s" }} />
              )}
              <text x={cx} y={cy + 5} textAnchor="middle" fontSize="9.5"
                fill={isToday ? "white" : lit ? C.terracottaDk : C.textDark}
                fontWeight={isToday ? "700" : "400"} fontFamily="Roboto">
                {day <= 30 ? day : ""}
              </text>
            </g>
          );
        })}
      </g>

      {/* Approved card */}
      <g style={{ opacity: cardVisible ? 1 : 0, transform: cardVisible ? "none" : "translateX(20px)", transition: "all 0.55s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <rect x="276" y="30" width="134" height="76" rx="12" fill={C.bgCard} stroke={C.khaki} strokeWidth="1.5" filter="url(#ls1)" />
        <rect x="284" y="41" width="28" height="28" rx="7" fill={C.terracotta + "20"} />
        <text x="298" y="61" textAnchor="middle" fontSize="14">📋</text>
        <text x="320" y="52" fontSize="9" fontWeight="700" fill={C.textDark} fontFamily="Roboto">FMLA Leave</text>
        <text x="320" y="63" fontSize="7.5" fill={C.textMuted} fontFamily="Roboto">12 weeks eligible</text>
        <rect x="284" y="78" width="118" height="5" rx="2.5" fill={C.khaki} opacity="0.35" />
        <rect x="284" y="87" width="88" height="5" rx="2.5" fill={C.khaki} opacity="0.22" />

        <rect x="276" y="118" width="134" height="60" rx="12" fill={C.terracottaDk} filter="url(#ls2)" />
        <circle cx="296" cy="143" r="9" fill="white" opacity="0.15" />
        <polyline points="290,143 295,148 304,137" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="312" y="139" fontSize="9" fontWeight="700" fill="white" fontFamily="Roboto">Approved</text>
        <text x="312" y="150" fontSize="7.5" fill={C.bg + "cc"} fontFamily="Roboto">Jun 8 – 12</text>
        <rect x="284" y="160" width="110" height="4" rx="2" fill="white" opacity="0.18" />

        <rect x="276" y="190" width="134" height="52" rx="12" fill={C.bgCard} stroke={C.rose + "60"} strokeWidth="1.5" filter="url(#ls1)" />
        <circle cx="296" cy="212" r="7" fill={C.rose + "50"} />
        <text x="296" y="216" textAnchor="middle" fontSize="9" fill={C.roseDark}>!</text>
        <text x="310" y="208" fontSize="8.5" fontWeight="700" fill={C.roseDark} fontFamily="Roboto">Pending Review</text>
        <text x="310" y="219" fontSize="7.5" fill={C.textBody} fontFamily="Roboto">Jun 17 – 18</text>
        <rect x="284" y="228" width="106" height="4" rx="2" fill={C.rose} opacity="0.22" />
      </g>
    </svg>
  );
}

/* ─── PerformIQ Illustration ────────────────────────────────────── */
function PerformIQIllustration() {
  const [visible, setVisible] = useState(false);
  const [bars, setBars] = useState([0, 0, 0, 0]);
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => ts.push(setTimeout(fn, ms));
    t(() => setVisible(true), 200);
    t(() => setBars([82, 0, 0, 0]), 700);
    t(() => setBars([82, 67, 0, 0]), 950);
    t(() => setBars([82, 67, 91, 0]), 1200);
    t(() => setBars([82, 67, 91, 74]), 1450);
    return () => ts.forEach(clearTimeout);
  }, []);

  const people = [
    { name: "A. Rivera", role: "Sales Lead", score: 82, color: C.perf },
    { name: "J. Chen", role: "Engineer", score: 67, color: C.perfLight },
    { name: "M. Patel", role: "Designer", score: 91, color: C.perf },
    { name: "S. Kim", role: "Operations", score: 74, color: C.perfLight },
  ];

  return (
    <svg viewBox="0 0 420 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md">
      <defs>
        <filter id="ps1"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={C.perf} floodOpacity="0.14" /></filter>
        <filter id="ps2"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={C.perfDark} floodOpacity="0.22" /></filter>
      </defs>

      {/* Glow orbs */}
      <ellipse cx="360" cy="50" rx="80" ry="80" fill={C.perf} opacity="0.08" />
      <ellipse cx="60" cy="250" rx="65" ry="65" fill={C.perfLight} opacity="0.10" />

      {/* Main dashboard card */}
      <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s" }}>
        <rect x="10" y="10" width="270" height="250" rx="14" fill={C.bgCard} stroke="#A8CFCF" strokeWidth="1.5" filter="url(#ps1)" />

        {/* Header */}
        <rect x="10" y="10" width="270" height="44" rx="14" fill={C.perfDark} />
        <rect x="10" y="38" width="270" height="16" fill={C.perfDark} />
        <text x="145" y="35" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="Roboto">Q2 Performance Review</text>

        {/* Score rings summary */}
        <text x="22" y="74" fontSize="8" fontWeight="600" fill={C.textMuted} fontFamily="Roboto" letterSpacing="0.5">TEAM OVERVIEW</text>

        {/* Circular score */}
        <circle cx="62" cy="108" r="28" fill="none" stroke="#A8CFCF" strokeWidth="5" />
        <circle cx="62" cy="108" r="28" fill="none" stroke={C.perf} strokeWidth="5"
          strokeDasharray={`${visible ? 2 * Math.PI * 28 * 0.79 : 0} ${2 * Math.PI * 28}`}
          strokeDashoffset={2 * Math.PI * 28 * 0.25}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s ease" }} />
        <text x="62" y="105" textAnchor="middle" fontSize="14" fontWeight="800" fill={C.perfDark} fontFamily="Roboto">79</text>
        <text x="62" y="116" textAnchor="middle" fontSize="7" fill={C.textMuted} fontFamily="Roboto">avg score</text>

        {/* Stats */}
        <rect x="102" y="82" width="70" height="30" rx="8" fill={C.perfBg} />
        <text x="137" y="95" textAnchor="middle" fontSize="14" fontWeight="800" fill={C.perfDark} fontFamily="Roboto">12</text>
        <text x="137" y="107" textAnchor="middle" fontSize="7" fill={C.textMuted} fontFamily="Roboto">on track</text>

        <rect x="180" y="82" width="70" height="30" rx="8" fill={C.rose + "20"} />
        <text x="215" y="95" textAnchor="middle" fontSize="14" fontWeight="800" fill={C.roseDark} fontFamily="Roboto">3</text>
        <text x="215" y="107" textAnchor="middle" fontSize="7" fill={C.textMuted} fontFamily="Roboto">need support</text>

        {/* Divider */}
        <line x1="18" y1="128" x2="272" y2="128" stroke="#A8CFCF" strokeWidth="0.8" />
        <text x="22" y="144" fontSize="8" fontWeight="600" fill={C.textMuted} fontFamily="Roboto" letterSpacing="0.5">INDIVIDUAL SCORES</text>

        {/* People bars */}
        {people.map(({ name, role, score, color }, i) => {
          const y = 154 + i * 28;
          const barW = (bars[i] / 100) * 150;
          return (
            <g key={name}>
              {/* Avatar circle */}
              <circle cx="30" cy={y} r="9" fill={color + "30"} />
              <text x="30" y={y + 4} textAnchor="middle" fontSize="8" fontWeight="700" fill={color} fontFamily="Roboto">
                {name[0]}
              </text>
              {/* Name / role */}
              <text x="46" y={y - 2} fontSize="8.5" fontWeight="600" fill={C.textDark} fontFamily="Roboto">{name}</text>
              <text x="46" y={y + 8} fontSize="7" fill={C.textMuted} fontFamily="Roboto">{role}</text>
              {/* Score bar */}
              <rect x="120" y={y - 7} width="150" height="10" rx="5" fill="#DCF0F0" />
              <rect x="120" y={y - 7} width={barW} height="10" rx="5" fill={color}
                style={{ transition: "width 0.6s ease" }} />
              <text x="276" y={y + 2} fontSize="8.5" fontWeight="700" fill={color} fontFamily="Roboto">{bars[i] || "—"}</text>
            </g>
          );
        })}
      </g>

      {/* Goal card */}
      <g style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(20px)", transition: "all 0.6s 0.4s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <rect x="288" y="20" width="126" height="90" rx="12" fill={C.bgCard} stroke="#A8CFCF" strokeWidth="1.5" filter="url(#ps1)" />
        <rect x="296" y="30" width="28" height="28" rx="7" fill={C.perf + "20"} />
        <text x="310" y="50" textAnchor="middle" fontSize="14">🎯</text>
        <text x="332" y="38" fontSize="8.5" fontWeight="700" fill={C.textDark} fontFamily="Roboto">Goal Progress</text>
        <text x="332" y="49" fontSize="7.5" fill={C.textMuted} fontFamily="Roboto">Q2 2026</text>
        <rect x="296" y="65" width="110" height="6" rx="3" fill="#DCF0F0" />
        <rect x="296" y="65" width={visible ? 88 : 0} height="6" rx="3" fill={C.perf}
          style={{ transition: "width 1.4s ease" }} />
        <text x="296" y="84" fontSize="7.5" fill={C.textMuted} fontFamily="Roboto">8 of 10 goals on track</text>
        <text x="398" y="74" textAnchor="middle" fontSize="9" fontWeight="700" fill={C.perf} fontFamily="Roboto">80%</text>

        {/* Review card */}
        <rect x="288" y="122" width="126" height="78" rx="12" fill={C.perfDark} filter="url(#ps2)" />
        <text x="314" y="142" fontSize="8" fontWeight="600" fill={C.bg + "bb"} fontFamily="Roboto" letterSpacing="0.4">REVIEW CYCLE</text>
        <text x="350" y="163" textAnchor="middle" fontSize="22" fontWeight="800" fill="white" fontFamily="Roboto">94%</text>
        <text x="350" y="177" textAnchor="middle" fontSize="7.5" fill={C.bg + "bb"} fontFamily="Roboto">complete</text>
        <rect x="296" y="186" width="112" height="4" rx="2" fill="white" opacity="0.18" />

        {/* Sentiment card */}
        <rect x="288" y="212" width="126" height="62" rx="12" fill={C.bgCard} stroke="#A8CFCF" strokeWidth="1.5" filter="url(#ps1)" />
        <text x="300" y="232" fontSize="8" fontWeight="600" fill={C.textMuted} fontFamily="Roboto">TEAM SENTIMENT</text>
        {[C.perf, C.perfLight, C.perf, "#7EC8A4", C.perfLight].map((c, i) => (
          <circle key={i} cx={302 + i * 22} cy={252} r={8} fill={c + "30"} stroke={c} strokeWidth={1.5} />
        ))}
        <text x="305" y="257" fontSize="10">😊</text>
        <text x="327" y="257" fontSize="10">😐</text>
        <text x="349" y="257" fontSize="10">😊</text>
        <text x="371" y="257" fontSize="10">😀</text>
        <text x="393" y="257" fontSize="10">😊</text>
      </g>
    </svg>
  );
}

/* ─── Landing ───────────────────────────────────────────────────── */
const HERO_LINE1 = "Smarter HR,";
const HERO_LINE2 = "Start to Finish.";
const HERO_SUB = "Two intelligent platforms. One connected HR experience. Built for the teams that keep your people moving.";

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<"leaveiq" | "performiq">("leaveiq");

  const h1 = useTypewriter(HERO_LINE1 + " " + HERO_LINE2, 0, 42);
  const sub = useTypewriter(HERO_SUB, (HERO_LINE1.length + 1 + HERO_LINE2.length) * 42 + 200, 18);
  const headingDone = h1.length >= HERO_LINE1.length + 1 + HERO_LINE2.length;
  const subDone = sub.length >= HERO_SUB.length;

  const line1 = h1.slice(0, HERO_LINE1.length);
  const line2 = h1.length > HERO_LINE1.length + 1 ? h1.slice(HERO_LINE1.length + 1) : "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, fontFamily: "Roboto, sans-serif", color: C.textDark }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ background: `${C.bg}f5`, borderColor: C.khaki }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/leavara-logo.png" alt="Leavara" className="h-8 w-8 object-contain" />
            <span className="font-bold text-xl tracking-tight" style={{ color: C.textDark }}>Leavara</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: C.textBody }}>
            {/* Products dropdown */}
            <div className="relative">
              <button
                className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                onClick={() => setProductsOpen(v => !v)}
                onBlur={() => setTimeout(() => setProductsOpen(false), 150)}
              >
                Products <ChevronDown className="w-3.5 h-3.5" />
              </button>
              {productsOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 rounded-xl border shadow-lg overflow-hidden z-50"
                  style={{ background: C.bgCard, borderColor: C.khaki }}>
                  <a href="#leaveiq" className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                    onClick={() => setProductsOpen(false)}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: C.terracotta + "20" }}>📅</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: C.textDark }}>LeaveIQ</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>Smart Leave Management</p>
                    </div>
                  </a>
                  <a href="#performiq" className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                    onClick={() => setProductsOpen(false)}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: C.perf + "20" }}>📊</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: C.textDark }}>PerformIQ</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>Smart Performance Management</p>
                    </div>
                  </a>
                </div>
              )}
            </div>
            <a href="#why-leavara" className="hover:opacity-70 transition-opacity">Why Leavara</a>
            <a href="#cta" className="hover:opacity-70 transition-opacity">Get Started</a>
          </nav>

          {/* Sign in + CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/leaveiq/login" className="px-4 py-2 rounded-lg text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: C.textBody }}>
              Sign In
            </Link>
            <Link href="/interest" className="px-5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: C.terracotta }}>
              Get Started
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(v => !v)} style={{ color: C.textBody }}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t px-6 py-4 flex flex-col gap-4 text-sm font-medium"
            style={{ background: C.bg, borderColor: C.khaki, color: C.textBody }}>
            <a href="#leaveiq" onClick={() => setMobileOpen(false)}>LeaveIQ</a>
            <a href="#performiq" onClick={() => setMobileOpen(false)}>PerformIQ</a>
            <a href="#why-leavara" onClick={() => setMobileOpen(false)}>Why Leavara</a>
            <Link href="/leaveiq/login" onClick={() => setMobileOpen(false)}>Sign In</Link>
            <Link href="/interest" onClick={() => setMobileOpen(false)}
              className="text-center py-2.5 rounded-lg font-semibold text-white"
              style={{ background: C.terracotta }}>
              Get Started
            </Link>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #ede8df 60%, ${C.bg} 100%)` }}>
        <div className="absolute top-[-80px] right-[-80px] w-[500px] h-[500px] rounded-full blur-[110px] pointer-events-none"
          style={{ background: C.terracotta + "1a" }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-[350px] h-[350px] rounded-full blur-[90px] pointer-events-none"
          style={{ background: C.perf + "15" }} />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-16">
          {/* Platform badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold"
              style={{ background: C.bgCard, borderColor: C.khaki, color: C.textMuted }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.terracotta }} />
              Intelligent HR Platform · Two Products, One Platform
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-6">
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight mb-0" style={{ color: C.textDark, minHeight: "6rem" }}>
              {line1}
              {line2 && (
                <> <span style={{ color: C.terracottaDk }}>{line2}</span></>
              )}
              <Cursor visible={!headingDone} />
            </h1>
            <p className="text-lg mt-4 max-w-2xl mx-auto leading-relaxed"
              style={{ color: C.textBody, minHeight: "4rem" }}>
              {sub}<Cursor visible={headingDone && !subDone} color={C.perf} />
            </p>
          </div>

          {/* Product pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-10"
            style={{ opacity: headingDone ? 1 : 0, transition: "opacity 0.5s" }}>
            <a href="#leaveiq"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border font-semibold text-sm transition-all hover:shadow-md"
              style={{ background: C.terracotta + "15", borderColor: C.terracotta + "50", color: C.terracottaDk }}>
              📅 LeaveIQ — Smart Leave Management
            </a>
            <a href="#performiq"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border font-semibold text-sm transition-all hover:shadow-md"
              style={{ background: C.perf + "12", borderColor: C.perf + "50", color: C.perfDark }}>
              📊 PerformIQ — Smart Performance Management
            </a>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-3 mb-16"
            style={{ opacity: subDone ? 1 : 0, transition: "opacity 0.5s" }}>
            <Link href="/interest"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-md"
              style={{ background: C.terracotta }}>
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/leaveiq/login"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm border hover:opacity-80 transition-opacity"
              style={{ borderColor: C.khaki, color: C.textBody, background: C.bgCard }}>
              Sign In to Your Platform
            </Link>
          </div>

          {/* Dual product preview toggle */}
          <div style={{ opacity: subDone ? 1 : 0, transition: "opacity 0.8s 0.3s" }}>
            <div className="flex justify-center gap-2 mb-6">
              {(["leaveiq", "performiq"] as const).map(p => (
                <button key={p} onClick={() => setActiveProduct(p)}
                  className="px-5 py-2 rounded-full text-sm font-semibold transition-all"
                  style={activeProduct === p
                    ? { background: p === "leaveiq" ? C.terracotta : C.perfDark, color: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }
                    : { background: C.bgCard, color: C.textMuted, border: `1px solid ${C.khaki}` }
                  }>
                  {p === "leaveiq" ? "LeaveIQ Preview" : "PerformIQ Preview"}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              {activeProduct === "leaveiq" ? <LeaveIQIllustration /> : <PerformIQIllustration />}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS SECTION ── */}
      <section className="py-20 border-t" style={{ background: C.bg, borderColor: C.khaki }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: C.textDark }}>
              One Platform. Two Powerful Products.
            </h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: C.textBody }}>
              Each built to tackle a critical piece of the people operations puzzle — and designed to work together.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* LeaveIQ Card */}
            <div id="leaveiq" className="rounded-3xl border overflow-hidden"
              style={{ background: C.bgCard, borderColor: C.khaki }}>
              <div className="px-8 py-6 border-b" style={{ background: C.terracotta + "12", borderColor: C.khaki }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: C.terracotta + "25" }}>📅</div>
                  <div>
                    <h3 className="font-bold text-xl" style={{ color: C.textDark }}>LeaveIQ</h3>
                    <p className="text-sm font-medium" style={{ color: C.terracottaDk }}>Smart Leave Management</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>
                  Automate leave tracking, ensure FMLA/CFRA compliance, and empower HR with
                  AI-assisted eligibility decisions — while keeping humans in full control.
                </p>
              </div>
              <div className="px-8 py-6 space-y-3">
                {[
                  { icon: <ShieldCheck className="w-4 h-4" />, text: "Automated FMLA/CFRA/PDL eligibility analysis" },
                  { icon: <ClipboardList className="w-4 h-4" />, text: "AI-drafted notices and certifications" },
                  { icon: <MessageSquare className="w-4 h-4" />, text: "Employee self-service portal with magic link access" },
                  { icon: <BadgeCheck className="w-4 h-4" />, text: "HR always makes the final decision" },
                  { icon: <Users className="w-4 h-4" />, text: "HRIS integration and leave calendar" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: C.terracotta + "20", color: C.terracottaDk }}>{f.icon}</div>
                    <span className="text-sm font-medium" style={{ color: C.textDark }}>{f.text}</span>
                  </div>
                ))}
                <div className="pt-4">
                  <Link href="/interest"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ background: C.terracotta }}>
                    Learn More <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>

            {/* PerformIQ Card */}
            <div id="performiq" className="rounded-3xl border overflow-hidden"
              style={{ background: C.bgCard, borderColor: "#A8CFCF" }}>
              <div className="px-8 py-6 border-b" style={{ background: C.perf + "0d", borderColor: "#A8CFCF" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: C.perf + "20" }}>📊</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xl" style={{ color: C.textDark }}>PerformIQ</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: C.perf + "20", color: C.perfDark }}>Coming Soon</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: C.perfDark }}>Smart Performance Management</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>
                  Set goals, run review cycles, track development, and build high-performing teams
                  with intelligent insights that help managers lead with confidence.
                </p>
              </div>
              <div className="px-8 py-6 space-y-3">
                {[
                  { icon: <Target className="w-4 h-4" />, text: "Goal setting and OKR tracking" },
                  { icon: <Star className="w-4 h-4" />, text: "360-degree performance reviews" },
                  { icon: <BarChart3 className="w-4 h-4" />, text: "Real-time performance analytics" },
                  { icon: <TrendingUp className="w-4 h-4" />, text: "Individual development planning" },
                  { icon: <Zap className="w-4 h-4" />, text: "AI-powered coaching insights" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: C.perf + "18", color: C.perfDark }}>{f.icon}</div>
                    <span className="text-sm font-medium" style={{ color: C.textDark }}>{f.text}</span>
                  </div>
                ))}
                <div className="pt-4">
                  <Link href="/interest"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ background: C.perfDark }}>
                    Request Early Access <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY LEAVARA ── */}
      <section id="why-leavara" style={{ background: C.mochaDeep }}>
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold mb-2" style={{ color: C.textOnDark }}>
            Why HR Teams Choose Leavara
          </h2>
          <p className="mb-12 text-sm max-w-lg mx-auto" style={{ color: C.khaki }}>
            We built Leavara because HR teams deserve tools as smart as the people they support.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: <ShieldCheck className="w-8 h-8" style={{ color: C.terracotta }} />,
                title: "Compliance First",
                desc: "Always aligned with FMLA, CFRA, PDL, and state-specific regulations — updated as laws change.",
                bg: C.terracotta + "22", border: C.terracotta + "44",
              },
              {
                icon: <Zap className="w-8 h-8" style={{ color: C.perfLight }} />,
                title: "AI-Assisted, Human-Led",
                desc: "Our AI surfaces insights and recommendations. Your HR team always makes the final call.",
                bg: C.perf + "22", border: C.perfLight + "44",
              },
              {
                icon: <Users className="w-8 h-8" style={{ color: C.rose }} />,
                title: "Built for Your People",
                desc: "Intuitive for HR, clear for employees, and powerful for the business — all in one connected platform.",
                bg: C.rose + "22", border: C.rose + "55",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-center gap-4 p-6 rounded-2xl border"
                style={{ background: item.bg, borderColor: item.border }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-lg" style={{ color: C.textOnDark }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: C.khaki }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SIGN IN SECTION ── */}
      <section className="py-16 border-b" style={{ background: C.bgCard, borderColor: C.khaki }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-2" style={{ color: C.textDark }}>Already a Leavara customer?</h2>
          <p className="mb-8 text-sm" style={{ color: C.textBody }}>
            One login gives you access to all the Leavara products your organization has activated.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/leaveiq/login"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-md"
              style={{ background: C.terracotta }}>
              Sign In to LeaveIQ <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/interest"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm border hover:opacity-80 transition-opacity"
              style={{ borderColor: C.khaki, color: C.textBody, background: "white" }}>
              New Organization? Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="cta" className="py-20 text-center"
        style={{ background: `linear-gradient(135deg, ${C.terracottaDk} 0%, ${C.mochaDeep} 100%)` }}>
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold mb-3" style={{ color: "white" }}>
            Ready to Transform HR at Your Organization?
          </h2>
          <p className="mb-8 text-sm" style={{ color: C.bg + "cc" }}>
            Tell us about your team and we'll get you set up with the products that fit.
          </p>
          <Link href="/interest"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity shadow-lg"
            style={{ background: "white", color: C.terracottaDk }}>
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-8" style={{ background: C.textDark, borderColor: C.mochaDeep }}>
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
          style={{ color: C.textOnDark }}>
          <div className="flex items-center gap-2">
            <img src="/leavara-logo.png" alt="Leavara" className="h-5 w-5 object-contain" />
            <span className="font-semibold">Leavara</span>
            <span style={{ color: C.khaki }}>·</span>
            <span style={{ color: C.khaki }}>LeaveIQ &amp; PerformIQ</span>
          </div>
          <span style={{ color: C.khaki }}>© {new Date().getFullYear()} Leavara, LLC · All rights reserved.</span>
          <div className="flex gap-5" style={{ color: C.khaki }}>
            <Link href="/leaveiq/login" className="hover:opacity-70 transition-opacity">Sign In</Link>
            <Link href="/interest" className="hover:opacity-70 transition-opacity">Get Started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
