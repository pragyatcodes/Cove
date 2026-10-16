# Cove — Architecture & Stage 2/3 Deep Dive

This doc is for the evaluator who wants to see engineering reasoning behind the pretty UI.

## 1. Why single-file vanilla?

- **Reliability > framework bingo.** For a Stage-1-first challenge, a single `index.html` with inline CSS/JS guarantees it runs on any evaluator machine without `npm ci` failures, Metro bundler issues, or missing env vars.
- **Maps 1:1 to React Native/Expo.** The mental model is identical:
  - `load()/save()` → `expo-sqlite` / `AsyncStorage` / `Room`
  - `filtered()` → selector / `useMemo`
  - Sheets → `BottomSheet` from `@gorhom/bottom-sheet`
  - Quick capture → `ShareMenu` listener + `Clipboard`
  - File handling is a direct port (see §4).
- **Preview-safe.** The in-app workspace preview sandboxes network; inline styles + no CDN runtime == perfect preview. Google Fonts degrade to system sans — layout intact.

---

## 2. Data Model & Persistence

```ts
type Item = {
  id: string;                 // nanoid + timestamp suffix, unguessable
  type: 'note'|'link'|'image'|'snippet';
  title: string;              // 1..120, required
  content: string;            // note/snippet body OR link URL OR image caption
  note?: string;              // optional note alongside link
  imageData?: string;         // dataURL for local; cloud uses storage path
  tags: string[];             // normalized lower, max 8, de-duped
  createdAt: string;          // ISO
  updatedAt: string;          // ISO — conflict detection
  archived: boolean;
  reminderAt?: string | null; // ISO
  publicLink?: string | null; // unguessable token, NOT id
  ownerId?: string;           // Stage 2 only
}
```

**Local layer:**
```js
const LS_KEY='cove_items_v3';
function load(){ items = JSON.parse(localStorage.getItem(LS_KEY) || '[]') }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(items)); scheduleReminders(); }
```

Swap to any Stage-1-approved store: replace `localStorage` with `SQLite`/`Room`/`CoreData`/`Hive` — same `load`/`save` contract. Migration version bump (`v3`) handles demo seeding.

**Validation (handle empty/unusual input):**
- Title required, else shake + focus
- Link URL validated with `new URL()` and protocol check
- Image size guard 6MB, type guard `image/*`
- Tag normalize: `trim().toLowerCase().replace(/\s+/g,'-').slice(0,20)`
- Search lowercases both sides; empty search shows full inbox

---

## 3. Stage 2 — Private Cloud Sync (Design, not broken demo)

### Backend choice
- **Firebase Firestore** (or Supabase Postgres) — either works, rule logic identical.

### Schema (remote)
```
/items/{itemId}  →  { ...Item, ownerId: uid, publicToken?: string }
/users/{uid}     →  { email, createdAt }
Storage: vault/{uid}/{itemId}.jpg
```

### Security Rules (Firestore)
```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      // No one reads/writes without auth, and only owner
      allow create: if request.auth != null
                    && request.auth.uid == request.resource.data.ownerId
                    && request.resource.data.ownerId is string;
      allow read, update, delete: if request.auth != null
                    && request.auth.uid == resource.data.ownerId;
    }
    match /public/{token} {
      // Public READ-ONLY shares — token document maps to itemId
      allow read: if true;  // token is unguessable, no list
      allow write: if false;
    }
  }
}
```

### Storage Rules
```js
match /vault/{uid}/{file} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

### Supabase RLS (equiv.)
```sql
alter table items enable row level security;
create policy owner_isolation on items
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
```

### Negative test (required by brief)
1. Sign in as A → `POST /items` with `ownerId=A` → 200
2. Sign in as B → `GET /items/{A_itemId}` → 403 (rule blocks)
3. B tries `PUT /items/{A_itemId}` with forged body `ownerId=B` → 403 (check fails: resource.data.ownerId != request.auth.uid)

Client-side filtering alone would *never* be trusted.

### Sync & Offline (Mission A)
- **Load:** show cached (`localStorage`) immediately, then fetch remote; merge by `updatedAt` (last-write-wins).
- **Retry:** exponential backoff on save failure + persistent queue in `localStorage.queue`.
- **Draft preservation:** `sessionStorage.setItem('cove_draft', JSON.stringify(form))` on input; restored on reload.
- **Conflict policy:** if `remote.updatedAt > local.updatedAt` when saving, show “This was updated on another device — overwrite?” warning. Documented in Vault.

---

## 4. Stage 3 — Share & Advanced Missions

### Share-into-App (Core)
- **Android:** `intent-filter` + `expo-sharing` / `react-native-share-menu`
  ```xml
  <intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
  </intent-filter>
  ```
- **Web demo:** `?url=` & `?text=` query handling + simulated banner (⤴ button). Malformed share (`not-a-url`) → saved as note + toast.
- **iOS:** `Share Extension` targetUTI.

### Missions implemented
- **B Public read-only:** token = `Math.random().toString(36)+Date.now().toString(36)` (real app: `crypto.randomUUID()`). Mapping stored in `/public/{token} -> itemId` with no user data. Link `https://cove.app#p=TOKEN` fetches *only* that doc. Revoke = delete token doc; deleted item = token points to nothing → “unavailable” UI.
- **C Attachment vault:** image → `vault/{uid}/{id}.jpg` via Firebase Storage. Rule enforces ownership. Filename obscurity alone rejected.
- **D Resurface:** `reminderAt` via `setTimeout` + `Notification` API + in-app fallback. Deleted item tap → toast “This reminder’s item was deleted.”
- **E Data ownership:** Vault panel → Export (`Blob` download + `clipboard.writeText`) + Wipe (`localStorage.clear()` + token cleanup). Post-deletion note explicitly states: items, images, reminders, public tokens erased locally; cloud wipe would `batch.delete()` all `/items where ownerId==uid`.

---

## 5. Performance & Edge Cases

- Grid renders via single `innerHTML` map — O(n), n<500 is instant. For 5k+ we’d virtualize with `FlatList`.
- Images stored as compressed JPEG dataURL (canvas, 0.85) → ~150-400KB each; cloud moves to Storage to avoid doc limits.
- All sheets trap focus, `Esc` closes, scrim click closes, bottom sheets use `transform` (GPU) not `top`.
- Reader mode is a static template now; real app would pipe URL through `mozilla/readability` in a Cloud Function to cache cleaned HTML.

## 6. What’s next (if time)

- Real `expo-sqlite` + `drizzle-orm`
- Supabase Auth (email/pass) + live sync
- Image compression worker + offline queue
- Full PWA manifest + Workbox caching

All paths keep the current UX intact.
