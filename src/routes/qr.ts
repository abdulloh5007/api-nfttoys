import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../lib/firebase/config';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, collection, getDocs, query, where, orderBy, serverTimestamp, addDoc, arrayUnion } from 'firebase/firestore';
import { PEPE_MODELS } from '../lib/data/pepe_models';
import { generateTokenId, generateContractAddress, signTransaction, generateTxHash } from '../lib/utils/crypto';
import { sanitizeString, validateRequired, validateNumber } from '../lib/utils/validation';
import { strictLimit, standardLimit } from '../middleware/rateLimit';
import { csrfProtection } from '../middleware/csrfProtection';

const router = Router();

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// ===============================
// TOKEN VERIFICATION HELPERS
// ===============================

function verifyToken(token: string): { valid: boolean; nfcId?: string } {
    if (!TOKEN_SECRET) {
        console.warn('⚠️ TOKEN_SECRET not set');
    }

    const newFormatResult = verifyTokenNewFormat(token);
    if (newFormatResult.valid) return newFormatResult;

    return verifyTokenLegacyFormat(token);
}

function verifyTokenNewFormat(token: string): { valid: boolean; nfcId?: string } {
    try {
        const parts = token.split('_');
        if (parts.length < 4) return { valid: false };

        const signature = parts.pop()!;
        const salt = parts.pop()!;
        const timestamp = parts.pop()!;
        const nfcIdB64 = parts.join('_');

        const nfcId = Buffer.from(nfcIdB64, 'base64url').toString('utf-8');

        const expectedSignature = crypto
            .createHmac('sha256', TOKEN_SECRET)
            .update(`${nfcId}:${timestamp}:${salt}`)
            .digest('hex')
            .substring(0, 32);

        if (signature.length !== expectedSignature.length) return { valid: false };
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return { valid: false };
        }

        return { valid: true, nfcId };
    } catch {
        return { valid: false };
    }
}

function verifyTokenLegacyFormat(token: string): { valid: boolean; nfcId?: string } {
    try {
        const parts = token.split('.');
        if (parts.length !== 4) return { valid: false };

        const [nfcIdB64, timestamp, salt, signature] = parts;
        const nfcId = Buffer.from(nfcIdB64, 'base64').toString('utf-8');

        const expectedSignature = crypto
            .createHmac('sha256', TOKEN_SECRET)
            .update(`${nfcId}:${timestamp}:${salt}`)
            .digest('hex')
            .substring(0, 32);

        if (signature.length !== expectedSignature.length) return { valid: false };
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return { valid: false };
        }

        return { valid: true, nfcId };
    } catch {
        return { valid: false };
    }
}

