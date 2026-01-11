import { Router } from 'express';
import crypto from 'crypto';
import { adminAuth } from '../lib/firebase/admin';
import { db } from '../lib/firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { generateWalletAddress, toFriendlyAddress } from '../lib/utils/crypto';
import { authLimit } from '../middleware/rateLimit';

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
}

// Verify Telegram initData signature
function verifyTelegramData(initData: string): { valid: boolean; user?: TelegramUser } {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');

        if (!hash) return { valid: false };

        // Check auth_date expiry (24 hours max)
        const authDate = parseInt(params.get('auth_date') || '0', 10);
        const now = Math.floor(Date.now() / 1000);
        const maxAge = 86400;

        if (now - authDate > maxAge) {
            console.warn('Telegram auth_date expired');
            return { valid: false };
        }

        params.delete('hash');

        const sortedParams = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(BOT_TOKEN)
            .digest();

        const expectedHash = crypto
            .createHmac('sha256', secretKey)
            .update(sortedParams)
            .digest('hex');

        if (hash.length !== expectedHash.length) {
            return { valid: false };
        }

        if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash))) {
            return { valid: false };
        }

        const userStr = params.get('user');
        if (!userStr) return { valid: false };

        const user = JSON.parse(userStr) as TelegramUser;
        return { valid: true, user };

    } catch (error) {
        console.error('Error verifying Telegram data:', error);
        return { valid: false };
    }
}

// POST /auth/telegram
router.post('/telegram', authLimit, async (req, res) => {
    try {
        const { initData } = req.body;

        if (!initData) {
            return res.status(400).json({ error: 'initData is required' });
        }

        const verification = verifyTelegramData(initData);

        if (!verification.valid || !verification.user) {
            return res.status(401).json({
                error: 'Invalid Telegram data',
                code: 'INVALID_SIGNATURE',
            });
        }

        const user = verification.user;
        const uid = `telegram_${user.id}`;

        // Create custom token
        const customToken = await adminAuth.createCustomToken(uid, {
            telegramId: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            username: user.username,
        });

        const userRef = doc(db, 'users', uid);
        const existingUser = await getDoc(userRef);

        // Auto-create wallet if needed
        let walletAddress = existingUser.exists() ? existingUser.data().walletAddress : null;
        let walletFriendly = existingUser.exists() ? existingUser.data().walletFriendly : null;

        if (!walletAddress) {
            const wallet = generateWalletAddress();
            walletAddress = wallet.address;
            walletFriendly = toFriendlyAddress(wallet.address);

            const walletRef = doc(db, 'wallets', wallet.address);
            await setDoc(walletRef, {
                address: wallet.address,
                friendlyAddress: walletFriendly,
                userId: uid,
                addressHash: wallet.addressHash,
                createdAt: serverTimestamp(),
                nfts: [],
                balance: 0,
            });
        }

        const userData = {
            telegramId: user.id,
            firstName: user.first_name,
            lastName: user.last_name || null,
            username: user.username || null,
            photoUrl: user.photo_url || null,
            languageCode: user.language_code || null,
            walletAddress,
            walletFriendly,
            lastLoginAt: serverTimestamp(),
            ...(existingUser.exists() ? {} : { createdAt: serverTimestamp() })
        };

        await setDoc(userRef, userData, { merge: true });

        res.json({
            success: true,
            token: customToken,
            user: {
                uid,
                telegramId: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                photoUrl: user.photo_url,
                walletAddress,
                walletFriendly,
            }
        });

    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

export default router;
