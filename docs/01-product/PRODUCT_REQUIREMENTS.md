# PRODUCT_REQUIREMENTS.md

# Stay in Touch

**Version:** 1.0  
**Status:** Draft

---

# 1. Product Overview

**Stay in Touch** is a private application designed for close friends who have moved on to different cities, careers, and stages of life after graduation.

Each person maintains a single living update consisting of a photo and a short description of what they are currently doing.

The application and its home screen widget provide an effortless way to stay aware of each other's lives without requiring constant conversations.

The product focuses on presence, not engagement.

---

# 2. Objectives

The primary objectives of Stay in Touch are:

- Help close friends remain connected after graduation.
- Reduce the effort required to know what friends are doing.
- Create an ambient experience through a home screen widget.
- Encourage genuine, low-effort life updates.
- Respect the user's device by remaining lightweight, efficient, and unobtrusive.

---

# 3. Target Users

### Primary Users

- College friend groups
- Close friend circles
- Small private communities (5–50 members)

### Product Assumptions

- Members already know each other.
- Trust exists between members.
- Privacy is expected.
- The application is invite-only.

---

# 4. Functional Requirements

## FR-01 User Access

- A user can join using an invitation.
- A user belongs to one group during the MVP.
- Only invited users can access group content.

---

## FR-02 Current State

Each user owns exactly one active current state.

A current state consists of:

- One photo
- One short description
- Last updated timestamp

Updating the current state replaces the previous one.

---

## FR-03 Home

Users can:

- View all friends in the group.
- View each friend's current photo.
- View each friend's description.
- View when the state was last updated.

The home screen should present the group's current state at a glance.

---

## FR-04 Widget

The home screen widget shall:

- Display friends' current updates.
- Work using locally cached data.
- Continue functioning while offline.
- Refresh automatically after synchronization.
- Rotate between friends over time.

The widget is a core product feature.

---

## FR-05 Synchronization

The application shall:

- Synchronize updates automatically.
- Cache the latest state locally.
- Recover from temporary network failures.
- Refresh the widget after successful synchronization.

---

# 5. Non-Functional Requirements

## Performance

- Fast application startup.
- Smooth navigation.
- Responsive widget updates.

---

## Resource Usage

The application should:

- Minimize storage usage.
- Minimize battery consumption.
- Minimize network traffic.
- Cache only essential information.

---

## Reliability

The application should:

- Continue working offline using cached data.
- Recover automatically after reconnecting.
- Avoid data loss during uploads.

---

## Privacy

The application should:

- Be private by default.
- Restrict access to invited users.
- Store user data securely.
- Never expose group content publicly.

---

# 6. User Stories

### US-01

As a graduate living in another city, I want to know what my friends are doing without messaging each person individually.

---

### US-02

As a user, I want updating my current state to take less than one minute.

---

### US-03

As a user, I want to see my friends' latest updates directly from my home screen widget.

---

### US-04

As a user, I want the application to continue showing the latest available information even when I am offline.

---

# 7. MVP Scope

Included in Version 1:

- Invite-only group
- One group
- One current state per user
- Photo upload
- Description update
- Home screen
- Android widget
- Offline cache
- Automatic synchronization

---

# 8. Out of Scope

The following are intentionally excluded from the MVP:

- Chat
- Likes
- Comments
- Followers
- Public profiles
- Timeline
- Multiple groups
- Notifications for engagement
- Stories
- Content discovery
- Recommendation algorithms

---

# 9. Success Metrics

The MVP is considered successful if:

- Friends naturally keep their current state updated.
- Users regularly glance at the widget.
- The application helps users remain aware of each other's lives.
- The experience remains simple enough that users do not feel burdened by using it.

Success is measured by meaningful connection, not screen time.

---

# 10. Future Scope

Potential future enhancements include:

- Personal timeline
- Shared memory archive
- Reunion planning
- Cross-platform widget support
- Additional accessibility improvements

These features are intentionally deferred until the core product has been validated.

---

# Product Principles

Every future feature must satisfy the following questions:

1. Does it help close friends stay in touch?
2. Does it keep the experience simple?
3. Does it respect the user's attention?
4. Does it respect the user's device?
5. Does it align with the Product Constitution?

If the answer to any of these questions is **No**, the feature should be reconsidered before implementation.