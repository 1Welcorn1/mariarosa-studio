import { AppState, CatalogItem } from "../types";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";

// Firebase Configuration
// Ensure these environment variables are set in your deployment environment
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
let db: any;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (e) {
  console.warn("Firebase initialization failed. Check your config.", e);
}

const LOCAL_USER_ID_KEY = 'MARIA_ROSA_USER_ID';

/**
 * Gets or creates a persistent unique ID for the user's browser session
 * to simulate personal storage without login.
 */
const getUserSessionId = (): string => {
  let id = localStorage.getItem(LOCAL_USER_ID_KEY);
  if (!id) {
    id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem(LOCAL_USER_ID_KEY, id);
  }
  return id;
};

export const saveSession = async (state: AppState): Promise<{ success: boolean; message: string }> => {
  if (!db) {
    return { success: false, message: "Firebase not configured." };
  }

  const sessionId = getUserSessionId();
  const sessionRef = doc(db, "sessions", sessionId);
  const workstationRef = doc(db, "sessions", sessionId, "data", "workstation");

  try {
    // 1. Save Main Settings (Lightweight data)
    const mainData = {
      sourceType: state.sourceType,
      selectedPresetId: state.selectedPresetId,
      activeActions: state.activeActions,
      promptInputs: state.promptInputs,
      generatedTags: state.generatedTags,
      curatorName: state.curatorName,
      phoneNumber: state.phoneNumber,
      cart: state.cart, // Saving cart structure here. Images in cart are huge, but usually refs to catalog.
      lastUpdated: Date.now()
    };
    
    // 2. Save Workstation Images (Heavy data - separated to avoid doc limits)
    const workstationData = {
      uploadedImage: state.uploadedImage,
      currentImage: state.currentImage,
      generatedImage: state.generatedImage
    };

    // Parallel writes for base docs
    await Promise.all([
      setDoc(sessionRef, mainData, { merge: true }),
      setDoc(workstationRef, workstationData, { merge: true })
    ]);

    // 3. Save Catalog Items (Each item as a separate doc to handle size)
    // Using a batch for atomicity (up to 500 ops)
    if (state.catalog.length > 0) {
      const batch = writeBatch(db);
      const catalogRef = collection(db, "sessions", sessionId, "catalog");
      
      state.catalog.forEach(item => {
        const itemRef = doc(catalogRef, item.id);
        batch.set(itemRef, item);
      });
      
      await batch.commit();
    }

    return { success: true, message: "Saved to Cloud!" };
  } catch (error: any) {
    console.error("Firebase Save error:", error);
    if (error.code === 'resource-exhausted') {
       return { success: false, message: "Quota exceeded. Images might be too large." };
    }
    return { success: false, message: "Failed to save to cloud." };
  }
};

export const loadSession = async (): Promise<{ success: boolean; data?: Partial<AppState>; message: string }> => {
  if (!db) {
    return { success: false, message: "Firebase not configured." };
  }

  const sessionId = getUserSessionId();
  const sessionRef = doc(db, "sessions", sessionId);
  const workstationRef = doc(db, "sessions", sessionId, "data", "workstation");
  const catalogRef = collection(db, "sessions", sessionId, "catalog");

  try {
    // 1. Load Main Data & Workstation in parallel
    const [sessionSnap, workstationSnap, catalogSnap] = await Promise.all([
      getDoc(sessionRef),
      getDoc(workstationRef),
      getDocs(catalogRef)
    ]);

    if (!sessionSnap.exists()) {
      return { success: false, message: "No cloud session found." };
    }

    const mainData = sessionSnap.data();
    const workstationData = workstationSnap.exists() ? workstationSnap.data() : {};
    
    // 2. Reconstruct Catalog
    const catalog: CatalogItem[] = [];
    catalogSnap.forEach(doc => {
      catalog.push(doc.data() as CatalogItem);
    });
    // Sort by timestamp if possible, otherwise they come in random order usually
    catalog.sort((a, b) => b.timestamp - a.timestamp);

    const loadedState: Partial<AppState> = {
      ...mainData,
      ...workstationData,
      catalog: catalog,
      // Ensure cart is typed correctly if loaded
      cart: (mainData.cart || [])
    };

    return { success: true, data: loadedState, message: "Session loaded from Cloud!" };
  } catch (error) {
    console.error("Firebase Load error:", error);
    return { success: false, message: "Failed to load session." };
  }
};