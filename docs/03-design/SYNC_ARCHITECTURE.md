# SYNC_ARCHITECTURE.md

# Stay in Touch

**Version:** 1.0  
**Status:** Approved

---

# 1. Purpose

This document defines how Stay in Touch synchronizes Presence data between the cloud and users' devices.

The synchronization system must provide:

- Fresh Presence data
- Offline functionality
- Low battery usage
- Low network usage
- Reliable recovery from failures
- Automatic widget updates

Synchronization should remain mostly invisible to the user.

---

# 2. Core Principle

Stay in Touch uses a **Local-First Synchronization Architecture**.

The application does not wait for the network before updating the user's experience.

The basic flow is:

```text
User Action
    ↓
Local Database
    ↓
UI / Widget
    ↓
Synchronization
    ↓
Cloud
```

For other members:

```text
Cloud
   ↓
Update Signal
   ↓
Device Synchronization
   ↓
Local Database
   ↓
Widget / App
```

---

# 3. Two-Sided Data Model

Synchronization exists between two persistent data stores.

```text
┌──────────────────┐
│  Local Database  │
│     Device A     │
└────────┬─────────┘
         │
         ↕
┌────────┴─────────┐
│      Cloud       │
└────────┬─────────┘
         ↕
┌────────┴─────────┐
│  Local Database  │
│     Device B     │
└──────────────────┘
```

The cloud allows different devices to converge on the latest group state.

The local database allows each device to function independently while offline.

---

# 4. Source of Truth

There are two different concepts of truth.

## Local Truth

The local database is the source used by:

- UI
- Widget
- Local application logic

This provides immediate and offline access.

---

## Cloud Truth

The cloud is the shared synchronization authority.

It represents the state that should eventually be shared across all members.

---

## Important Distinction

The local database is **not merely a disposable cache**.

It is a persistent local representation of the application state.

The synchronization system is responsible for keeping the local and cloud representations consistent.

---

# 5. Synchronization Direction

There are two synchronization directions.

## Upload

```text
Device
  ↓
Cloud
```

Used when the local member creates or updates a Presence.

---

## Download

```text
Cloud
  ↓
Device
```

Used when another member updates their Presence.

---

# 6. Presence Update Flow

When a member checks in:

```text
Select Photo
      ↓
Write Description
      ↓
Check In
      ↓
Validate
      ↓
Update Local Database
      ↓
Update UI
      ↓
Update Widget
      ↓
Add Sync Operation
      ↓
Background Upload
      ↓
Cloud
```

The user does not need to wait for the upload.

---

# 7. Image Synchronization

Images follow a separate media flow.

```text
Original Image
      ↓
Resize
      ↓
Compress
      ↓
Store Local Upload
      ↓
Upload
      ↓
Cloud Storage
      ↓
Receive Image Reference
      ↓
Associate With Presence
```

The original camera image should not be retained as the application's Presence image.

---

# 8. Sync Queue

Local changes that have not yet reached the cloud are represented as pending synchronization operations.

Conceptually:

```text
Sync Queue

┌─────────────────────────┐
│ Presence Update         │
│ Status: Pending         │
└─────────────────────────┘
```

A successful synchronization removes the operation from the pending queue.

A failed synchronization leaves the operation available for retry.

---

# 9. Synchronization States

A Presence can have the following local synchronization states:

```text
Draft
  ↓
Pending
  ↓
Syncing
  ↓
Synced
```

If synchronization fails:

```text
Syncing
   ↓
Failed
   ↓
Pending
   ↓
Retry
```

The user-facing Presence remains available throughout this process.

---

# 10. Upload Reliability

Uploads should be safe to retry.

For example:

```text
Upload
  ↓
Network Failure
  ↓
Retry
```

The retry must not create duplicate Presences.

Synchronization operations should therefore be designed to be idempotent wherever possible.

---

# 11. Download Synchronization

A device should not download the entire group's data every time synchronization occurs.

Instead, synchronization should be incremental.

Conceptually:

```text
Last Successful Sync
        ↓
Request Changes Since
        ↓
Receive Changed Data
        ↓
Apply Local Changes
        ↓
Update Sync Timestamp
```

This reduces:

- Network usage
- Battery usage
- Processing
- Data transfer

---

# 12. Synchronization Timestamp

The device maintains a local synchronization timestamp.

Example:

```text
lastSuccessfulSync = 2026-08-08T08:00:00Z
```

The next synchronization requests changes after that point.

