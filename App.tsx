import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImageSourceType, EditingAction, AppState, CatalogItem, AppView } from './types';
import { PRODUCT_PRESETS, ACTION_OPTIONS, DEFAULT_PROMPTS } from './constants';
import { generateEditedImage, generateHashtags, urlToBase64, enhancePrompt } from './services/geminiService';
import { saveSession, loadSession } from './services/storageService';
import { Upload, Wand2, Download, AlertCircle, Image as ImageIcon, CheckCircle2, Sparkles, Hash, Copy, GripVertical, Save, FolderOpen, X, Plus, Trash2, ExternalLink, Calendar, Printer, BookOpen, PenLine, DollarSign, FileCode } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [state, setState] = useState<AppState>({
    sourceType: ImageSourceType.PRESET,
    selectedPresetId: PRODUCT_PRESETS[0].id,
    uploadedImage: null,
    currentImage: null,
    // Multi-select state initialization
    activeActions: [EditingAction.BACKGROUND_SWAP],
    promptInputs: { ...DEFAULT_PROMPTS }, // Initialize with defaults
    isGenerating: false,
    generatedImage: null,
    error: null,
    statusMessage: null,
    generatedTags: [],
    isGeneratingTags: false,
    isEnhancingPrompt: false,
    // Catalog
    catalog: [],
    currentView: 'STUDIO'
  });

  const [sliderPosition, setSliderPosition] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clear status message after 3 seconds
  useEffect(() => {
    if (state.statusMessage) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, statusMessage: null }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [state.statusMessage]);

  // Load initial preset image
  useEffect(() => {
    const loadInitialImage = async () => {
      // Only load if we haven't manually loaded a session (which might set currentImage directly)
      // and we are in default preset mode
      if (state.sourceType === ImageSourceType.PRESET && state.selectedPresetId && !state.currentImage) {
        const preset = PRODUCT_PRESETS.find(p => p.id === state.selectedPresetId);
        if (preset) {
          try {
            // We convert to base64 immediately to normalize handling
            const base64 = await urlToBase64(preset.url);
            setState(prev => ({ ...prev, currentImage: base64, generatedImage: null, error: null, generatedTags: [] }));
          } catch (err) {
            console.error("Failed to load preset image", err);
            setState(prev => ({ ...prev, error: "Failed to load preset image." }));
          }
        }
      }
    };
    loadInitialImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedPresetId, state.sourceType]);

  // Handlers
  const handleSourceChange = (type: ImageSourceType) => {
    setState(prev => ({
      ...prev,
      sourceType: type,
      currentImage: type === ImageSourceType.PRESET 
        ? null // Will be reloaded by effect
        : prev.uploadedImage, 
      generatedImage: null,
      generatedTags: [],
      error: null,
      statusMessage: null
    }));
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState(prev => ({ ...prev, selectedPresetId: e.target.value, currentImage: null, generatedImage: null, generatedTags: [], statusMessage: null }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setState(prev => ({ ...prev, error: "Image size too large. Max 5MB.", statusMessage: null }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setState(prev => ({
          ...prev,
          uploadedImage: result,
          currentImage: result,
          sourceType: ImageSourceType.UPLOAD,
          generatedImage: null,
          generatedTags: [],
          error: null,
          statusMessage: null
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle Action Handler
  const toggleAction = (action: EditingAction) => {
    setState(prev => {
      let newActions = [...prev.activeActions];
      
      // Logic: Freeform is mutually exclusive
      if (action === EditingAction.FREEFORM) {
        newActions = [EditingAction.FREEFORM];
      } else {
        // If selecting a standard action, remove Freeform if it exists
        if (newActions.includes(EditingAction.FREEFORM)) {
          newActions = [];
        }

        if (newActions.includes(action)) {
          newActions = newActions.filter(a => a !== action);
        } else {
          newActions.push(action);
        }
      }

      // Default to Background if empty to avoid empty state
      if (newActions.length === 0) newActions = [EditingAction.BACKGROUND_SWAP];

      return {
        ...prev,
        activeActions: newActions,
        generatedImage: null, // Clear generated image on mode switch to avoid confusion
        statusMessage: null
      };
    });
  };

  const handlePromptChange = (action: string, value: string) => {
    setState(prev => ({
      ...prev,
      promptInputs: {
        ...prev.promptInputs,
        [action]: value
      }
    }));
  };

  // Construct the final prompt based on active actions
  const constructCompositePrompt = () => {
    if (state.activeActions.includes(EditingAction.FREEFORM)) {
      return state.promptInputs[EditingAction.FREEFORM] || "";
    }

    const segments: string[] = [];
    
    state.activeActions.forEach(action => {
      const val = state.promptInputs[action];
      if (!val) return;

      switch(action) {
        case EditingAction.BACKGROUND_SWAP:
          segments.push(`Change the background to: ${val}`);
          break;
        case EditingAction.OUTFIT_SWAP:
          segments.push(`Change the outfit to: ${val}`);
          break;
        case EditingAction.POSE_SWAP:
          segments.push(`Change the pose to: ${val}`);
          break;
        case EditingAction.SHOES_SWAP:
          segments.push(`Change the shoes to: ${val}`);
          break;
        case EditingAction.BAG_SWAP:
          segments.push(`Add or change the bag to: ${val}`);
          break;
        case EditingAction.COLOR_CHANGE:
          segments.push(`Change color: ${val}`);
          break;
      }
    });

    if (segments.length === 0) return "";

    return segments.join(". ") + ". Maintain all other details, facial features, and lighting consistent with the original image.";
  };

  const handleEnhancePrompt = async (action: string) => {
    const currentInput = state.promptInputs[action];
    if (!currentInput) return;
    
    setState(prev => ({ ...prev, isEnhancingPrompt: true, statusMessage: null }));
    try {
      const betterPrompt = await enhancePrompt(currentInput, action as EditingAction);
      setState(prev => ({
        ...prev,
        promptInputs: {
          ...prev.promptInputs,
          [action]: betterPrompt
        },
        isEnhancingPrompt: false
      }));
    } catch (e) {
      setState(prev => ({ ...prev, isEnhancingPrompt: false }));
    }
  };

  const handleGenerate = async () => {
    if (!state.currentImage) return;
    
    const finalPrompt = constructCompositePrompt();
    if (!finalPrompt) {
      setState(prev => ({ ...prev, error: "Please enter a description for your edits." }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null, generatedTags: [], statusMessage: null }));
    setSliderPosition(50);

    try {
      // We use FREEFORM as the action type here to bypass the single-template logic in geminiService
      // since we constructed a composite prompt already.
      const resultBase64 = await generateEditedImage(state.currentImage, finalPrompt, EditingAction.FREEFORM);
      setState(prev => ({ ...prev, generatedImage: resultBase64, isGenerating: false }));
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isGenerating: false, 
        error: err.message || "Failed to generate image. Please try again." 
      }));
    }
  };

  const handleUseGenerated = () => {
    if (state.generatedImage) {
      setState(prev => ({
        ...prev,
        currentImage: prev.generatedImage,
        uploadedImage: prev.generatedImage,
        sourceType: ImageSourceType.UPLOAD,
        generatedImage: null,
        generatedTags: [],
        statusMessage: null
      }));
    }
  };

  // --- Catalog Logic ---

  const handleAddToCatalog = () => {
    if (!state.generatedImage) return;

    const newItem: CatalogItem = {
      id: Date.now().toString(),
      imageUrl: state.generatedImage,
      prompt: constructCompositePrompt(),
      actions: [...state.activeActions],
      timestamp: Date.now(),
      tags: state.generatedTags,
      name: "New Collection Item",
      description: "",
      price: ""
    };

    setState(prev => ({
      ...prev,
      catalog: [newItem, ...prev.catalog],
      statusMessage: "Added to Catalog!",
      // Automatically save to storage when adding
    }));
    
    // We defer the actual saveSession call to the effect or manual save 
    // but to be safe let's trigger a save immediately
    setTimeout(() => handleSaveSession(), 100);
  };

  const handleUpdateCatalogItem = (id: string, field: keyof CatalogItem, value: string) => {
    setState(prev => ({
      ...prev,
      catalog: prev.catalog.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleRemoveFromCatalog = (id: string) => {
    setState(prev => ({
      ...prev,
      catalog: prev.catalog.filter(item => item.id !== id)
    }));
    setTimeout(() => handleSaveSession(), 100);
  };

  const handleLoadFromCatalog = (item: CatalogItem) => {
    setState(prev => ({
      ...prev,
      currentImage: item.imageUrl,
      uploadedImage: item.imageUrl, // Treat as uploaded
      sourceType: ImageSourceType.UPLOAD,
      generatedImage: null,
      currentView: 'STUDIO',
      statusMessage: "Image loaded from Catalog"
    }));
  };

  // --- End Catalog Logic ---

  const handleGenerateTags = async () => {
    setState(prev => ({ ...prev, isGeneratingTags: true, statusMessage: null }));
    try {
      let context = constructCompositePrompt();
      if (state.sourceType === ImageSourceType.PRESET) {
         const preset = PRODUCT_PRESETS.find(p => p.id === state.selectedPresetId);
         if (preset) context += ` ${preset.name}`;
      }
      
      const tags = await generateHashtags(context);
      setState(prev => ({ ...prev, generatedTags: tags, isGeneratingTags: false }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isGeneratingTags: false }));
    }
  };

  const copyTags = () => {
    if (state.generatedTags.length > 0) {
      navigator.clipboard.writeText(state.generatedTags.join(' '));
      setState(prev => ({...prev, statusMessage: "Tags copied to clipboard!"}));
    }
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintLookbook = () => {
    window.print();
  };

  const handleExportHTML = () => {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Maria Rosa Lookbook - ${new Date().toLocaleDateString()}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
        h1, h2, h3, h4 { font-family: 'Playfair Display', serif; }
        .page-break { page-break-after: always; }
        @media print {
            .no-print { display: none; }
            body { -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body class="bg-white text-gray-900 antialiased">
    <div class="max-w-4xl mx-auto bg-white min-h-screen">
        <!-- Cover Page -->
        <div class="p-16 flex flex-col items-center justify-center min-h-[80vh] text-center border-b border-gray-100 page-break">
            <div class="w-24 h-24 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mb-8">MR</div>
            <h1 class="text-6xl text-gray-900 mb-4 tracking-tight">MARIA ROSA</h1>
            <p class="text-2xl text-gray-400 font-light uppercase tracking-[0.2em] mb-12">Collection 2025</p>
            <div class="w-16 h-1 bg-gray-900 mb-8"></div>
            <p class="text-gray-500">Curated by AI Studio</p>
            <p class="text-sm text-gray-400 mt-2">${new Date().toLocaleDateString()}</p>
        </div>

        <!-- Items -->
        <div class="p-8 md:p-16 space-y-24">
            ${state.catalog.map((item, index) => `
                <div class="flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-12 items-center page-break-inside-avoid mb-16">
                    <div class="w-full md:w-1/2 aspect-[3/4] bg-gray-100">
                        <img src="${item.imageUrl}" class="w-full h-full object-cover shadow-sm" alt="${item.name || 'Product'}">
                    </div>
                    <div class="w-full md:w-1/2 text-left space-y-6">
                        <div>
                            <h3 class="text-3xl text-gray-900 mb-2">${item.name || "Untitled Product"}</h3>
                            <p class="text-2xl font-light text-gray-500">${item.price ? `$${item.price}` : "Price upon request"}</p>
                        </div>
                        <div class="w-12 h-px bg-gray-300"></div>
                        <p class="text-gray-600 leading-relaxed font-light text-lg">
                            ${item.description || "No description provided for this exclusive piece."}
                        </p>
                        ${item.tags.length > 0 ? `
                        <div class="pt-4 flex flex-wrap gap-2">
                            ${item.tags.slice(0, 5).map(tag => `
                                <span class="text-xs uppercase tracking-wider text-gray-400 border border-gray-200 px-2 py-1">
                                    ${tag.replace('#', '')}
                                </span>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Back Cover -->
        <div class="p-16 text-center border-t border-gray-100 bg-gray-50">
            <h4 class="font-bold text-gray-900 uppercase tracking-widest mb-4">Maria Rosa AI Studio</h4>
            <p class="text-gray-500 text-sm">mariarosa.style</p>
            <p class="text-gray-500 text-sm">contact@mariarosa.style</p>
        </div>
    </div>
</body>
</html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maria-rosa-lookbook-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Session Management ---
  const handleSaveSession = () => {
    const result = saveSession(state);
    if (result.success) {
      setState(prev => ({ ...prev, statusMessage: result.message, error: null }));
    } else {
      setState(prev => ({ ...prev, error: result.message, statusMessage: null }));
    }
  };

  const handleLoadSession = () => {
    const result = loadSession();
    if (result.success && result.data) {
      setState(prev => ({
        ...prev,
        ...result.data,
        statusMessage: result.message,
        error: null,
        isGenerating: false,
        isGeneratingTags: false,
        isEnhancingPrompt: false
      }));
    } else {
      setState(prev => ({ ...prev, error: result.message, statusMessage: null }));
    }
  };

  const handleViewChange = (view: AppView) => {
    setState(prev => ({ ...prev, currentView: view }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Print Styles */}
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; -webkit-print-color-adjust: exact; }
          .page-break { page-break-after: always; }
        }
      `}</style>

      <Header 
        currentView={state.currentView} 
        onViewChange={handleViewChange} 
        catalogCount={state.catalog.length}
      />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {state.currentView === 'CATALOG' ? (
          // --- CATALOG VIEW ---
          <div className="space-y-8 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                 <h2 className="text-3xl font-bold text-gray-900">Campaign Catalog</h2>
                 <p className="text-gray-500 mt-1">Manage details and organize your collection.</p>
              </div>
              <div className="flex gap-2">
                 <button 
                  onClick={() => handleViewChange('LOOKBOOK')}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <BookOpen size={18} />
                  View Lookbook
                </button>
                <button 
                  onClick={() => handleViewChange('STUDIO')}
                  className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Back to Studio
                </button>
              </div>
            </div>

            {state.catalog.length === 0 ? (
               <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
                  <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="text-gray-400" size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">Your catalog is empty</h3>
                  <p className="text-gray-500 max-w-md mx-auto mt-2 mb-6">Create stunning designs in the studio and save them here to build your campaign.</p>
                  <button 
                    onClick={() => handleViewChange('STUDIO')}
                    className="text-purple-600 font-semibold hover:text-purple-800"
                  >
                    Go to Studio &rarr;
                  </button>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {state.catalog.map((item) => (
                  <div key={item.id} className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 group hover:shadow-lg transition-all duration-300">
                    <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
                      <img src={item.imageUrl} alt="Catalog Item" className="w-full h-full object-cover" />
                      
                      {/* Overlay Controls */}
                      <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                          onClick={() => handleLoadFromCatalog(item)}
                          className="bg-white/90 text-gray-900 p-2 rounded-full hover:bg-white shadow-sm backdrop-blur-sm"
                          title="Edit in Studio"
                        >
                          <Wand2 size={16} />
                        </button>
                        <button 
                          onClick={() => downloadImage(item.imageUrl, `catalog-${item.id}.png`)}
                          className="bg-white/90 text-gray-900 p-2 rounded-full hover:bg-white shadow-sm backdrop-blur-sm"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => handleRemoveFromCatalog(item.id)}
                          className="bg-red-500/90 text-white p-2 rounded-full hover:bg-red-600 shadow-sm backdrop-blur-sm"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Editable Fields */}
                    <div className="p-5 space-y-4">
                      
                      <div className="space-y-3">
                         {/* Name Input */}
                         <div className="flex items-center gap-2 border-b border-gray-100 pb-1 focus-within:border-purple-500 transition-colors">
                            <PenLine size={14} className="text-gray-400" />
                            <input 
                              type="text" 
                              value={item.name}
                              onChange={(e) => handleUpdateCatalogItem(item.id, 'name', e.target.value)}
                              placeholder="Product Name"
                              className="w-full text-base font-semibold text-gray-900 border-none p-0 focus:ring-0 placeholder:text-gray-300"
                            />
                         </div>
                         
                         {/* Price Input */}
                         <div className="flex items-center gap-2 border-b border-gray-100 pb-1 focus-within:border-purple-500 transition-colors">
                            <DollarSign size={14} className="text-gray-400" />
                            <input 
                              type="text" 
                              value={item.price}
                              onChange={(e) => handleUpdateCatalogItem(item.id, 'price', e.target.value)}
                              placeholder="0.00"
                              className="w-full text-sm font-medium text-gray-700 border-none p-0 focus:ring-0 placeholder:text-gray-300"
                            />
                         </div>

                         {/* Description Input */}
                         <textarea 
                            value={item.description}
                            onChange={(e) => handleUpdateCatalogItem(item.id, 'description', e.target.value)}
                            placeholder="Add a marketing description..."
                            className="w-full text-sm text-gray-600 border border-gray-100 rounded-md p-2 focus:border-purple-500 focus:ring-purple-500 min-h-[80px] resize-none bg-gray-50"
                         />
                      </div>

                      <div className="pt-2 flex flex-wrap gap-1">
                        {item.tags.slice(0,3).map((tag, i) => (
                          <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : state.currentView === 'LOOKBOOK' ? (
          // --- LOOKBOOK VIEW (Print Ready) ---
          <div className="animate-fadeIn pb-20">
            {/* Action Bar (Hidden when printing) */}
            <div className="flex justify-between items-center mb-8 bg-gray-900 text-white p-4 rounded-xl shadow-lg no-print">
              <div>
                 <h2 className="text-xl font-bold">Presentation Mode</h2>
                 <p className="text-gray-400 text-sm">Review your lookbook before printing.</p>
              </div>
              <div className="flex gap-3">
                 <button 
                  onClick={handlePrintLookbook}
                  className="bg-white text-gray-900 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <Printer size={18} />
                  Print / PDF
                </button>
                 <button 
                  onClick={handleExportHTML}
                  className="bg-white text-gray-900 px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-100 transition-colors flex items-center gap-2"
                >
                  <FileCode size={18} />
                  Export HTML
                </button>
                <button 
                  onClick={() => handleViewChange('CATALOG')}
                  className="bg-transparent border border-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Lookbook Content */}
            <div className="bg-white max-w-4xl mx-auto shadow-2xl min-h-screen print:shadow-none print:w-full">
              
              {/* Cover Page */}
              <div className="p-16 flex flex-col items-center justify-center min-h-[80vh] text-center border-b border-gray-100 page-break">
                 <div className="w-24 h-24 bg-black text-white rounded-full flex items-center justify-center text-2xl font-bold mb-8">MR</div>
                 <h1 className="text-6xl font-serif text-gray-900 mb-4 tracking-tight">MARIA ROSA</h1>
                 <p className="text-2xl text-gray-400 font-light uppercase tracking-[0.2em] mb-12">Collection 2025</p>
                 <div className="w-16 h-1 bg-gray-900 mb-8"></div>
                 <p className="text-gray-500">Curated by AI Studio</p>
                 <p className="text-sm text-gray-400 mt-2">{new Date().toLocaleDateString()}</p>
              </div>

              {/* Items */}
              <div className="p-8 md:p-16 space-y-24">
                 {state.catalog.map((item, index) => (
                    <div key={item.id} className={`flex flex-col ${index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} gap-12 items-center page-break-inside-avoid mb-16`}>
                       <div className="w-full md:w-1/2 aspect-[3/4] bg-gray-100">
                          <img src={item.imageUrl} className="w-full h-full object-cover shadow-sm" alt={item.name} />
                       </div>
                       <div className="w-full md:w-1/2 text-left space-y-6">
                          <div>
                             <h3 className="text-3xl font-serif text-gray-900 mb-2">{item.name || "Untitled Product"}</h3>
                             <p className="text-2xl font-light text-gray-500">{item.price ? `$${item.price}` : "Price upon request"}</p>
                          </div>
                          
                          <div className="w-12 h-px bg-gray-300"></div>
                          
                          <p className="text-gray-600 leading-relaxed font-light text-lg">
                             {item.description || "No description provided for this exclusive piece. Contact our sales team for more details on sizing and availability."}
                          </p>

                          {item.tags.length > 0 && (
                            <div className="pt-4 flex flex-wrap gap-2">
                               {item.tags.slice(0, 5).map(tag => (
                                  <span key={tag} className="text-xs uppercase tracking-wider text-gray-400 border border-gray-200 px-2 py-1">
                                     {tag.replace('#', '')}
                                  </span>
                               ))}
                            </div>
                          )}
                       </div>
                    </div>
                 ))}
              </div>

              {/* Back Cover */}
              <div className="p-16 text-center border-t border-gray-100 bg-gray-50 print:bg-white">
                 <h4 className="font-bold text-gray-900 uppercase tracking-widest mb-4">Maria Rosa AI Studio</h4>
                 <p className="text-gray-500 text-sm">mariarosa.style</p>
                 <p className="text-gray-500 text-sm">contact@mariarosa.style</p>
              </div>
            </div>
          </div>
        ) : (
          // --- STUDIO VIEW ---
          <>
            {/* Landing Hero Section */}
            <div className="mb-10 text-center animate-fadeIn">
              <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Transform Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">Fashion Photos</span> with AI
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Combine multiple edits like background swaps, outfit changes, and new accessories in a single click.
              </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
              
              {/* Controls Sidebar */}
              <div className="w-full lg:w-1/3 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-24">
                  
                  {/* Toolbar */}
                  <div className="bg-gray-50 border-b border-gray-100 px-6 py-3 flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Workstation</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveSession}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                        title="Save current session"
                      >
                        <Save size={16} />
                      </button>
                      <button 
                        onClick={handleLoadSession}
                        className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                        title="Load last session"
                      >
                        <FolderOpen size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    
                    {/* Status/Error Messages */}
                    {state.error && (
                      <div className="bg-red-50 text-red-700 p-3 rounded-lg flex items-start gap-2 text-sm animate-pulse">
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                        <p>{state.error}</p>
                      </div>
                    )}
                    {state.statusMessage && (
                      <div className="bg-green-50 text-green-700 p-3 rounded-lg flex items-start gap-2 text-sm">
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                        <p>{state.statusMessage}</p>
                      </div>
                    )}

                    {/* Image Source Selection */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Original Image</h3>
                      <div className="flex gap-4 mb-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sourceType" 
                            checked={state.sourceType === ImageSourceType.PRESET} 
                            onChange={() => handleSourceChange(ImageSourceType.PRESET)}
                            className="text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">Existing Product</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sourceType" 
                            checked={state.sourceType === ImageSourceType.UPLOAD} 
                            onChange={() => handleSourceChange(ImageSourceType.UPLOAD)}
                            className="text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700">Upload Own</span>
                        </label>
                      </div>

                      {state.sourceType === ImageSourceType.PRESET ? (
                        <select 
                          className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm py-2.5"
                          value={state.selectedPresetId}
                          onChange={handlePresetChange}
                        >
                          {PRODUCT_PRESETS.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <Upload className="h-6 w-6 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-500">Click to upload image</span>
                          <input 
                            ref={fileInputRef}
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleFileUpload}
                          />
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-gray-100"></div>

                    {/* Multi-Select Action Options */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Select Edits (Multi-Select)</h3>
                      <div className="flex flex-wrap gap-2">
                        {ACTION_OPTIONS.map(opt => {
                          const isActive = state.activeActions.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              onClick={() => toggleAction(opt.value)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 flex items-center gap-1
                                ${isActive 
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-md transform scale-105' 
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50'}`}
                            >
                              {opt.label}
                              {isActive && <CheckCircle2 size={10} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Prompt Inputs */}
                    <div className="space-y-4">
                      {state.activeActions.map(action => {
                        const opt = ACTION_OPTIONS.find(o => o.value === action);
                        if (!opt) return null;

                        return (
                          <div key={action} className="animate-fadeIn">
                            <div className="flex justify-between items-center mb-1">
                              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                {opt.shortLabel} Details
                              </label>
                              <button
                                onClick={() => handleEnhancePrompt(action)}
                                disabled={state.isEnhancingPrompt || !state.promptInputs[action]}
                                className="text-[10px] text-purple-600 hover:text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
                              >
                                Auto-Enhance
                              </button>
                            </div>
                            <textarea 
                              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-sm p-2.5 min-h-[60px]"
                              placeholder={opt.placeholder}
                              value={state.promptInputs[action] || ''}
                              onChange={(e) => handlePromptChange(action, e.target.value)}
                            />
                          </div>
                        );
                      })}
                      <p className="text-xs text-gray-400 text-right">Combine multiple edits for a complete transformation.</p>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleGenerate}
                      disabled={state.isGenerating || !state.currentImage}
                      className={`w-full py-3 px-4 rounded-lg text-white font-semibold shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95
                        ${state.isGenerating || !state.currentImage 
                          ? 'bg-gray-300 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shadow-purple-200'
                        }`}
                    >
                      {state.isGenerating ? (
                        <>
                          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Magic...
                        </>
                      ) : (
                        <>
                          <Wand2 size={18} />
                          Generate with AI
                        </>
                      )}
                    </button>

                  </div>
                </div>
              </div>

              {/* Results Area */}
              <div className="w-full lg:w-2/3 space-y-6">
                
                {/* Main Preview */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] flex flex-col">
                  <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                        <ImageIcon size={18} className="text-gray-400"/>
                        Preview Studio
                      </h2>
                      {state.generatedImage && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => downloadImage(state.generatedImage!, 'generated-fashion.png')}
                            className="text-xs bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <Download size={14} /> Download
                          </button>
                        </div>
                      )}
                  </div>

                  <div className="flex-grow p-4 md:p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-100 flex items-center justify-center relative">
                      
                      {/* Image Display Logic */}
                      {!state.generatedImage ? (
                        // Initial State: Single Image
                        <div className="relative max-w-md w-full aspect-[3/4] rounded-lg shadow-xl overflow-hidden group">
                          {state.currentImage ? (
                            <img 
                                src={state.currentImage} 
                                alt="Original" 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                              />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center flex-col text-gray-400">
                              <ImageIcon size={48} className="mb-2 opacity-50" />
                              <p>No Image Selected</p>
                            </div>
                          )}
                          <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-medium">Original</div>
                        </div>
                      ) : (
                        // Result State: Comparison Slider
                        <div className="relative w-full max-w-lg aspect-[3/4] rounded-lg shadow-2xl overflow-hidden select-none">
                          
                          {/* Before Image (Background) */}
                          <img 
                            src={state.currentImage!} 
                            alt="Before" 
                            className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
                          />
                          
                          {/* After Image (Foreground, clipped) */}
                          <div 
                            className="absolute inset-0 overflow-hidden pointer-events-none"
                            style={{ width: `${sliderPosition}%` }}
                          >
                            <img 
                              src={state.generatedImage} 
                              alt="After" 
                              className="absolute inset-0 w-full max-w-none h-full object-cover"
                              style={{ width: '100vw', maxWidth: '32rem' }}
                            />
                          </div>
                          
                          {/* Slider UI */}
                          <div className="absolute inset-0 w-full h-full">
                            <img src={state.currentImage!} className="absolute w-full h-full object-cover" />
                            <div 
                                className="absolute inset-0 w-full h-full"
                                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                              >
                              <img src={state.generatedImage} className="absolute w-full h-full object-cover" />
                              <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded text-xs shadow-sm font-bold">
                                After
                              </div>
                            </div>
                            <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-0.5 rounded text-xs shadow-sm font-bold">
                                Before
                            </div>
                            <div 
                                className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                style={{ left: `${sliderPosition}%` }}
                              >
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg text-purple-600">
                                  <GripVertical size={20} />
                                </div>
                            </div>
                            <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={sliderPosition} 
                                onChange={(e) => setSliderPosition(Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                            />
                          </div>
                        </div>
                      )}
                  </div>

                  {/* Footer Actions for Generated Image */}
                  {state.generatedImage && (
                    <div className="bg-white p-4 border-t border-gray-100 flex justify-between items-center gap-3">
                        <button 
                          onClick={handleAddToCatalog}
                          className="flex-1 bg-white border border-gray-300 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <Save size={16} />
                          Save to Catalog
                        </button>
                        <button 
                          onClick={handleUseGenerated}
                          className="flex-1 bg-black hover:bg-gray-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 size={16} />
                          Use as Base
                        </button>
                    </div>
                  )}
                </div>

                {/* Tags Generation Section */}
                <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Hash size={18} className="text-pink-500" />
                        Social Boost (Hashtags)
                      </h3>
                      <button 
                        onClick={handleGenerateTags}
                        className="text-xs bg-pink-50 hover:bg-pink-100 text-pink-700 font-medium px-3 py-1.5 rounded-md transition-colors"
                      >
                        {state.isGeneratingTags ? 'Searching...' : 'Find Trending Tags'}
                      </button>
                  </div>
                  
                  {state.generatedTags.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 relative group">
                        <button 
                          onClick={copyTags}
                          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-white transition-all"
                          title="Copy all tags"
                        >
                          <Copy size={16} />
                        </button>
                        <div className="flex flex-wrap gap-2">
                          {state.generatedTags.map((tag, idx) => (
                            <span key={idx} className="bg-white border border-gray-200 text-gray-600 text-sm px-2 py-1 rounded-full">
                              {tag}
                            </span>
                          ))}
                        </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                      Click "Find Trending Tags" to discover Portuguese keywords for your design.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;