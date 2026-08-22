# API_SPEC.md

# Stay in Touch

**Version:** 1.0  
**Status:** Draft

---

# Purpose

This document defines the communication contract between the mobile application and the backend.

It specifies the operations required by the product without depending on a specific backend provider or SDK.

The API should remain stable even if the backend implementation changes.

---

# API Design Principles

- Resource-oriented
- Idempotent where possible
- Minimal payloads
- Offline-first compatible
- Versionable
- Consistent response structure

---

# Common Response Format

## Success

```json
{
  "success": true,
  "data": {}
}
```

---

## Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

# Authentication

Authentication is handled by the backend authentication provider.

The application should only require a valid authenticated session before accessing protected resources.

Business APIs should never expose authentication implementation details.

---

# Resource: Group

## Get Current Group

Purpose:

Load the user's group information.

Returns:

- Group details
- Owner information
- Member count

---

## Get Members

Purpose:

Retrieve all members belonging to the current group.

Returns:

- Member list
- Profile information
- Current Presence summary

---

# Resource: Presence

Presence is the primary resource in the application.

---

## Get Current Group Presence

Purpose:

Retrieve the latest Presence for every member.

Returns:

- Member
- Presence
- Image reference
- Updated timestamp

---

## Update My Presence

Purpose:

Replace the authenticated member's current Presence.

Input:

- Description (required)
- Image reference (optional)

Behaviour:

- Replaces previous Presence
- Updates timestamp
- Triggers synchronization

Returns:

- Updated Presence

---

## Get My Presence

Purpose:

Retrieve the authenticated member's current Presence.

Returns:

- Current Presence

---

# Resource: Image

Images are uploaded separately and referenced by Presence.

---

## Upload Image

Purpose:

Upload an optimized image.

Input:

- Image file

Returns:

- Image identifier
- Storage reference

---

## Delete Previous Image (Future)

Purpose:

Allow cleanup of unused images.

Not required for MVP.

---

# Resource: Invitation

---

## Validate Invitation

Purpose:

Validate whether an invitation code is valid.

Returns:

- Valid / Invalid
- Group information

---

## Join Group

Purpose:

Join the group using a valid invitation.

Input:

- Invitation code

Returns:

- Membership confirmation

---

# Synchronization

Synchronization is driven by timestamps.

The client compares the last successful synchronization time with the latest data available on the backend.

The backend only returns changes newer than the provided timestamp.

This minimizes network traffic.

---

## Sync Request

Input:

- Last successful sync timestamp

Returns:

- Changed Members
- Changed Presence
- Deleted resources (future)

---

# Upload Sequence

Member

↓

Update Presence

↓

Upload Image (if present)

↓

Update Presence with Image Reference

↓

Synchronization Complete

---

# Download Sequence

Application Opens

↓

Load Local Database

↓

Synchronize

↓

Apply Changes

↓

Refresh Widget

---

# Error Codes

The backend should return predictable error codes.

Examples:

- UNAUTHORIZED
- INVALID_INVITATION
- MEMBER_NOT_FOUND
- GROUP_NOT_FOUND
- IMAGE_UPLOAD_FAILED
- SYNC_CONFLICT
- NETWORK_UNAVAILABLE
- INTERNAL_ERROR

---

# Retry Strategy

The client is responsible for retrying failed operations.

The backend should avoid duplicate side effects by treating repeated update requests safely.

---

# Versioning

The API should support versioning.

Initial version:

v1

Future breaking changes should be introduced under a new version rather than modifying existing behaviour.

---

# Security

All protected operations require an authenticated session.

Members may only access resources belonging to their own group.

Images should never be publicly accessible without authorization.

---

# Performance Expectations

The API should:

- Return only required data.
- Support incremental synchronization.
- Minimize payload size.
- Avoid unnecessary requests.

---

# Future Endpoints

These are intentionally excluded from the MVP but reserved for future versions.

- Presence History
- Multiple Groups
- Group Administration
- Reactions
- Shared Memories
- Push Notification Preferences

---

# Summary

The API exists for one primary purpose:

> Synchronize the current Presence of every member reliably and efficiently.

The API should remain simple, predictable, and implementation-independent so that the mobile application and backend evolve without breaking their contract.