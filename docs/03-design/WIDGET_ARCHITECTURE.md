# WIDGET_ARCHITECTURE.md

# Stay in Touch

**Version:** 1.0  
**Status:** Approved

---

# 1. Purpose

This document defines the architecture of the Stay in Touch home screen widget.

The widget is a core feature of Version 0.1.

Its purpose is to allow a member to see their friends' latest Presence without opening the application.

The widget should feel like a quiet, ambient window into the group rather than another application interface.

---

# 2. Widget Philosophy

The widget follows three principles:

### Ambient

The user should be able to understand what is happening at a glance.

### Passive

The widget should not demand interaction.

### Lightweight

The widget should consume minimal:

- Battery
- Network
- Storage
- Memory

---

# 3. Widget Responsibilities

The widget is responsible for:

- Displaying current Presences.
- Displaying Presence images.
- Showing member names.
- Showing Presence descriptions.
- Showing relative update information where appropriate.
- Refreshing when local data changes.
- Continuing to display data while offline.

The widget is **not** responsible for:

- Authentication.
- Backend communication.
- Synchronization.
- Image downloading.
- Business logic.

---

# 4. High-Level Architecture

```text
                         Cloud
                           │
                           ▼
                   Synchronization
                        Engine
                           │
                           ▼
                    Local Database
                           │
                  ┌────────┴────────┐
                  │                 │
                  ▼                 ▼
             Mobile App          Widget
```

The widget is downstream from the application data layer.

---

# 5. Widget Data Source

The widget reads from local persisted data.

It must never make a network request simply to render itself.

The data flow is:

```text
Local Database
      ↓
Widget Data Adapter
      ↓
Widget State
      ↓
Widget UI
```

This allows the widget to render even when the device is offline.

---

# 6. Native Platform Boundary

The main application is built with React Native.

The home screen widget is platform-specific.

For the Android MVP:

```text
React Native Application
          │
          │
          ▼
Native Android Layer
          │
          ▼
Android App Widget
```

The widget should therefore be treated as a native Android component rather than a React Native screen.

---

# 7. React Native Responsibility

React Native is responsible for:

- Main application UI.
- Presence editing.
- Group display.
- Local data interaction.
- Synchronization orchestration.
- Triggering widget refreshes through the native bridge where required.

React Native should not directly render the widget.

---

# 8. Native Android Responsibility

The Android layer is responsible for:

- Widget provider.
- Widget lifecycle.
- Widget rendering.
- Widget refresh.
- Reading widget-compatible local data.
- Android-specific scheduling.
- Handling system widget events.

---

# 9. Shared Local Data

The application and widget need access to the same logical data.

The architecture should avoid maintaining two independent copies of Presence data.

Conceptually:

```text
                  Local State
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
   React Native App           Widget
```

The exact mechanism used to expose local data safely to the native widget will be finalized during implementation.

---

# 10. Widget Content

The initial widget should display:

```text
┌─────────────────────────────┐
│                             │
│       Friend Photo          │
│                             │
│  Aman                       │
│  "Working on my project"    │
│                             │
│  Updated 2h ago             │
│                             │
└─────────────────────────────┘
```

The exact visual design belongs to `UI_GUIDELINES.md`.

This document defines only the architecture.

---

# 11. Multiple Friends

The widget should support displaying multiple members.

However, the MVP should keep the presentation simple.

Possible initial layouts:

### Single Friend

```text
┌──────────────────────┐
│                      │
│       Photo          │
│                      │
│       Name           │
│       Presence       │
│                      │
└──────────────────────┘
```

### Friend Collection

```text
┌────────────────────────────┐
│ Photo   Name                │
│         Presence            │
│                            │
│ Photo   Name                │
│         Presence            │
└────────────────────────────┘
```

The exact widget size variants will be decided during implementation.

---

# 12. Widget Rotation

If the selected widget layout cannot display all members simultaneously, the widget may rotate between members.

Rotation should be:

- Predictable.
- Lightweight.
- System-scheduled.
- Independent of continuous background execution.

The widget must not run a permanent timer.

---

# 13. Rotation Data

The widget should determine its displayed member using locally available data.

For example:

```text
Members:

Aman
Riya
Akash
Neha
```

The widget can select:

```text
Aman
↓
Riya
↓
Akash
↓
Neha
```

The exact rotation algorithm is an implementation detail.

---

# 14. Widget Refresh Events

The widget should refresh when relevant data changes.

Primary triggers:

```text
Local Presence Updated
        ↓
Widget Refresh
```

and:

```text
Remote Presence Synchronized
        ↓
Local Database Updated
        ↓
Widget Refresh
```

Additional system-controlled refreshes may occur according to Android's widget lifecycle.

---

# 15. Own Presence Update

When the user updates their own Presence:

```text
Check In
   ↓
Local Database
   ↓
Widget Refresh
```

The user's widget should not wait for cloud synchronization.

---

# 16. Friend Presence Update

When another friend updates their Presence:

```text
Friend Device
      ↓
Cloud
      ↓
Synchronization
      ↓
Local Database
      ↓
Widget Refresh
```

This ensures the widget reflects the latest locally synchronized state.

---

# 17. Offline Behaviour

The widget must work without network access.

Example:

```text
Network unavailable

       ↓

Local Database

       ↓

Latest known Presence

       ↓

Widget
```

