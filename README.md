# ReviewTap — NFC + Dynamic QR Cards

Cloudflare Worker + D1, with mobile admin dashboard, unique printable SVG QR codes, CSV export and assignable Google review redirects.

## Deploy
1. `npm install` and `npx wrangler login`.
2. `npx wrangler d1 create reviewtap-db` and copy its database ID into `wrangler.toml`.
3. `npm run db:remote`.
4. `npx wrangler secret put ADMIN_PASSWORD` and enter a strong password.
5. `npx wrangler secret put SESSION_SECRET` and enter a separate random string (32+ characters).
6. `npm run deploy`. Open the displayed URL ending in `/admin`.
7. Generate 50 cards, export CSV, and give the QR SVG links to your printer. Test QR + NFC before bulk printing.

Each card's QR encodes `https://YOUR-WORKER.workers.dev/r/CARD_ID`. Program the NFC tag with exactly that same URL. Never change the Worker URL after printing. Free tier limits apply. Do not commit secrets. Configure login rate limiting before production. Scan counts are approximate, not unique people.
