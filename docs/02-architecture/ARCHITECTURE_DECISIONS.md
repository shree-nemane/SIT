# ARCHITECTURE_DECISIONS.md

# Stay in Touch

**Version:** 1.0  
**Status:** Approved

---

# Purpose

This document is the index and summary of the major architectural decisions made for Stay in Touch.

Architecture Decision Records (ADRs) exist to preserve the reasoning behind important technical choices.

A decision should not be changed casually. If an accepted architectural decision needs to change, a new ADR should document the reason and consequences of the change.

---

# ADR Statuses

| Status | Meaning |
|---|---|
| Proposed | Being evaluated |
| Accepted | Decision has been approved |
| Superseded | Replaced by a newer decision |
| Rejected | Considered but not selected |

---

# ADR-001 — Backend Strategy

**Status:** Accepted

## Decision

The MVP will use a **Backend-as-a-Service (BaaS)** instead of a self-hosted backend.

The initial implementation will prioritize a managed free-tier provider.

The specific provider remains an implementation decision and should be selected based on:

- Free-tier availability
- Authentication support
- Database support
- File storage
- Reliability
- Mobile integration
- Suitability for a small private application

## Context

The developer does not currently have a continuously running server or sufficiently stable internet connection to operate self-hosted infrastructure reliably.

The product requires a continuously available synchronization service.

## Rationale

A managed backend removes:

- Server maintenance
- Uptime dependency on local infrastructure
- Manual backups
- SSL management
- Server monitoring
- Infrastructure maintenance

This allows development to focus on the product.

## Consequences

The MVP depends on an external backend provider.

The application should therefore avoid coupling business logic directly to provider-specific APIs wherever practical.

---

# ADR-002 — Single Group MVP

**Status:** Accepted

## Decision

The MVP supports exactly **one private group**.

A member belongs to that group.

Multiple groups are intentionally excluded from the initial implementation.

## Context

The first version is intended for one close circle of friends.

Supporting multiple groups would introduce unnecessary complexity into:

- Authentication
- Membership
- Permissions
- Synchronization
- Navigation
- Data handling

## Rationale

The goal of the MVP is to validate the core experience:

> Knowing what your friends are currently doing.

Multiple groups do not contribute to that core experience.

## Consequences

The initial application can use a much simpler group model.

Multi-group support may be introduced later if actual usage demonstrates a need for it.

---

# ADR-003 — Owner Model

**Status:** Accepted

## Decision

The Group has exactly one Owner.

The Owner creates the group and is responsible for group administration.

## Context

The MVP is designed for a small group of trusted friends.

A distributed administration model would introduce unnecessary permission complexity.

## Rationale

The Owner Model is the simplest approach that satisfies the MVP.

## Consequences

The MVP does not support:

- Multiple administrators
- Democratic administration
- Ownership transfer

These may be considered in a future version if necessary.

---

# ADR-004 — State Management

**Status:** Accepted

## Decision

The mobile application will use:

**Zustand** for client/application state.

**TanStack Query** for server state and synchronization.

## Context

The application has two fundamentally different types of state:

### Local Application State

Examples:

- UI state
- Current editing state
- Sync indicators
- Temporary application state

### Remote/Synchronized State

Examples:

- Group members
- Presences
- Remote data
- Synchronization state

## Rationale

Separating these responsibilities keeps state management simple and avoids introducing a large global state architecture.

## Consequences

Business logic should not be placed directly inside UI components.

Server state should not be duplicated unnecessarily inside Zustand.

---

# ADR-005 — Offline-First Architecture

**Status:** Accepted

## Decision

The application will use an **offline-first** architecture.

The application should remain useful even when network connectivity is unavailable.

## Context

The widget must work without requiring a network connection.

Users should be able to see the latest known information even during temporary connectivity failures.

## Rationale

Offline support is part of the product experience rather than an optional enhancement.

## Consequences

The application requires persistent local storage.

Synchronization becomes a first-class system component.

---

# ADR-006 — Local-First Updates

**Status:** Accepted

## Decision

User actions update local state before remote synchronization.

## Flow

```text
User Action
    ↓
Local Database
    ↓
UI / Widget
    ↓
Background Synchronization
    ↓
Backend
```

## Context

Waiting for the network before updating the UI would make the application feel slow and unreliable.

## Rationale

Local-first updates provide:

- Immediate feedback
- Offline operation
- Better perceived performance
- Resilience to network failures

## Consequences

The system must track synchronization state and retry failed operations.

