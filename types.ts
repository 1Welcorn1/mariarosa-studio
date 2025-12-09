export enum ImageSourceType {
  PRESET = 'PRESET',
  UPLOAD = 'UPLOAD'
}

export enum EditingAction {
  BACKGROUND_SWAP = 'BACKGROUND_SWAP',
  OUTFIT_SWAP = 'OUTFIT_SWAP',
  POSE_SWAP = 'POSE_SWAP',
  SHOES_SWAP = 'SHOES_SWAP',
  BAG_SWAP = 'BAG_SWAP',
  COLOR_CHANGE = 'COLOR_CHANGE',
  FREEFORM = 'FREEFORM'
}

export interface ProductPreset {
  id: string;
  name: string;
  url: string;
}

export interface CatalogItem {
  id: string;
  imageUrl: string;
  prompt: string;
  actions: EditingAction[];
  timestamp: number;
  tags: string[];
  // New Metadata fields
  name: string;
  description: string;
  price: string;
  // Variations support
  variations: string[];
}

export interface CartItem extends CatalogItem {
  quantity: number;
}

export type AppView = 'STUDIO' | 'CATALOG' | 'LOOKBOOK';

export interface AppState {
  sourceType: ImageSourceType;
  selectedPresetId: string;
  uploadedImage: string | null; // Base64 data URL
  currentImage: string | null; // The image currently displayed/used for generation
  
  // Refactored for Multi-Select
  activeActions: EditingAction[]; 
  promptInputs: Record<string, string>; // Map of ActionEnum -> User Input String

  isGenerating: boolean;
  generatingVariationId: string | null; // Track which catalog item is generating a variation
  generatedImage: string | null;
  error: string | null;
  statusMessage: string | null; // For success messages like "Session Saved"
  generatedTags: string[];
  isGeneratingTags: boolean;
  isEnhancingPrompt: boolean;

  // Catalog Features
  catalog: CatalogItem[];
  currentView: AppView;
  curatorName: string; // Name of the curator/brand for the lookbook
  
  // E-commerce Features
  cart: CartItem[];
  isCartOpen: boolean;
  phoneNumber: string; // WhatsApp number
  
  // Branding
  logoUrl: string | null;
}