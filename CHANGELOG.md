# Change Log - Stay in Touch (SIT)

All notable changes, architectural decisions, database schema migrations, and bug fixes for **Stay in Touch** are documented in this file chronologically.

---

## [0.2.0] - 2026-08-21

### Added
* **Silent Push Notifications & FCM Integration (`pushService.ts`, `00008_push_devices.sql`, `00009_presence_push_webhook.sql`)**:
  * Created `public.push_devices` database table with Row Level Security (RLS) and idempotent `register_push_device` / `deactivate_push_device` RPCs.
  * Implemented client `PushService` managing non-blocking permission requests (`POST_NOTIFICATIONS` on Android 13+ / iOS), FCM token registration with masked token logging, token refresh hooks, and foreground message handlers.
  * Configured PostgreSQL database triggers and webhooks (`00009_presence_push_webhook.sql`) to trigger Supabase `dispatch-presence-push` Edge Function and deliver silent FCM data wake-up messages upon presence and member database mutations.
* **Native Android WorkManager & Headless JS Sync (`BackgroundSyncWorker.kt`, `BackgroundSyncHeadlessService.kt`, `backgroundSyncTask.ts`)**:
  * Implemented native `BackgroundSyncWorker.kt` (using Android `WorkManager` & `CoroutineWorker`) with `CONNECTED` network constraints for both unique one-time background syncs (`enqueueOneTimeWork`) and 15-minute periodic background sync fallback (`schedulePeriodicWork`).
  * Created `BackgroundSyncHeadlessService.kt` (`HeadlessJsTaskService`) and `backgroundSyncTask.ts` to execute `syncEngine.syncAll()` even when the application UI is closed or terminated.
  * Registered `BackgroundSyncHeadlessService` service in `AndroidManifest.xml`.
* **Bottom Floating Tab Navigation (`TabNavigator.tsx`, `GroupScreen.tsx`, `ProfileScreen.tsx`)**:
  * Replaced single feed view with a floating bottom tab navigation bar featuring three dedicated screens: **Feed** (`HomeScreen`), **Circle** (`GroupScreen`), and **You** (`ProfileScreen`).
  * Created lightweight custom vector-like tab icons without external icon library dependencies.
  * Created dedicated `GroupScreen.tsx` for offline group management, member roster, owner controls, and invitation code generation.
  * Created dedicated `ProfileScreen.tsx` for profile picture framing, user settings, and secure sign-out.
* **Modular Component Architecture & Testing Infrastructure**:
  * Extracted component directories (`src/components/group/`, `src/components/presence/`, `src/components/ui/`, `src/components/widget/`).
  * Added Firebase messaging mock (`__mocks__/@react-native-firebase/messaging.js`) ensuring Jest unit test suites pass without native Firebase runtime binaries.

### Changed
* Integrated automatic FCM device registration into `authStore.ts` upon user sign-in or session restoration, and token deactivation upon sign-out.

---

## [0.1.7] - 2026-08-15

### Added
* **Atomic Invitation Expiration (`00003_invitation_atomic_expiration.sql`)**:
  * Updated `generate_invitation` RPC to set `status = 'expired'` and `expires_at = NOW()` on all previous active group invitation codes in the same atomic PostgreSQL transaction.
  * Added stale invitation database cleanup marking expired codes (`expires_at <= NOW()`) as `'expired'`.
* **Interactive Image Framing Editor (`ImageEditorModal.tsx`)**:
  * Created `ImageEditorModal.tsx` providing touch pan/drag and zoom controls (`-` / `+` / reset) for framing Profile Pictures and Presence status photos.
  * Added Dual Realtime Previews matching both the **App Feed Card** layout and the **Android Native Widget** (including avatar circular shader) from a single unified crop state.
  * Added `cropAndResizeImage` in `WidgetBridgeModule.kt` and `imagePipeline.ts`, cropping and scaling images locally to persistent storage (`filesDir/media_cache/crop_img_{hash}.jpg`) with zero network dependencies.
### Changed
* **Direct Image Selection Restored**: Restored direct photo attachment from Camera and Gallery in `CheckInScreen.tsx` and `HomeScreen.tsx` without intermediate crop modal interception.

### Fixed
* Fixed a runtime error (`Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL`) by enforcing valid HTTP URL validation and defaults in `src/config/env.ts` and `src/data/supabaseClient.ts`.
* Fixed presence image horizontal stretching by adding explicit `resizeMode="cover"` to presence cards and previews.

---

## [0.1.6] - 2026-08-14

