# ENGINEERING_STANDARDS.md

# Stay in Touch

**Version:** 1.0  
**Status:** Approved

---

# Purpose

This document defines the engineering standards for Stay in Touch.

These standards exist to keep the codebase:

- Simple
- Consistent
- Maintainable
- Resource-efficient
- Reliable
- Easy to understand

The standards apply to all application code, infrastructure code, scripts, and future contributions.

---

# 1. General Engineering Principles

## 1.1 Keep It Simple

Prefer the simplest implementation that satisfies the requirement.

Do not introduce abstractions, libraries, services, or architectural patterns without a concrete reason.

> Complexity must earn its place.

---

## 1.2 Build for the Current Product

Do not build infrastructure for hypothetical future requirements.

The MVP is designed for a small private group.

Do not optimize for millions of users before there is evidence that it is necessary.

---

## 1.3 Avoid Premature Abstraction

Do not create abstractions solely because something might change in the future.

Create an abstraction when:

- There are multiple implementations.
- A boundary needs to be isolated.
- It significantly improves testing.
- It removes meaningful duplication.

---

## 1.4 Prefer Readable Code

Code should be understandable without requiring extensive comments.

Prefer:

```text
syncPendingPresence()
```

over:

```text
processData()
```

Names should describe intent.

---

# 2. TypeScript Standards

The mobile application should use TypeScript.

---

## 2.1 Strict Type Checking

TypeScript strict mode should be enabled.

Avoid:

```ts
any
```

unless there is a documented reason.

Prefer explicit types.

---

## 2.2 Domain Types

Core domain objects should have explicit types.

Example:

```ts
type Presence = {
  id: string;
  memberId: string;
  description: string;
  imageId?: string;
  updatedAt: string;
};
```

Domain types should not depend directly on UI components.

---

## 2.3 Avoid Type Duplication

A domain concept should have one canonical type.

Do not create slightly different versions of the same entity throughout the application.

---

# 3. Project Organization

Code should be organized by feature and responsibility.

Preferred structure:

```text
features/
├── auth/
├── group/
├── presence/
├── media/
├── sync/
└── widget/
```

Shared functionality belongs in shared modules only when it is genuinely shared.

Avoid creating a large global utility folder.

---

# 4. UI Standards

## 4.1 Components

Components should have one clear responsibility.

Avoid components that:

- Fetch data
- Modify databases
- Handle authentication
- Perform image processing
- Render complex UI

all at the same time.

---

## 4.2 Business Logic

Business logic must not be embedded directly inside UI components.

Prefer:

```text
Component
   ↓
Feature Logic
   ↓
Repository / Data Layer
```

---

## 4.3 Network Independence

UI components must never depend directly on network requests.

The UI reads application state.

The data layer determines where that state comes from.

---

## 4.4 Loading States

Every asynchronous operation should have an intentional loading state where appropriate.

Avoid blank screens while data is being retrieved.

---

## 4.5 Error States

Errors should be understandable to users.

Do not expose raw backend errors.

Bad:

> `PGRST116: JSON object requested...`

Better:

> `We couldn't update your Presence. We'll try again when you're connected.`

---

# 5. State Management

The project uses:

### Zustand

For local application state.

Examples:

- UI state
- Editing state
- Sync state
- Temporary user interaction state

### TanStack Query

For server/synchronized state.

Examples:

- Group data
- Members
- Remote Presence data
- Synchronization queries

---

## 5.1 Do Not Duplicate Server State

Do not copy TanStack Query data into Zustand unless there is a specific reason.

Avoid:

```text
TanStack Query
      ↓
Zustand copy
      ↓
UI
```

Prefer:

```text
TanStack Query
      ↓
UI
```

---

## 5.2 Local Database

The offline-first local database is the persistent source used by the application.

TanStack Query should not become a replacement for the local database.

---

# 6. Offline-First Standards

Offline behaviour is a core requirement.

---

## 6.1 Local First

User actions should update local state first.

```text
User Action
    ↓
Local Database
    ↓
UI
    ↓
Sync Queue
    ↓
Backend
```

---

## 6.2 Never Discard Pending Data

A failed network request must not delete a user's locally stored Presence.

Pending operations remain until they succeed or require user intervention.

---

## 6.3 Retry Carefully

Retries must:

- Have reasonable limits.
- Avoid tight loops.
- Respect network availability.
- Avoid unnecessary battery usage.

---

# 7. Synchronization Standards

Synchronization must remain predictable.

---

## 7.1 No Continuous Polling

The application must not continuously poll the backend.

Use appropriate:

- Push events
- Background synchronization
- Manual recovery synchronization

---

## 7.2 Idempotency

Synchronization operations should be safe to retry.

Repeated execution should not create duplicate Presences or duplicate images.

---

## 7.3 Conflict Handling

The system should prefer deterministic conflict resolution.

For the MVP, Presence is a current-state model.

The most recent valid update should represent the current Presence.

Complex collaborative conflict resolution is unnecessary.

---

# 8. Image Standards

Images are one of the largest resource consumers.

---

## 8.1 Process Before Upload

Every image must be:

1. Resized.
2. Compressed.
3. Validated.
4. Uploaded.

---

## 8.2 No Original Preservation

The application should not upload and retain full-resolution camera originals for Presence.

---

## 8.3 Cache Limits

Local image storage must remain bounded.

Old or unused cached images should be removed when they are no longer required.

---

## 8.4 Supported Formats

Use efficient formats supported reliably by the target platform.

