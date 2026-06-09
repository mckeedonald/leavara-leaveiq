import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Menu,
  X,
  ShieldCheck,
  BadgeCheck,
  Users,
  ClipboardList,
  MessageSquare,
  Zap,
  ChevronDown,
} from "lucide-react";

/* ─── Brand palette ─────────────────────────────────────────────── */
const C = {
  bg:           "#F4F1EA",
  bgCard:       "#FAF8F3",
  khaki:        "#C9BD9E",
  mocha:        "#B39A6A",
  mochaDeep:    "#6E5A2E",
  terracotta:   "#C39A4A",
  terracottaDk: "#9C7A35",
  rose:         "#D9B87A",
  roseDark:     "#B58A48",
  textDark:     "#1B2430",
  textBody:     "#2E3742",
  textMuted:    "#5A6470",
  textOnDark:   "#F4F1EA",
  // Guildlight Grow accent — teal
  perf:         "#7C9273",
  perfLight:    "#A3B89B",
  perfDark:     "#54684B",
  perfBg:       "#ECF0E9",
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

/* ─── Guildlight Leave Hero Illustration ────────────────────────────────── */
function GuildlightLeaveIllustration() {
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
        <text x="140" y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">Leave Calendar — June</text>
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <text key={i} x={33 + i * 34} y="70" textAnchor="middle" fontSize="8.5" fontWeight="600" fill={C.textMuted} fontFamily="Inter, sans-serif">{d}</text>
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
                fontWeight={isToday ? "700" : "400"} fontFamily="Inter, sans-serif">
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
        <text x="320" y="52" fontSize="9" fontWeight="700" fill={C.textDark} fontFamily="Inter, sans-serif">FMLA Leave</text>
        <text x="320" y="63" fontSize="7.5" fill={C.textMuted} fontFamily="Inter, sans-serif">12 weeks eligible</text>
        <rect x="284" y="78" width="118" height="5" rx="2.5" fill={C.khaki} opacity="0.35" />
        <rect x="284" y="87" width="88" height="5" rx="2.5" fill={C.khaki} opacity="0.22" />

        <rect x="276" y="118" width="134" height="60" rx="12" fill={C.terracottaDk} filter="url(#ls2)" />
        <circle cx="296" cy="143" r="9" fill="white" opacity="0.15" />
        <polyline points="290,143 295,148 304,137" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="312" y="139" fontSize="9" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">Approved</text>
        <text x="312" y="150" fontSize="7.5" fill={C.bg + "cc"} fontFamily="Inter, sans-serif">Jun 8 – 12</text>
        <rect x="284" y="160" width="110" height="4" rx="2" fill="white" opacity="0.18" />

        <rect x="276" y="190" width="134" height="52" rx="12" fill={C.bgCard} stroke={C.rose + "60"} strokeWidth="1.5" filter="url(#ls1)" />
        <circle cx="296" cy="212" r="7" fill={C.rose + "50"} />
        <text x="296" y="216" textAnchor="middle" fontSize="9" fill={C.roseDark}>!</text>
        <text x="310" y="208" fontSize="8.5" fontWeight="700" fill={C.roseDark} fontFamily="Inter, sans-serif">Pending Review</text>
        <text x="310" y="219" fontSize="7.5" fill={C.textBody} fontFamily="Inter, sans-serif">Jun 17 – 18</text>
        <rect x="284" y="228" width="106" height="4" rx="2" fill={C.rose} opacity="0.22" />
      </g>
    </svg>
  );
}

