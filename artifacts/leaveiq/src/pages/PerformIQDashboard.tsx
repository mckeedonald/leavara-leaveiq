import React from "react";
import { useLocation } from "wouter";
import { TrendingUp, Target, Users, Star, ArrowLeft, BarChart3, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";

const C = {
  bg: "#EDF1F8",
  perf: "#4F6FA5",
  perfDark: "#2E4D80",
  perfLight: "#7B97C4",
  textDark: "#1A2D4A",
  textBody: "#3A4F6E",
  textMuted: "#6B7FA8",
  card: "#FFFFFF",
  border: "#C8D5E8",
};

const features = [
  { icon: Target, title: "Goal Tracking", desc: "OKRs and goal alignment across teams" },
  { icon: BarChart3, title: "Performance Reviews", desc: "360° feedback and review cycles" },
  { icon: Users, title: "Team Insights", desc: "Sentiment analysis and team health scores" },
  { icon: MessageSquare, title: "1:1 Management", desc: "Structured check-ins and meeting notes" },
  { icon: Star, title: "Recognition", desc: "Peer recognition and achievement badges" },
  { icon: TrendingUp, title: "Analytics", desc: "AI-powered performance trends" },
];

export default function PerformIQDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: `linear-gradient(135deg, ${C.bg} 0%, #D9E4F5 100%)` }}>
      <div className="w-full max-w-2xl">

        {/* Back link */}
        <button
          onClick={() => navigate("/leaveiq/dashboard")}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-opacity hover:opacity-70"
          style={{ color: C.perf }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to LeaveIQ
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 shadow-lg" style={{ background: C.perf }}>
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: "#D6E2F5", color: C.perfDark }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.perf }} />
            Coming Soon
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: C.textDark }}>
            Perform<span style={{ color: C.perf }}>IQ</span>
          </h1>
          <p className="text-lg" style={{ color: C.textBody }}>
            Smart performance management — built for modern HR teams.
          </p>
          {user && (
            <p className="text-sm mt-2" style={{ color: C.textMuted }}>
              Hi {user.firstName}, we're putting the finishing touches on this platform.
            </p>
          )}
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-5 border transition-shadow hover:shadow-md"
              style={{ background: C.card, borderColor: C.border }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: "#EDF1F8" }}>
                <Icon className="w-4.5 h-4.5" style={{ color: C.perf }} />
              </div>
              <p className="font-semibold text-sm mb-1" style={{ color: C.textDark }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: C.textMuted }}>{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl p-6 text-center border" style={{ background: C.card, borderColor: C.border }}>
          <p className="text-sm font-medium mb-1" style={{ color: C.textDark }}>Your organization is on the early access list.</p>
          <p className="text-sm" style={{ color: C.textMuted }}>
            You'll be notified as soon as PerformIQ is ready for your team.
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: C.textMuted }}>
          © 2026 Leavara · PerformIQ is coming soon
        </p>
      </div>
    </div>
  );
}
