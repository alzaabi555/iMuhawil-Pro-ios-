import React from 'react';
import { UploadCloud, FileType, AlertCircle, Zap } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Tier 1 allows for larger files processing
      if (file.size > 20 * 1024 * 1024) {
        alert('عذراً، حجم الملف يجب أن يكون أقل من 20 ميجابايت');
        return;
      }
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[calc(100vh-80px)] p-6 animate-fade-in-up">
      
      <div className="text-center mb-10 max-w-2xl">
        <h2 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 leading-tight">
          حول ملفات <span className="text-indigo-600">PDF</span> إلى <span className="text-indigo-600">Word</span> بذكاء.
        </h2>
        <p className="text-lg text-slate-500 leading-relaxed">
          نستخدم أحدث تقنيات الذكاء الاصطناعي (Gemini 3 Pro) للحفاظ على التنسيق العربي، 
          الجداول، والصور بدقة عالية.
        </p>
      </div>

      <div className="w-full max-w-xl">
        <label 
          className={`
            group relative flex flex-col items-center justify-center w-full h-64 
            rounded-3xl border-2 border-dashed border-slate-300 bg-white 
            transition-all duration-300 ease-out
            ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-xl hover:shadow-indigo-100 hover:-translate-y-1'}
          `}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
              <UploadCloud size={32} />
            </div>
            
            <p className="mb-2 text-lg font-semibold text-slate-700">
              اضغط للرفع أو اسحب الملف هنا
            </p>
            <p className="text-sm text-slate-400 mb-4 flex items-center gap-1 justify-center">
               يدعم ملفات PDF حتى <span className="font-bold text-slate-600">20 ميجابايت</span>
               <Zap size={12} className="text-amber-500 fill-amber-500" />
            </p>
            
            <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
              <AlertCircle size={12} />
              <span>خصوصية تامة: الملفات تعالج ولا تخزن</span>
            </div>
          </div>
          
          <input 
            type="file" 
            className="hidden" 
            accept=".pdf" 
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      </div>

      {/* Features / Footer */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center opacity-70">
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 bg-green-100 text-green-700 rounded-lg">
            <FileType size={20} />
          </div>
          <span className="text-sm font-medium text-slate-600">دعم الجداول المعقدة</span>
        </div>
        <div className="flex flex-col items-center gap-2">
           <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <FileType size={20} />
          </div>
          <span className="text-sm font-medium text-slate-600">تنسيق عربي دقيق</span>
        </div>
        <div className="flex flex-col items-center gap-2">
           <div className="p-2 bg-orange-100 text-orange-700 rounded-lg">
            <FileType size={20} />
          </div>
          <span className="text-sm font-medium text-slate-600">تصدير Word مباشر</span>
        </div>
      </div>
    </div>
  );
};