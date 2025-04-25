import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, Firestore } from 'firebase/firestore';
import { FirebaseError } from 'firebase/app';

// Your web app's Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// For debugging
console.log('Starting Firebase initialization...');

// Check if config values exist
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.error('Essential Firebase config is missing!', {
        apiKey: !!firebaseConfig.apiKey,
        authDomain: !!firebaseConfig.authDomain,
        projectId: !!firebaseConfig.projectId,
        storageBucket: !!firebaseConfig.storageBucket,
        messagingSenderId: !!firebaseConfig.messagingSenderId,
        appId: !!firebaseConfig.appId
    });
    throw new Error('Firebase configuration is missing. Please check your .env file');
}

// Log each config value separately for better debugging
console.log('Firebase config validation:');
console.log('- API Key:', firebaseConfig.apiKey ? 'Present' : 'Missing');
console.log('- Auth Domain:', firebaseConfig.authDomain ? 'Present' : 'Missing');
console.log('- Project ID:', firebaseConfig.projectId ? 'Present' : 'Missing');
console.log('- Storage Bucket:', firebaseConfig.storageBucket ? 'Present' : 'Missing');
console.log('- Messaging Sender ID:', firebaseConfig.messagingSenderId ? 'Present' : 'Missing');
console.log('- App ID:', firebaseConfig.appId ? 'Present' : 'Missing');

let firestore: Firestore;

try {
    // Initialize Firebase
    console.log('Attempting to initialize Firebase app...');
    const app = initializeApp(firebaseConfig);
    console.log('Firebase app initialized successfully');

    // Initialize Firestore
    console.log('Attempting to initialize Firestore...');
    firestore = getFirestore(app);
    console.log('Firestore initialized successfully');

    // Enable offline persistence
    console.log('Attempting to enable offline persistence...');
    enableIndexedDbPersistence(firestore)
        .then(() => console.log('Offline persistence enabled successfully'))
        .catch((err: FirebaseError) => {
            console.error('Error enabling offline persistence:', err);
            if (err.code === 'failed-precondition') {
                console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
            } else if (err.code === 'unimplemented') {
                console.warn('The current browser doesn\'t support offline persistence');
            } else {
                console.error('Unknown error enabling persistence:', err.message);
            }
        });
} catch (error) {
    const firebaseError = error as FirebaseError;
    console.error('Detailed Firebase initialization error:', {
        message: firebaseError.message,
        code: firebaseError.code,
        stack: firebaseError.stack
    });
    throw error;
}

export { firestore };
