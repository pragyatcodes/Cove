# Cove — Install as a Real App (PWA + Native)

Cove is now a **real installable app**, not just a website. It works offline, opens standalone without browser chrome, and appears on your home screen.

## Option 1: Install PWA (30 seconds — recommended for submission)

**On Android (Chrome):**
1. Open `index.html` via HTTPS (or `npx serve .` → open the preview link)
2. You’ll see a black banner: **“Install Cove as app”** → tap **Install**
3. Or Chrome menu (⋮) → **Install app** / **Add to Home screen**
4. Cove opens standalone with splash screen, offline cache, and share target

**On iPhone (Safari):**
1. Open `index.html` in Safari
2. Tap **Share** (⎙) → **Add to Home Screen** → Add
3. Open from home screen — standalone, no Safari bar

**Verify it’s an app:**
- No address bar, theme color `#0A0A0B`, icon on home screen (c with coral dot)
- Turn on Airplane mode → reopen → still works (cached)
- Share from Chrome: select text → Share → **Cove** appears (via `share_target` in manifest)

**Files that make it an app:**
- `manifest.json` — `display: standalone`, icons, share_target
- `sw.js` — offline cache, network-first for share/public links
- `icon-192.png` / `icon-512.png` — maskable icons
- `index.html` now registers SW and shows install prompt (`beforeinstallprompt`)

## Option 2: Build a native APK (Expo wrapper — 2 minutes)

If your society wants an **APK** to sideload:

```bash
# 1. Create Expo wrapper (wraps the PWA in a WebView)
npx create-expo-app cove-native
cd cove-native
npx expo install react-native-webview

# 2. Replace App.js with:
cat > App.js << 'JS'
import { WebView } from 'react-native-webview';
export default function App(){
  return <WebView source={{uri: 'https://your-hosted-cove.com/index.html'}} 
    allowsInlineMediaPlayback
    javaScriptEnabled
    domStorageEnabled
  />;
}
JS

# 3. Build APK (no dev account needed for local)
npx expo prebuild
npx expo run:android   # or eas build -p android --profile preview
```

Or use **PWABuilder** (no code): https://www.pwabuilder.com → enter your hosted URL → **Package for Android** → download signed APK.

## Option 3: Host for the society

```bash
# quick host for demo
npx serve . --listen 8000
# give them the preview URL or deploy to Vercel/Netlify:
# vercel --prod   # or drag folder to netlify
```

Share the URL — they can install directly from there. Public links (`#p=TOKEN`) and share-into-app work even when installed.

## What reviewers will see as “app”

- Standalone window, no browser UI
- Splash screen (background `#FDFBF7`, theme `#0A0A0B`)
- Works offline (service worker caches assets)
- Receives shares via Android Share menu (manifest `share_target`)
- Home screen icon (192/512 maskable)

---
Made for MAIT Tech Society — Stage 1 polished, Stage 2 private, Stage 3 share + vault, now **installable**.
