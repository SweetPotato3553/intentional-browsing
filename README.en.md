# Intentional Browsing: Skip the Feed, Go Straight to Search

不入流 · Bilibili / Xiaohongshu Home Feed Remover

Skip home-page recommendation feeds and go straight to search or your saved collections.

[中文](README.md) · [Installation](docs/INSTALL.md) · [Privacy](PRIVACY.md) · [Development](docs/DEVELOPMENT.md)

Replace the Bilibili and Xiaohongshu web home pages with a simple entry for search, collection shortcuts and temporary home-page access, reducing distractions from recommendations.

**Desktop Chrome / Edge extension · Version 1.0.0 · [MIT License](LICENSE)**

![Still entry page](docs/images/zen.png)

## Features

- Replace the two platforms' home pages with an intentional search entry.
- Open the original site's search results and keep using its videos or posts.
- **Collection shortcuts**: save a link to an existing course collection or supported list and open it quickly later. This does not bookmark individual videos or posts for you.
- **Temporary access**: restore the original home page for 1–180 minutes. When access expires or you end it, home/feed pages return to the entry; search, video and collection pages remain open. The UI calls this “Take a break” or “Sneak a break”, depending on the style.
- Switch between Still, Study or Not, and Study buddy. Preferences and timers are shared.
- Chinese and English UI. Custom messages stay exactly as written.

Study buddy displays a fixed received-text message with an editable sender and body: up to 24 characters for the name and 160 for the message, including line breaks. No random quotes or tone selector.

## Install

1. Download [intentional-browsing-chromium-1.0.0.zip](https://github.com/SweetPotato3553/intentional-browsing/releases/download/v1.0.0/intentional-browsing-chromium-1.0.0.zip) from the [v1.0.0 release](https://github.com/SweetPotato3553/intentional-browsing/releases/tag/v1.0.0) and extract it to a permanent location.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode** and choose **Load unpacked**.
4. Select the inner **`extension`** directory containing `manifest.json`.
5. Refresh open platform tabs and visit either home page. Keep the installed folder in place.

You can also use **Code → Download ZIP**, extract the repository and load its `extension` directory directly. No build is required for installation.

To update while retaining settings, replace files inside the same loaded extension directory, reload the same extension and refresh platform tabs. Loading a different directory may create a separate extension with separate settings.

## Collection shortcuts, sign-in and styles

Use the collection settings button to open a **3-minute** setup tab, navigate to your collection and choose Save this page. The floating widget can be dragged or collapsed. You can also paste a supported collection URL manually. For Xiaohongshu, choose your own profile; access to its saved posts is controlled by the platform.

Sign-in remains on the original website. A tab-scoped login route and a **5-minute** native-site fallback are available. Click the toolbar icon or Style on an entry page to change appearance.

## Privacy and compatibility

No ads, telemetry or developer uploads. Preferences, collection URLs and custom notes stay in local extension storage; pending searches and temporary deadlines use browser session storage. Platform searches and sign-in still contact the platforms themselves. Site permissions support home-page navigation, login and collection recognition, and floating controls. `storage` saves preferences and temporary state; `alarms` handles deadlines; `declarativeNetRequestWithHostAccess` applies browser rules for home-page redirects and temporary access. Content scripts also inspect relevant page elements for login and collection recognition. See [Privacy](PRIVACY.md).

Desktop Chrome / Edge with Chromium 120+ is required. Automated checks have passed on Windows Edge with mocked websites. Other Chromium browsers meeting the minimum version are expected to be compatible; compatibility reports are welcome. Mobile apps are unsupported. Real-account QR sign-in and verification challenges are not covered by these tests; platform changes may affect login or collection recognition. Timers may resume late after browser shutdown or system sleep.

## Development and support

Developed with assistance from OpenAI Codex.

The runtime uses plain JavaScript, HTML and CSS without third-party runtime libraries. See [Development](docs/DEVELOPMENT.md) for Node.js, Python, Playwright, testing and packaging instructions. The 1.0.0 release passed **86 mocked-site scenarios**; see [verification metadata](VERIFICATION.json) and [review dispositions](RELEASE-REVIEW.md). This repository preparation leaves runtime files unchanged.

Report bugs through Issues with reproduction steps and redacted screenshots. Do not share cookies, tokens or private collection URLs. See [Contributing](CONTRIBUTING.md), [Security](SECURITY.md) and the [MIT license](LICENSE).
