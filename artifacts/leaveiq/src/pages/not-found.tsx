import React from "react";
import { Link } from "wouter";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <FileQuestion className="w-10 h-10 text-slate-500" />
      </div>
      <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">404</h1>
      <p className="text-lg text-slate-600 mt-2 mb-8 text-center max-w-md">
        The page or case you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <div className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-medium shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </div>
      </Link>
    </div>
  );
}