The exact timestamp implementation will be finalized during backend implementation.

---

# 13. Update Detection

A device needs a way to discover that another member has changed their Presence.

The architecture supports two complementary mechanisms.

## Primary — Push-Triggered Synchronization

When the backend detects a relevant change, the affected devices may receive a background update signal.

The signal does not need to contain the complete Presence.

Instead, it tells the application:

> "New data may be available."

The application then performs a normal synchronization.

```text
Friend Updates
      ↓
Cloud
      ↓
Background Update Signal
      ↓
Device Wakes
      ↓
Sync
      ↓
Local Database
      ↓
Widget Refresh
```

---

## Fallback — Periodic Synchronization

Push delivery cannot be assumed to be perfectly reliable.

The application therefore performs periodic background synchronization when the operating system permits it.

```text
Scheduled Background Work
          ↓
        Sync
          ↓
Check for Missed Updates
```

This provides eventual recovery when:

- Device was offline
- Push was missed
- Background execution was delayed
- Device was restarted
- Operating system deferred background work

---

# 14. No Continuous Polling

The application must never continuously poll the backend.

Avoid:

```text
Every 5 seconds
Every 10 seconds
Every 30 seconds
```

This would provide little value while increasing:

- Battery consumption
- Network usage
- Backend requests

Stay in Touch does not require second-by-second synchronization.

---

# 15. Widget Synchronization

The widget does not participate in cloud synchronization.

Instead:

```text
Cloud
  ↓
Application Sync
  ↓
Local Database
  ↓
Widget Refresh
```

This keeps the widget:

- Fast
- Offline-capable
- Lightweight
- Independent of network availability

---

# 16. Own Device Update

When the current user updates their Presence:

```text
Check In
   ↓
Local Database
   ↓
Widget
```

The user's own widget can therefore update immediately.

The backend does not need to respond first.

---

# 17. Other Device Update

When another member updates:

```text
Friend Device
      ↓
Cloud
      ↓
Update Signal / Periodic Sync
      ↓
Local Database
      ↓
Widget
```

The update becomes visible after synchronization completes.

---

# 18. Offline Behaviour

When there is no network:

```text
                    OFFLINE

App
 ↓
Local Database
 ↓
Existing Presences

New Check-In
 ↓
Local Database
 ↓
Sync Queue
```

The application continues functioning.

The new Presence remains pending until connectivity returns.

---

# 19. Reconnection

When connectivity returns:

```text
Network Available
       ↓
Synchronization Starts
       ↓
Upload Pending Changes
       ↓
Download Remote Changes
       ↓
Update Local Database
       ↓
Refresh Widget
       ↓
Mark Sync Complete
```

---

# 20. Conflict Handling

The MVP has deliberately simple conflict requirements.

Each member owns one Presence.

A member's Presence is normally modified only by that member.

Therefore, complex collaborative conflict resolution is unnecessary.

---

## Current-State Rule

For the same member:

> The latest valid Presence update becomes the active Presence.

The exact conflict timestamp and ordering mechanism will be finalized during backend implementation.

---

# 21. Synchronization Ordering

When a device both has local pending changes and receives remote changes, synchronization should follow a deterministic process.

Recommended order:

```text
1. Read Local Pending Operations
        ↓
2. Upload Pending Changes
        ↓
3. Download Remote Changes
        ↓
4. Resolve Any Conflicts
        ↓
5. Commit Local State
        ↓
6. Refresh Widget
        ↓
7. Mark Sync Successful
```

This avoids treating partially synchronized state as complete.

---

# 22. Failure Handling

Synchronization can fail because of:

- No network
- Timeout
- Authentication expiration
- Backend unavailable
- Image upload failure
- Storage failure
- Invalid remote data

Failures should not destroy local data.

---

## Example

```text
Presence Updated
      ↓
Upload Failed
      ↓
Local Presence Remains
      ↓
Status = Pending
      ↓
Retry Later
```

---

# 23. Authentication Failure

If synchronization fails because the session is invalid:

```text
Sync
 ↓
Authentication Failure
 ↓
Refresh Session
 ↓
Retry
```

If session recovery fails:

```text
Require User Authentication
```

The local data remains available.

---

# 24. Image Upload Failure

If the Presence text succeeds but the image upload fails, the application must not silently discard the user's Presence.

The synchronization system should preserve the pending operation and retry the image upload.

The exact transactional behaviour between image storage and Presence metadata will be finalized during backend implementation.

---

# 25. Sync Completion