---

# ADR-007 — Local Database as the Application Data Source

**Status:** Accepted

## Decision

The mobile application and widget will read application data from the local database.

The backend is used for synchronization between devices.

## Context

The application must operate offline and the widget must render quickly.

## Rationale

A local data source provides:

- Fast reads
- Offline availability
- Consistent widget behaviour
- Reduced network usage

## Consequences

The system must reconcile local and remote data.

The local database is therefore a fundamental part of the application rather than a temporary cache.

---

# ADR-008 — Presence as the Core Domain Object

**Status:** Accepted

## Decision

The central domain concept is **Presence**.

Each Member has exactly one active Presence.

## Context

The product is not intended to be a traditional social feed.

The purpose is to maintain a simple snapshot of what each friend is currently doing.

## Rationale

A single living Presence avoids:

- Feed complexity
- Post history
- Content accumulation
- Engagement mechanics

It directly represents the product's purpose.

## Consequences

Updating a Presence replaces the previous active Presence.

A timeline is explicitly deferred.

---

# ADR-009 — Feature-Oriented Application Architecture

**Status:** Accepted

## Decision

The application will be organized primarily around features and responsibilities rather than generic file-type folders.

Example:

```text
features/
├── auth/
├── group/
├── presence/
├── media/
├── sync/
└── widget/
```

## Context

Large generic folders such as:

```text
components/
screens/
utils/
services/
```

can become difficult to maintain as the project grows.

## Rationale

Feature-oriented organization keeps related functionality together and makes ownership clearer.

## Consequences

Shared functionality should only be extracted when it is genuinely shared.

---

# ADR-010 — Backend Independence

**Status:** Accepted

## Decision

Business logic must not depend directly on a specific backend provider.

Provider-specific implementation belongs in the data/infrastructure layer.

## Context

The MVP will use a managed backend, but the provider may change in the future.

## Rationale

This prevents unnecessary vendor lock-in and allows the system to evolve without rewriting the application.

## Consequences

A small abstraction layer may be introduced around backend operations where useful.

Abstraction should not be introduced purely for theoretical future migration.

---

# ADR-011 — Widget as a Core Product Surface

**Status:** Accepted

## Decision

The home screen widget is a core product feature of Version 0.1.

It is not treated as an optional extension of the mobile application.

## Context

The primary purpose of Stay in Touch is ambient connection.

Users should be able to see their friends' current Presences without opening the application.

## Rationale

The widget directly supports the Product Constitution's principle of **Ambient Connection**.

## Consequences

Widget architecture must be considered from the beginning.

The local data model must support reliable widget access.

---

# ADR-012 — Widget Does Not Communicate Directly With Backend

**Status:** Accepted

## Decision

The widget never performs direct backend synchronization.

Its data source is the local device state.

## Flow

```text
Backend
   ↓
Synchronization
   ↓
Local Database
   ↓
Widget
```

## Context

Direct network requests from the widget would increase complexity, battery usage, and reliability problems.

## Rationale

The widget needs to be:

- Fast
- Offline-capable
- Battery efficient
- Predictable

## Consequences

The application synchronization system must trigger widget refreshes after relevant changes.

---

# ADR-013 — Image Optimization Before Upload

**Status:** Accepted

## Decision

Images must be resized and compressed before being uploaded.

Original camera-resolution images should not be stored as the application's primary Presence image.

## Context

Images are expected to be the largest consumer of application and network storage.

## Rationale

The product prioritizes low storage and network usage.

## Consequences

The application must perform image processing before upload.

Image dimensions and file size should be bounded.

---

# ADR-014 — No Continuous Polling

**Status:** Accepted

## Decision

The application must not continuously poll the backend for updates.

Synchronization should be event-driven or periodic only when necessary.

## Context

Continuous polling would consume battery and network resources unnecessarily.

## Rationale

The application has a small number of updates and does not require second-by-second synchronization.

## Consequences

The synchronization architecture will use mechanisms such as:

- Push-triggered synchronization
- Background synchronization
- Recovery synchronization

The exact mechanism will be defined in `SYNC_ARCHITECTURE.md`.

---

# ADR-015 — Zero-Cost MVP

**Status:** Accepted

## Decision

The MVP should be buildable and usable using free resources.

No recurring paid infrastructure should be required for the initial private group.

## Context

The application is being developed for a small group of friends rather than as a commercial service.

## Rationale

There is no reason to introduce operating costs before the product has been validated.

## Consequences

