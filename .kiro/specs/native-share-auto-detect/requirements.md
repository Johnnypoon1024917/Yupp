# Requirements Document

## Introduction

The Native Share & Auto-Detect feature enables YUPP Travel PWA to receive shared links from the operating system share sheet (Android/Desktop) and to detect travel-related URLs on the clipboard (iOS fallback). When a supported platform link (Instagram, Douyin, Xiaohongshu) is detected through either channel, the app automatically routes it to the MagicBar for AI-powered place extraction and pinning — eliminating the need for manual copy-paste.

## Glossary

- **Share_Handler**: The Next.js route at `/share` that receives incoming share intents from the operating system and redirects them into the main application.
- **MagicBar**: The floating search/URL-processing component (`src/components/MagicBar.tsx`) that scrapes a URL, extracts places via AI, geocodes them, and creates travel pins.
- **MagicBarRef**: The imperative handle interface exposed by MagicBar via `forwardRef`/`useImperativeHandle`, currently providing `focus()`.
- **Clipboard_Detector**: The logic within AppLayout that reads the system clipboard when the app gains focus and checks for supported platform URLs.
- **Platform**: A union type (`'instagram' | 'douyin' | 'xiaohongshu' | 'unknown'`) representing the social media source of a URL, as defined in `src/types/index.ts`.
- **Link_Banner**: A non-intrusive top notification banner displayed when the Clipboard_Detector finds a supported URL, prompting the user to process it.
- **PWA_Manifest**: The `public/manifest.json` Web App Manifest file that configures the installed PWA's metadata and capabilities, including share target registration.
- **Supported_URL**: A URL whose hostname matches one of the three supported platforms: Instagram (`instagram.com`), Douyin (`v.douyin.com`), or Xiaohongshu (`xiaohongshu.com`, `xhslink.com`).
- **Processed_Links_Set**: An in-memory set that tracks URLs already acted upon during the current session, preventing duplicate prompts or processing.

## Requirements

### Requirement 1: Register PWA as a System Share Target

**User Story:** As a mobile or desktop user, I want YUPP Travel to appear in my device's native share menu, so that I can send travel links directly to the app without opening it first.

#### Acceptance Criteria

1. THE PWA_Manifest SHALL include a `share_target` object with `action` set to `"/share"`, `method` set to `"GET"`, and `params` mapping `title`, `text`, and `url` to their respective query parameter names.
2. WHEN the PWA is installed, THE PWA_Manifest SHALL cause the operating system to register YUPP Travel as an available share destination.
3. THE PWA_Manifest SHALL retain all existing manifest properties (name, icons, display, theme_color, background_color, start_url, orientation) unchanged after the share_target addition.

### Requirement 2: Share Handler Route

**User Story:** As a user who shared a link to YUPP Travel from another app, I want the shared link to be automatically routed to the main app for processing, so that I do not have to paste it manually.

#### Acceptance Criteria

1. WHEN the Share_Handler route receives a request, THE Share_Handler SHALL read the `url` and `text` query parameters from the URL search params.
2. WHEN the `url` query parameter contains a Supported_URL, THE Share_Handler SHALL redirect to `/?autoPaste=<URL>` using the value from the `url` parameter.
3. WHEN the `url` query parameter is absent or empty AND the `text` query parameter contains a Supported_URL, THE Share_Handler SHALL extract the first Supported_URL from the `text` value and redirect to `/?autoPaste=<EXTRACTED_URL>`.
4. WHEN neither the `url` nor the `text` query parameter contains a Supported_URL, THE Share_Handler SHALL redirect to `/` without an `autoPaste` parameter.
5. THE Share_Handler SHALL perform the redirect on the client side so that the single-page application state is preserved.

### Requirement 3: Auto-Process via autoPaste Query Parameter

**User Story:** As a user arriving at the main app with an `autoPaste` parameter, I want the MagicBar to automatically begin processing the shared URL, so that pinning happens without extra interaction.

#### Acceptance Criteria

1. WHEN the AppLayout mounts and the URL contains an `autoPaste` query parameter with a Supported_URL, THE AppLayout SHALL call `MagicBarRef.triggerProcess` with the URL value.
2. WHEN the `autoPaste` parameter has been consumed, THE AppLayout SHALL remove the `autoPaste` query parameter from the browser URL without triggering a page reload.
3. THE AppLayout SHALL process the `autoPaste` parameter at most once per page load to prevent duplicate processing.

### Requirement 4: Clipboard Detection on Focus

