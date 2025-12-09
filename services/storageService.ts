import { AppState, CatalogItem } from "../types";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";

// --- FIREBASE CONFIGURATION ---
// PASTE YOUR CONFIG HERE FROM FIREBASE CONSOLE
// It is safe to expose these keys on the frontend IF you set up Firestore Security Rules.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let db: any;
try {
  // Only initialize if config is replaced
  if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase initialization failed. Check your config.", e);
}

const LOCAL_USER_ID_KEY = 'MARIA_ROSA_USER_ID';

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
    return { success: false, message: "Firebase not configured in code." };
  }

  const sessionId = getUserSessionId();
  const sessionRef = doc(db, "sessions", sessionId);
  const workstationRef = doc(db, "sessions", sessionId, "data", "workstation");

  try {
    const mainData = {
      sourceType: state.sourceType,
      selectedPresetId: state.selectedPresetId,
      activeActions: state.activeActions,
      promptInputs: state.promptInputs,
      generatedTags: state.generatedTags,
      curatorName: state.curatorName,
      phoneNumber: state.phoneNumber,
      cart: state.cart,
      lastUpdated: Date.now()
    };
    
    const workstationData = {
      uploadedImage: state.uploadedImage,
      currentImage: state.currentImage,
      generatedImage: state.generatedImage
    };

    await Promise.all([
      setDoc(sessionRef, mainData, { merge: true }),
      setDoc(workstationRef, workstationData, { merge: true })
    ]);

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
    return { success: false, message: "Firebase not configured in code." };
  }

  const sessionId = getUserSessionId();
  const sessionRef = doc(db, "sessions", sessionId);
  const workstationRef = doc(db, "sessions", sessionId, "data", "workstation");
  const catalogRef = collection(db, "sessions", sessionId, "catalog");

  try {
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
    
    const catalog: CatalogItem[] = [];
    catalogSnap.forEach(doc => {
      catalog.push(doc.data() as CatalogItem);
    });
    catalog.sort((a, b) => b.timestamp - a.timestamp);

    const loadedState: Partial<AppState> = {
      ...mainData,
      ...workstationData,
      catalog: catalog,
      cart: (mainData.cart || [])
    };

    return { success: true, data: loadedState, message: "Session loaded from Cloud!" };
  } catch (error) {
    console.error("Firebase Load error:", error);
    return { success: false, message: "Failed to load session." };
  }
};