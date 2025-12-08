import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { ImageSourceType, EditingAction, AppState } from './types';
import { PRODUCT_PRESETS, ACTION_OPTIONS, DEFAULT_PROMPTS } from './constants';
import { generateEditedImage, generateHashtags, urlToBase64, enhancePrompt } from './services/geminiService';
import { saveSession, loadSession } from './services/storageService';
import { Upload, Wand2, Download, AlertCircle, Image as ImageIcon, CheckCircle2, Sparkles, Hash, Copy, GripVertical, Save, FolderOpen, X, Plus } from 'lucide-react';

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
        // Reset inputs to encourage new edits? Or keep them? 
        // Usually better to clear or let user decide. Let's keep inputs but clear generation.
        generatedTags: [],
        statusMessage: null
      }));
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Landing Hero Section */}
        <div className="mb-10 text-center">
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

          {/* Results Area (Unchanged Logic, just visual) */}
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
                      
                      {/* Better Implementation of Slider using Clip Path for perfect alignment */}
                      <div className="absolute inset-0 w-full h-full">
                         {/* Bottom Layer: Original */}
                         <img src={state.currentImage!} className="absolute w-full h-full object-cover" />
                         
                         {/* Top Layer: Generated */}
                         <div 
                            className="absolute inset-0 w-full h-full"
                            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                          >
                           <img src={state.generatedImage} className="absolute w-full h-full object-cover" />
                           
                           {/* Label for Generated */}
                           <div className="absolute top-4 left-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-2 py-0.5 rounded text-xs shadow-sm font-bold">
                             After
                           </div>
                         </div>
                         
                         {/* Label for Original */}
                         <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-0.5 rounded text-xs shadow-sm font-bold">
                             Before
                         </div>

                         {/* Slider Handle */}
                         <div 
                            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                            style={{ left: `${sliderPosition}%` }}
                          >
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-lg text-purple-600">
                               <GripVertical size={20} />
                            </div>
                         </div>
                         
                         {/* Input Range Overlay for Interaction */}
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
                 <div className="bg-white p-4 border-t border-gray-100 flex justify-between items-center">
                    <p className="text-sm text-gray-500">
                      Satisfaction: <span className="text-green-600 font-medium">High Confidence</span>
                    </p>
                    <button 
                      onClick={handleUseGenerated}
                      className="bg-black hover:bg-gray-800 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <CheckCircle2 size={16} />
                      Use this Image
                    </button>
                 </div>
               )}
            </div>

            {/* Tags Generation Section - Only visible if we have an image or text */}
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
      </main>
    </div>
  );
};

export default App;