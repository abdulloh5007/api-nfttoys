import { Router } from 'express';
import { db } from '../lib/firebase/config';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { generateWalletAddress, toFriendlyAddress } from '../lib/utils/crypto';
import { standardLimit, authLimit } from '../middleware/rateLimit';

const router = Router();

// POST /wallet/create
router.post('/create', authLimit, async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required', code: 'VALIDATION_ERROR' });
        }

        // Check if user already has a wallet
        const userRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists() && userDoc.data().walletAddress) {
            const data = userDoc.data();
            return res.json({
                success: true,
                wallet: {
                    address: data.walletAddress,
                    friendlyAddress: toFriendlyAddress(data.walletAddress),
                },
                existing: true,
            });
        }

        // Generate new wallet
        const wallet = generateWalletAddress();
        const friendlyAddress = toFriendlyAddress(wallet.address);

        // Save wallet
        const walletRef = doc(db, 'wallets', wallet.address);
        await setDoc(walletRef, {
            address: wallet.address,
            friendlyAddress,
            userId,
            addressHash: wallet.addressHash,
            createdAt: serverTimestamp(),
            nfts: [],
            balance: 0,
        });

        // Update user
        await setDoc(userRef, {
            walletAddress: wallet.address,
            walletFriendly: friendlyAddress,
        }, { merge: true });

        res.json({
            success: true,
            wallet: {
                address: wallet.address,
                friendlyAddress,
            },
            existing: false,
        });

    } catch (error) {
        console.error('Wallet creation error:', error);
        res.status(500).json({ error: 'Failed to create wallet', code: 'WALLET_ERROR' });
    }
});

// GET /wallet/info
router.get('/info', standardLimit, async (req, res) => {
    try {
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required', code: 'VALIDATION_ERROR' });
        }

        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        }

        const userData = userSnap.data();
        const walletAddress = userData.walletAddress;

        if (!walletAddress) {
            return res.status(404).json({ error: 'User has no wallet', code: 'NO_WALLET' });
        }

        const walletRef = doc(db, 'wallets', walletAddress);
        const walletSnap = await getDoc(walletRef);

        if (!walletSnap.exists()) {
            return res.status(404).json({ error: 'Wallet not found', code: 'WALLET_NOT_FOUND' });
        }

        const walletData = walletSnap.data();

        res.json({
            success: true,
            wallet: {
                address: walletAddress,
                friendlyAddress: walletData.friendlyAddress || toFriendlyAddress(walletAddress),
                nftCount: walletData.nfts?.length || 0,
                balance: walletData.balance || 0,
                createdAt: walletData.createdAt?.seconds
                    ? new Date(walletData.createdAt.seconds * 1000).toISOString()
                    : null,
            }
        });

    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ error: 'Failed to fetch wallet', code: 'FETCH_ERROR' });
    }
});

export default router;
