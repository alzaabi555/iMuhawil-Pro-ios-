import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FileUpload } from './components/FileUpload';
import { PreviewEditor } from './components/PreviewEditor';
import { convertPdfToHtml } from './services/geminiService';
import { ProcessingStatus, ConvertedDocument } from './types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { 
  Loader2, WifiOff, FileDown, RefreshCw, Copy, Check, 
  Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, 
  Printer, ArrowRight, Download
} from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [convertedDoc, setConvertedDoc] = useState<ConvertedDocument | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!isOnline) {
      setErrorMsg('لا يوجد اتصال بالإنترنت.');
      return;
    }
    setStatus(ProcessingStatus.PROCESSING);
    setErrorMsg('');
    try {
      const htmlContent = await convertPdfToHtml(file);
      setConvertedDoc({
        htmlContent,
        fileName: file.name.replace('.pdf', '')
      });
      setStatus(ProcessingStatus.COMPLETE);
    } catch (err) {
      console.error(err);
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    }
  };

  const handleDownload = async () => {
    if (!convertedDoc) return;
    
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'
            dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${convertedDoc.fileName}</title>
        <style>
          @page { size: 21cm 29.7cm; margin: 2.54cm; mso-page-orientation: portrait; }
          body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 12pt; }
          table { border-collapse: collapse; width: 100%; mso-border-alt: solid windowtext .5pt; }
          td, th { border: 1px solid #000; padding: 5pt; }
        </style>
      </head>
      <body>
        <div class="Section1">${convertedDoc.htmlContent}</div>
      </body>
      </html>
    `;

    // 1. Mobile (iOS/Android) Save Logic
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `${convertedDoc.fileName}.doc`;
        await Filesystem.writeFile({
          path: fileName,
          data: preHtml,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        
        setSaveStatus(`تم الحفظ في المستندات: ${fileName}`);
        setTimeout(() => setSaveStatus(''), 4000);
        alert(`تم حفظ الملف بنجاح في مجلد المستندات باسم: ${fileName}`);
      } catch (e) {
        console.error("Save failed", e);
        alert('فشل حفظ الملف. يرجى التأكد من صلاحيات الوصول للملفات.');
      }
      return;
    }

    // 2. Web/Desktop Logic
    const blob = new Blob(['\ufeff', preHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${convertedDoc.fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const content = document.querySelector('.word-content') as HTMLElement;
    if (content) {
      await navigator.clipboard.writeText(content.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setStatus(ProcessingStatus.IDLE);
    setConvertedDoc(null);
    setErrorMsg('');
    setSaveStatus('');
  };

  // Simple Action Button Component
  const ToolButton = ({ icon: Icon, onClick, active = false, title, danger = false }: any) => (
    <button 
      onClick={onClick}
      title={title}
      className={`
        p-2 rounded-lg transition-all duration-200
        ${active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}
        ${danger ? 'hover:bg-red-50 hover:text-red-600' : ''}
      `}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
      
      <Navbar fileName={convertedDoc?.fileName} />

      {/* Main Container */}
      <main className="flex-1 flex flex-col relative">
        
        {/* Offline Warning */}
        {!isOnline && (
          <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex justify-center items-center gap-2 text-sm">
            <WifiOff size={16} />
            <span>لا يوجد اتصال بالإنترنت</span>
          </div>
        )}

        {/* Save Status Notification (Mobile) */}
        {saveStatus && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-6 py-2 rounded-full shadow-lg z-50 text-sm animate-fade-in-up">
            {saveStatus}
          </div>
        )}

        {/* State: IDLE (Upload) */}
        {status === ProcessingStatus.IDLE && (
           <FileUpload onFileSelect={handleFileSelect} disabled={!isOnline} />
        )}

        {/* State: PROCESSING */}
        {status === ProcessingStatus.PROCESSING && (
           <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
             <div className="bg-white p-10 rounded-3xl shadow-xl text-center max-w-sm border border-slate-100">
               <div className="relative inline-block mb-8">
                 <div className="absolute inset-0 bg-indigo-200 rounded-full blur-xl opacity-50 animate-pulse"></div>
                 <div className="relative bg-white text-indigo-600 p-4 rounded-full shadow-sm border border-slate-100">
                   <Loader2 size={48} className="animate-spin" />
                 </div>
               </div>
               <h3 className="text-xl font-bold text-slate-800 mb-3">جاري المعالجة...</h3>
               <p className="text-slate-500 text-sm leading-relaxed">
                 يقوم الذكاء الاصطناعي الآن بقراءة الملف وتحويله إلى صيغة قابلة للتعديل.
               </p>
             </div>
           </div>
        )}

        {/* State: COMPLETE (Editor & Toolbar) */}
        {status === ProcessingStatus.COMPLETE && convertedDoc && (
          <div className="flex flex-col items-center w-full animate-fade-in-up">
            
            {/* Sticky Simple Toolbar */}
            <div className="sticky-toolbar sticky z-30 w-full bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm px-4 md:px-8 py-2 flex items-center justify-between gap-4">
              
              <div className="flex items-center gap-2 border-l border-slate-200 pl-4 ml-2">
                <button 
                  onClick={handleReset}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                >
                  <ArrowRight size={16} />
                  <span className="hidden sm:inline">ملف جديد</span>
                </button>
              </div>

              {/* Formatting Tools (Visual Only in this version) */}
              <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                <ToolButton icon={Bold} title="غامق" />
                <ToolButton icon={Italic} title="مائل" />
                <ToolButton icon={Underline} title="تسطير" />
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <ToolButton icon={AlignRight} title="يمين" active />
                <ToolButton icon={AlignCenter} title="وسط" />
                <ToolButton icon={AlignLeft} title="يسار" />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopy}
                  className="hidden md:flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors font-medium text-sm"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>نسخ</span>
                </button>
                
                <button 
                  onClick={() => window.print()}
                  className="hidden sm:flex items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="طباعة"
                >
                  <Printer size={20} />
                </button>

                <button 
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md shadow-indigo-200 transition-all transform hover:scale-105 font-medium text-sm"
                >
                  <Download size={18} />
                  <span>{Capacitor.isNativePlatform() ? 'حفظ' : 'تحميل Word'}</span>
                </button>
              </div>
            </div>

            {/* Document Preview Area */}
            <div className="w-full max-w-5xl p-4 md:p-8">
               <PreviewEditor htmlContent={convertedDoc.htmlContent} />
            </div>

          </div>
        )}

        {/* State: ERROR */}
        {status === ProcessingStatus.ERROR && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-red-100 max-w-md text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                 <WifiOff size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">فشلت العملية</h3>
              <p className="text-slate-500 mb-6 text-sm">{errorMsg}</p>
              <button 
                onClick={handleReset} 
                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-slate-800 text-white rounded-xl hover:bg-slate-900 transition-all"
              >
                <RefreshCw size={18} />
                <span>حاول مرة أخرى</span>
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default App;