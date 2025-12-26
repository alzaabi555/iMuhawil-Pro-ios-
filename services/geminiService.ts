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
    // Using the most capable model available (Gemini 3 Pro Preview)
    const modelId = 'gemini-3-pro-preview'; 

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

    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} to convert PDF...`);
        const response = await ai.models.generateContent({
          model: modelId,
          contents: {
            parts: [
              pdfPart,
              { text: prompt }
            ]
          },
          config: {
            // MAXIMUM Thinking Budget for Paid/Pro Plans.
            // 32768 is the max for Gemini 3 Pro, allowing deepest possible reasoning for complex Arabic layouts.
            thinkingConfig: { thinkingBudget: 32768 }, 
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
        
        return cleanHtml;

      } catch (error: any) {
        console.warn(`Attempt ${attempt} failed:`, error);
        lastError = error;
        
        // Detect XHR/Network/Server errors
        const errorMessage = error.toString().toLowerCase();
        const isNetworkError = 
          errorMessage.includes('xhr') || 
          errorMessage.includes('fetch') || 
          errorMessage.includes('500') || 
          errorMessage.includes('503') ||
          errorMessage.includes('rpc');

        if (attempt < maxRetries && isNetworkError) {
          const delayMs = attempt * 2000;
          await wait(delayMs);
          continue;
        }
        
        // Break immediately for client errors (4xx) unless it's a rate limit (429)
        if (errorMessage.includes('400') || (errorMessage.includes('4') && !errorMessage.includes('429'))) {
          break;
        }
      }
    }

    // Final Error Handling
    if (lastError?.message?.includes('xhr') || lastError?.message?.includes('RPC')) {
      throw new Error("حدث خطأ في الاتصال بالخادم (XHR Failed). قد يكون الملف كبيراً جداً أو الاتصال بطيئاً. حاول تقليل حجم الملف.");
    }

    throw lastError;

  } catch (error) {
    console.error("Conversion Error:", error);
    throw error;
  }
};