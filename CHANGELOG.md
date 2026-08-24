# Change Log - Stay in Touch (SIT)

All notable changes, architectural decisions, database schema migrations, and bug fixes for **Stay in Touch** are documented in this file chronologically.

---

## [0.4.0] - 2026-08-24

### Added

* **Notification Preferences Store (`notificationPreferencesStore.ts`)**:
  * Introduced `useNotificationPreferencesStore` (Zustand) for persisting the user's notification on/off preference.
  * Preference persisted to local SQLite via `kvStorage` under the key `@sit_notifications_enabled`.
  * Loaded eagerly at app startup (`App.tsx`) before the database initialises, ensuring notification gating decisions are never made on uninitialised state.

* **Notification Type Contracts (`notificationTypes.ts`)**:
  * Added `NotificationDestination` union type: `'Today' | 'Group' | 'Profile' | 'CheckIn' | 'Settings'`.
  * Added `SITNotificationPayload` and `PendingNotificationNavigation` interfaces, standardising the shape of notification data across FCM, Notifee, and navigation integration.

* **KV Storage Layer (`kvStorage.ts`)**:
  * Lightweight key-value store backed by the existing `sync_metadata` SQLite table, replacing any dependency on `AsyncStorage` for simple persistent flags.
  * Exposes `getItem`, `setItem`, and `removeItem`. Errors are swallowed gracefully — callers receive `null` on read failure without crashing.

* **`ConfirmModal` Component (`src/components/ui/ConfirmModal.tsx`)**:
  * Reusable modal for destructive confirmations. Replaces inline `Alert.alert` calls for presence deletion and other irreversible actions.
  * Supports `isDestructive` styling, `isLoading` lock during async operations, and backdrop-tap-to-dismiss. Accessible (`accessibilityViewIsModal`, `accessibilityRole="header"`, `accessibilityLiveRegion`).

* **Reversible Undo Toast on Check-In (`HomeScreen.tsx`, `CheckInScreen.tsx`)**:
  * After a successful check-in, `CheckInScreen` navigates back to the `Today` tab passing `showUndoToast`, `undoPresenceId`, `undoMemberId`, and `undoStatusText` as route params.
  * `HomeScreen` reads those params and renders a 5-second auto-dismissing banner: *"Status updated: '...'"* with a one-tap **Undo** button.
  * Undo calls `PresenceRepository.deletePresenceTransaction({ memberId, presenceId })`, reloads the feed, updates the widget, and triggers a background sync — all in one action with no confirmation dialog required.

* **`PresenceRepository.getActivePresenceForMember()` (`PresenceRepository.ts`)**:
  * New single-row optimised query that joins `presences`, `members`, and `images` for a given `memberId` in one SQLite call.
  * Used by `MemberDetailScreen` instead of the full `getAllGroupPresences()` scan, reducing unnecessary data processing.
  * `deletePresenceTransaction` signature extended to accept either a plain `memberId: string` or a structured `{ memberId, presenceId }` object for undo-aware deletion.

* **Phase 4.5 Test Suite (`__tests__/phase4_5.test.ts`)**:
  * Three test groups covering: dual notification channel registration, preference-gated notification suppression, `PRESENCE_DELETED` banner suppression, `getActivePresenceForMember` single-query contract, and `deletePresenceTransaction` object-target signature.

### Changed

* **`notificationService.ts` — Dual Channel + Deduplication + Preference Gating**:
  * Now registers two Notifee channels on startup: `presence_updates_v2` (`AndroidImportance.HIGH`, sound + vibration) for opted-in users and `presence_updates_quiet_v2` (`AndroidImportance.LOW`, silent) for default quiet mode.
  * Added a `shouldShowPresenceNotification()` decision layer that checks: `PRESENCE_DELETED` event type (always suppressed), preference store loaded state (conservative: do not notify until loaded), user preference toggle, and OS permission status. FCM reception and background `syncAll()` are entirely unaffected by this gating.
  * Added a 10-second in-memory deduplication window (`recentEvents` map) to prevent duplicate banners for rapid successive FCM deliveries on the same `presenceId` or `actorId`.
  * Notification now reads `notificationPreferencesStore` before displaying — if the user has disabled notifications, `showPresenceUpdateNotification` returns `null` immediately without touching Notifee.

* **`notificationNavigation.ts` — Persistent Cold-Start Destination**:
  * `setPendingDestination` now persists the pending navigation intent to `kvStorage` so it survives app termination. `loadStoredDestination()` restores it on cold start.
  * `consumePendingDestination` clears both the in-memory value and the persisted `kvStorage` entry atomically.

* **`RootNavigator.tsx` — Navigation Infrastructure**:
  * Exports a typed `navigationRef` (`createNavigationContainerRef<RootStackParamList>`) for imperative navigation from outside the component tree (notification tap handlers).
  * Added `useEffect` to call `notificationNavigation.loadStoredDestination()` on mount for cold-start tap recovery.
  * `Settings` and `MemberDetail` registered as stack screens, enabling deep-link navigation from notification taps.

