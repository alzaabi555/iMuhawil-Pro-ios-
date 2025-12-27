import React, { useState } from 'react';
import { FileText, Info, X, Phone, Crown } from 'lucide-react';

interface NavbarProps {
  fileName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ fileName }) => {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <nav className="w-full bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 pt-safe transition-all duration-200">
        <div className="h-16 flex items-center justify-between px-4 md:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <FileText size={20} />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-amber-400 border-2 border-white text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 flex items-center gap-0.5">
                <Crown size={8} fill="currentColor" />
                <span>PRO</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Muhawil Pro</h1>
              {/* Tier 1 Badge with Pulse Animation */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 tracking-wide">
                  TIER 1 ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* File Name Display (Centered) */}
          {fileName && (
            <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-200 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-sm font-medium text-slate-600 max-w-[200px] truncate" dir="ltr">
                {fileName}
              </span>
            </div>
          )}

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAbout(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
              title="عن التطبيق"
            >
              <Info size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up border border-white/20">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-800 pr-2">حول التطبيق</h3>
              <button 
                onClick={() => setShowAbout(false)}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <FileText size={32} />
              </div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-2">Muhawil Pro</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                تطبيق ذكي لتحويل ملفات PDF العربية إلى مستندات Word قابلة للتعديل. يعتمد التطبيق على خوارزميات الذكاء الاصطناعي لفهم بنية المستند، ومعالجة النصوص العربية، والجداول المعقدة بدقة عالية.
              </p>

              <div className="border-t border-dashed border-slate-200 pt-4 mt-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                  الإعداد والتصميم
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold shadow-sm border border-indigo-100">
                    محمد الزعابي
                  </div>
                  <a href="tel:98344555" className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1 dir-ltr">
                    <Phone size={12} />
                    <span>98344555</span>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Footer Button */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button 
                onClick={() => setShowAbout(false)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};