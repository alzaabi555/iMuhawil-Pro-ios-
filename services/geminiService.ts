import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";

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
          // FORCE application/pdf. 
          // Mobile browsers sometimes send generic binary types which fail the API.
          mimeType: 'application/pdf', 
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
      throw new Error("لم يتم العثور على مفتاح API. يرجى التأكد من الإعدادات.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // UPDATED MODELS: Use Gemini 3 series to prevent 404 errors on older endpoints
    // gemini-3-pro-preview: Best for complex reasoning and structure analysis
    // gemini-3-flash-preview: Faster fallback
    const models = ['gemini-3-pro-preview', 'gemini-3-flash-preview'];
    
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
        console.log(`Attempting conversion using model: ${modelId}`);
        const maxRetries = 2; 
        
        // Retry loop
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const response = await ai.models.generateContent({
              model: modelId,
              contents: { parts: [pdfPart, { text: "Digitize this entire PDF to HTML perfectly. Follow system instructions." }] },
              config: { 
                temperature: 0.1,
                systemInstruction: systemPrompt,
                // CRITICAL: Disable safety settings to prevent false positives on exam papers
                safetySettings: [
                  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
              }
            });

            // Check if we have candidates
            if (!response.candidates || response.candidates.length === 0) {
               console.warn(`Model ${modelId} returned no candidates on attempt ${attempt}`);
               throw new Error("No candidates returned");
            }

            // Check finish reason
            const candidate = response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                console.warn(`Model ${modelId} finished with reason: ${candidate.finishReason}`);
                if (candidate.finishReason === 'SAFETY') throw new Error("Blocked by Safety");
                if (candidate.finishReason === 'RECITATION') throw new Error("Blocked by Recitation");
            }

            const text = response.text;
            
            if (!text) {
               console.warn(`Model ${modelId} returned empty text on attempt ${attempt}`);
               throw new Error("Empty response text");
            }

            const cleanHtml = text.replace(/```html/g, '').replace(/```/g, '').trim();
            return cleanHtml; 

          } catch (innerError: any) {
            const status = innerError.status || innerError.response?.status || 0;
            // Handle cases where message is a JSON string
            let message = innerError.message || '';
            try {
                if (message.startsWith('{')) message = JSON.parse(message).error?.message || message;
            } catch(e) {}
            message = message.toLowerCase();

            console.warn(`Attempt ${attempt} failed on ${modelId}:`, message);

            if (status === 404 || message.includes('not found')) {
               throw innerError; // Move to next model immediately if model not found
            }

            const isQuotaError = status === 429 || message.includes('429') || message.includes('quota');
            const isServerBusy = status === 503 || message.includes('503') || message.includes('overloaded');
            
            if (attempt < maxRetries) {
              if (isQuotaError) {
                await wait(2000 * attempt); 
                continue;
              }
              if (isServerBusy) {
                 await wait(1000 * attempt);
                 continue;
              }
              await wait(1000); // Standard retry
            } else {
               throw innerError;
            }
          }
        }
      } catch (modelError: any) {
        lastError = modelError;
        console.warn(`Model ${modelId} failed completely. Switching to next model...`);
      }
    }

    // Detailed Error Reporting
    if (lastError) {
        let msg = lastError.message || '';
         // Try to parse if it looks like JSON to avoid showing raw JSON to user
        try {
            if (msg.trim().startsWith('{')) {
                 const parsed = JSON.parse(msg);
                 if (parsed.error && parsed.error.message) msg = parsed.error.message;
            }
        } catch (e) {}
        
        const lowerMsg = msg.toLowerCase();
        
        if (lowerMsg.includes('404') || lowerMsg.includes('not found')) {
             throw new Error("موديل الذكاء الاصطناعي غير متوفر حالياً (404). يرجى التحقق من المفتاح أو استخدام موديل أحدث.");
        }
        if (lowerMsg.includes('429')) {
            throw new Error("ضغط عالي على الخوادم (Rate Limit). يرجى المحاولة لاحقاً.");
        }
        if (lowerMsg.includes('safety') || lowerMsg.includes('blocked')) {
            throw new Error("تم حظر الملف لسياسات المحتوى. يرجى تجربة ملف آخر.");
        }
        if (lowerMsg.includes('recitation')) {
             throw new Error("تم حظر الملف بسبب حقوق النشر (Recitation).");
        }
        if (lowerMsg.includes('400') || lowerMsg.includes('invalid argument')) {
            throw new Error("الملف تالف أو غير مدعوم من قبل النموذج.");
        }
        if (lowerMsg.includes('empty response') || lowerMsg.includes('no candidates')) {
             throw new Error("لم يتمكن الذكاء الاصطناعي من قراءة محتوى الملف. تأكد أن الملف نصي وليس صوراً فقط.");
        }
        
        // Fallback with clean error info
        throw new Error(`فشلت العملية: ${msg}`);
    }
    
    throw new Error("حدث خطأ غير متوقع.");

  } catch (error: any) {
    console.error("Final Conversion Error:", error);
    let finalMsg = error.message || "حدث خطأ غير متوقع";
    // Clean up if it's the catch-all
    if (finalMsg.startsWith('Error: ')) finalMsg = finalMsg.substring(7);
    throw new Error(finalMsg);
  }
};