A synchronization cycle is considered successful only when:

- Pending changes have been handled.
- Remote changes have been applied.
- Local database state is consistent.
- Sync metadata has been updated.
- Widget refresh has been requested where necessary.

---

# 26. Widget Refresh Rules

A widget refresh should be requested after:

- Local Presence update
- Successful remote Presence synchronization
- Relevant image synchronization
- Scheduled widget rotation

The widget should not refresh unnecessarily when no displayed information has changed.

---

# 27. Network Efficiency

Synchronization should minimize transferred data.

Use:

- Incremental updates
- Optimized images
- Small payloads
- Cached resources
- Local comparison where possible

The application should never download an image again if the locally cached version is still valid.

---

# 28. Battery Efficiency

Background synchronization should:

- Use operating-system scheduling.
- Group work where possible.
- Avoid unnecessary wakeups.
- Avoid continuous services.
- Avoid repeated retries during prolonged failure.

The synchronization system should prioritize eventual consistency over aggressive freshness.

---

# 29. Data Consistency Model

Stay in Touch does not require strict real-time consistency.

The system uses:

> **Eventual Consistency**

A member's update should eventually propagate to all other members.

Temporary differences between devices are acceptable.

Example:

```text
Friend A
Updated: 10:00

Cloud
Updated: 10:00

Friend B
Updated: 09:45
```

Until Friend B synchronizes.

After synchronization:

```text
Friend B
Updated: 10:00
```

This trade-off allows the application to remain lightweight and battery efficient.

---

# 30. Freshness Expectations

The product does not require instant synchronization.

The goal is:

> **Fresh enough to feel alive without continuously consuming resources.**

Push-triggered synchronization should provide fast updates when the platform allows it.

Periodic synchronization provides recovery when push delivery is delayed or unavailable.

---

# 31. Sync Architecture Overview

The complete architecture is:

```text
                     ┌──────────────┐
                     │    Cloud     │
                     │              │
                     │ Group        │
                     │ Members      │
                     │ Presences    │
                     │ Images       │
                     └──────┬───────┘
                            │
                    Push / Background
                       Sync Signal
                            │
                            ▼
┌──────────────────────────────────────────┐
│                 Device                  │
│                                          │
│  ┌──────────────┐                        │
│  │ Sync Engine  │                        │
│  └──────┬───────┘                        │
│         │                                │
│         ▼                                │
│  ┌──────────────┐                        │
│  │ Local DB     │◄─────────────┐         │
│  └──────┬───────┘              │         │
│         │                      │         │
│     ┌───┴────┐                 │         │
│     ▼        ▼                 │         │
│    App     Widget              │         │
│                                │         │
│  Sync Queue ───────────────────┘         │
│                                          │
└──────────────────────────────────────────┘
```

---

# 32. Core Synchronization Loop

The complete system can be reduced to:

```text
          ┌──────────────┐
          │ Local State  │
          └──────┬───────┘
                 │
                 ▼
          Pending Changes
                 │
                 ▼
              Cloud
                 │
                 ▼
          Remote Changes
                 │
                 ▼
          Local Database
                 │
          ┌──────┴───────┐
          ▼              ▼
         App           Widget
```

The loop continues whenever synchronization is required.

---

# 33. Synchronization Responsibilities

## Mobile Application

Responsible for:

- Local persistence
- Sync queue
- Uploading changes
- Downloading changes
- Retry
- Applying remote state
- Triggering widget refresh

---

## Backend

Responsible for:

- Persisting shared state
- Authenticating requests
- Providing changed data
- Storing images
- Providing synchronization signals where supported

---

## Widget

Responsible only for:

- Reading local data
- Rendering current information
- Refreshing when requested

The widget has no synchronization responsibility.

---

# 34. Non-Goals

The synchronization system will not provide:

- Real-time collaborative editing
- WebSocket-based continuous connections
- Second-by-second synchronization
- Cross-device editing of the same Presence
- Offline conflict resolution between multiple simultaneous editors

These are unnecessary for the MVP.

---

# 35. Future Considerations

The synchronization architecture can later evolve to support:

- Presence history
- Multiple groups
- More granular synchronization
- Additional device platforms
- More advanced conflict resolution

Such changes require new architecture decisions if they materially affect the current model.

---

# 36. Final Principle

The synchronization system should follow one rule:

> **Keep every device reasonably fresh without making the device constantly work.**

Stay in Touch should feel connected without behaving like a constantly running service.

The ideal synchronization system is one the user rarely notices.