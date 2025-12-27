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

  // Robust function to convert SVGs to PNGs
  const processHtmlForExport = async (rawHtml: string): Promise<string> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, 'text/html');
    const svgs = doc.querySelectorAll('svg');

    if (svgs.length === 0) return rawHtml;

    const conversionPromises = Array.from(svgs).map(async (svg) => {
      return new Promise<void>((resolve) => {
        try {
          // 1. Ensure dimensions exist
          let width = parseInt(svg.getAttribute('width') || '0');
          let height = parseInt(svg.getAttribute('height') || '0');
          
          // Fallback to viewBox if width/height are missing
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
          
          // Final fallback
          width = width || 300;
          height = height || 150;

          // Set Explicit dimensions on the SVG node before serializing
          svg.setAttribute('width', width.toString());
          svg.setAttribute('height', height.toString());
          
          // Ensure XML namespace exists
          svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // 3x Scale for high quality in Word
            canvas.width = width * 3;
            canvas.height = height * 3;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              // White background to prevent black artifacts in Word
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              
              const pngData = canvas.toDataURL('image/png');
              const newImg = doc.createElement('img');
              newImg.src = pngData;
              // Set styles for Word to behave
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
            console.warn('SVG load failed');
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
    
    // 1. Process Images
    const processedBodyContent = await processHtmlForExport(convertedDoc.htmlContent);

    // 2. Prepare HTML for Word
    // Note: CSS updated to force NO BORDERS on the main document body
    const preHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'
            dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>${convertedDoc.fileName}</title>
        <style>
          @page { 
            size: 21cm 29.7cm; 
            margin: 2cm 2cm 2cm 2cm; 
            mso-page-orientation: portrait; 
          }
          @page Section1 {
            size: 21cm 29.7cm; 
            margin: 2cm 2cm 2cm 2cm;
            mso-header-margin: 35.4pt; 
            mso-footer-margin: 35.4pt; 
            mso-paper-source: 0;
          }
          body { 
            font-family: 'Times New Roman', Arial, sans-serif; 
            font-size: 14pt; 
            border: none !important;
            margin: 0;
            padding: 0;
          }
          
          /* Ensure the main container has no border */
          div.Section1 { 
            page: Section1; 
            border: none !important;
            box-shadow: none !important;
          }

          /* Keep tables borders intact */
          table { 
            border-collapse: collapse; 
            width: 100%; 
            table-layout: fixed; 
            margin-bottom: 15px;
          }
          td, th { 
            border: 1px solid #000; 
            padding: 8px; 
            vertical-align: top;
          }
          
          img {
            max-width: 100%;
            height: auto;
            display: inline-block;
          }
        </style>
      </head>
      <body>
        <div class="Section1">${processedBodyContent}</div>
      </body>
      </html>
    `;

    // 3. Mobile (iOS/Android) Share
    if (Capacitor.isNativePlatform()) {
      try {
        const fileName = `${convertedDoc.fileName}.doc`;
        const result = await Filesystem.writeFile({
          path: fileName,
          data: preHtml,
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

    // 4. Web Download
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
    setSaveStatus('');
  };

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

      <main className="flex-1 flex flex-col relative">
        {!isOnline && (
          <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 flex justify-center items-center gap-2 text-sm">
            <WifiOff size={16} />
            <span>لا يوجد اتصال بالإنترنت</span>
          </div>
        )}

        {status === ProcessingStatus.IDLE && (
           <FileUpload onFileSelect={handleFileSelect} disabled={!isOnline} />
        )}

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
                 نقوم الآن بإعادة رسم الجداول والمخططات لتتوافق مع Microsoft Word.
               </p>
             </div>
           </div>
        )}

        {status === ProcessingStatus.COMPLETE && convertedDoc && (
          <div className="flex flex-col items-center w-full animate-fade-in-up">
            
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

              <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                <ToolButton icon={Bold} title="غامق" />
                <ToolButton icon={Italic} title="مائل" />
                <ToolButton icon={Underline} title="تسطير" />
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <ToolButton icon={AlignRight} title="يمين" active />
                <ToolButton icon={AlignCenter} title="وسط" />
                <ToolButton icon={AlignLeft} title="يسار" />
              </div>

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
                  disabled={isExporting}
                  className={`
                    flex items-center gap-2 px-6 py-2 rounded-lg shadow-md shadow-indigo-200 transition-all font-medium text-sm
                    ${isExporting 
                      ? 'bg-indigo-400 cursor-wait text-white' 
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-105'}
                  `}
                >
                  {isExporting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    Capacitor.isNativePlatform() ? <ShareIcon size={18} /> : <Download size={18} />
                  )}
                  <span>
                    {isExporting ? 'جاري التحضير...' : (Capacitor.isNativePlatform() ? 'حفظ / مشاركة' : 'تحميل Word')}
                  </span>
                </button>
              </div>
            </div>

            <div className="w-full max-w-5xl p-4 md:p-8">
               <PreviewEditor htmlContent={convertedDoc.htmlContent} />
            </div>
          </div>
        )}

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