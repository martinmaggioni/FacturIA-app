import { GoogleGenAI, Type } from "@google/genai";
import { InvoiceType, ConceptType, PaymentCondition } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseInvoiceRequest = async (prompt: string): Promise<any> => {
  const modelId = "gemini-2.5-flash";

  // Obtener fecha y hora real del sistema del usuario
  const now = new Date();
  
  // Formato manual YYYY-MM-DD para asegurar consistencia
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const argentinaDate = `${year}-${month}-${day}`;
  
  const argentinaTime = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  const systemInstruction = `
    Act as a specialized invoice data extractor for ARCA (Argentina).
    
    CONTEXT:
    - Today's Date: ${argentinaDate} (Use this EXACT date unless the user specifies another).
    - Current Time: ${argentinaTime} (Use this EXACT time unless specified).

    CRITICAL RULES FOR EXTRACTION:
    1. ITEM NAMES (KEYWORDS ONLY): 
       - Extract only the core product name. Remove words like "litros de", "botella de", "paquete de", "unidades de".
       - Example Input: "2 litros de lavandina a 800" -> Output: Item: "Lavandina", Qty: 2, Price: 800.
       - Example Input: "una coca cola" -> Output: Item: "Coca Cola", Qty: 1.
    
    2. DATES:
       - If the user does not mention a specific date (like "ayer", "mañana", "el 5 de enero"), YOU MUST RETURN "${argentinaDate}".
       - DO NOT hallucinate dates from 2024 or the past.

    3. TIME:
       - Always return the time in HH:MM format. Default to "${argentinaTime}".

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
            date: { type: Type.STRING, description: "ISO 8601 YYYY-MM-DD. Default to Today." },
            time: { type: Type.STRING, description: "HH:MM (24h)" },
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
          required: ["type", "concept", "paymentCondition", "items", "date", "time"]
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text);
      // Doble verificación de seguridad por si la IA alucina la fecha
      if (!parsed.date || parsed.date.includes('2024-05')) {
          parsed.date = argentinaDate;
      }
      if (!parsed.time) {
          parsed.time = argentinaTime;
      }
      return parsed;
    }
    return null;
  } catch (error) {
    console.error("Error parsing invoice with Gemini:", error);
    throw error;
  }
};