function generateSecureToken(nfcId: string): string {
    const secret = TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
    const salt = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now().toString(36);

    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${nfcId}:${timestamp}:${salt}`)
        .digest('hex');

    const nfcIdEncoded = Buffer.from(nfcId).toString('base64url');
    return `${nfcIdEncoded}_${timestamp}_${salt}_${signature.substring(0, 32)}`;
}

// ===============================
// ROUTES
// ===============================

// GET /qr/activate - Check QR status
router.get('/activate', async (req, res) => {
    try {
        const token = req.query.token as string;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const verification = verifyToken(token);
        if (!verification.valid || !verification.nfcId) {
            return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
        }

        const nfcId = verification.nfcId;
        const qrRef = doc(db, 'qrcodes', nfcId);
        const qrSnap = await getDoc(qrRef);

        if (!qrSnap.exists()) {
            const parts = nfcId.replace('nfc_', '').split('_');
            const serialNum = parts.pop() || '1';
            const nameSlug = parts.join('_');

            const model = PEPE_MODELS.find(m =>
                m.name.toLowerCase().replace(/\s/g, '_') === nameSlug
            );

            if (model) {
                return res.json({
                    status: 'available',
                    toy: {
                        id: nfcId,
                        name: model.name,
                        serialNumber: serialNum,
                        rarity: model.rarity,
                        tgsUrl: `/models/${model.tgsFile}`,
                    }
                });
            }

            return res.status(404).json({ error: 'QR code not found', code: 'NOT_FOUND' });
        }

        const qrData = qrSnap.data();

        res.json({
            status: qrData.status,
            toy: {
                id: nfcId,
                name: qrData.modelName,
                serialNumber: qrData.serialNumber,
                rarity: qrData.rarity,
                tgsUrl: `/models/${qrData.tgsFile}`,
            },
            usedAt: qrData.usedAt?.seconds
                ? new Date(qrData.usedAt.seconds * 1000).toISOString()
                : null,
            usedBy: qrData.usedBy,
            usedByName: qrData.usedByName || null,
            usedByPhoto: qrData.usedByPhoto || null,
            usedByFirstName: qrData.usedByFirstName || null,
        });

    } catch (error) {
        console.error('Error checking QR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /qr/activate - Activate QR and mint NFT
router.post('/activate', async (req, res) => {
    try {
        const { token, userId, username, userPhoto, firstName } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        const verification = verifyToken(token);
        if (!verification.valid || !verification.nfcId) {
            return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
        }

        const nfcId = verification.nfcId;
        const qrRef = doc(db, 'qrcodes', nfcId);
        const qrSnap = await getDoc(qrRef);

        if (!qrSnap.exists()) {
            return res.status(404).json({ error: 'QR code not found', code: 'NOT_FOUND' });
        }

        const qrData = qrSnap.data();

        if (qrData.status === 'used') {
            return res.status(409).json({
                error: 'QR code already used',
                code: 'ALREADY_USED',
                usedAt: qrData.usedAt?.seconds
                    ? new Date(qrData.usedAt.seconds * 1000).toISOString()
                    : null,
                usedBy: qrData.usedBy,
                usedByName: qrData.usedByName || null,
                usedByPhoto: qrData.usedByPhoto || null,
                usedByFirstName: qrData.usedByFirstName || null,
            });
        }

        // Mark as used
        await updateDoc(qrRef, {
            status: 'used',
            usedAt: serverTimestamp(),
            usedBy: userId || 'anonymous',
            usedByName: username || null,
            usedByPhoto: userPhoto || null,
            usedByFirstName: firstName || null,
        });

        // Get user's wallet
        let userWallet = null;
        if (userId) {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                userWallet = userSnap.data().walletAddress;
            }
        }

        // Generate NFT
        const tokenId = generateTokenId(qrData.modelName, qrData.serialNumber);
        const contractAddress = generateContractAddress(tokenId);
        const mintTimestamp = Date.now();

        // Create NFT document
        const nftRef = doc(db, 'nfts', tokenId);
        await setDoc(nftRef, {
            tokenId,
            contractAddress,
            ownerWallet: userWallet,
            ownerId: userId || null,
            modelName: qrData.modelName,
            serialNumber: qrData.serialNumber,
            rarity: qrData.rarity,
            tgsFile: qrData.tgsFile,
            qrCodeId: nfcId,
            mintedAt: serverTimestamp(),
            status: 'minted',
            metadata: {
                name: `${qrData.modelName} #${qrData.serialNumber}`,
                description: `NFT Toy - ${qrData.modelName} (${qrData.rarity})`,
                image: `/models/${qrData.tgsFile}`,
            },
        });

        // Add history entry
        await addDoc(collection(db, 'nfts', tokenId, 'history'), {
            wallet: userWallet,
            userId: userId || null,
            type: 'mint',
            timestamp: serverTimestamp(),
        });

        // Create transaction record
        const txData = {
            type: 'mint' as const,
            from: null,
            to: userWallet || 'anonymous',
            tokenId,
            timestamp: mintTimestamp,
        };
        const txSignature = signTransaction(txData, TOKEN_SECRET);
        const txHash = generateTxHash('mint', null, userWallet || 'anonymous', tokenId, mintTimestamp);

        await addDoc(collection(db, 'transactions'), {
            txHash,
            type: 'mint',
            from: null,
            to: userWallet,
            toUserId: userId || null,
            tokenId,
            modelName: qrData.modelName,
            serialNumber: qrData.serialNumber,
            signature: txSignature,
            timestamp: serverTimestamp(),
            status: 'confirmed',
        });

        // Add NFT to wallet
        if (userWallet) {
            const walletRef = doc(db, 'wallets', userWallet);
            await updateDoc(walletRef, {
                nfts: arrayUnion(tokenId),
            });
        }

        res.json({
            success: true,
            toy: {
                id: nfcId,
                name: qrData.modelName,
                serialNumber: qrData.serialNumber,
                rarity: qrData.rarity,
                tgsFile: qrData.tgsFile,
                tgsUrl: `/models/${qrData.tgsFile}`,
            },
            nft: {
                tokenId,
                contractAddress,
                ownerWallet: userWallet,
                txHash,
            },
            activatedAt: new Date().toISOString(),
        });

    } catch (error) {
        console.error('Error activating QR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /qr/create - Create new QR code
router.post('/create', strictLimit, async (req, res) => {
    try {
        const modelName = sanitizeString(req.body.modelName || '');
        const serialNumber = req.body.serialNumber;

        const validation = validateRequired({ modelName, serialNumber }, ['modelName', 'serialNumber']);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Model name and serial number are required',
                code: 'VALIDATION_ERROR',
                fields: validation.missing
            });
        }

        if (!validateNumber(serialNumber, 1, 999999)) {
            return res.status(400).json({
                error: 'Serial number must be between 1 and 999999',
                code: 'VALIDATION_ERROR'
            });
        }

        const model = PEPE_MODELS.find(m => m.name === modelName);
        if (!model) {
            return res.status(404).json({ error: 'Model not found' });
        }

        // Check serial uniqueness
        const qrCodesRef = collection(db, 'qrcodes');
        const serialQuery = query(qrCodesRef, where('serialNumber', '==', serialNumber.toString()));
        const existingSerials = await getDocs(serialQuery);

        if (!existingSerials.empty) {
            const existingDoc = existingSerials.docs[0].data();
            return res.status(409).json({
                error: `Serial number ${serialNumber} already exists for model "${existingDoc.modelName}"`,
                code: 'SERIAL_EXISTS',
                existingModel: existingDoc.modelName
            });
        }

        const nfcId = `nfc_${modelName.toLowerCase().replace(/\s/g, '_')}_${serialNumber}`;
        const qrRef = doc(db, 'qrcodes', nfcId);
        const existing = await getDoc(qrRef);

        if (existing.exists()) {
            return res.status(409).json({ error: 'QR code already exists', code: 'DUPLICATE' });
        }

        const token = generateSecureToken(nfcId);

        const qrData = {
            nfcId,
            modelName,
            serialNumber: serialNumber.toString(),
            rarity: model.rarity,
            tgsFile: model.tgsFile,
            token,
            status: 'created',
            createdAt: serverTimestamp(),
        };

        await setDoc(qrRef, qrData);

        res.json({
            success: true,
            nfcId,
            activationUrl: `/activate/${encodeURIComponent(token)}`,
            qrData: {
                modelName,
                serialNumber,
                rarity: model.rarity,
            }
        });

    } catch (error) {
        console.error('Error creating QR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /qr/delete - Delete QR code
router.delete('/delete', csrfProtection, async (req, res) => {
    try {
        const nfcId = req.query.nfcId as string;

        if (!nfcId) {
            return res.status(400).json({ error: 'nfcId is required' });
        }

        const qrRef = doc(db, 'qrcodes', nfcId);
        const qrSnap = await getDoc(qrRef);

        if (!qrSnap.exists()) {
            return res.status(404).json({ error: 'QR code not found', code: 'NOT_FOUND' });
        }

        await deleteDoc(qrRef);

        res.json({ success: true, message: `QR code ${nfcId} deleted` });

    } catch (error) {
        console.error('Error deleting QR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /qr/list - List all QR codes
router.get('/list', async (req, res) => {
    try {
        const qrRef = collection(db, 'qrcodes');
        const q = query(qrRef, orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);

        const qrCodes = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                nfcId: data.nfcId,
                modelName: data.modelName,
                serialNumber: data.serialNumber,
                rarity: data.rarity,
                status: data.status,
                token: data.token,
                createdAt: data.createdAt?.seconds
                    ? new Date(data.createdAt.seconds * 1000).toISOString()
                    : null,
                usedAt: data.usedAt?.seconds
                    ? new Date(data.usedAt.seconds * 1000).toISOString()
                    : null,
                usedBy: data.usedBy,
            };
        });

        let used = 0;
        let created = 0;

        qrCodes.forEach(qr => {
            if (qr.status === 'used') used++;
            else created++;
        });

        res.json({
            qrCodes,
            stats: { total: qrCodes.length, used, created }
        });

    } catch (error) {
        console.error('Error getting QR list:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
