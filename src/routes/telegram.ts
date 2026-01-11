import { Router } from 'express';
import { validateTelegramInitData } from '../lib/utils/telegramValidation';

const router = Router();

// POST /telegram/validate
router.post('/validate', async (req, res) => {
    try {
        const { initData } = req.body;

        if (!initData) {
            return res.status(400).json({ valid: false, error: 'initData is required' });
        }

        const result = validateTelegramInitData(initData);

        if (!result.valid) {
            return res.status(401).json({ valid: false, error: result.error });
        }

        res.json({
            valid: true,
            user: result.user,
            auth_date: result.auth_date,
        });

    } catch (error) {
        console.error('Telegram validation error:', error);
        res.status(500).json({ valid: false, error: 'Server error' });
    }
});

export default router;
