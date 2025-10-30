import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    type Timestamp
} from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import type { PurchaseOrder } from '../types';

// Your web app's Firebase configuration for the "sistema-megabor-final" project
const firebaseConfig = {
  apiKey: "AIzaSyC3cpkNUNcnkFeaG6xh29Hh33kNOJuiRoA",
  authDomain: "sistema-megabor-final.firebaseapp.com",
  projectId: "sistema-megabor-final",
  storageBucket: "sistema-megabor-final.firebasestorage.app",
  messagingSenderId: "658624570731",
  appId: "1:658624570731:web:9a75bf4816bf126681d82e"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

const provider = new GoogleAuthProvider();

export const handleSignIn = () => {
  signInWithPopup(auth, provider).catch((error) => console.error("Google Sign-In Error:", error));
};

export const handleSignOut = () => {
  signOut(auth).catch((error) => console.error("Sign-Out Error:", error));
};

// Simplified save function. It no longer handles images.
// It expects a complete, sanitized data object from the business logic layer.
export const savePurchaseOrder = async (orderData: object): Promise<string> => {
    const docRef = await addDoc(collection(db, 'purchaseOrders'), orderData);
    return docRef.id;
};

// UPDATED: The query now fetches all purchase orders, not just for a specific user.
export const getPurchaseOrders = (
  callback: (orders: PurchaseOrder[]) => void,
  onError: (error: Error) => void
) => {
    const q = query(
        collection(db, 'purchaseOrders'), 
        orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
        const orders: PurchaseOrder[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            orders.push({ 
              id: doc.id, 
              ...data,
              createdAt: data.createdAt as Timestamp,
            } as PurchaseOrder);
        });
        callback(orders);
    }, (error) => {
        console.error("Error fetching purchase orders:", error);
        onError(error);
    });
};

export const updatePurchaseOrder = async (orderId: string, updates: Partial<Omit<PurchaseOrder, 'id'>>) => {
    const orderRef = doc(db, 'purchaseOrders', orderId);
    await updateDoc(orderRef, updates);
};

export const deletePurchaseOrder = async (orderId: string) => {
    const orderRef = doc(db, 'purchaseOrders', orderId);
    await deleteDoc(orderRef);
};


// New function to upload an image associated with a purchase order with progress tracking
export const uploadImageForOrder = (
    orderId: string,
    file: File,
    onProgress: (progress: number) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const storageRef = ref(storage, `purchaseOrders/${orderId}/${Date.now()}_${sanitizedFileName}`);
        
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                onProgress(progress);
            },
            (error) => {
                reject(error);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                    resolve(downloadURL);
                }).catch(reject);
            }
        );
    });
};


// New function to delete an image by its URL
export const deleteImageByUrl = async (imageUrl: string): Promise<void> => {
    try {
        const imageRef = ref(storage, imageUrl);
        await deleteObject(imageRef);
    } catch (error) {
        console.error("Error deleting image from Firebase Storage:", error);
        // We can choose to not re-throw if the file not existing is an acceptable state
        // For example, if a previous delete failed part-way through.
    }
};


export { onAuthStateChanged, serverTimestamp };