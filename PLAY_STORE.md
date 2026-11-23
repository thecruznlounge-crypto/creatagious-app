# Publish Creatagious to Google Play

Creatagious ships as a Trusted Web Activity: an Android app that opens your live PWA full screen.

1. Deploy to `https://creatagious.com` and confirm the manifest and service worker load.
2. Go to https://www.pwabuilder.com, enter the site, and choose **Package for stores > Android**. Use package ID `com.creatagious.app`. (Or use Bubblewrap with `twa-manifest.json`.)
3. Keep the signing key and passwords somewhere safe.
4. Upload the `.aab` to Play Console, in Internal testing first.
5. In Play Console open **Setup > App signing** and copy the **App signing SHA-256** fingerprint.
6. Paste it into `.well-known/assetlinks.json`, replacing `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`, then upload that file. Without this, Android shows a browser address bar.
7. Check `https://creatagious.com/.well-known/assetlinks.json` opens publicly.

## Store listing
**App name:** Creatagious: AI Ad Maker
**Short description:** Turn one sentence into image ads and video clips for social media.
**Full description:**
Describe what you're promoting and Creatagious creates ready-to-edit ads. Make image ads, short video clips, promo clips and multi-format campaigns. Change the copy, colors, template and photo, then download or share to the social apps on your phone.

- Image ads in square, portrait, story, Pinterest, link and landscape sizes
- 6, 15 and 30 second video clips with captions and music
- One campaign, every size, in a single download
- Swipeable carousels and Platform Packs from one idea
- Templates for food, events, transport, sales, beauty, fitness, real estate and openings
- Works offline, with projects saved on your device

**Category:** Business. **Graphics:** see `store/` (icon, 1024x500 feature graphic, phone and 7"/10" tablet screenshots).

## Premium on Google Play
Apps on Play that sell digital goods or subscriptions must use Play Billing, so the Play build hides web checkout and license codes.
1. Create a subscription in Play Console and put its product ID in `PLAY_SKU` in `js/config.js`.
2. `twa-manifest.json` already enables Play Billing. Rebuild the Android package after any Bubblewrap update.
3. Add a backend that verifies and acknowledges purchases with the Google Play Developer API before charging real customers. Unacknowledged purchases can be refunded by Google.
4. Test with Play license testers.

## Ads on Google Play
The Play build does not load AdSense. It shows only the Premium promo. Showing paid ads in the Android app needs a separate AdMob-capable setup, so confirm the current Google policies first. If real ads are added, declare them in Play Console.

## Play Console answers to review
- **AI-generated content:** the app has an in-app **Report this result** control on generated copy.
- **Data safety:** project data stays on the device. If AI writing or the website kit is used, the typed description or entered URL is sent to your server and AI provider. Microphone audio is used for voiceover and stays on the device unless exported. AI voice scripts are sent to your server and voice provider. Declare this.
- **Account deletion:** no accounts. `delete-account.html` is the public data deletion page.
- **Privacy policy URL:** `https://creatagious.com/privacy.html`
