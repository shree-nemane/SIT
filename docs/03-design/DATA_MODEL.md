# DATA_MODEL.md

# Stay in Touch

**Version:** 1.0  
**Status:** Approved

---

# Purpose

This document defines the core data model of Stay in Touch.

It describes the entities that exist within the system, their responsibilities, and their relationships.

This is a domain model, not a database schema.

---

# Design Principles

The data model follows these principles:

- Every entity has a single responsibility.
- The model should reflect the product, not the database.
- Entities should be easy to synchronize.
- Data duplication should be avoided.
- Relationships should remain simple.

---

# Domain Overview

```
Stay in Touch

└── Group
      │
      ├── Owner
      │
      ├── Members
      │      │
      │      └── Presence
      │               │
      │               └── Image
      │
      └── Invitations
```

---

# Entity: Group

A Group represents one private circle of friends.

The MVP supports exactly one Group.

## Responsibilities

- Own members.
- Own invitations.
- Define the private boundary of the application.

## Properties

- id
- name
- ownerId
- createdAt

---

# Entity: Member

A Member represents one person inside the Group.

A Member is different from an authenticated User.

Authentication identifies a person.

Membership describes participation within the product.

## Responsibilities

- Belong to one Group.
- Own one Presence.
- Maintain profile information.

## Properties

- id
- groupId
- displayName
- profileImageId (optional)
- joinedAt
- createdAt

---

# Entity: Presence

Presence is the central entity of Stay in Touch.

Everything in the application exists to synchronize Presence.

A Presence represents a member's current life snapshot.

Updating a Presence replaces the previous one.

There is never more than one active Presence per Member.

## Responsibilities

- Represent the member's current situation.
- Synchronize across all devices.
- Drive widget content.

## Properties

- id
- memberId
- description
- imageId (optional)
- updatedAt

---

# Entity: Image

Images are media resources.

They are stored separately from Presence and referenced when needed.

## Responsibilities

- Store optimized media.
- Provide reusable image references.
- Support local caching.

## Properties

- id
- storagePath
- width
- height
- fileSize
- uploadedAt

---

# Entity: Invitation

Invitations provide controlled access to the Group.

## Responsibilities

- Allow new members to join.
- Restrict access to invited users.

## Properties

- id
- code
- createdBy
- createdAt
- expiresAt (future)
- status

---

# Local Device Model

The application stores information locally to support offline-first behaviour.

## Local Data

- Member
- Presence
- Cached Images
- Synchronization Metadata
- User Preferences

The local database is considered a primary data source.

The application always reads from it first.

---

# Cloud Model

The cloud exists to synchronize members.

## Cloud Data

- Group
- Member
- Presence
- Image
- Invitation

No UI state exists in the cloud.

---

# Relationships

## Group → Member

One Group contains many Members.

Each Member belongs to exactly one Group.

---

## Member → Presence

One Member owns exactly one active Presence.

Updating creates a new version logically while replacing the previous active Presence.

---

## Presence → Image

A Presence may reference one Image.

Images are optional.

Text-only Presence is valid.

---

## Group → Invitation

A Group may contain multiple Invitation codes.

Each Invitation belongs to one Group.

---

# Data Ownership

Every entity has one owner.

| Entity | Owner |
|---------|-------|
| Group | Owner |
| Member | Group |
| Presence | Member |
| Image | Presence |
| Invitation | Group |

---

# Synchronization Rules

The following rules must always be respected.

## Rule 1

The local Presence is updated before remote synchronization.

---

## Rule 2

The backend never directly updates the UI.

---

## Rule 3

The widget always reads local Presence.

---

## Rule 4

Synchronization never creates duplicate Presences.

---

## Rule 5

Images are uploaded only after optimization.

---

# Lifecycle

## Member

Join Group

↓

Create Initial Presence

↓

Update Presence

↓

Remain Member

---

## Presence

Create

↓

Uploading

↓

Synced

↓

Replace

---

## Image

Capture

↓

Optimize

↓

Upload

↓

Cache

↓

Replace

---

# Future Extensions

The current model intentionally leaves room for future features without affecting existing entities.

Possible future additions include:

- Presence History (Timeline)
- Reactions
- Shared Memories
- Multiple Groups
- Presence Tags
- City / Location (optional)
- Attachments

These features should extend the existing model rather than replacing it.

---

# Summary

The Stay in Touch data model is intentionally centered around a single concept:

> **Presence**

Everything else in the application exists to create, synchronize, store, or display a member's current Presence.

Keeping the model small, predictable, and easy to understand ensures that future development remains maintainable while staying aligned with the Product Constitution.