### Added
* **Environment Configuration**:
  * Created root `.env` configuration file and `.env.example` template for client-side configuration parameters (`SUPABASE_URL` and `SUPABASE_ANON_KEY`).
  * Updated `.gitignore` to exclude `.env` and `.env.local` files from version control.
* **Cross-Device Profile Picture Synchronization**:
  * Updated `syncPush.ts` `UPDATE_PROFILE` handler to reconcile the uploader's local SQLite `images` and `members` tables with remote UUIDs upon successful cloud push.
  * Updated `syncPull.ts` media downloader to register BOTH `storage_path` and `image.id` (UUID) in `imageResolver.setLocalFileUri()`.
  * Refactored `imageResolver.ts` to perform dual-key memory & persistent disk checks (`filesDir/media_cache/media_img_{hash}.jpg`), keeping Repositories, HomeScreen UI, and native Android Widget 100% network-free.

---

## [0.1.5] - 2026-08-13

### Added
* **Reinstall Recovery & Auto-Sync Engine**:
  * Implemented explicit SQLite `ON CONFLICT(id) DO UPDATE SET ...` UPSERT statements in `MemberRepository.ts` (`upsertMember()`, `upsertGroup()`). `NULL` profile image IDs are treated as authoritative to clear removed avatars during cloud reconciliation.
  * Centralized startup synchronization in `authStore.ts` upon session restoration, `createGroup()`, and `joinGroup()`, persisting current member/group records locally and triggering `syncEngine.syncAll()`.
  * Rebuilt complete group state reconstruction in `syncPull.ts`: pulls authoritative `groups`, `members`, `images` metadata, and `presences` directly using `.in('member_id', memberIds)`.
  * Atomic batch reconciliation executed in a single native SQLite transaction (`db.executeBatch()`).
  * Safe remote member and presence deletion reconciliation executed only after 100% remote query success.
  * Single widget snapshot update (`widgetSnapshotService.updateAndNotifyWidget()`) published after complete reconciliation.
* **Persistent Local Disk Media Downloader**:
  * Implemented `downloadAndCacheMedia()` and `getLocalMediaFile()` in `WidgetBridgeModule.kt`, enabling the Sync Engine (`syncPull.ts`) to download remote images to persistent internal device storage (`filesDir/media_cache/media_img_{hash}.jpg`).
  * Enforced strict rule: **Temporary signed URLs are NEVER stored as durable SQLite state.** SQLite database stores ONLY permanent image UUIDs and `storage_path`.
  * Refactored `imageResolver.ts` to perform 100% network-free, synchronous/local file resolution against local disk storage.
  * Ensures member profile avatars and presence photos persist on disk across app restarts, device reboots, and 100% offline usage.

### Fixed
* Fixed an issue where raw image UUIDs stored in SQLite `presences` and `members` tables prevented presence photos and member profile avatars from displaying on `HomeScreen` and `GroupInfoModal`.
* Fixed `syncEngine` concurrency lock to re-use and await active in-flight sync Promises during concurrent reconciliation calls.

---

## [0.1.4] - 2026-08-10

### Added
* **Batched Profile Image Resolution**: Implemented batched storage path resolution in `syncPull.ts` (`SELECT id, storage_path FROM images WHERE id IN (...)`), querying all missing profile image UUIDs in a single query rather than sequential requests.
* **Persistent Widget Media Storage**: Updated native Android widget media pipeline to store cached presence photos and profile avatars in `context.filesDir/widget_media/`. This guarantees widget media persistence even if Android's system cache cleaner purges temporary `cacheDir` files.
* **Circular Widget Avatar Shader**: Implemented `getCircularBitmap()` in `StayInTouchWidgetProvider.kt` using Android `BitmapShader` and `Canvas.drawCircle()`, rendering rounded profile picture avatars next to member names on the Home Screen Widget.
* **Obsolete Media Cleanup**: Added `cleanupObsoleteMedia()` in `StayInTouchWidgetProvider.kt` to purge unreferenced `.jpg` files from persistent media storage when presences or profile pictures are deleted.
* **Defensive URI Scheme Validation**: Added `isValidImageUri()` in `HomeScreen.tsx` to validate URI schemes (`http://`, `https://`, `file://`, `content://`, `/`). Prevents raw UUID strings from reaching React Native `<Image>` and gracefully falls back to crisp member initial badges.

### Fixed
* Fixed an issue where PostgREST relation embedding failure caused `syncPull.ts` to assign raw UUID strings to member profile URLs, rendering a blank space on co-members' devices.
* Optimized native widget tap cycling handler to decode pre-cached disk files in under $2\text{ ms}$ with **zero** network requests.

