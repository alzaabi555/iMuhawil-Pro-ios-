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
    // 1. Priority: User's Custom Key from Settings (Local Storage)
    // 2. Fallback: The default environment key
    const userKey = localStorage.getItem('USER_GEMINI_API_KEY');
    const apiKey = userKey || process.env.API_KEY;

    if (!apiKey) {
      throw new Error("لم يتم العثور على مفتاح API. يرجى إضافة مفتاحك في الإعدادات.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Priority list of models.
    const models = ['gemini-2.0-flash-exp', 'gemini-3-pro-preview', 'gemini-3-flash-preview'];
    
    let pdfPart;
    try {
      pdfPart = await fileToGenerativePart(file);
    } catch (readError) {
      throw new Error("فشل في قراءة الملف من الجهاز.");
    }

    const prompt = `
    You are an expert Educational Document Digitizer specialized in ALL Academic Subjects (Math, Physics, Chemistry, Biology, Geography, and Languages).
    
    Target: Convert the provided PDF exam paper into a high-fidelity HTML document compatible with MS Word.

    **CRITICAL INSTRUCTION: FULL DOCUMENT CONVERSION**
    - You MUST convert **EVERY SINGLE PAGE** in the PDF file.
    - **DO NOT STOP** after the first few pages.
    - **DO NOT SUMMARIZE**.
    - If the document is long, continue generating HTML until the very last question of the last page.

    **CRITICAL RULES FOR DIAGRAMS & MAPS (SVG GENERATION):**
    The document may contain visual elements from various subjects.
    1. **Mathematics**: Geometry (Triangles, Circles, Functions, Coordinates).
    2. **Physics**: Electric circuits, Forces, Optics diagrams.
    3. **Chemistry**: Molecules, Bonds, Laboratory apparatus.
    4. **Biology**: Simplified anatomical diagrams (Cells, Organs).
    5. **Geography**: Maps (Country outlines, Topographic lines).

    **DRAWING RULES:**
    - **DO NOT** use image placeholders.
    - **YOU MUST DRAW** these using **Inline SVG Code**.
    - **Style**: Black stroke (#000), stroke-width="2", transparent or light-gray (#eee) fill.
    - **Labels**: Preserve labels inside the SVG (e.g., "Voltmeter", "Cytoplasm", "Egypt", "5cm").
    - **Simplification**: For complex maps or biological drawings, draw a clean *schematic* vector representation (outlines only).

    **TEXT & LAYOUT RULES:**
    1. **Structure**: Return ONLY the HTML <body> content.
    2. **Language Handling**:
       - Default direction: dir="rtl" (Arabic).
       - **English/Foreign Language**: If a section or paragraph is in English/French, you MUST wrap it in <div dir="ltr" style="text-align: left; font-family: 'Arial', sans-serif;">...</div>.
    3. **Formatting**: Preserve H1/H2 headings, Bold, and Font sizes.
    4. **Scientific Formulas**: Use HTML <sub> and <sup> tags (e.g., H<sub>2</sub>O, x<sup>2</sup>, 10<sup>-6</sup>).
    5. **Tables**: Use standard HTML tables with border="1" style="border-collapse: collapse; width: 100%;".
    6. **Correction**: Fix OCR errors (e.g., broken Arabic characters).

    Output raw HTML only. No markdown blocks.
    `;

    let lastError: any = null;

    // Loop through models as fallback mechanism
    for (const modelId of models) {
      try {
        console.log(`Attempting conversion using model: ${modelId}`);
        
        // Inner Retry Loop for transient network errors AND Rate Limits
        const maxRetries = 3; // Increased retries to handle 429 waits
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
                maxOutputTokens: 65536, 
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
            const status = innerError.status || 0;
            const message = innerError.message?.toLowerCase() || '';
            
            // Log warning
            console.warn(`Attempt ${attempt} with ${modelId} failed:`, message);

            // Handle 404 (Not Found) - Abort this model immediately
            if (status === 404 || message.includes('not found')) {
               throw innerError; 
            }

            // SMART WAIT LOGIC:
            // If error is 429 (Quota/Rate Limit) OR 503 (Overloaded)
            const isQuotaError = status === 429 || message.includes('429') || message.includes('quota');
            const isServerBusy = status === 503 || message.includes('503') || message.includes('overloaded');
            
            if (attempt < maxRetries) {
              if (isQuotaError) {
                // If it's a Quota error, wait significantly longer (e.g., 12 seconds) to let the Token Bucket refill
                console.log("Quota hit (429). Waiting 12s before retry...");
                await wait(12000); 
                continue;
              }
              
              if (isServerBusy || message.includes('xhr') || message.includes('fetch')) {
                 // Network glitch or busy server, short wait
                 await wait(attempt * 2000);
                 continue;
              }
            }
            
            // If we ran out of retries or it's a fatal error, throw.
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
            throw new Error("السيرفر مشغول جداً حالياً بسبب ضغط الملفات الكبيرة. يرجى المحاولة بعد دقيقة أو استخدام مفتاح API خاص في الإعدادات.");
        }
        throw lastError;
    }
    
    throw new Error("حدث خطأ غير معروف أثناء المعالجة.");

  } catch (error: any) {
    console.error("Final Conversion Error:", error);
    if (error.message?.includes('429') || error.message?.includes('quota')) {
       throw new Error("عفواً، الخوادم مشغولة جداً الآن (429). جرب استخدام مفتاحك الخاص من الإعدادات.");
    }
    throw error;
  }
};