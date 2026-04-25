# Bugfix Requirements Document

## Introduction

The `ProfileSheet` component in `src/components/ProfileSheet.tsx` has three UX bugs affecting Google-authenticated users. First, Google OAuth sometimes provides the avatar URL under `user.user_metadata.picture` instead of `user.user_metadata.avatar_url`, causing some users to see a fallback icon instead of their profile picture. Second, anonymous users may see authenticated-user UI elements they cannot actually use because the `isRegistered` gate is not consistently enforced. Third, the avatar `<img>` element is missing `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"` attributes, which causes privacy and CORS errors when loading Google profile images in certain browsers and contexts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a Google-authenticated user has their avatar URL stored under `user.user_metadata.picture` (but not under `user.user_metadata.avatar_url`) THEN the system shows the fallback `<User>` icon instead of the user's Google profile picture

1.2 WHEN an anonymous user (`user.is_anonymous === true`) views the ProfileSheet THEN the system may render authenticated-user UI elements (avatar, name, email, sign-out button) if the `isRegistered` gate is not consistently applied to all auth-dependent UI paths

1.3 WHEN a registered user's Google avatar `<img>` element loads in a browser that enforces strict referrer or CORS policies THEN the system fails to load the avatar image due to missing `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"` attributes, resulting in a broken image or console errors

### Expected Behavior (Correct)

2.1 WHEN a Google-authenticated user has their avatar URL stored under `user.user_metadata.picture` (but not under `user.user_metadata.avatar_url`) THEN the system SHALL resolve the avatar URL by checking `user.user_metadata.avatar_url` first, then falling back to `user.user_metadata.picture`, and display the user's Google profile picture

2.2 WHEN an anonymous user (`user.is_anonymous === true`) views the ProfileSheet THEN the system SHALL show only the "Sign in with Google" button and SHALL NOT render any authenticated-user UI elements (avatar, name, email, sign-out button)

2.3 WHEN a registered user's Google avatar `<img>` element loads THEN the system SHALL include `referrerPolicy="no-referrer"` and `crossOrigin="anonymous"` attributes on the `<img>` element to prevent privacy and CORS errors across all browsers

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a Google-authenticated user has their avatar URL stored under `user.user_metadata.avatar_url` THEN the system SHALL CONTINUE TO display the user's profile picture from that URL as before

3.2 WHEN a registered (non-anonymous) user views the ProfileSheet THEN the system SHALL CONTINUE TO display their avatar, name, email, and sign-out button

3.3 WHEN a user has no avatar URL in either `user.user_metadata.avatar_url` or `user.user_metadata.picture` THEN the system SHALL CONTINUE TO display the fallback `<User>` icon

3.4 WHEN any user views the ProfileSheet THEN the system SHALL CONTINUE TO display the collections grid and all non-auth UI elements unchanged

3.5 WHEN a non-authenticated user (no user object) views the ProfileSheet THEN the system SHALL CONTINUE TO display the "Sign in with Google" button
