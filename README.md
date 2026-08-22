# Stay in Touch

A private mobile app for close friend groups. Each person maintains one living update — a photo and a short description of what they're doing right now. The home screen widget shows it without opening the app.

Built for the group of friends who stopped talking not because they stopped caring, but because life got busy.

> *Simple enough to disappear. Meaningful enough to stay.*

---

## What it does

Every member has exactly one active presence: a photo, a caption, and a timestamp. Updating replaces the previous one. No history, no feed, no likes, no followers.

The home screen widget rotates through your group's updates silently in the background. You don't need to open the app.

**Not on the roadmap, ever:** messaging, likes, comments, public profiles, content discovery, algorithmic ranking.

---

## Current state (v0.2.0)

- Three-tab navigation: **Feed** · **Circle** · **You**
- Check-in with camera or gallery, interactive crop/frame editor
- Android home screen widget — tap to cycle through members, updates without app launch
- Silent FCM push: friends' widgets update within seconds of a new check-in
- Android WorkManager periodic sync (15-min fallback when push is delayed or missed)
- Offline-first: full app and widget functionality with no network
- Invite-only group join via 24-hour expiring codes

---

## Architecture

**Local-first.** Every action writes to SQLite first. The UI, widget, and offline mode all read from there. Sync is a background concern.

**Sync pipeline:**
```
User checks in
  → SQLite write + sync_queue entry (0ms, instant UI)
  → syncPush uploads image to Supabase Storage, upserts presence row
  → Postgres trigger fires dispatch-presence-push Edge Function
  → Silent FCM data message wakes friends' devices
  → syncPull downloads changes → SQLite reconciliation
  → widgetSnapshot.updateAndNotifyWidget()
```

**Widget without app launch:**
- Silent FCM (real-time, seconds latency)
- Android WorkManager / HeadlessJS (15-min periodic fallback)
- `widget_snapshot.json` written to internal storage; native Android reads it directly without touching React Native runtime

```
src/
├── features/
│   ├── auth/              # Google OAuth + invite code join flow
│   ├── presence/          # HomeScreen, GroupScreen, ProfileScreen, CheckInScreen
│   ├── media/             # Pick → ImageEditorModal → resize/compress → upload
│   ├── sync/              # syncEngine, syncPush, syncPull, realtimeListener,
│   │                      # netInfoListener, backgroundSyncTask (HeadlessJS)
│   ├── notifications/     # pushService (FCM token registration + refresh)
│   └── widget/            # widgetSnapshot bridge writer
├── components/
│   ├── presence/          # PresenceCard, PresenceImage, HumanSyncBar, QuickStatusPill
│   ├── group/             # MemberRow, InviteCodeCard
│   ├── widget/            # WidgetGuideCard
│   └── ui/                # Avatar, Badge, Button, Card, Input, EmptyState, SkeletonLoader, ...
├── data/
│   ├── repositories/      # PresenceRepository, MemberRepository, SyncQueueRepository
│   └── supabaseClient.ts
├── database/              # SQLite init + schema (presences, members, groups,
│                          # images, sync_queue, sync_metadata)
└── navigation/            # RootNavigator + TabNavigator (Feed / Circle / You)
```

**Backend:** Supabase — Postgres (RLS + SECURITY DEFINER RPCs), Storage, Auth (Google OAuth), Realtime, Edge Functions  
**Push:** Firebase Cloud Messaging (silent data messages only — no banners, no sound)  
**State:** Zustand (auth, presence draft), TanStack Query  
**Local DB:** `@op-engineering/op-sqlite`  
**Background sync:** Android WorkManager + HeadlessJS (`BackgroundSyncWorker.kt`, `BackgroundSyncHeadlessService.kt`)

---

## Setup

**Prerequisites:** Node >= 22.11, Android Studio (JDK 17+) or Xcode, a Supabase project, a Firebase project (for FCM).

```bash
git clone <repo>
cd SIT
npm install

# iOS only
cd ios && bundle install && bundle exec pod install && cd ..
```

Create `.env` from `.env.example`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Apply migrations:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

Place your `google-services.json` (Android) in `android/app/`. For iOS, add `GoogleService-Info.plist` to the Xcode project.

Run:

```bash
npm start          # Metro bundler
npm run android    # or: npm run ios
```

---

## Database

Migrations live in `supabase/migrations/`. Tables: `groups`, `members`, `presences`, `images`, `invitations`, `push_devices`. `sync_queue` and `sync_metadata` are local-only (SQLite).

Row-level security on all Supabase tables — members read only within their own group. Invitations expire after 24 hours. Generating a new code atomically expires all previous codes for that group.

---

## Design constraints (intentional)

- One presence per member. Updating replaces, not appends.
- No public profiles, no discovery. Invite-only.
- Widget never touches the network directly — reads from local SQLite snapshot only.
- No continuous polling. Sync is event-driven (Realtime + FCM) with WorkManager as fallback.
- Signed image URLs are never stored in SQLite. Only UUIDs and `storage_path` are persisted; images are downloaded once to internal storage (`filesDir/media_cache/`).
- Images are resized and compressed before upload. Originals are discarded.

---

## Docs

`docs/` contains the full design record:

- `01-product/` — product constitution, requirements, and why this exists
- `02-architecture/` — system design and engineering standards
- `03-design/` — sync architecture, widget architecture, data model, API spec
