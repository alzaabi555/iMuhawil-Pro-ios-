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
  Loader2, WifiOff, RefreshCw, Copy, Check, 
  Bold, Italic, Underline, AlignRight, AlignCenter, AlignLeft, 
  Printer, ArrowRight, Download, Share as ShareIcon, FileText
} from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [convertedDoc, setConvertedDoc] = useState<ConvertedDocument | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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

  const processHtmlForExport = async (rawHtml: string): Promise<string> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const svgs = doc.querySelectorAll('svg');

    if (svgs.length === 0) return rawHtml;

    const conversionPromises = Array.from(svgs).map(async (svg) => {
      return new Promise<void>((resolve) => {
        try {
          let width = parseInt(svg.getAttribute('width') || '0');
          let height = parseInt(svg.getAttribute('height') || '0');
          
          if (!width || !height) {
            const viewBox = svg.getAttribute('viewBox');
            if (viewBox) {
               const parts = viewBox.split(' ').map(parseFloat);
               if (parts.length === 4) {
                 width = parts[2];
                 height = parts[3];
               }
            }
          }
          
          width = width || 300;
          height = height || 150;

          svg.setAttribute('width', width.toString());
          svg.setAttribute('height', height.toString());
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width * 3;
            canvas.height = height * 3;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              const pngData = canvas.toDataURL('image/png');
              const newImg = doc.createElement('img');
              newImg.src = pngData;
              newImg.width = width;
              newImg.height = height;
              newImg.style.width = `${width}px`;
              newImg.style.height = `${height}px`;
              newImg.style.display = 'block';
              
              svg.parentNode?.replaceChild(newImg, svg);
            }
            URL.revokeObjectURL(url);
            resolve();
          };
          
          img.onerror = () => {
            resolve();
          };

          img.src = url;
        } catch (e) {
          console.error("SVG Conversion Error", e);
          resolve();
        }
      });
    });

    await Promise.all(conversionPromises);
    return doc.body.innerHTML;
  };

  const handleDownload = async () => {
    if (!convertedDoc) return;
    setIsExporting(true);
    
    const processedBodyContent = await processHtmlForExport(convertedDoc.htmlContent);

    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'
            dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${convertedDoc.fileName}</title>
        <style>
          @page { size: 21cm 29.7cm; margin: 2cm; mso-page-orientation: portrait; }
          body { font-family: 'Times New Roman', Arial, sans-serif; font-size: 14pt; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #000; padding: 8px; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <div class="Section1">${processedBodyContent}</div>
      </body>
      </html>
    `;

    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `${convertedDoc.fileName}.doc`;
        const dataToWrite = '\uFEFF' + preHtml;

        const result = await Filesystem.writeFile({
          path: fileName,
          data: dataToWrite, 
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });
        
        await Share.share({
          title: fileName,
          text: 'تم تحويل الملف باستخدام Muhawil Pro',
          url: result.uri,
          dialogTitle: 'حفظ الملف'
        });
      } catch (e) {
        if (!JSON.stringify(e).toLowerCase().includes('cancel')) {
          alert('حدث خطأ أثناء المشاركة.');
        }
      }
      setIsExporting(false);
      return;
    }

    const blob = new Blob(['\ufeff', preHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${convertedDoc.fileName}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsExporting(false);
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
  };

  const ToolButton = ({ icon: Icon, onClick, active = false, title }: any) => (
    <button 
      onClick={onClick}
      title={title}
      className={`
        p-2 rounded-lg transition-all duration-200
        ${active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-100 hover:text-indigo-600'}
      `}
    >
      <Icon size={18} />
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen font-sans selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
      
      <Navbar fileName={convertedDoc?.fileName} />

      <main className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto">
        {!isOnline && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-white/80 backdrop-blur-md border border-amber-200 text-amber-800 px-6 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold">
            <WifiOff size={16} />
            <span>لا يوجد اتصال بالإنترنت</span>
          </div>
        )}

        {status === ProcessingStatus.IDLE && (
           <FileUpload onFileSelect={handleFileSelect} disabled={!isOnline} />
        )}

        {status === ProcessingStatus.PROCESSING && (
           <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in min-h-[80vh]">
             <div className="glass-card p-12 rounded-[40px] shadow-2xl text-center max-w-sm border border-white/50 relative overflow-hidden">
               {/* Decorative background blobs */}
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-[40px] rounded-full"></div>
               <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full"></div>

               <div className="relative inline-block mb-10">
                 <div className="absolute inset-0 bg-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                 <div className="relative bg-white text-indigo-600 p-6 rounded-3xl shadow-lg ring-1 ring-indigo-50">
                   <Loader2 size={48} className="animate-spin" />
                 </div>
               </div>
               
               <h3 className="text-2xl font-bold text-slate-800 mb-4">جاري المعالجة الذكية</h3>
               <div className="space-y-2">
                 <p className="text-slate-500 text-sm">تحليل بنية المستند...</p>
                 <div className="h-1.5 w-32 mx-auto bg-slate-100 rounded-full overflow-hidden">
                   <div className="h-full bg-indigo-500 rounded-full animate-[shimmer_1s_infinite]"></div>
                 </div>
               </div>
             </div>
           </div>
        )}

        {status === ProcessingStatus.COMPLETE && convertedDoc && (
          <div className="flex flex-col items-center w-full animate-fade-in-up pb-20 pt-24 px-4">
            
            {/* Floating Toolbar */}
            <div className="sticky top-24 z-30 w-full max-w-4xl mx-auto mb-8">
              <div className="glass-panel p-2 rounded-2xl shadow-xl shadow-slate-200/50 flex flex-wrap items-center justify-between gap-3 border border-white/60">
                
                <div className="flex items-center gap-2 pr-2">
                   <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                     <FileText size={20} />
                   </div>
                   <div className="hidden sm:block">
                     <div className="text-xs font-bold text-slate-400">ملف جاهز</div>
                     <div className="text-sm font-bold text-slate-800">HTML Preview</div>
                   </div>
                </div>

                {/* Editor Tools */}
                <div className="flex items-center bg-slate-50/80 rounded-xl p-1 gap-1 border border-slate-100">
                  <ToolButton icon={Bold} title="غامق" />
                  <ToolButton icon={Italic} title="مائل" />
                  <ToolButton icon={Underline} title="تسطير" />
                  <div className="w-px h-5 bg-slate-200 mx-1"></div>
                  <ToolButton icon={AlignRight} title="يمين" active />
                  <ToolButton icon={AlignCenter} title="وسط" />
                  <ToolButton icon={AlignLeft} title="يسار" />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pl-1">
                  <button 
                    onClick={handleCopy}
                    className="p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    title="نسخ النص"
                  >
                    {copied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                  </button>

                  <button 
                    onClick={handleDownload}
                    disabled={isExporting}
                    className={`
                      flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all font-bold text-sm text-white
                      ${isExporting 
                        ? 'bg-indigo-400 cursor-wait' 
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-indigo-500/30 hover:-translate-y-0.5'}
                    `}
                  >
                    {isExporting ? <Loader2 size={18} className="animate-spin" /> : (Capacitor.isNativePlatform() ? <ShareIcon size={18} /> : <Download size={18} />)}
                    <span>{isExporting ? 'جاري التحضير...' : 'تحميل Word'}</span>
                  </button>
                  
                  <button 
                    onClick={handleReset}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border-r border-slate-100 mr-1 pr-3"
                    title="إغلاق"
                  >
                     <RefreshCw size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-center">
               <PreviewEditor htmlContent={convertedDoc.htmlContent} />
            </div>
          </div>
        )}

        {status === ProcessingStatus.ERROR && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
            <div className="glass-card p-8 rounded-3xl shadow-xl border border-red-100 max-w-md text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-12 shadow-sm">
                 <WifiOff size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">فشلت العملية</h3>
              <p className="text-slate-500 mb-8 text-sm leading-relaxed">{errorMsg}</p>
              <button 
                onClick={handleReset} 
                className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all font-bold shadow-lg shadow-slate-200"
              >
                <RefreshCw size={20} />
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