The exact format should be determined during implementation testing.

---

# 9. Widget Standards

The widget is a first-class product surface.

---

## 9.1 Local Data Only

The widget must read local data.

It must never depend directly on a network request.

---

## 9.2 No Continuous Execution

The widget must respect Android's lifecycle and background execution limitations.

Do not attempt to simulate a continuously running service.

---

## 9.3 Refresh Events

Widget updates should be triggered by:

- Local Presence changes.
- Successful synchronization.
- System-initiated widget refresh.
- Scheduled rotation where supported.

---

## 9.4 Widget Failure

If fresh data is unavailable, the widget should display the latest known local state rather than becoming empty.

---

# 10. Storage Standards

## 10.1 Local Storage

Only data required for offline functionality should be persisted locally.

---

## 10.2 Cloud Storage

Cloud storage should contain only the data necessary for synchronization and product functionality.

---

## 10.3 No Duplicate Storage

Avoid storing the same image or data in multiple locations without a clear reason.

---

# 11. API Standards

API communication should be:

- Predictable
- Minimal
- Typed
- Authenticated

---

## 11.1 Small Payloads

Only request information required by the current operation.

---

## 11.2 Explicit Errors

Errors should have stable error codes.

The client should make decisions based on codes rather than parsing error messages.

---

## 11.3 Authentication

Protected operations must require a valid authenticated session.

---

# 12. Security Standards

Security should be appropriate to the product's threat model.

---

## 12.1 Never Store Secrets in the App

No backend service-role keys, private credentials, or administrative secrets may be included in the mobile application.

---

## 12.2 Public vs Private Data

Group data and Presence information should remain private.

Images should not be publicly accessible by default.

---

## 12.3 Environment Configuration

Environment-specific values must not be hardcoded throughout the codebase.

Use environment configuration where appropriate.

---

# 13. Dependency Standards

Every dependency must justify its existence.

Before adding a package, ask:

1. Do we actually need it?
2. Can the platform already solve this?
3. Is the dependency maintained?
4. Does it meaningfully increase application size?
5. Does it introduce security or maintenance concerns?

Avoid dependencies that solve trivial problems.

---

# 14. Performance Standards

Performance should be measured rather than assumed.

---

## 14.1 Avoid Unnecessary Rendering

Components should not re-render unnecessarily.

Use appropriate state boundaries and memoization only where measurement shows it is useful.

---

## 14.2 Lazy Loading

Load expensive resources only when required.

---

## 14.3 Image Loading

Do not load every full-size image into memory simultaneously.

---

## 14.4 Startup

The application should prioritize fast perceived startup.

Local data should be available immediately where possible.

---

# 15. Battery Standards

Background work must have a clear purpose.

Do not:

- Poll continuously.
- Run unnecessary timers.
- Keep long-running background processes alive.
- Perform repeated network requests without a reason.

---

# 16. Error Handling

Errors must be handled at the appropriate layer.

```text
Infrastructure Error
        ↓
Data Layer
        ↓
Business Layer
        ↓
Presentation
```

The UI should receive meaningful application-level errors rather than raw infrastructure exceptions.

---

# 17. Logging

Logging should be useful during development without becoming excessive.

Logs should:

- Provide meaningful context.
- Avoid sensitive information.
- Avoid dumping entire objects unnecessarily.
- Be removable or disabled in production where appropriate.

---

# 18. Testing Standards

Testing should focus on behaviour rather than implementation details.

---

## Priority

### High

- Presence updates
- Synchronization
- Offline recovery
- Authentication
- Widget data
- Image processing

### Medium

- Navigation
- UI states
- Validation

### Low

- Purely visual details that are difficult to regress functionally

---

# 19. Git Standards

The project uses feature-based branches.

Examples:

```text
feature/presence
feature/widget
feature/auth
feature/sync
```

Documentation changes:

```text
docs/system-design
```

Bug fixes:

```text
fix/widget-refresh
```

---

# 20. Commit Standards

Use Conventional Commits.

Examples:

```text
feat: implement presence editor

fix: retry failed presence upload

docs: update synchronization design

refactor: simplify presence repository

test: add offline sync tests

chore: update dependencies
```

Commits should describe the actual change.

---

# 21. Code Review Standards

Before considering a change complete, verify:

- Does it satisfy a requirement?
- Does it follow the architecture?
- Does it introduce unnecessary complexity?
- Does it respect offline-first behaviour?
- Does it introduce unnecessary dependencies?
- Does it affect storage or battery usage?
- Are errors handled?
- Are tests appropriate?
- Is documentation affected?

---

# 22. Documentation Standards

Architectural decisions must be documented.

If an implementation changes an accepted architectural decision:

1. Stop.
2. Document the reason.
3. Create or update an ADR.
4. Review the consequences.
5. Then implement the change.

Code should never silently redefine architecture.

---

# 23. Definition of Done

A feature is considered complete when:

- The intended functionality works.
- Offline behaviour has been considered.
- Error handling exists.
- Appropriate tests exist.
- Resource impact has been considered.
- Code follows project standards.
- Documentation is updated when necessary.
- The application remains buildable.

---

# 24. Engineering Rule

When uncertain, prefer:

```text
Simple
   ↓
Predictable
   ↓
Reliable
   ↓
Efficient
   ↓
Extensible
```

Do not sacrifice simplicity for hypothetical future requirements.

---

# Final Principle

The engineering standard for Stay in Touch can be summarized as:

> **Write the smallest amount of understandable code that reliably solves the actual problem.**