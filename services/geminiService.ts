import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceType, ConceptType, PaymentCondition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseInvoiceRequest = async (prompt: string): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  const now = new Date();
  const argentinaDate = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
  const argentinaTime = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });

  const systemInstruction = `
    You are an expert accountant assistant for the Argentine tax system (ARCA/AFIP).
    Current Date Context: ${argentinaDate} (YYYY-MM-DD).
    Current Time Context: ${argentinaTime}.

    Extract invoice details from natural language text or voice transcripts.
    
    Defaults if not specified:
    - Type: Factura C
    - Concept: Productos
    - Payment: Contado
    - POS: 1
    - Date: ${argentinaDate}
    - Time: ${argentinaTime}

    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: Object.values(InvoiceType) },
            concept: { type: Type.STRING, enum: Object.values(ConceptType) },
            paymentCondition: { type: Type.STRING, enum: Object.values(PaymentCondition) },
            date: { type: Type.STRING, description: "ISO 8601 format YYYY-MM-DD" },
            time: { type: Type.STRING, description: "Format HH:MM (24h)" },
            scheduledFor: { type: Type.STRING, description: "ISO 8601 format YYYY-MM-DD", nullable: true },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                },
                required: ["name", "quantity", "unitPrice"]
              }
            }
          },
          required: ["type", "concept", "paymentCondition", "items", "date"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return null;
  } catch (error) {
    console.error("Error parsing invoice with Gemini:", error);
    throw error;
  }
};