Service providers will be selected based partly on sustainable free-tier limits.

Paid services may be introduced later if real usage justifies them.

---

# ADR-016 — Optional Presence Image

**Status:** Accepted

## Decision

A Presence may contain a photo, but a photo is not mandatory.

The description is required.

## Context

The purpose of the product is to communicate Presence, not to force users to post photographs.

## Rationale

Users should be able to update their Presence without taking or selecting a photo.

For example:

> "Still alive. Library every day."

is a valid Presence.

## Consequences

The UI and data model must support text-only Presences.

---

# ADR-017 — Authentication and Group Membership Separation

**Status:** Accepted

## Decision

Authentication identity and product membership are separate concepts.

```text
Authenticated User
        ↓
     Member
        ↓
      Group
```

## Context

Authentication answers who the person is.

Membership answers which private group they belong to.

## Rationale

Separating these concepts keeps authentication infrastructure independent from product logic.

## Consequences

A user's authentication provider can change without changing the domain model.

---

# ADR-018 — Google Sign-In + Invitation Code

**Status:** Accepted for MVP

## Decision

The initial authentication and onboarding flow will use:

**Google Sign-In + Invitation Code**

## Context

The application is private and intended for a trusted group.

The MVP must avoid paid SMS/OTP infrastructure.

## Rationale

Google Sign-In is suitable for the Android-first MVP and avoids password management.

Invitation codes provide the private group boundary.

## Consequences

Phone-based OTP authentication is excluded from the MVP.

Future authentication providers can be added without changing the Group model.

---

# ADR-019 — No Timeline in MVP

**Status:** Accepted

## Decision

The MVP stores and displays only the current Presence.

Historical Presences are not exposed.

## Context

A timeline would transform the product from a lightweight connection tool into a content history platform.

## Rationale

The product should remain focused on the current moment.

## Consequences

Old Presences may be replaced rather than exposed as a feed.

A timeline can be evaluated after the MVP based on actual user behaviour.

---

# ADR-020 — One Active Presence Per Member

**Status:** Accepted

## Decision

Each Member has exactly one active Presence.

## Context

The product represents a living snapshot rather than a collection of posts.

## Rationale

This keeps:

- Storage small
- Synchronization simple
- UI focused
- Database structure simple

## Consequences

Updating Presence replaces the previous active Presence.

Historical versions are outside the MVP.

---

# Decision Principles

When making future architectural decisions, the following priority order should be used:

```text
Product Purpose
       ↓
User Experience
       ↓
Reliability
       ↓
Simplicity
       ↓
Resource Efficiency
       ↓
Maintainability
       ↓
Scalability
```

Scalability is deliberately lower in priority because the initial product is designed for small private groups.

---

# Changing an Accepted Decision

An accepted ADR should only be changed when:

- A product requirement changes.
- The existing decision causes a real problem.
- A platform limitation makes the decision impractical.
- New evidence demonstrates that the decision is no longer appropriate.

A new decision should reference the previous ADR.

Example:

```text
ADR-021 — Replace ADR-005 Offline Strategy
```

The original ADR should remain in the repository as historical record.

---

# Current Architecture Decision Summary

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Backend-as-a-Service | Accepted |
| ADR-002 | One Group MVP | Accepted |
| ADR-003 | Owner Model | Accepted |
| ADR-004 | Zustand + TanStack Query | Accepted |
| ADR-005 | Offline First | Accepted |
| ADR-006 | Local-First Updates | Accepted |
| ADR-007 | Local Database as Data Source | Accepted |
| ADR-008 | Presence-Centered Domain | Accepted |
| ADR-009 | Feature-Oriented Architecture | Accepted |
| ADR-010 | Backend Independence | Accepted |
| ADR-011 | Widget as Core Surface | Accepted |
| ADR-012 | Widget Uses Local Data | Accepted |
| ADR-013 | Image Optimization | Accepted |
| ADR-014 | No Continuous Polling | Accepted |
| ADR-015 | Zero-Cost MVP | Accepted |
| ADR-016 | Optional Presence Image | Accepted |
| ADR-017 | Auth/Membership Separation | Accepted |
| ADR-018 | Google + Invitation Code | Accepted |
| ADR-019 | No Timeline in MVP | Accepted |
| ADR-020 | One Active Presence | Accepted |

---

# Architectural Principle

All future technical decisions should ultimately support one statement:

> **Stay in Touch should make it effortless for close friends to remain aware of each other's lives while consuming as little attention and device resources as possible.**