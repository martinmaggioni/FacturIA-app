import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceType, ConceptType, PaymentCondition } from "../types";

// Use process.env.API_KEY according to strict coding guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseInvoiceRequest = async (prompt: string): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  // Obtener fecha actual en Argentina para darle contexto a la IA
  const now = new Date();
  const argentinaDate = now.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
  const argentinaTime = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });

  const systemInstruction = `
    You are an expert accountant assistant for the Argentine tax system (ARCA/AFIP).
    Current Date Context: ${argentinaDate} (DD/MM/YYYY).
    Current Time Context: ${argentinaTime}.

    Your goal is to extract invoice details from natural language text or voice transcripts.
    
    Defaults if not specified:
    - Type: Factura C
    - Concept: Productos
    - Payment: Contado
    - POS: 1
    - Date: ${new Date().toISOString().split('T')[0]} (ISO Format YYYY-MM-DD)
    - Time: ${argentinaTime}

    Extract items, quantities, and prices.
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