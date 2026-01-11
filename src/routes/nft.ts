import { Router } from 'express';
import { db } from '../lib/firebase/config';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, addDoc, serverTimestamp, arrayUnion, arrayRemove } from 'firebase/firestore';
import { toFriendlyAddress, signTransaction, generateTxHash, isValidAddress } from '../lib/utils/crypto';
import { standardLimit, strictLimit } from '../middleware/rateLimit';
import { csrfProtection } from '../middleware/csrfProtection';

const router = Router();

const TOKEN_SECRET = process.env.TOKEN_SECRET || '';

// GET /nft/my - Get user's NFTs
router.get('/my', standardLimit, async (req, res) => {
    try {
        const userId = req.query.userId as string;
        const walletAddress = req.query.wallet as string;

        if (!userId && !walletAddress) {
            return res.status(400).json({
                error: 'userId or wallet is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const nftsRef = collection(db, 'nfts');
        let q;

        if (walletAddress) {
            q = query(nftsRef, where('ownerWallet', '==', walletAddress));
        } else {
            q = query(nftsRef, where('ownerId', '==', userId));
        }

        const querySnap = await getDocs(q);

        const nfts = querySnap.docs.map(doc => {
            const data = doc.data();
            return {
                tokenId: data.tokenId,
                contractAddress: data.contractAddress,
                modelName: data.modelName,
                serialNumber: data.serialNumber,
                rarity: data.rarity,
                tgsFile: data.tgsFile,
                tgsUrl: `/models/${data.tgsFile}`,
                mintedAt: data.mintedAt?.seconds
                    ? new Date(data.mintedAt.seconds * 1000).toISOString()
                    : null,
                metadata: data.metadata,
            };
        });

        // Sort by rarity
        const rarityOrder = { legendary: 0, rare: 1, common: 2 };
        nfts.sort((a, b) => {
            const orderA = rarityOrder[a.rarity as keyof typeof rarityOrder] ?? 3;
            const orderB = rarityOrder[b.rarity as keyof typeof rarityOrder] ?? 3;
            return orderA - orderB;
        });

        res.json({ success: true, count: nfts.length, nfts });

    } catch (error) {
        console.error('Error fetching NFTs:', error);
        res.status(500).json({ error: 'Failed to fetch NFTs', code: 'FETCH_ERROR' });
    }
});

// GET /nft/:tokenId - Get NFT details
router.get('/:tokenId', standardLimit, async (req, res) => {
    try {
        const { tokenId } = req.params;

        if (!tokenId) {
            return res.status(400).json({ error: 'tokenId is required', code: 'VALIDATION_ERROR' });
        }

        const nftRef = doc(db, 'nfts', tokenId);
        const nftSnap = await getDoc(nftRef);

        if (!nftSnap.exists()) {
            return res.status(404).json({ error: 'NFT not found', code: 'NOT_FOUND' });
        }

        const nftData = nftSnap.data();

        // Get owner info
        let ownerInfo = null;
        if (nftData.ownerId) {
            const userRef = doc(db, 'users', nftData.ownerId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                ownerInfo = {
                    username: userData.username,
                    firstName: userData.firstName,
                    photoUrl: userData.photoUrl,
                };
            }
        }

        // Format owner history (now from subcollection)
        const historyRef = collection(db, 'nfts', tokenId, 'history');
        const historySnap = await getDocs(historyRef);
        const ownerHistory = historySnap.docs.map(doc => {
            const entry = doc.data();
            return {
                ...entry,
                friendlyAddress: entry.wallet ? toFriendlyAddress(entry.wallet) : null,
                date: entry.timestamp?.seconds
                    ? new Date(entry.timestamp.seconds * 1000).toISOString()
                    : null,
            };
        });

        res.json({
            success: true,
            nft: {
                tokenId: nftData.tokenId,
                contractAddress: nftData.contractAddress,
                modelName: nftData.modelName,
                serialNumber: nftData.serialNumber,
                rarity: nftData.rarity,
                tgsFile: nftData.tgsFile,
                tgsUrl: `/models/${nftData.tgsFile}`,
                status: nftData.status,
                mintedAt: nftData.mintedAt?.seconds
                    ? new Date(nftData.mintedAt.seconds * 1000).toISOString()
                    : null,
                metadata: nftData.metadata,
                owner: {
                    wallet: nftData.ownerWallet,
                    friendlyAddress: nftData.ownerWallet ? toFriendlyAddress(nftData.ownerWallet) : null,
                    ...ownerInfo,
                },
                ownerHistory,
            }
        });

    } catch (error) {
        console.error('Error fetching NFT:', error);
        res.status(500).json({ error: 'Failed to fetch NFT', code: 'FETCH_ERROR' });
    }
});

// POST /nft/transfer - Transfer NFT
router.post('/transfer', strictLimit, csrfProtection, async (req, res) => {
    try {
        const { tokenId, fromUserId, toAddress, toUsername, initData } = req.body;

        if (!tokenId) {
            return res.status(400).json({ error: 'tokenId is required', code: 'VALIDATION_ERROR' });
        }

        if (!fromUserId) {
            return res.status(400).json({ error: 'fromUserId is required', code: 'VALIDATION_ERROR' });
        }

        if (!toAddress && !toUsername) {
            return res.status(400).json({
                error: 'Either toAddress or toUsername is required',
                code: 'VALIDATION_ERROR'
            });
        }

        const nftRef = doc(db, 'nfts', tokenId);
        const nftSnap = await getDoc(nftRef);

        if (!nftSnap.exists()) {
            return res.status(404).json({ error: 'NFT not found', code: 'NOT_FOUND' });
        }

        const nftData = nftSnap.data();

        if (nftData.ownerId !== fromUserId) {
            return res.status(403).json({ error: 'You do not own this NFT', code: 'UNAUTHORIZED' });
        }

        // Find recipient
        let recipientWallet: string | null = null;
        let recipientUserId: string | null = null;

        if (toUsername) {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', toUsername.replace('@', '')));
            const querySnap = await getDocs(q);

            if (querySnap.empty) {
                return res.status(404).json({ error: 'User not found', code: 'RECIPIENT_NOT_FOUND' });
            }

            const recipientData = querySnap.docs[0].data();
            recipientUserId = querySnap.docs[0].id;
            recipientWallet = recipientData.walletAddress;
        } else if (toAddress) {
            let walletAddress = toAddress;

            if (toAddress.startsWith('UZ-')) {
                const walletsRef = collection(db, 'wallets');
                const q = query(walletsRef, where('friendlyAddress', '==', toAddress.toUpperCase()));
                const querySnap = await getDocs(q);

                if (querySnap.empty) {
                    return res.status(404).json({ error: 'Wallet not found', code: 'RECIPIENT_NOT_FOUND' });
                }

                walletAddress = querySnap.docs[0].id;
            }

            if (!isValidAddress(walletAddress)) {
                return res.status(400).json({ error: 'Invalid wallet address format', code: 'INVALID_ADDRESS' });
            }

            const walletRef = doc(db, 'wallets', walletAddress);
            const walletSnap = await getDoc(walletRef);

            if (!walletSnap.exists()) {
                return res.status(404).json({ error: 'Wallet not found', code: 'RECIPIENT_NOT_FOUND' });
            }

            recipientWallet = walletAddress;
            recipientUserId = walletSnap.data().userId;
        }

        if (!recipientWallet) {
            return res.status(404).json({ error: 'Could not find recipient wallet', code: 'RECIPIENT_NOT_FOUND' });
        }

        if (recipientWallet === nftData.ownerWallet) {
            return res.status(400).json({ error: 'Cannot transfer to yourself', code: 'SELF_TRANSFER' });
        }

        const transferTimestamp = Date.now();

        const txData = {
            type: 'transfer' as const,
            from: nftData.ownerWallet,
            to: recipientWallet,
            tokenId,
            timestamp: transferTimestamp,
        };
        const txSignature = signTransaction(txData, TOKEN_SECRET);
        const txHash = generateTxHash('transfer', nftData.ownerWallet, recipientWallet, tokenId, transferTimestamp);

        // Update NFT owner
        await updateDoc(nftRef, {
            ownerWallet: recipientWallet,
            ownerId: recipientUserId,
            lastTransferAt: serverTimestamp(),
        });

        // Add history entry
        await addDoc(collection(db, 'nfts', tokenId, 'history'), {
            wallet: recipientWallet,
            userId: recipientUserId,
            type: 'transfer',
            fromWallet: nftData.ownerWallet,
            timestamp: serverTimestamp(),
        });

        // Remove from sender's wallet
        if (nftData.ownerWallet) {
            const senderWalletRef = doc(db, 'wallets', nftData.ownerWallet);
            await updateDoc(senderWalletRef, {
                nfts: arrayRemove(tokenId),
            });
        }

        // Add to recipient's wallet
        const recipientWalletRef = doc(db, 'wallets', recipientWallet);
        await updateDoc(recipientWalletRef, {
            nfts: arrayUnion(tokenId),
        });

        // Record transaction
        await addDoc(collection(db, 'transactions'), {
            txHash,
            type: 'transfer',
            from: nftData.ownerWallet,
            fromUserId,
            to: recipientWallet,
            toUserId: recipientUserId,
            tokenId,
            modelName: nftData.modelName,
            serialNumber: nftData.serialNumber,
            signature: txSignature,
            timestamp: serverTimestamp(),
            status: 'confirmed',
        });

        res.json({
            success: true,
            transfer: {
                txHash,
                tokenId,
                from: nftData.ownerWallet,
                to: recipientWallet,
                timestamp: new Date(transferTimestamp).toISOString(),
            }
        });

    } catch (error) {
        console.error('Transfer error:', error);
        res.status(500).json({ error: 'Transfer failed', code: 'TRANSFER_ERROR' });
    }
});

export default router;