**User Story:** As an iOS user (or any user returning to the app), I want the app to detect a supported travel link on my clipboard, so that I can pin it with a single tap instead of manually pasting.

#### Acceptance Criteria

1. WHEN the browser window gains focus, THE Clipboard_Detector SHALL attempt to read the clipboard text using `navigator.clipboard.readText()`.
2. WHEN the clipboard text contains a Supported_URL AND the URL is not in the Processed_Links_Set, THE Clipboard_Detector SHALL display the Link_Banner.
3. WHEN the clipboard text does not contain a Supported_URL, THE Clipboard_Detector SHALL not display the Link_Banner.
4. WHEN the clipboard text contains a URL that is already in the Processed_Links_Set, THE Clipboard_Detector SHALL not display the Link_Banner.
5. IF `navigator.clipboard.readText()` throws an error (permission denied or unavailable API), THEN THE Clipboard_Detector SHALL silently ignore the error and not display the Link_Banner.
6. THE Clipboard_Detector SHALL add each detected URL to the Processed_Links_Set after displaying the Link_Banner, regardless of whether the user acts on it.

### Requirement 5: Link Detection Banner UI

**User Story:** As a user who has a travel link on my clipboard, I want to see a subtle prompt identifying the platform, so that I can choose to pin the link with one tap.

#### Acceptance Criteria

1. WHEN the Link_Banner is displayed, THE Link_Banner SHALL show the text "📍 Detected a link from [Platform_Name]. Pin it now?" where Platform_Name is the capitalized name of the detected Platform (Instagram, Douyin, or Xiaohongshu).
2. THE Link_Banner SHALL include a "Yes" button that, when pressed, calls `MagicBarRef.triggerProcess` with the detected URL.
3. THE Link_Banner SHALL include a dismiss mechanism that hides the banner and adds the URL to the Processed_Links_Set.
4. THE Link_Banner SHALL appear at the top of the viewport below the safe area inset, styled as a non-intrusive notification that does not obscure the MagicBar.
5. WHEN the user taps "Yes" on the Link_Banner, THE Link_Banner SHALL dismiss itself immediately.
6. IF the Link_Banner receives no interaction within 8 seconds, THEN THE Link_Banner SHALL automatically dismiss itself.

### Requirement 6: MagicBar External Trigger

**User Story:** As a developer integrating the share and clipboard flows, I want the MagicBar to expose a programmatic trigger, so that external components can initiate URL processing without simulating user input.

#### Acceptance Criteria

1. THE MagicBarRef SHALL expose a `triggerProcess(url: string)` method in addition to the existing `focus()` method.
2. WHEN `triggerProcess` is called with a URL, THE MagicBar SHALL set the input value to the provided URL and execute the same processing logic as a manual form submission.
3. WHEN `triggerProcess` is called while the MagicBar is already in the `processing` state, THE MagicBar SHALL ignore the call and not queue a second processing run.
4. WHEN `triggerProcess` is called with an empty string, THE MagicBar SHALL ignore the call.

### Requirement 7: Shared Link Status Feedback

**User Story:** As a user who shared or auto-pasted a link, I want to see contextual feedback indicating the source platform, so that I know the app recognized where the link came from.

#### Acceptance Criteria

1. WHEN processing is triggered via `triggerProcess` (share or clipboard flow), THE MagicBar SHALL display the status text "Shared from [Platform_Name]! Finding the spot..." where Platform_Name is the capitalized name of the detected Platform.
2. WHEN processing is triggered via manual paste in the input field, THE MagicBar SHALL continue to display the existing status text "Scanning for multiple spots..." without the "Shared from" prefix.
3. THE MagicBar SHALL determine the Platform_Name by applying the `detectPlatform` function to the URL before beginning the scrape step.

### Requirement 8: URL Parsing Utility

**User Story:** As a developer, I want a shared utility that extracts supported URLs from arbitrary text, so that both the Share_Handler and Clipboard_Detector use consistent parsing logic.

#### Acceptance Criteria

1. THE URL parsing utility SHALL accept an arbitrary string and return the first Supported_URL found within it, or null if none is found.
2. THE URL parsing utility SHALL match URLs containing hostnames recognized by the existing `detectPlatform` function (instagram.com, v.douyin.com, xiaohongshu.com, xhslink.com and their subdomains).
3. THE URL parsing utility SHALL correctly extract URLs that are embedded within surrounding text, such as share sheet text that includes a message before or after the URL.
4. FOR ALL strings containing exactly one Supported_URL, parsing the string and then calling `detectPlatform` on the result SHALL return a Platform value other than `'unknown'` (round-trip property).
