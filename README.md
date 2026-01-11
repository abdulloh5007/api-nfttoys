# NFT Toys API Server

Express server for NFT Toys platform at `api.nfttoys.shop`.

## Setup

```bash
cd server
npm install
cp .env.example .env  # Configure environment
npm run dev           # Development
npm run build && npm start  # Production
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `PORT` - Server port (default: 4000)
- `FIREBASE_*` - Firebase credentials
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TOKEN_SECRET` - QR signing secret (min 32 chars)
- `ALLOWED_ORIGINS` - CORS allowed origins

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/telegram` | POST | Telegram authentication |
| `/qr/activate` | GET | Check QR status |
| `/qr/activate` | POST | Activate QR & mint NFT |
| `/qr/create` | POST | Create QR code |
| `/qr/delete` | DELETE | Delete QR code |
| `/qr/list` | GET | List all QR codes |
| `/nft/:tokenId` | GET | Get NFT details |
| `/nft/my` | GET | Get user's NFTs |
| `/nft/transfer` | POST | Transfer NFT |
| `/wallet/create` | POST | Create wallet |
| `/wallet/info` | GET | Get wallet info |
| `/telegram/validate` | POST | Validate Telegram initData |
| `/health` | GET | Health check |
