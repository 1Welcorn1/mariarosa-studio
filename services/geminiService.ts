import { GoogleGenAI } from "@google/genai";
import { EditingAction } from "../types";
import { ACTION_OPTIONS } from "../constants";

const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
const TEXT_MODEL_NAME = 'gemini-2.5-flash';

// Initialize the client with the environment variable
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Debug variable to store the last error for UI inspection
let lastDebugError: any = null;

export function getLastErrorDebugInfo() {
  return lastDebugError ? JSON.stringify(lastDebugError, null, 2) : "Nenhum erro registrado.";
}

/**
 * Helper to fetch a URL and convert it to base64 string
 */
export async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Helper to strip the data:image/xyz;base64, prefix for the API
 */
function extractBase64Data(dataUrl: string): { mimeType: string; data: string } {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Formato de string base64 inválido");
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

/**
 * Centralized error handling for Gemini API with context
 */
function handleGeminiError(error: any, modelUsed: string): never {
  console.error(`Gemini API Error [${modelUsed}]:`, error);
  lastDebugError = error; // Store for UI debugging

  const msg = error.message || error.toString();
  
  // Specific handling for Quota/Billing issues
  if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
    // Check for "limit: 0" which implies Free Tier restriction or Billing requirement
    if (msg.includes('limit: 0')) {
       throw new Error(`COTA ZERO DETECTADA (${modelUsed}).\nO projeto parece estar no 'Free Tier' ou sem faturamento (Billing) ativado para este modelo específico.\nErro Técnico: ${msg.substring(0, 100)}...`);
    }
    throw new Error(`Cota excedida para o modelo ${modelUsed}. Aguarde um momento.\nErro Técnico: ${msg.substring(0, 100)}...`);
  }
  
  if (msg.includes('503') || msg.includes('overloaded')) {
     throw new Error(`Serviço ${modelUsed} sobrecarregado. Tente novamente em instantes.`);
  }
  
  if (msg.includes('SAFETY') || msg.includes('blocked')) {
    throw new Error("A imagem gerada foi bloqueada pelos filtros de segurança. Tente um prompt diferente.");
  }

  throw new Error(`Erro (${modelUsed}): ${msg.substring(0, 100)}...`);
}

export async function generateEditedImage(
  imageBase64: string,
  prompt: string,
  action: EditingAction
): Promise<string> {
  try {
    // Construct the prompt based on the action template
    const actionConfig = ACTION_OPTIONS.find(opt => opt.value === action);
    const finalPrompt = actionConfig 
      ? actionConfig.promptTemplate.replace('{prompt}', prompt)
      : prompt;

    const { mimeType, data } = extractBase64Data(imageBase64);

    console.log(`[DEBUG] Calling ${IMAGE_MODEL_NAME} with prompt length: ${finalPrompt.length}`);

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [
          {
            text: finalPrompt
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: data
            }
          }
        ]
      },
      config: {}
    });

    const parts = response.candidates?.[0]?.content?.parts;
    
    if (!parts) {
      throw new Error("API retornou sucesso mas nenhum conteúdo gerado");
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("Nenhum dado de imagem encontrado na resposta da API");

  } catch (error) {
    handleGeminiError(error, IMAGE_MODEL_NAME);
  }
}

export async function generateHashtags(context: string): Promise<string[]> {
  const prompt = `Find popular and trending Instagram/TikTok hashtags in Portuguese (Brazil) that would help people find a post about: "${context}". 
      Focus on fashion, style, trends, and the specific visual elements described.
      Return strictly a list of 15-20 hashtags separated by spaces. Example output: #moda #lookdodia #fashionstyle`;

  try {
    // Attempt 1: With Google Search for current trends (More expensive/strict quota)
    console.log(`[DEBUG] Calling ${TEXT_MODEL_NAME} (Tools Mode)`);
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });
    return parseHashtags(response.text || "");
  } catch (error: any) {
    console.warn("Hashtag generation with tools failed, retrying without tools...", error);
    lastDebugError = error; // Capture the first failure too

    // Attempt 2: Fallback without tools (Cheaper/Simpler)
    try {
      console.log(`[DEBUG] Calling ${TEXT_MODEL_NAME} (Fallback Mode)`);
      const response = await ai.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: prompt + " (Generate generic popular fashion tags)",
      });
      return parseHashtags(response.text || "");
    } catch (fallbackError) {
      handleGeminiError(fallbackError, TEXT_MODEL_NAME);
    }
  }
}

function parseHashtags(text: string): string[] {
  const tags = text.match(/#[a-zA-Z0-9\u00C0-\u00FF]+/g) || [];
  if (tags.length === 0) {
    return text.split(/\s+/).filter(w => w.length > 2).map(w => w.startsWith('#') ? w : `#${w}`);
  }
  return tags;
}

export async function enhancePrompt(currentPrompt: string, action: EditingAction): Promise<string> {
  try {
    console.log(`[DEBUG] Calling ${TEXT_MODEL_NAME} for prompt enhancement`);
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: `You are a professional fashion photographer and AI prompter. Rewrite the following user prompt (which may be in Portuguese) to be more descriptive, focusing on lighting, fabric texture, and realistic details to get the best result from an image generation model.
      
      User Prompt: "${currentPrompt}"
      Context/Action: ${action}
      
      Keep it concise (under 40 words) but impactful. Translate the intent to English for better model performance if needed, or keep high quality Portuguese. Do not add conversational text, just return the improved prompt string.`,
    });
    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    // Non-critical, return original without throwing to UI
    return currentPrompt;
  }
}