The widget should never become blank simply because the network is unavailable.

---

# 18. Image Handling

Images require special consideration because widget rendering must remain lightweight.

The application should:

1. Download the optimized image.
2. Store it locally.
3. Make it available to the widget.
4. Trigger widget refresh.
5. Allow the widget to use the local copy.

The widget should not independently download images from the cloud.

---

# 19. Image Cache

The widget should prefer an existing local image.

Conceptually:

```text
Presence
   ↓
Image ID
   ↓
Local Image
   ↓
Widget
```

If the image is temporarily unavailable, the widget should fall back gracefully.

Possible fallback:

```text
Profile Image
```

or a text-only representation.

---

# 20. Widget Data Freshness

The widget displays the latest state available locally.

It does not guarantee that the information is currently online.

This distinction is intentional.

For example:

```text
Last synchronized:
10:42 AM
```

The widget may display:

```text
Updated 15m ago
```

rather than pretending the information is live.

---

# 21. Widget State

The widget does not maintain an independent business state.

Its state is derived from:

- Local Members
- Local Presences
- Local Images
- Widget configuration

The widget should be disposable.

If Android destroys and recreates the widget, it should be able to reconstruct itself from persisted data.

---

# 22. Widget Lifecycle

The widget must respect Android lifecycle events.

Conceptually:

```text
Widget Added
    ↓
Initialize
    ↓
Read Local Data
    ↓
Render
    ↓
System Refresh / App Trigger
    ↓
Read Local Data
    ↓
Render
    ↓
Widget Removed
    ↓
Cleanup
```

The widget must not depend on the React Native JavaScript runtime remaining active.

---

# 23. Application Lifecycle Independence

The widget must continue functioning when:

- The application has not been opened recently.
- The application process has been terminated.
- The device has been restarted.
- The user is offline.

The widget must rely on persisted local data rather than an active React Native process.

---

# 24. Device Restart

After a device restart:

```text
Android
  ↓
Widget Restored
  ↓
Local Storage Available
  ↓
Widget Reads Data
  ↓
Widget Renders
```

The application does not need to be manually opened for the widget to display its last known state.

---

# 25. Widget Refresh Strategy

The system should use a combination of:

### Application-triggered refresh

Used when the application knows that relevant data has changed.

### System-triggered refresh

Used when Android requests widget updates.

### Scheduled refresh

Used only where required for time-based UI changes such as relative timestamps or rotation.

The implementation must respect Android's background execution constraints.

---

# 26. Relative Time

If the widget displays relative timestamps such as:

```text
5m ago
2h ago
Yesterday
```

the displayed value may become stale without a refresh.

The widget should therefore avoid excessively frequent updates.

The exact refresh interval should be determined during implementation based on Android's widget scheduling constraints.

---

# 27. Widget Interactions

The widget should remain primarily passive.

Limited interactions may include:

- Open application.
- Open a specific friend's Presence.
- Refresh where supported.

Interactions should never be required to understand the information displayed.

---

# 28. Security

The widget may expose information on the device lock screen depending on Android configuration.

The MVP should therefore avoid displaying sensitive information beyond what the user has intentionally chosen to share as their Presence.

The application should respect platform privacy settings.

---

# 29. Performance Requirements

The widget should:

- Render quickly.
- Use optimized images.
- Avoid unnecessary network access.
- Avoid large memory allocations.
- Avoid continuous background work.

---

# 30. Failure Handling

If local data is unavailable:

```text
Widget
  ↓
No Data
  ↓
Friendly Empty State
```

If an image is unavailable:

```text
Missing Image
    ↓
Fallback Representation
```

If synchronization has failed:

```text
Latest Local Data
    ↓
Display Normally
```

The widget should not expose technical synchronization errors.

---

# 31. Widget and Synchronization Boundary

The boundary is strict.

```text
                 Synchronization
                       │
                       ▼
                 Local Database
                       │
                       ▼
                    Widget
```

Never:

```text
Widget
  ↓
Backend
```

Never:

```text
Widget
  ↓
Sync Engine
```

The widget consumes synchronized local state.

---

# 32. Android Implementation Boundary

The Android implementation will likely contain:

```text
Native Android
│
├── Widget Provider
├── Widget Renderer
├── Widget Refresh Manager
└── Local Data Adapter
```

The React Native side will communicate with the native layer only when necessary.

The exact bridge implementation will be determined during the implementation phase.

---

# 33. Non-Goals

The MVP widget will not provide:

- Chat
- Real-time presence indicators
- Live location
- Continuous network updates
- Background services dedicated solely to the widget
- Complex widget configuration
- Multiple independent widget synchronization engines

---

# 34. Future Possibilities

The architecture leaves room for:

- Additional widget sizes.
- Multiple widget styles.
- iOS widgets.
- Friend-specific widgets.
- Timeline-based widgets.
- Custom rotation.
- Widget configuration.

These are not part of Version 0.1.

---

# 35. Widget Architecture Summary

The complete flow is:

```text
                  ┌──────────────┐
                  │    Cloud     │
                  └──────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Sync Engine   │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Local Storage │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Widget Adapter│
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │ Android Widget│
                 └───────────────┘
```

The central rule is:

> **The widget displays what the device already knows; it never goes looking for the data itself.**

This keeps the widget fast, offline-capable, resource-efficient, and aligned with the overall architecture of Stay in Touch.