import React, { useState, useEffect } from 'react';
import { FileText, Info, X, Zap, Key, CheckCircle, ExternalLink, LogOut, ShieldCheck, Link as LinkIcon } from 'lucide-react';

interface NavbarProps {
  fileName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ fileName }) => {
  const [showAbout, setShowAbout] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [userKey, setUserKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Check for existing key on load to determine connection status
    const stored = localStorage.getItem('USER_GEMINI_API_KEY');
    if (stored) {
      setUserKey(stored);
      setIsConnected(true);
    }
  }, []);

  const handleConnect = () => {
    if (userKey.trim().length > 10) {
      localStorage.setItem('USER_GEMINI_API_KEY', userKey.trim());
      setIsConnected(true);
      setShowConnection(false);
      // Small visual feedback could be added here
    } else {
      alert('يرجى إدخال مفتاح API صحيح');
    }
  };

  const handleDisconnect = () => {
    if (confirm('هل أنت متأكد من إلغاء ربط الحساب؟ سيعود التطبيق للنسخة المجانية المحدودة.')) {
      localStorage.removeItem('USER_GEMINI_API_KEY');
      setUserKey('');
      setIsConnected(false);
    }
  };

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
              {isConnected && (
                <div className="absolute -bottom-1 -right-1 bg-amber-400 border-2 border-white text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 flex items-center gap-0.5">
                  <Zap size={8} fill="currentColor" />
                  <span>PRO</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-800 leading-tight tracking-tight">Muhawil Pro</h1>
              {isConnected ? (
                <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                  <ShieldCheck size={10} />
                  <span>متصل بحسابك الخاص</span>
                </span>
              ) : (
                <span className="text-[10px] font-medium text-slate-500">النسخة العامة</span>
              )}
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
            
            {/* Connection Button */}
            <button 
              onClick={() => setShowConnection(true)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border
                ${isConnected 
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-indigo-200 hover:text-indigo-600'
                }
              `}
            >
              {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-bold hidden sm:inline">حسابي</span>
                </>
              ) : (
                <>
                  <LinkIcon size={14} />
                  <span className="text-xs font-bold hidden sm:inline">ربط الحساب</span>
                </>
              )}
            </button>

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

      {/* Connection Modal (Replaces Settings) */}
      {showConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-white/20">
             {/* Header */}
             <div className="relative p-6 pb-0">
               <button 
                  onClick={() => setShowConnection(false)}
                  className="absolute left-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
               <div className="flex flex-col items-center justify-center text-center">
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg ${isConnected ? 'bg-gradient-to-tr from-green-500 to-emerald-600 text-white' : 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'}`}>
                   {isConnected ? <ShieldCheck size={32} /> : <Zap size={32} fill="currentColor" />}
                 </div>
                 <h3 className="text-xl font-bold text-slate-800">
                   {isConnected ? 'حسابك متصل بنجاح' : 'ربط حساب Gemini Pro'}
                 </h3>
                 <p className="text-sm text-slate-500 mt-1 max-w-[80%] mx-auto">
                   {isConnected 
                     ? 'يتم الآن استخدام مفتاح API الخاص بك للتمتع بحدود معالجة عالية وسرعة فائقة.' 
                     : 'قم بربط مفتاح API الخاص بك للحصول على سرعة معالجة أعلى، ودعم للملفات الكبيرة بلا حدود.'
                   }
                 </p>
               </div>
             </div>

            <div className="p-6">
              
              {!isConnected ? (
                /* Disconnected State Form */
                <>
                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-700 block mb-2 mr-1">مفتاح API (Google AI Studio)</label>
                    <div className="relative group">
                      <div className="absolute right-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <Key size={18} />
                      </div>
                      <input 
                        type="password" 
                        value={userKey}
                        onChange={(e) => setUserKey(e.target.value)}
                        placeholder="الصق المفتاح هنا (AIzaSy...)"
                        className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-mono text-left dir-ltr"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleConnect}
                    className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group"
                  >
                    <span>ربط الحساب الآن</span>
                    <Zap size={16} className="group-hover:text-yellow-300 transition-colors" fill="currentColor" />
                  </button>

                  <div className="mt-4 text-center">
                    <a 
                      href="https://aistudio.google.com/app/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 border-b border-indigo-200 hover:border-indigo-400 pb-0.5 transition-all"
                    >
                      <span>ليس لديك مفتاح؟ احصل عليه مجاناً من هنا</span>
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </>
              ) : (
                /* Connected State Info */
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <span className="text-xs font-bold text-slate-500">حالة الحساب</span>
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-md">نشط (Active)</span>
                  </div>
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-bold text-slate-500">المفتاح المستخدم</span>
                    <span className="text-xs font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 dir-ltr">
                      {userKey.substring(0, 6)}...******
                    </span>
                  </div>
                  
                  <button 
                    onClick={handleDisconnect}
                    className="w-full py-3 bg-white border border-red-100 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut size={16} />
                    <span>إلغاء الربط (تسجيل الخروج)</span>
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center flex items-center justify-center gap-2">
              <ShieldCheck size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400">بياناتك مشفرة وتخزن محلياً على جهازك فقط</p>
            </div>
          </div>
        </div>
      )}

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
                <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold shadow-sm border border-indigo-100">
                  محمد زعابي
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