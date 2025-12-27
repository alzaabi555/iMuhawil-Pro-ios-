import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FileUpload } from './components/FileUpload';
import { PreviewEditor } from './components/PreviewEditor';
import { convertPdfToHtml } from './services/geminiService';
import { ProcessingStatus, ConvertedDocument } from './types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { 
  Loader2, WifiOff, FileDown, RefreshCw, Copy, Check, 
  Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, 
  Printer, ArrowRight, Download, Share as ShareIcon
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
    
    // Updated CSS: Explicit 2cm margins for all directions and generic @page support
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'
            dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${convertedDoc.fileName}</title>
        <style>
          /* General page defaults */
          @page { 
            size: 21cm 29.7cm; 
            margin: 2cm 2cm 2cm 2cm; 
            mso-page-orientation: portrait; 
          }
          
          /* Specific Section 1 definition - crucial for Word to apply margins correctly */
          @page Section1 {
            size: 21cm 29.7cm;
            margin: 2cm 2cm 2cm 2cm;
            mso-header-margin: 36pt; 
            mso-footer-margin: 36pt; 
            mso-paper-source: 0;
          }

          body { 
            font-family: 'Times New Roman', Arial, sans-serif; 
            font-size: 12pt; 
          }
          
          /* Table styling to fit within margins */
          table { 
            border-collapse: collapse; 
            width: 100%; 
            mso-border-alt: solid windowtext .5pt; 
            margin-bottom: 12pt;
          }
          td, th { 
            border: 1px solid #000; 
            padding: 5pt; 
          }
          
          div.Section1 { page: Section1; }
        </style>
      </head>
      <body>
        <div class="Section1">${convertedDoc.htmlContent}</div>
      </body>
      </html>
    `;

    // 1. Mobile (iOS/Android) Share/Save Logic
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `${convertedDoc.fileName}.doc`;
        
        // Write file to Cache first (Best practice for sharing)
        const result = await Filesystem.writeFile({
          path: fileName,
          data: preHtml,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        
        // Open the Native Share Sheet
        await Share.share({
          title: fileName,
          text: 'تم تحويل الملف باستخدام Muhawil Pro',
          url: result.uri, // This passes the local file path to the share sheet
          dialogTitle: 'حفظ أو مشاركة الملف' // Android title
        });

      } catch (e) {
        console.error("Share failed", e);
        // Only alert if it's not a user cancellation (which is common in share sheets)
        if (JSON.stringify(e).toLowerCase().includes('cancel')) return;
        alert('حدث خطأ أثناء محاولة المشاركة.');
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
                  {Capacitor.isNativePlatform() ? <ShareIcon size={18} /> : <Download size={18} />}
                  <span>{Capacitor.isNativePlatform() ? 'حفظ / مشاركة' : 'تحميل Word'}</span>
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