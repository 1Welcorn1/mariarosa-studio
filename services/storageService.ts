import { AppState } from "../types";

const STORAGE_KEY = 'MARIA_ROSA_SESSION_V3'; // Bumped version for Catalog support

export const saveSession = (state: AppState): { success: boolean; message: string } => {
  try {
    // Select specific fields to persist
    const dataToSave: Partial<AppState> = {
      sourceType: state.sourceType,
      selectedPresetId: state.selectedPresetId,
      uploadedImage: state.uploadedImage,
      currentImage: state.currentImage,
      activeActions: state.activeActions,
      promptInputs: state.promptInputs,
      generatedImage: state.generatedImage,
      generatedTags: state.generatedTags,
      catalog: state.catalog // Save the catalog
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    return { success: true, message: "Session and Catalog saved successfully!" };
  } catch (error: any) {
    console.error("Save error:", error);
    // Check for quota exceeded (Storage full)
    if (
      error.name === 'QuotaExceededError' || 
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ) {
       return { success: false, message: "Storage full. Try deleting some items from your catalog." };
    }
    return { success: false, message: "Failed to save session." };
  }
};

export const loadSession = (): { success: boolean; data?: Partial<AppState>; message: string } => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) {
      return { success: false, message: "No saved session found." };
    }
    const data = JSON.parse(json);
    return { success: true, data, message: "Session loaded successfully!" };
  } catch (error) {
    console.error("Load error:", error);
    return { success: false, message: "Failed to load session." };
  }
};