---

## [0.1.3] - 2026-08-09

### Added
* **Structural Feed Layout Hierarchy**: Redesigned `HomeScreen.tsx` feed into a two-tier sectioned hierarchy:
  * **`YOUR STATUS`** (Top): Anchored current user card featuring an gold accent border (`colors.primary`), an elevated card surface, a prominent **`YOU`** badge, and a **`🗑️ Clear Status`** action button (or check-in action if inactive).
  * **`FRIENDS`** (Bottom): Read-only presence cards displaying co-members' status updates.
* **Group Info & Members List Modal**: Added a **`🔒 Group Name`** header badge button that opens an offline-first modal displaying group details, total member count, member avatars/initials, joined dates, and owner indicator (`👑 Owner`).
* **Realtime Postgres Listener**: Built `realtimeSyncListener.ts` managed by `AppState` lifecycle, subscribing to Supabase Realtime `postgres_changes` on `presences` and `members` tables. Automatically triggers `syncEngine.syncAll()` on foreground or remote database changes.
* **Camera Photo Capture**: Added Android CAMERA runtime permission checks (`PermissionsAndroid.request(CAMERA)`) and direct camera capture capabilities in `imagePipeline.ts` and `CheckInScreen.tsx`.
* **Local-First Presence Deletion**: Added `PresenceRepository.deletePresenceTransaction()` providing $0\text{ ms}$ local SQLite deletion, immediate feed/widget updates, and background cloud cleanup of remote presence rows, image metadata, and storage objects.
* **Member Profile Management**: Created `MemberRepository.ts` for atomic SQLite profile updates (`UPDATE_PROFILE` sync queue) and added an **Edit Profile Modal** on `HomeScreen.tsx`.

### Changed
* Removed duplicate `👥 Group` header button from `headerActions`, consolidating group info review into the `🔒 Group Name` badge trigger.

---

## [0.1.2] - 2026-08-09

### Added
* **Database Migration `00002_invitation_expiration_and_rls_fix.sql`**:
  * **24-Hour Invitation Code Expiration**: Updated `generate_invitation` RPC to set `expires_at = NOW() + INTERVAL '24 hours'`. Automatically revokes older active group codes (`status = 'expired'`) whenever a new code is generated.
  * **Expiration Enforcement**: Updated `join_group_with_code` RPC to validate `expires_at > NOW()`, auto-expire outdated codes, normalize code strings (`UPPER(TRIM(...))`), and preserve row locking (`FOR UPDATE`). Rejects expired codes with a clear error message.
  * **Group-Aware Profile Image RLS**: Updated `public.images` `FOR SELECT` policy to grant authenticated group members read access if the image is referenced by either `presences.image_id` OR `members.profile_image_id` of a member in the user's group (`public.is_group_member(m.group_id)`).

### Fixed
* Fixed an offline authentication bug in `authStore.ts` where launching the app without internet connection caused `api.getCurrentMember()` network failures, incorrectly redirecting logged-in users to the sign-in screen. `initializeAuth()` now checks local SQLite `members` table first for immediate offline startup.

---

## [0.1.1] - 2026-08-08

### Added
* **Android Home Screen Widget**: Built a native Android App Widget (`StayInTouchWidgetProvider.kt`, `stay_in_touch_widget.xml`).
* **Native Widget Bridge**: Created React Native bridge (`WidgetBridge.kt`, `WidgetBridgeModule.kt`) to project SQLite presences state into `widget_snapshot.json`.
* **Touch-to-Cycle Action**: Implemented broadcast receiver `com.sit.ACTION_WIDGET_NEXT` enabling users to tap the widget on their phone's Home Screen to cycle through group members' updates offline.

---

## [0.1.0] - 2026-08-07

### Added
* **Project Foundation**: Initialized React Native TypeScript codebase for **Stay in Touch (SIT)**.
* **Local-First SQLite Engine**: Configured local database storage using `@op-engineering/op-sqlite` (`presences`, `members`, `groups`, `images`, `sync_queue`, `sync_metadata`).
* **Authentication**: Configured Supabase Auth with Google OAuth deep-link handler (`sit://auth/callback`).
* **Background Sync Engine**: Built two-way reconciliation engine (`syncPush.ts`, `syncPull.ts`, `syncEngine.ts`) executing queued DDL operations and cursor-based remote pulls.
* **Database Migration `00001_initial_schema.sql`**: Hardened Supabase schema with RLS policies and `SECURITY DEFINER` RPCs (`create_group`, `join_group_with_code`, `generate_invitation`).
