# SYSTEM_DESIGN.md

# Stay in Touch

**Version:** 1.0
**Status:** Architecture Approved

---

# Purpose

This document defines the complete system architecture for **Stay in Touch**.

It describes how the system should behave, how information flows through it, and the engineering principles that guide every implementation decision.

This document intentionally avoids implementation-specific details where possible. It describes the architecture, not the code.

---

# 1. Design Goals

The architecture exists to support the Product Constitution.

The system should prioritize simplicity, maintainability and long-term reliability over unnecessary complexity.

---

## Goal 1 — Simplicity over Scale

Stay in Touch is designed for small private groups.

The architecture should optimize for maintainability rather than millions of users.

Whenever multiple valid solutions exist, the simplest one should be preferred.

---

## Goal 2 — Offline First

The application should remain useful without internet.

Users should always be able to:

* View the latest synchronized Presence.
* View cached images.
* Use the home screen widget.

Internet connectivity improves the experience but should not be required for basic usage.

---

## Goal 3 — Resource Efficiency

The application should respect the user's device.

Engineering decisions should minimize:

* Storage
* Battery
* Memory
* Background processing
* Network traffic

The application should remain lightweight enough to stay installed for years.

---

## Goal 4 — Fast Perceived Performance

The application should feel immediate.

Local data should always be displayed before remote synchronization.

The user should never wait for the backend before seeing information.

---

## Goal 5 — Reliability

User data should never be lost.

Synchronization failures should recover automatically whenever possible.

Temporary failures must not result in permanent data loss.

---

## Goal 6 — Single Source of Truth

Every piece of information should exist only once.

The application and widget should always read from the same local database.

Duplicate caches should be avoided.

---

## Goal 7 — Predictable Behaviour

The system should behave consistently.

Hidden behaviour and unnecessary complexity should be avoided.

---

## Goal 8 — Minimal Infrastructure

Only infrastructure required by the product should exist.

Large distributed systems and unnecessary services are intentionally out of scope.

---

# 2. Engineering Philosophy

Stay in Touch is built around a small number of engineering principles.

---

## Product First

Technology supports the product.

The product should never change because of technology limitations.

---

## Offline First

The application always prefers local data.

Synchronization happens independently.

---

## Local First

User actions should immediately update the local database.

Network communication should happen afterwards.

---

## Resource Efficient

Respect:

* Storage
* Battery
* Memory
* CPU
* Network

---

## Zero Cost MVP

The MVP should be deployable using free-tier resources.

Recurring costs should be avoided until the product has been validated.

---

## Simplicity

Prefer deleting complexity over introducing abstractions.

---

## Constraints Driven Design

Engineering decisions are guided by constraints rather than feature expansion.

---

# 3. Design Constraints

The following constraints must never be violated.

---

### Constraint 1

Every Member owns exactly one active Presence.

---

### Constraint 2

The widget always displays locally cached data.

---

### Constraint 3

Images are resized and compressed before upload.

---

### Constraint 4

The application never continuously polls the backend.

---

### Constraint 5

The application remains useful while offline.

---

### Constraint 6

Features should never increase cognitive load unnecessarily.

---

# 4. System Philosophy

Stay in Touch is not a traditional CRUD application.

It is a **Presence Synchronization System**.

The purpose of the system is to synchronize the latest Presence between trusted members of a private group.

Everything in the architecture exists to support this idea.

---

# 5. Domain Model

The application revolves around four core domain objects.

---

## Group

Represents the friendship circle.

Owns:

* Members
* Invitations

The MVP supports exactly one Group.

---

## Member

Represents a person inside the Group.

Contains:

* Display Name
* Profile Photo
* Join Date
* Presence

Authentication is separate from Membership.

---

## Presence

Represents the member's current life snapshot.

Contains:

* Optional Photo
* Required Description
* Last Updated Timestamp

Updating a Presence replaces the previous one.

Only one Presence exists per Member.

---

## Image

Represents an uploaded media resource.

Images are stored separately and referenced by Presence.

---

## Invitation

Represents access to the private Group.

Contains:

* Invite Code
* Creator
* Status
* Expiry (future)

---

# 6. Ownership Model

The MVP follows the Owner Model.

One Group has exactly one Owner.

The Owner:

* Creates the Group
* Generates invitations
* Manages future administration

Ownership transfer is outside MVP scope.

---

# 7. Backend Strategy

The MVP uses a Backend-as-a-Service.

Reasons:

* Lower maintenance
* Reliable hosting
* Faster development
* Zero-cost free tier
* No requirement for self-hosted infrastructure

The application should remain backend-provider independent where practical.

---

# 8. Component Architecture

The application is divided into independent modules.

---

## Authentication Module

Responsible for:

* Login
* Session
* Logout
* Identity

---

## Group Module

Responsible for:

* Group information
* Members
* Invitations

---

## Presence Module

Responsible for:

* Check-in
* Presence updates
* Presence validation
* Presence synchronization state

---

## Media Module

Responsible for:

