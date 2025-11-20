import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceType, ConceptType, PaymentCondition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseInvoiceRequest = async (prompt: string): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  const systemInstruction = `
    Act as a specialized invoice data extractor for ARCA (Argentina).
    
    CRITICAL RULES FOR EXTRACTION:
    1. ITEM NAMES (KEYWORDS ONLY): 
       - Extract only the core product name. Remove words like "litros de", "botella de", "paquete de", "unidades de".
       - Example Input: "2 litros de lavandina a 800" -> Output: Item: "Lavandina", Qty: 2, Price: 800.
       - Example Input: "una coca cola" -> Output: Item: "Coca Cola", Qty: 1.
    
    2. DATES AND TIMES:
       - UNLESS the user explicitly mentions a date (e.g., "con fecha de ayer", "para mañana"), RETURN NULL for date.
       - DO NOT hallucinate a default date like "2024-05-15". Return NULL so the app can use the system date.
       - Return NULL for time unless specified.

    Defaults:
    - Type: Factura C
    - Concept: Productos
    - Payment: Contado
    - POS: 1
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
            date: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD. Null if not specified.", nullable: true },
            time: { type: Type.STRING, description: "HH:MM (24h). Null if not specified.", nullable: true },
            scheduledFor: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD", nullable: true },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Concise product name (Keywords only)" },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                },
                required: ["name", "quantity", "unitPrice"]
              }
            }
          },
          required: ["type", "concept", "paymentCondition", "items"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      // El frontend se encargará de rellenar la fecha si es null
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("Error parsing invoice with Gemini:", error);
    throw error;
  }
};