/* ─── Guildlight Grow Illustration ────────────────────────────────────── */
function GuildlightGrowIllustration() {
  const [visible, setVisible] = useState(false);
  const [typedLen, setTypedLen] = useState(0);
  const [step, setStep] = useState(0);
  const agentText = "Based on the pattern you've described, I'll draft a Written Warning. Here's a summary before I generate the document:";
  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    const t = (fn: () => void, ms: number) => ts.push(setTimeout(fn, ms));
    t(() => setVisible(true), 200);
    t(() => {
      let i = 0;
      const iv = setInterval(() => {
        i++;
        setTypedLen(i);
        if (i >= agentText.length) clearInterval(iv);
      }, 18);
      ts.push(iv as any);
    }, 600);
    t(() => setStep(1), 2600);
    t(() => setStep(2), 3400);
    t(() => setStep(3), 4100);
    return () => ts.forEach(clearTimeout);
  }, []);

  const workflowSteps = [
    { label: "Draft", done: true },
    { label: "Supervisor", done: step >= 1 },
    { label: "HR Approval", done: step >= 2 },
    { label: "Delivery", done: step >= 3 },
  ];

  return (
    <svg viewBox="0 0 420 310" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-md">
      <defs>
        <filter id="ps1"><feDropShadow dx="0" dy="3" stdDeviation="5" floodColor={C.perf} floodOpacity="0.14" /></filter>
        <filter id="ps2"><feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={C.perfDark} floodOpacity="0.22" /></filter>
      </defs>

      {/* Glow orbs */}
      <ellipse cx="370" cy="40" rx="90" ry="90" fill={C.perf} opacity="0.07" />
      <ellipse cx="50" cy="260" rx="70" ry="70" fill={C.perfLight} opacity="0.09" />

      {/* Agent chat card */}
      <g style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s" }}>
        <rect x="10" y="10" width="268" height="258" rx="14" fill={C.bgCard} stroke="#BFCDB3" strokeWidth="1.5" filter="url(#ps1)" />
        {/* Header */}
        <rect x="10" y="10" width="268" height="44" rx="14" fill={C.perfDark} />
        <rect x="10" y="38" width="268" height="16" fill={C.perfDark} />
        <circle cx="34" cy="32" r="10" fill={C.perf} />
        <text x="34" y="36" textAnchor="middle" fontSize="10">🤖</text>
        <text x="50" y="29" fontSize="10" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">Performance Specialist</text>
        <text x="50" y="40" fontSize="7.5" fill={C.bg + "aa"} fontFamily="Inter, sans-serif">AI Documentation Partner</text>

        {/* Manager message bubble */}
        <rect x="120" y="64" width="148" height="28" rx="10" fill={C.perf + "20"} />
        <text x="194" y="75" textAnchor="middle" fontSize="7.5" fill={C.perfDark} fontFamily="Inter, sans-serif">Second attendance issue this</text>
        <text x="194" y="85" textAnchor="middle" fontSize="7.5" fill={C.perfDark} fontFamily="Inter, sans-serif">month, prior coaching on file.</text>

        {/* Agent reply bubble */}
        <rect x="18" y="102" width="232" height="60" rx="10" fill={C.perfBg} />
        <text x="28" y="115" fontSize="7" fill={C.perfDark} fontFamily="Inter, sans-serif" fontStyle="italic">Performance Specialist</text>
        <foreignObject x="22" y="119" width="222" height="42">
          <div style={{ fontSize: "7.5px", color: C.textDark, fontFamily: "Roboto", lineHeight: "1.45" }}>
            {agentText.slice(0, typedLen)}
          </div>
        </foreignObject>

        {/* Draft summary card */}
        <rect x="18" y="172" width="240" height="54" rx="10" fill={C.perfDark + "12"} stroke={C.perf + "40"} strokeWidth="1" />
        <rect x="26" y="180" width="4" height="38" rx="2" fill={C.perf} />
        <text x="38" y="190" fontSize="7.5" fontWeight="700" fill={C.perfDark} fontFamily="Inter, sans-serif">Written Warning — Attendance</text>
        <text x="38" y="201" fontSize="7" fill={C.textMuted} fontFamily="Inter, sans-serif">Employee: Marcus Webb</text>
        <text x="38" y="211" fontSize="7" fill={C.textMuted} fontFamily="Inter, sans-serif">Manager: Dana Osei  ·  05/08/2026</text>
        <text x="38" y="220" fontSize="7" fill={C.textMuted} fontFamily="Inter, sans-serif">Prior docs: 1 coaching note (04/12)</text>

        {/* Confirm button */}
        <rect x="18" y="234" width="105" height="22" rx="7" fill={C.perf} />
        <text x="70" y="249" textAnchor="middle" fontSize="8" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">✓  Confirm &amp; Draft</text>
        <rect x="132" y="234" width="126" height="22" rx="7" fill={C.perf + "18"} stroke={C.perf + "50"} strokeWidth="1" />
        <text x="195" y="249" textAnchor="middle" fontSize="8" fontWeight="600" fill={C.perfDark} fontFamily="Inter, sans-serif">Provide Feedback</text>
      </g>

      {/* Right-side status cards */}
      <g style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(20px)", transition: "all 0.6s 0.3s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* Workflow tracker */}
        <rect x="286" y="10" width="128" height="120" rx="12" fill={C.bgCard} stroke="#BFCDB3" strokeWidth="1.5" filter="url(#ps1)" />
        <text x="350" y="28" textAnchor="middle" fontSize="8.5" fontWeight="700" fill={C.perfDark} fontFamily="Inter, sans-serif">Approval Workflow</text>
        <line x1="296" y1="34" x2="406" y2="34" stroke="#BFCDB3" strokeWidth="0.8" />
        {workflowSteps.map(({ label, done }, i) => (
          <g key={label}>
            <circle cx="303" cy={50 + i * 22} r="7"
              fill={done ? C.perf : "#E4ECDD"}
              style={{ transition: "fill 0.4s" }} />
            {done && <polyline points={`298,${50 + i * 22} 302,${54 + i * 22} 309,${46 + i * 22}`}
              stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
            <text x="317" y={54 + i * 22} fontSize="8" fontWeight={done ? "600" : "400"}
              fill={done ? C.perfDark : C.textMuted} fontFamily="Inter, sans-serif">{label}</text>
            {done && <text x="400" y={54 + i * 22} textAnchor="end" fontSize="7" fill={C.perf} fontFamily="Inter, sans-serif">✓</text>}
            {i < 3 && <line x1="303" y1={57 + i * 22} x2="303" y2={43 + (i + 1) * 22}
              stroke={done && step > i ? C.perf : "#E4ECDD"} strokeWidth="1.5"
              style={{ transition: "stroke 0.4s" }} />}
          </g>
        ))}

        {/* E-signature card */}
        <rect x="286" y="140" width="128" height="80" rx="12" fill={C.perfDark} filter="url(#ps2)" />
        <text x="350" y="158" textAnchor="middle" fontSize="8" fontWeight="600" fill={C.bg + "bb"} fontFamily="Inter, sans-serif" letterSpacing="0.4">E-SIGNATURE</text>
        <circle cx="310" cy="180" r="12" fill="white" opacity="0.12" />
        <text x="310" y="184" textAnchor="middle" fontSize="13">✍️</text>
        <text x="330" y="174" fontSize="8" fontWeight="700" fill="white" fontFamily="Inter, sans-serif">Employee Signed</text>
        <text x="330" y="184" fontSize="7" fill={C.bg + "aa"} fontFamily="Inter, sans-serif">05/08/2026</text>
        <text x="330" y="196" fontSize="7" fill={C.bg + "aa"} fontFamily="Inter, sans-serif">PDF generated &amp; filed</text>
        <rect x="296" y="206" width="110" height="4" rx="2" fill="white" opacity="0.18" />

        {/* Case closed card */}
        <rect x="286" y="230" width="128" height="66" rx="12" fill={C.bgCard} stroke="#BFCDB3" strokeWidth="1.5" filter="url(#ps1)" />
        <text x="298" y="249" fontSize="8" fontWeight="600" fill={C.textMuted} fontFamily="Inter, sans-serif">CASE FILED</text>
        <rect x="296" y="255" width="110" height="5" rx="2.5" fill={C.perf} opacity="0.7" />
        <rect x="296" y="265" width="80" height="5" rx="2.5" fill={C.perf} opacity="0.35" />
        <text x="350" y="286" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={C.perf} fontFamily="Inter, sans-serif">Closed &amp; Archived ✓</text>
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
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, color: C.textDark }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{ background: `${C.bg}f5`, borderColor: C.khaki }}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/leavara-logo.png" alt="Guildlight" className="h-8 w-8 object-contain" />
            <span className="font-bold text-xl tracking-tight" style={{ color: C.textDark }}>Guildlight</span>
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
                      <p className="font-semibold text-sm" style={{ color: C.textDark }}>Guildlight Leave</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>Smart Leave Management</p>
                    </div>
                  </a>
                  <a href="#performiq" className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 transition-colors"
                    onClick={() => setProductsOpen(false)}>
                    <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                      style={{ background: C.perf + "20" }}>📊</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: C.textDark }}>Guildlight Grow</p>
                      <p className="text-xs" style={{ color: C.textMuted }}>Smart Performance Management</p>
                    </div>
                  </a>
                </div>
              )}
            </div>
            <a href="#why-guildlight" className="hover:opacity-70 transition-opacity">Why Guildlight</a>
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
            <a href="#leaveiq" onClick={() => setMobileOpen(false)}>Guildlight Leave</a>
            <a href="#performiq" onClick={() => setMobileOpen(false)}>Guildlight Grow</a>
            <a href="#why-guildlight" onClick={() => setMobileOpen(false)}>Why Guildlight</a>
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
        style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #EAE4D6 60%, ${C.bg} 100%)` }}>
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
              📅 Guildlight Leave — Smart Leave Management
            </a>
            <a href="#performiq"
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border font-semibold text-sm transition-all hover:shadow-md"
              style={{ background: C.perf + "12", borderColor: C.perf + "50", color: C.perfDark }}>
              📋 Guildlight Grow — AI Performance Documentation
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
                  {p === "leaveiq" ? "Guildlight Leave Preview" : "Guildlight Grow Preview"}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              {activeProduct === "leaveiq" ? <GuildlightLeaveIllustration /> : <GuildlightGrowIllustration />}
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
            {/* Guildlight Leave Card */}
            <div id="leaveiq" className="rounded-3xl border overflow-hidden"
              style={{ background: C.bgCard, borderColor: C.khaki }}>
              <div className="px-8 py-6 border-b" style={{ background: C.terracotta + "12", borderColor: C.khaki }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: C.terracotta + "25" }}>📅</div>
                  <div>
                    <h3 className="font-bold text-xl" style={{ color: C.textDark }}>Guildlight Leave</h3>
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

            {/* Guildlight Grow Card */}
            <div id="performiq" className="rounded-3xl border overflow-hidden"
              style={{ background: C.bgCard, borderColor: "#BFCDB3" }}>
              <div className="px-8 py-6 border-b" style={{ background: C.perf + "0d", borderColor: "#BFCDB3" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                    style={{ background: C.perf + "20" }}>📋</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xl" style={{ color: C.textDark }}>Guildlight Grow</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: C.perf + "20", color: C.perfDark }}>Now Available</span>
                    </div>
                    <p className="text-sm font-medium" style={{ color: C.perfDark }}>AI-Assisted Performance Documentation</p>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: C.textBody }}>
                  Guide managers through legally sound performance documentation with a conversational AI specialist —
                  from coaching notes to termination requests — with configurable approval workflows and built-in e-signatures.
                </p>
              </div>
              <div className="px-8 py-6 space-y-3">
                {[
                  { icon: <MessageSquare className="w-4 h-4" />, text: "Conversational AI drafts coaching notes, warnings & termination docs" },
                  { icon: <ClipboardList className="w-4 h-4" />, text: "Configurable approval workflow: supervisor → HR → delivery" },
                  { icon: <BadgeCheck className="w-4 h-4" />, text: "Native e-signature — employee reviews, signs, and PDF is archived" },
                  { icon: <Users className="w-4 h-4" />, text: "Employee profiles with full prior documentation history" },
                  { icon: <Zap className="w-4 h-4" />, text: "Org policy & template upload — agent reads your docs directly" },
                ].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: C.perf + "18", color: C.perfDark }}>{f.icon}</div>
                    <span className="text-sm font-medium" style={{ color: C.textDark }}>{f.text}</span>
                  </div>
                ))}
                <div className="pt-4 flex gap-3 flex-wrap">
                  <Link href="/leaveiq/login"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                    style={{ background: C.perfDark }}>
                    Sign In to Guildlight Grow <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link href="/interest"
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold border hover:opacity-80 transition-opacity"
                    style={{ borderColor: "#BFCDB3", color: C.perfDark }}>
                    Request Access
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── VIDEO SECTION ── */}
      <section className="py-20 border-t" style={{ background: C.bgCard, borderColor: C.khaki }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold mb-4"
              style={{ background: C.bg, borderColor: C.khaki, color: C.textMuted }}>
              ▶ See It In Action
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: C.textDark }}>
              Real Workflows. Zero Guesswork.
            </h2>
            <p className="max-w-xl mx-auto text-base" style={{ color: C.textBody }}>
              Watch how each product handles the moments that matter — from employee intake to final HR decision.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Guildlight Leave Video */}
            <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: C.khaki }}>
              <div className="px-5 py-4 border-b flex items-center gap-3"
                style={{ background: C.terracotta + "12", borderColor: C.khaki }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: C.terracotta + "25" }}>📅</div>
                <div>
                  <p className="font-bold text-sm" style={{ color: C.textDark }}>Guildlight Leave in Action</p>
                  <p className="text-xs" style={{ color: C.textMuted }}>
                    Employee portal · Ave AI intake · Eligibility analysis · HR decision
                  </p>
                </div>
              </div>
              <div className="aspect-video bg-black">
                <video
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/videos/leaveiq-demo-poster.jpg"
                  src="/videos/leaveiq-demo.mp4"
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                >
                  Your browser does not support video playback.
                </video>
              </div>
            </div>

            {/* Guildlight Grow Video */}
            <div className="rounded-2xl overflow-hidden border shadow-sm" style={{ borderColor: "#BFCDB3" }}>
              <div className="px-5 py-4 border-b flex items-center gap-3"
                style={{ background: C.perf + "0d", borderColor: "#BFCDB3" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                  style={{ background: C.perf + "20" }}>📋</div>
                <div>
                  <p className="font-bold text-sm" style={{ color: C.textDark }}>Guildlight Grow in Action</p>
                  <p className="text-xs" style={{ color: C.textMuted }}>
                    AI document drafting · Approval workflow · E-signature · PDF filing
                  </p>
                </div>
              </div>
              <div className="relative aspect-video" style={{ background: "#1A2417" }}>
                <video
                  className="w-full h-full object-cover"
                  controls
                  playsInline
                  preload="metadata"
                  src="/videos/performiq-demo.mp4"
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                >
                  <p className="text-white text-sm p-4">Your browser does not support video playback.</p>
                </video>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                  style={{ background: "linear-gradient(135deg, #1A2417 0%, #1F2A1A 100%)" }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                    style={{ background: C.perf + "30", border: `1px solid ${C.perf}50` }}>
                    <span style={{ color: C.perfLight, fontSize: 28 }}>▶</span>
                  </div>
                  <p className="text-xs font-semibold" style={{ color: C.perfLight + "bb" }}>Guildlight Grow Workflow Demo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY GUILDLIGHT ── */}
      <section id="why-guildlight" style={{ background: C.mochaDeep }}>
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold mb-2" style={{ color: C.textOnDark }}>
            Why HR Teams Choose Guildlight
          </h2>
          <p className="mb-12 text-sm max-w-lg mx-auto" style={{ color: C.khaki }}>
            We built Guildlight because HR teams deserve tools as smart as the people they support.
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
                desc: "Our AI drafts, recommends, and routes — but every notice, document, and decision is reviewed and confirmed by your HR team.",
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
          <h2 className="text-2xl font-bold mb-2" style={{ color: C.textDark }}>Already a Guildlight customer?</h2>
          <p className="mb-8 text-sm" style={{ color: C.textBody }}>
            One login gives you access to all the Guildlight products your organization has activated.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/leaveiq/login"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-md"
              style={{ background: C.terracotta }}>
              Sign In to Guildlight Leave <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/leaveiq/login"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity shadow-md"
              style={{ background: C.perfDark }}>
              Sign In to Guildlight Grow <ArrowRight className="w-4 h-4" />
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
            <img src="/leavara-logo.png" alt="Guildlight" className="h-5 w-5 object-contain" />
            <span className="font-semibold">Guildlight</span>
            <span style={{ color: C.khaki }}>·</span>
            <span style={{ color: C.khaki }}>Guildlight Leave &amp; Guildlight Grow</span>
          </div>
          <span style={{ color: C.khaki }}>© {new Date().getFullYear()} Guildlight, LLC · All rights reserved.</span>
          <div className="flex gap-5" style={{ color: C.khaki }}>
            <Link href="/leaveiq/login" className="hover:opacity-70 transition-opacity">Sign In</Link>
            <Link href="/interest" className="hover:opacity-70 transition-opacity">Get Started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
