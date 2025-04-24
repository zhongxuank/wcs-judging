import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

declare global {
    interface Window {
        FIREBASE_CONFIG: {
            apiKey: string;
            authDomain: string;
            projectId: string;
            storageBucket: string;
            messagingSenderId: string;
            appId: string;
        };
    }
}

// Your web app's Firebase configuration
const firebaseConfig = window.FIREBASE_CONFIG;

// For debugging
console.log('Firebase Config:', {
    projectId: firebaseConfig.projectId,
    hasApiKey: !!firebaseConfig.apiKey,
    hasAuthDomain: !!firebaseConfig.authDomain
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app); 