* Camera
* Gallery
* Compression
* Resizing
* Upload preparation

---

## Synchronization Module

Responsible for:

* Upload
* Download
* Retry
* Conflict recovery

---

## Widget Module

Responsible for:

* Widget rendering
* Widget refresh
* Widget rotation

---

## Storage Module

Responsible for:

* Local database
* Cached images
* Sync metadata

---

## Network Module

Responsible for:

* Backend communication
* Uploads
* Downloads
* Authentication requests

---

# 9. Layered Architecture

The system follows four logical layers.

Presentation Layer

↓

Business Layer

↓

Data Layer

↓

Infrastructure Layer

---

## Presentation Layer

Contains UI.

No business logic.

---

## Business Layer

Contains:

* Presence logic
* Synchronization decisions
* Validation
* Group rules

---

## Data Layer

Contains:

* Local database
* Remote backend
* Image storage

---

## Infrastructure Layer

Contains:

* Authentication
* Camera
* Filesystem
* Widget integration
* Network

---

# 10. Authentication Architecture

Authentication exists only to identify the member.

It should never contain business logic.

---

## Authentication Flow

Open App

↓

Google Sign-In

↓

Validate Invitation

↓

Join Group

↓

Persist Session

↓

Enter Application

Sessions should survive application restarts.

Authentication should happen once.

---

# 11. System Flow

The primary workflow is a Check-In.

---

## Step 1

Member performs a Check-In.

* Optional Photo
* Description

---

## Step 2

Application immediately updates the local database.

UI updates instantly.

Widget updates immediately.

---

## Step 3

Image processing.

Resize

↓

Compress

↓

Preview

↓

Upload

---

## Step 4

Background upload begins.

Presence uploads.

Image uploads.

---

## Step 5

Backend stores latest Presence.

Previous Presence is replaced.

---

## Step 6

Synchronization distributes the new Presence.

Friends receive updates.

Widgets refresh.

---

# 12. Synchronization Philosophy

Synchronization follows a Local First model.

The local database is always updated first.

Synchronization with the backend happens afterwards.

The widget always reads local data.

The user should rarely notice synchronization happening.

---

# 13. Presence State Machine

Presence moves through four synchronization states.

Draft

↓

Uploading

↓

Synced

↓

Sync Failed

Failed synchronization should retry automatically.

Presence must never be discarded.

---

# 14. Widget Architecture

The widget is a primary product surface.

Responsibilities:

* Display Presence
* Display cached images
* Work offline
* Refresh after synchronization
* Rotate displayed members

The widget never communicates directly with the backend.

It always reads from the local database.

---

# 15. Image Pipeline

Every uploaded image follows the same lifecycle.

Camera / Gallery

↓

Resize

↓

Compress

↓

Preview

↓

Upload

↓

Cloud Storage

↓

Local Cache

Images are always optimized before upload.

---

# 16. Local Storage Strategy

The local database is a permanent data source.

It stores:

* Members
* Presence
* Cached Images
* Synchronization Metadata
* User Preferences

The application always reads local data first.

---

# 17. Cloud Storage Strategy

Cloud storage exists only to synchronize devices.

Cloud stores:

* Members
* Presence
* Images
* Invitations

No UI state belongs in the cloud.

---

# 18. Security Model

Stay in Touch is private by design.

Security principles:

* Authenticated requests
* Invite-only access
* Private images
* Validated invitations
* Secure storage

Enterprise-level authorization is outside MVP scope.

---

# 19. Performance Budget

Startup

* Perceived startup under one second.

Storage

* Small APK.
* Bounded cache.
* Optimized images.

Battery

* Minimal background processing.

Network

* Synchronize only when necessary.

Memory

* Load only required information.

---

# 20. Error Handling Strategy

Errors should never cause data loss.

Categories:

* Network
* Authentication
* Storage
* Synchronization
* Image Upload

Recovery should be automatic whenever possible.

Pending updates must never be discarded.

---

# 21. Technology Decisions

## Backend

Backend-as-a-Service (Provider to be finalized during implementation).

---

## Authentication

Google Sign-In + Invitation Code.

---

## Group Model

One private Group.

---

## Ownership

Single Owner model.

---

## State Management

Zustand

* Local application state.

TanStack Query

* Server synchronization.
* Remote state.

---

## Architecture

Offline-first

Local-first

Single source of truth

Feature-oriented modules

Layered architecture

---

# 22. Future Extraction Documents

As implementation progresses, the following documents will be created and expanded separately.

* SYNC_ARCHITECTURE.md
* WIDGET_ARCHITECTURE.md
* DATA_MODEL.md
* API_SPEC.md
* IMPLEMENTATION_PLAN.md

These documents extend this architecture without replacing it.

---

# Conclusion

Stay in Touch is intentionally designed as a lightweight, offline-first Presence Synchronization System.

Every architectural decision supports one goal:

> **Help close friends stay connected with minimal effort, minimal distraction, and maximum simplicity.**

When implementation decisions become difficult, this document should be treated as the architectural source of truth.
