# Creatagious PWA

Vanilla HTML, CSS and JavaScript. No build step.

## Deploy on Cloudflare
Creatagious runs as one Cloudflare Worker: it serves the app's files and runs the server part (`worker/`), including AI, website reading, Premium codes and push reminders. There's no PHP and no build step.

**One-time setup**
1. **Database:** in Cloudflare, go to **Storage & Databases > D1 > Create**, name it `creatagious`, and copy its **Database ID** into `database_id` in `wrangler.jsonc`.
2. **Worker:** go to **Workers & Pages > Create > Import a repository**, pick `creatagious-app`, and deploy. The build command is empty and the deploy command is `npx wrangler deploy`. Every push to `main` then deploys automatically.
3. **Domain:** in the Worker's **Settings > Domains & Routes**, add `creatagious.com` (and `www.creatagious.com`) as custom domains. Remove the domain from any older project first.
4. **Keys:** in the Worker's **Settings > Variables and Secrets**, add these as **Secret** values: `ANTHROPIC_API_KEY`, `RUNWAY_API_KEY`, `ELEVENLABS_API_KEY`, and `PREMIUM_CODES` (your private codes, separated by commas). Never put keys in `wrangler.jsonc` or `js/`.
5. Open the app, go to **Profile > Check setup**, and fix anything marked with an X.

Models and daily limits are the `vars` in `wrangler.jsonc`. The signing secret for Premium tokens and the push notification keys are created automatically and stored in the database.

On every update, change `VERSION` in **both** `service-worker.js` and `js/config.js`. Open apps then show "A new version is ready".

## AI providers
Claude writes ad copy and handles the website search fallback. Runway creates AI images (`seedream5_flash`, 2 credits each) and 5-second video clips (`gemini_omni_flash_1.2` at 720p, 35 credits each; one Runway credit is $0.01). ElevenLabs creates AI voices. Add prepaid credits to Runway and use a paid ElevenLabs plan for commercial rights. With the default limits, clips are capped at 5 per Premium code and 30 per day overall, about $10.50 a day at most. Without keys the app still writes copy on the device and from website content.

Switch to Premium in **Profile > Test the app as**, then redeem your code. Paid AI will not run without it.

## Scheduling (Premium)
Premium users can schedule ads they made, or upload their own finished videos and images, choose platforms (TikTok, Instagram, Facebook, YouTube Shorts, LinkedIn, Pinterest) and pick a date and time. The Schedule screen is in the menu and in each editor's Post tab.
- **Push reminders:** "Turn on reminders" signs the phone up for notifications. The schedule is sent to the Worker, and a job that runs every minute sends a notification at post time, even when Creatagious is closed. Notifications use the app icon, with a white Creatagious mark in the status bar. They need internet when sent; an offline phone gets them when it reconnects. On iPhone, Creatagious must be added to the Home Screen first.
- **Calendar reminders:** "Remind me" downloads a calendar file with an alert. The phone's calendar reminds the user even offline.
- **Spoken reminders:** with "Speak reminders" on, the phone reads the reminder aloud while Creatagious is open. A web app can't speak while closed; phones can read notifications aloud through their own settings (Announce Notifications on iPhone, Google Assistant on Android).
- **Posting:** "Post now" prepares the file (videos are recorded first), copies the caption, and opens the phone's share sheet for each platform. On computers it downloads the file and opens the platform's upload page. Each platform is ticked off as it's posted.
- **Storage:** schedules and uploaded files stay on the device, like projects, and are included in Export my data.
- **Automatic posting (next):** needs accounts and server-side scheduling, plus approval from each platform. TikTok keeps posts from unaudited apps private, Instagram needs Business or Creator accounts and Meta app review, and YouTube keeps uploads from unverified projects private. Apply early, since reviews take weeks.

## Website generation
The Worker reads the home page and up to three About, Services, Menu or Pricing pages. It uses page text, structured data and app data embedded in the page. The kit shows everything found so the user can choose what the ad uses. If a site blocks servers or renders only in the browser, Claude searches that domain only, and the kit labels the result and links its sources. If nothing can be read, the kit says why and lets the user type the details and add photos.

## Voiceover
Premium video projects have an **Add voiceover** button under Export. Users can record their voice, upload an audio file, or choose an AI voice.

AI voices use ElevenLabs and need the `ELEVENLABS_API_KEY` secret plus a Premium code. They count toward `VOICE_DAILY_CHARACTERS` and show an on-video "AI-generated voice" label.

## Free and Premium
Free has ads, a small watermark, classic videos up to 15 seconds and 720p. Premium unlocks content-style videos, photos or clips per scene, caption styles, fonts, looks, transitions, music moods, logo, voiceover, the full website kit, 60-second videos, 1080p, and no ads or watermark.

**Before launch, set `PREMIUM_PREVIEW: false` in `js/config.js`.** While true, anyone can turn Premium on for testing.

- Web sales: set `CHECKOUT_URL` and issue license codes. Add each code to the `PREMIUM_CODES` secret, or its sha256 hash to `LICENSE_CODE_HASHES`.
- Web ads: set `ADSENSE_CLIENT` and `ADSENSE_SLOT` after approval. Until then a Premium promo shows in those spots.
- Paid AI is enforced on the server with signed Premium tokens issued from those codes. Other Premium tools are unlocked on the device. Google Play buyers do not receive a server token yet, so add Play purchase verification before selling AI features through Play.

## What runs where
| Feature | Works offline | Needs |
|---|---|---|
| Image ads, campaigns, video clips, editing, export | Yes | Nothing |
| AI copy | No | `ANTHROPIC_API_KEY` secret |
| AI images and video clips | No | `RUNWAY_API_KEY` secret plus a Premium code |
| Record or upload voiceover | Yes | Microphone permission for recording |
| AI voiceover | No | `ELEVENLABS_API_KEY` secret plus a Premium code |
| Website kit | No | The Worker |
| Push reminders | Sent when online | The Worker and its D1 database |
| Report this result | Saved locally, sent when online | The Worker |

## Good to know
- Content-style videos are built from the generated script plus the user's photos, clips, website images or drawn artwork. The app does not generate AI actors, photorealistic footage or AI voices yet.
- Video records in real time, so a 30-second clip takes 30 seconds. Chrome saves MP4 where the device supports it, otherwise WebM. Test a clip from your target Android phone before launch.
- The Home template and recent project thumbnails were cropped from your mockup. Replace `assets/img/*.webp` with full-size originals for sharper tablet display.
- Projects are stored on each device. There are no accounts or cloud sync yet.
- Analytics shows activity inside Creatagious, not reach or clicks from ad platforms.

## Before launch
Replace the bracketed items, including the ad and subscription notes, in `privacy.html` and `terms.html`, confirm `support@creatagious.com` (also in `js/config.js`), and have the legal pages reviewed.
