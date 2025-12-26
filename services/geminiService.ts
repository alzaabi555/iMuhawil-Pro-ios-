import { GoogleGenAI } from "@google/genai";

// Helper to convert File to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const convertPdfToHtml = async (file: File): Promise<string> => {
  // Client-side validation: 10MB limit to prevent XHR/Payload errors with inline base64
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("عذراً، حجم الملف كبير جداً. يرجى استخدام ملف أقل من 10 ميجابايت لضمان سرعة واستقرار المعالجة.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Priority list of models. If the first one fails (Quota/Error), we try the next.
    // 1. gemini-3-flash-preview: Latest, fast, but might be unstable/limited.
    // 2. gemini-1.5-flash: Very stable, high limits, reliable fallback.
    const models = ['gemini-3-flash-preview', 'gemini-1.5-flash'];
    
    let pdfPart;
    try {
      pdfPart = await fileToGenerativePart(file);
    } catch (readError) {
      throw new Error("فشل في قراءة الملف من الجهاز.");
    }

    const prompt = `
    You are a professional Document Conversion Engine specialized in Arabic PDF to Word transformation.
    
    Target: Create a high-fidelity HTML document structure that Microsoft Word can interpret perfectly.

    STRICT REQUIREMENTS:
    1. **Structure**: Return ONLY the HTML <body> content. Do NOT wrap in <html> or <head>.
    2. **Language**: The content is ARABIC. Force 'dir="rtl"' and 'text-align: right' styles on paragraphs.
    3. **Layout Accuracy**:
       - Preserve headings (h1, h2, h3).
       - Preserve Bold, Italic, and Underline.
       - Preserve font sizes relative to the original.
    4. **Tables (CRITICAL)**:
       - Use standard HTML <table>, <tr>, <td>.
       - You MUST add 'border="1"' to the table tag.
       - Add style="border-collapse: collapse; width: 100%;" to tables.
       - Ensure complex merged cells (rowspan/colspan) are accurate.
    5. **Images**: 
       - If you encounter diagrams or photos, insert a placeholder: <div style="padding: 20px; border: 1px dashed #666; background: #eee; text-align: center;">[صورة/رسم بياني هنا]</div>.
    6. **Cleanliness**: Do not output markdown code blocks (like \`\`\`html). Just the raw HTML string.

    7. **ARABIC OCR CORRECTION (VERY IMPORTANT)**:
       You must contextually fix common PDF extraction errors in Arabic ligatures:
       - **Fix "Alif-Lam" (ال)**: Convert "امل" to "الم" when it signifies "Alif-Lam-Mim" (e.g., correct "املفاهيم" -> "المفاهيم", "املخرجات" -> "المخرجات", "املعلم" -> "المعلم").
       - **Fix "Lam-Alif" (لا)**: Convert "الح" or "ال" patterns that should be "La" (e.g., correct "تالحظ" -> "تلاحظ", "عالمات" -> "علامات", "ال يوجد" -> "لا يوجد").
       - **Fix Broken Hamzas**: Fix detached Alif/Hamza (e.g., correct "األهداف" -> "الأهداف", "األول" -> "الأول", "اإلجابة" -> "الإجابة").
       - **General**: Ensure words are spelled correctly according to standard Arabic morphology.

    Convert the attached PDF document now.
    `;

    let lastError: any = null;

    // Loop through models as fallback mechanism
    for (const modelId of models) {
      try {
        console.log(`Attempting conversion using model: ${modelId}`);
        
        // Inner Retry Loop for transient network errors
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelId,
              contents: {
                parts: [
                  pdfPart,
                  { text: prompt }
                ]
              },
              config: {
                // Disable thinking to save tokens/quota
                thinkingConfig: { thinkingBudget: 0 }, 
                temperature: 0.1
              }
            });

            const text = response.text;
            if (!text) {
              throw new Error("لم يتم استرجاع أي بيانات من الخادم.");
            }

            // Advanced Cleanup
            const cleanHtml = text
              .replace(/```html/g, '')
              .replace(/```/g, '')
              .trim();
            
            return cleanHtml; // Success! Return immediately.

          } catch (innerError: any) {
            console.warn(`Attempt ${attempt} with ${modelId} failed:`, innerError);
            
            // If it's a Quota error (429), break inner loop to try next model immediately
            if (innerError.status === 429 || innerError.message?.includes('429') || innerError.message?.includes('quota')) {
               throw innerError; 
            }

            // If network error, wait and retry same model
            const errorMessage = innerError.toString().toLowerCase();
            const isNetworkError = 
              errorMessage.includes('xhr') || 
              errorMessage.includes('fetch') || 
              errorMessage.includes('500') || 
              errorMessage.includes('503');

            if (attempt < maxRetries && isNetworkError) {
              await wait(attempt * 2000);
              continue;
            }
            
            throw innerError;
          }
        }
      } catch (modelError: any) {
        console.error(`Model ${modelId} failed completely.`, modelError);
        lastError = modelError;
        // Continue to the next model in the list...
      }
    }

    // If all models failed
    if (lastError) {
        if (lastError.message?.includes('429') || lastError.message?.includes('quota')) {
            throw new Error("تم تجاوز الحد المسموح به للاستخدام المجاني حالياً في جميع النماذج. يرجى الانتظار دقيقة والمحاولة مجدداً.");
        }
        throw lastError;
    }
    
    throw new Error("حدث خطأ غير معروف أثناء المعالجة.");

  } catch (error: any) {
    console.error("Final Conversion Error:", error);
    if (error.message?.includes('429') || error.message?.includes('quota')) {
       throw new Error("عفواً، الخوادم مشغولة جداً الآن (429). يرجى الانتظار قليلاً.");
    }
    throw error;
  }
};