import { EditingAction, ProductPreset } from './types';

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: 'p1',
    name: 'Vestido Midi Rosa Claro Soltinho',
    url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p2',
    name: 'Casual White Summer Dress',
    url: 'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p3',
    name: 'Professional Black Blazer Suit',
    url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=1000&auto=format&fit=crop'
  }
];

export const ACTION_OPTIONS = [
  { 
    value: EditingAction.BACKGROUND_SWAP, 
    label: 'Cenário (Background)', 
    shortLabel: 'Background',
    placeholder: 'e.g., luxury retail store, beach at sunset',
    promptTemplate: 'Change the background to {prompt}. Keep the person, lighting, and clothes exactly the same. High fidelity.' 
  },
  { 
    value: EditingAction.OUTFIT_SWAP, 
    label: 'Look (Outfit)', 
    shortLabel: 'Outfit',
    placeholder: 'e.g., floral summer dress, red tuxedo',
    promptTemplate: 'Change the outfit to {prompt}. Keep the person, pose, and background exactly the same.' 
  },
  { 
    value: EditingAction.POSE_SWAP, 
    label: 'Pose', 
    shortLabel: 'Pose',
    placeholder: 'e.g., hands on hips, walking confidently',
    promptTemplate: 'Change the person\'s pose to {prompt}. Maintain the exact facial features, hairstyle, and outfit details. Photorealistic.' 
  },
  { 
    value: EditingAction.SHOES_SWAP, 
    label: 'Sapatos (Shoes)', 
    shortLabel: 'Shoes',
    placeholder: 'e.g., red stiletto heels, white sneakers',
    promptTemplate: 'Replace the shoes with {prompt}. Keep the legs, skin tone, and outfit exactly the same.' 
  },
  { 
    value: EditingAction.BAG_SWAP, 
    label: 'Bolsa (Bag)', 
    shortLabel: 'Bag',
    placeholder: 'e.g., beige leather tote bag',
    promptTemplate: 'Add or replace the handbag with {prompt}. Integrate it naturally with the outfit and lighting.' 
  },
  { 
    value: EditingAction.COLOR_CHANGE, 
    label: 'Cor (Color)', 
    shortLabel: 'Color',
    placeholder: 'e.g., change the dress to navy blue',
    promptTemplate: 'Change the color of {prompt}. Keep the fabric texture, style, and background exactly the same.' 
  },
  { 
    value: EditingAction.FREEFORM, 
    label: 'Livre (Freeform)', 
    shortLabel: 'Freeform',
    placeholder: 'Describe any change you want...',
    promptTemplate: '{prompt}' 
  },
];

export const DEFAULT_PROMPTS: Record<EditingAction, string> = {
  [EditingAction.BACKGROUND_SWAP]: 'luxury retail store interior',
  [EditingAction.OUTFIT_SWAP]: 'a floral summer dress',
  [EditingAction.POSE_SWAP]: 'standing with crossed arms',
  [EditingAction.SHOES_SWAP]: 'elegant high heels',
  [EditingAction.BAG_SWAP]: 'a beige leather tote bag',
  [EditingAction.COLOR_CHANGE]: 'the dress to navy blue',
  [EditingAction.FREEFORM]: 'make it look like a magazine cover'
};
