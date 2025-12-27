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
  // Client-side validation: 20MB limit (Tier 1 Supported)
  if (file.size > 20 * 1024 * 1024) {
    throw new Error("عذراً، حجم الملف كبير جداً. الحد الأقصى المسموح به هو 20 ميجابايت.");
  }

  try {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      throw new Error("لم يتم العثور على مفتاح API في الإعدادات الداخلية للتطبيق.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // STRATEGY FOR TIER 1 (STABLE):
    // 1. gemini-1.5-pro: The most stable high-intelligence model available. Excellent for Arabic & Tables.
    // 2. gemini-1.5-flash: Fast fallback.
    // We removed 'preview' models to avoid 404 errors.
    const models = ['gemini-1.5-pro', 'gemini-1.5-flash'];
    
    let pdfPart;
    try {
      pdfPart = await fileToGenerativePart(file);
    } catch (readError) {
      throw new Error("فشل في قراءة الملف من الجهاز.");
    }

    const systemPrompt = `
    You are an expert Educational Document Digitizer.
    Target: Convert the provided PDF exam paper into a high-fidelity HTML document optimized for MS Word.

    **CRITICAL INSTRUCTION: PROCESS THE FULL DOCUMENT**
    - You MUST convert **EVERY SINGLE PAGE** from the first page to the very last page.
    - **DO NOT STOP** after 2 or 3 pages.
    - If the PDF has 20 pages, output the HTML for all 20 pages.
    - Do not summarize. Do not skip questions.

    **LAYOUT & WORD COMPATIBILITY RULES:**
    - **NO Page Borders**: Do not add a border around the <body> or the main container.
    - **Question Boxes**: If a question has a box around it, use <table width="100%" border="1" cellspacing="0" cellpadding="5">.
    - **Images/Diagrams**: Draw them as inline SVGs. You MUST specify explicit width="X" and height="Y" (e.g., width="300" height="150") for every SVG.
    - **Direction**: dir="rtl" for Arabic.

    **OUTPUT FORMAT:**
    - Return ONLY the raw HTML code inside the <body> tag. 
    - Do not include \`\`\`html markdown blocks.
    - Just the content.
    `;

    let lastError: any = null;

    for (const modelId of models) {
      try {
        console.log(`Attempting conversion using Tier 1 model: ${modelId}`);
        const maxRetries = 2; 
        
        // Retry loop
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelId,
              // Optimized: Pass PDF as content, Prompt as System Instruction for stricter adherence
              contents: { parts: [pdfPart, { text: "Convert this entire document to HTML following the system instructions." }] },
              config: { 
                temperature: 0.1,
                systemInstruction: systemPrompt
              }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response");

            const cleanHtml = text.replace(/```html/g, '').replace(/```/g, '').trim();
            return cleanHtml; 

          } catch (innerError: any) {
            const status = innerError.status || innerError.response?.status || 0;
            const message = innerError.message?.toLowerCase() || '';
            console.warn(`Attempt ${attempt} failed on ${modelId}:`, message);

            if (status === 404 || message.includes('not found')) {
               throw innerError; 
            }

            const isQuotaError = status === 429 || message.includes('429') || message.includes('quota');
            const isServerBusy = status === 503 || message.includes('503') || message.includes('overloaded');
            
            if (attempt < maxRetries) {
              if (isQuotaError) {
                // Tier 1 allows faster retries
                await wait(2000); 
                continue;
              }
              if (isServerBusy) {
                 await wait(attempt * 1000);
                 continue;
              }
            }
            throw innerError;
          }
        }
      } catch (modelError: any) {
        lastError = modelError;
        console.warn(`Model ${modelId} failed completely. Switching to next model...`);
      }
    }

    if (lastError) {
        if (lastError.message?.includes('429') || lastError.status === 429) {
            throw new Error("ضغط عالي على الخوادم (Rate Limit). يرجى الانتظار لحظات.");
        }
        throw new Error("تعذر تحويل الملف. يرجى التأكد من أن الملف قابل للقراءة.");
    }
    throw new Error("حدث خطأ غير معروف.");

  } catch (error: any) {
    console.error("Final Conversion Error:", error);
    if (error.message?.includes('429') || error.status === 429) {
       throw new Error("يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.");
    }
    throw error;
  }
};