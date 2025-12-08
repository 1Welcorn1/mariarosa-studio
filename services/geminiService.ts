import { GoogleGenAI } from "@google/genai";
import { EditingAction } from "../types";
import { ACTION_OPTIONS } from "../constants";

// Initialize the API client
// Note: process.env.API_KEY is injected by the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
const TEXT_MODEL_NAME = 'gemini-2.5-flash';

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
    throw new Error("Invalid base64 string format");
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
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
      // Config specific for nano banana / 2.5 flash image
      config: {
        // We don't use responseMimeType here as per guidelines for nano banana
      }
    });

    // Check response structure for image parts
    const parts = response.candidates?.[0]?.content?.parts;
    
    if (!parts) {
      throw new Error("No content generated");
    }

    // Iterate to find the image part
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function generateHashtags(context: string): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: `Find popular and trending Instagram/TikTok hashtags in Portuguese (Brazil) that would help people find a post about: "${context}". 
      Focus on fashion, style, trends, and the specific visual elements described.
      Return strictly a list of 15-20 hashtags separated by spaces. Example output: #moda #lookdodia #fashionstyle`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    // Extract hashtags using regex to ensure clean output
    const tags = text.match(/#[a-zA-Z0-9\u00C0-\u00FF]+/g) || [];
    
    // If no tags found in text (fallback), try to split by space if the model didn't use #
    if (tags.length === 0) {
      return text.split(/\s+/).filter(w => w.length > 2).map(w => w.startsWith('#') ? w : `#${w}`);
    }
    
    return tags;
  } catch (error) {
    console.error("Gemini Tag Gen Error:", error);
    throw new Error("Failed to generate tags");
  }
}

export async function enhancePrompt(currentPrompt: string, action: EditingAction): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: `You are a professional fashion photographer and AI prompter. Rewrite the following user prompt to be more descriptive, focusing on lighting, fabric texture, and realistic details to get the best result from an image generation model.
      
      User Prompt: "${currentPrompt}"
      Context/Action: ${action}
      
      Keep it concise (under 40 words) but impactful. Do not add conversational text, just return the improved prompt string.`,
    });
    return response.text?.trim() || currentPrompt;
  } catch (error) {
    console.error("Prompt Enhancement Error:", error);
    return currentPrompt;
  }
}
