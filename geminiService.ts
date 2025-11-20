import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceType, ConceptType, PaymentCondition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseInvoiceRequest = async (prompt: string): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  const systemInstruction = `
    You are an expert accountant assistant for the Argentine tax system (ARCA/AFIP).
    Your goal is to extract invoice details from natural language text or voice transcripts.
    
    Defaults if not specified:
    - Type: Factura C
    - Concept: Productos
    - Payment: Contado
    - POS: 1
    - Date: Today (YYYY-MM-DD)

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