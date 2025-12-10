import { AppState } from "../types";

// Replaced Firebase with LocalStorage to resolve module import errors.
// This allows the app to persist state locally in the browser without requiring
// a configured Firebase environment or matching package versions.
const STORAGE_KEY = 'MARIA_ROSA_SESSION';

export const saveSession = async (state: AppState): Promise<{ success: boolean; message: string }> => {
  try {
    // Basic validation to avoid QuotaExceeded for very large states (e.g. too many base64 images)
    // We try to save it all, if it fails, we catch the error.
    const stateStr = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, stateStr);
    return { success: true, message: "Sessão salva no navegador!" };
  } catch (error: any) {
    console.error("Error saving session:", error);
    return { 
      success: false, 
      message: error.name === 'QuotaExceededError' 
        ? "Espaço insuficiente no navegador. Remova algumas imagens." 
        : "Erro ao salvar sessão." 
    };
  }
};

export const loadSession = async (): Promise<{ success: boolean; data?: Partial<AppState>; message: string }> => {
  try {
    const stateStr = localStorage.getItem(STORAGE_KEY);
    if (!stateStr) {
      return { success: false, message: "Nenhuma sessão salva encontrada." };
    }
    const data = JSON.parse(stateStr);
    return { success: true, data, message: "Sessão carregada com sucesso!" };
  } catch (error) {
    console.error("Error loading session:", error);
    return { success: false, message: "Erro ao carregar sessão." };
  }
};