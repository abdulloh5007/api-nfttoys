import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const getFirebaseAdmin = () => {
    if (admin.apps.length > 0) {
        return admin.apps[0]!;
    }

    // Check for service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccount) {
        try {
            const credentials = JSON.parse(serviceAccount);
            return admin.initializeApp({
                credential: admin.credential.cert(credentials),
            });
        } catch (error) {
            console.error('Error parsing service account:', error);
        }
    }

    // Fallback: use individual env variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (projectId && clientEmail && privateKey) {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    console.warn('⚠️ Firebase Admin SDK not configured.');
    return admin.initializeApp();
};

export const adminApp = getFirebaseAdmin();
export const adminAuth = admin.auth();
