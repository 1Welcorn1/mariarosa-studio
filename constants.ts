import { EditingAction, ProductPreset } from './types';

export const PRODUCT_PRESETS: ProductPreset[] = [
  {
    id: 'p1',
    name: 'Vestido Midi Rosa Claro Soltinho',
    url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p2',
    name: 'Vestido Branco Casual de Verão',
    url: 'https://images.unsplash.com/photo-1515347619252-60a6bf4fffce?q=80&w=1000&auto=format&fit=crop'
  },
  {
    id: 'p3',
    name: 'Terno Blazer Preto Profissional',
    url: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=1000&auto=format&fit=crop'
  }
];

export const ACTION_OPTIONS = [
  { 
    value: EditingAction.BACKGROUND_SWAP, 
    label: 'Cenário (Background)', 
    shortLabel: 'Cenário',
    placeholder: 'ex: loja de luxo, praia no pôr do sol',
    promptTemplate: 'Change the background to {prompt}. Keep the person, lighting, and clothes exactly the same. High fidelity.' 
  },
  { 
    value: EditingAction.OUTFIT_SWAP, 
    label: 'Look (Roupa)', 
    shortLabel: 'Look',
    placeholder: 'ex: vestido floral de verão, smoking vermelho',
    promptTemplate: 'Change the outfit to {prompt}. Keep the person, pose, and background exactly the same.' 
  },
  { 
    value: EditingAction.POSE_SWAP, 
    label: 'Pose', 
    shortLabel: 'Pose',
    placeholder: 'ex: mãos na cintura, caminhando confiante',
    promptTemplate: 'Change the person\'s pose to {prompt}. Maintain the exact facial features, hairstyle, and outfit details. Photorealistic.' 
  },
  { 
    value: EditingAction.SHOES_SWAP, 
    label: 'Sapatos', 
    shortLabel: 'Sapatos',
    placeholder: 'ex: salto alto vermelho, tênis branco',
    promptTemplate: 'Replace the shoes with {prompt}. Keep the legs, skin tone, and outfit exactly the same.' 
  },
  { 
    value: EditingAction.BAG_SWAP, 
    label: 'Bolsa', 
    shortLabel: 'Bolsa',
    placeholder: 'ex: bolsa tote de couro bege',
    promptTemplate: 'Add or replace the handbag with {prompt}. Integrate it naturally with the outfit and lighting.' 
  },
  { 
    value: EditingAction.COLOR_CHANGE, 
    label: 'Cor', 
    shortLabel: 'Cor',
    placeholder: 'ex: mudar o vestido para azul marinho',
    promptTemplate: 'Change the color of {prompt}. Keep the fabric texture, style, and background exactly the same.' 
  },
  { 
    value: EditingAction.FREEFORM, 
    label: 'Livre (Freeform)', 
    shortLabel: 'Livre',
    placeholder: 'Descreva qualquer alteração que deseja...',
    promptTemplate: '{prompt}' 
  },
];

export const DEFAULT_PROMPTS: Record<EditingAction, string> = {
  [EditingAction.BACKGROUND_SWAP]: 'interior de loja de luxo',
  [EditingAction.OUTFIT_SWAP]: 'um vestido floral de verão',
  [EditingAction.POSE_SWAP]: 'em pé com braços cruzados',
  [EditingAction.SHOES_SWAP]: 'saltos altos elegantes',
  [EditingAction.BAG_SWAP]: 'uma bolsa de couro bege',
  [EditingAction.COLOR_CHANGE]: 'o vestido para azul marinho',
  [EditingAction.FREEFORM]: 'faça parecer uma capa de revista'
};