* **`CheckInScreen.tsx` — 1-Tap Quick Check-In + Auto-Crop**:
  * Tapping a `QuickStatusPill` now immediately executes the full check-in without requiring the user to tap a secondary save button, reducing the action to a single tap.
  * Photo selection auto-crops and scales the image without forcing the `ImageEditorModal` interstitial for standard picks, reducing friction on the happy path. Editor modal remains accessible for manual framing.

* **`HomeScreen.tsx` — Clear Presence via `ConfirmModal`**:
  * Replaced inline `Alert.alert` for presence deletion with the new `ConfirmModal`, providing a more integrated, dismissible UX.
  * Sync error state now surfaces via `ErrorState` component with a retry button rather than a silent failure.
  * Offline state shown with a truthful inline banner: *"⚡ Offline mode — Last updated X ago"* rather than silently hiding staleness.

* **`App.tsx`**:
  * `useNotificationPreferencesStore.getState().loadPreferences()` called before database initialization, ensuring notification preferences are restored from SQLite before any sync or notification event could fire.

---

## [0.3.0] - 2026-08-24


### Added

* **Visible Presence Push Notifications (`notificationService.ts`, `notificationNavigation.ts`)**:
  * Introduced `notificationService.ts` built on `@notifee/react-native` to display human-friendly local presence notifications.
  * Notification format: `"{Name} • Circle Update"` title with a `💬 "{truncated description}"` body. Falls back gracefully to a generic message when actor identity or description is unavailable.
  * Actor name and description resolved via a two-tier lookup: explicit FCM payload fields first, then local SQLite (`MemberRepository`, `PresenceRepository`) as a deterministic fallback — ensuring a notification is always meaningful even if the payload was sparse.
  * Created `notificationNavigation.ts` to handle pending navigation intents from notification taps safely, after auth is resolved and the navigator is ready. Supports foreground press, background press, and cold-start launch-from-notification paths.
  * `pushService.ts` updated to initialize the Android notification channel (`AndroidImportance.HIGH` with sound + vibration) and register all Notifee tap event listeners on device registration.
  * Added `__mocks__/@notifee/react-native.js` to ensure Jest unit tests pass without native Notifee binaries.

* **Member Detail Screen (`MemberDetailScreen.tsx`)**:
  * New dedicated screen to view a single group member's profile and current presence in full.
  * Displays avatar, display name, last check-in timestamp, presence photo, and caption.
  * Explicitly guarded against gamification: no streaks, check-in counts, frequency metrics, or engagement badges per product constitution.

* **Settings Screen (`SettingsScreen.tsx`)**:
  * New dedicated settings screen under the **You** tab.
  * Sections: Notification Preferences, Home Screen Widget setup guide (collapsible accordion), Privacy & Account (sign-out).
  * Notification toggle maps to Attention Level 3 only (quiet circle check-in alert). Hard-coded constraint prevents escalation to Level 4/5 disruptive alerts.
  * Widget guide section reuses `WidgetGuideCard` component, collapsed by default.

* **Custom Typography System (`fonts.ts`, `typography.ts`, `Text.tsx`)**:
  * Introduced `fonts.ts` defining two distinct font families: **Manrope** (UI structure, navigation, buttons, headers, body) and **Caveat** (presence captions, status notes — limited to emotional expression contexts only).
  * Added `typography.ts` with 10 semantic presets: `display`, `h1`, `h2`, `h3`, `subtitle`, `body`, `bodySmall`, `label`, `micro`, `note`.
  * Built `Text.tsx` — a typed, variant-aware wrapper around React Native's `<Text>` that consumes the typography system. `includeFontPadding: false` applied globally to prevent Android baseline inconsistencies.
  * Fonts registered via `react-native.config.js` (`assets: ['./assets/fonts/']`) and bundled into `android/app/src/main/assets/fonts/` for native rendering.
  * Font assets (`assets/fonts/`): Manrope (Regular, Medium, SemiBold, Bold, ExtraBold) and Caveat (Regular, Medium, Bold).

* **`ErrorState` Component (`src/components/ui/ErrorState.tsx`)**:
  * New reusable error display component: names what failed, names what remains safe locally, and offers a retry action.
  * Never exposes raw technical error strings or blaming language per product design guidelines.

* **`HumanSyncBar` Component (`src/components/presence/HumanSyncBar.tsx`)**:
  * Lightweight inline sync status indicator rendered on presence cards.
  * Shows contextual human language: *"Saved locally · Syncs online"* (pending), *"↻ Syncing with your circle..."* (syncing), *"● Offline"* (no connection). Returns `null` when status is `synced`.

* **`QuickStatusPill` Component (`src/components/presence/QuickStatusPill.tsx`)**:
  * Horizontally scrollable row of quick-select status pills on the check-in screen.
  * Driven by a `QUICK_STATUSES` constant from `theme.ts`, each pill auto-fills the description field with a preset emoji + label combination.

### Changed

* **Tab Navigation renamed**: Tab labels updated from `Feed / Group / Profile` to `Today / Circle / You` to better reflect the product's ambient, relationship-first identity.
* **TabNavigator icons updated**: Custom vector-style tab icons rebuilt without any external icon library dependency.
* **`pushService.ts`**: Now imports and initialises `notificationService` during device token registration — wiring the full foreground + background tap handling lifecycle in one call.

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
