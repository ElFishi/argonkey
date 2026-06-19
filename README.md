[![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# ArgonKey — Argon2id Password Generator

A stateless, deterministic password generator that runs entirely in your browser. No data is ever stored or transmitted. Passwords are derived on-demand from a master password and contextual information.

## Table of Contents
- [How It Works](#how-it-works)
- [Password Generation Process](#password-generation-process)
- [Character Set](#character-set)
- [Full Hash & Salt Details](#full-hash--salt-details)
- [Security Parameters](#security-parameters)
- [Usage Example](#usage-example)
- [Project Structure](#project-structure)
- [Important Notes](#important-notes)

---

## How It Works

This is a **deterministic password manager**. Instead of storing passwords in a vault, it generates them mathematically from four inputs:

1. **Master Password** — The secret you memorise (never stored, cleared from the input field immediately after reading)
2. **Username** — Your login name for the service (forced to lowercase)
3. **Domain** — The website or service name (forced to lowercase)
4. **Salt Pepper** (optional) — Additional entropy for uniqueness (case-sensitive, not normalised)

**Key principle:** The same inputs will always produce the same password. You can regenerate any password from memory without needing a database.

---

## Password Generation Process

### Step 1 — Build the deterministic salt

The username, domain, and pepper are joined into a single UTF-8 string:

```
raw = username + ":" + domain + ":" + pepper
```

If no pepper is provided the trailing colon is still included: `username:domain:`.

That string is hashed with **SHA-256** via the browser's `crypto.subtle` API (requires a secure context — HTTPS or `localhost`). The salt passed to Argon2id is the **first 16 bytes (128 bits)** of the 32-byte digest.

### Step 2 — Encode the master password

The master password is UTF-8 encoded into bytes.

### Step 3 — Compute the Argon2id hash

The encoded password and derived salt are passed through **Argon2id** with these fixed parameters:

| Parameter | Value |
| :--- | :--- |
| Memory (`m`) | 65,536 KiB (64 MiB) |
| Iterations (`t`) | 3 |
| Parallelism (`p`) | 1 |
| Output length (`dkLen`) | 32 bytes (256 bits) |
| Type | Argon2id |

Argon2id is the current industry standard for password hashing. It is resistant to both GPU-based and side-channel attacks. These parameters exceed the OWASP baseline (`m=19 MiB, t=2, p=1`).

The parameters displayed in the app UI (bottom bar and both info modals) are generated at runtime from the same `ARGON2_CONFIG` object — they always reflect the parameters actually used.

### Step 4 — Encode to Base64URL (no padding)

The 32-byte hash is converted to a password-safe string:

1. Encode bytes as standard Base64
2. Replace `+` with `-` and `/` with `_`
3. Strip `=` padding

This produces a 43-character Base64URL string.

### Step 5 — Truncate to 16 characters

The Base64URL string is truncated to **16 characters**. If it were shorter (it never is for a 32-byte input), it would be padded with `0`.

---

## Character Set

The generated password uses the **Base64URL** alphabet only:

| Character type | Characters |
| :--- | :--- |
| Uppercase letters | `A–Z` |
| Lowercase letters | `a–z` |
| Digits | `0–9` |
| Special characters | `-` (hyphen), `_` (underscore) |

**Not included:** `! @ # $ % ^ & * ( ) [ ] { } < > ? / + =`

> ⚠️ **Compatibility note:** If a service requires special characters beyond `-` and `_`, this generator will not satisfy that requirement without modifying the encoding step.

---

## Full Hash & Salt Details

Expanding the **"Show full hash & salt"** panel reveals the raw cryptographic material behind the generated password:

| Field | Contents |
| :--- | :--- |
| **Full Hash (Base64)** | The complete 32-byte Argon2id output, standard Base64-encoded. The 16-character password is the first 16 characters of the Base64URL version of this value. |
| **Salt (Hex)** | The 16-byte salt (first 16 bytes of the SHA-256 digest) as a hexadecimal string. |
| **Salt (Base64)** | The same 16-byte salt, standard Base64-encoded. |

Each field has its own copy-to-clipboard button. The panel is collapsed by default.

A **"How to verify"** link at the bottom of the panel opens a modal that walks through reproducing the result step by step using independent online tools (a SHA-256 tool for the salt, an Argon2id tool for the hash).

---

## Security Parameters

```javascript
const ARGON2_CONFIG = {
    time: 3,          // iterations (passes)
    mem: 2 ** 16,     // 65,536 KiB = 64 MiB
    hashLen: 32,      // output length in bytes
    parallelism: 1,   // single-threaded
};
```

---

## Usage Example

### Inputs

| Field | Value |
| :--- | :--- |
| Master Password | `mySecureMasterPw!` |
| Username | `alice` |
| Domain | `example.com` |
| Salt Pepper | *(empty)* |

### Process

1. **Salt input string:** `alice:example.com:`
2. **SHA-256** of that string → take first 16 bytes → salt (shown as hex in the details panel)
3. **Argon2id** with the parameters above → 32-byte hash
4. **Base64URL** of hash → 43-character string
5. **Truncate** to first 16 characters → generated password

> The hash and salt values in the details panel can be used to verify the result independently — see the **"How to verify"** modal inside the app.

---

## Progressive Web App (PWA)

ArgonKey is installable as a PWA and runs **fully offline** after the first visit.

### Installation

On desktop (Chrome, Edge): click the install icon in the address bar, or open the browser menu and choose **"Install ArgonKey"**. On Android: tap **"Add to Home Screen"** in the browser menu. On iOS (Safari): tap the Share button and choose **"Add to Home Screen"**.

Once installed, the app opens in standalone mode (no browser chrome) and behaves like a native app.

### How offline works

On the first load, the Service Worker (`sw.js`) caches all required assets (cf. [project structure](#project-structure)).

All subsequent loads are served from that cache. Because the Argon2id library (`argon2-bundled.min.js`) is served locally rather than from a CDN, **no network connection is needed at any point after installation** — not even for the first computation.

The Service Worker uses a **cache-first** strategy: cached assets are served immediately, with a network fetch only as a fallback for uncached requests. This means the app loads instantly and works on a plane, in a basement, or anywhere else without connectivity.

> ℹ️ If you deploy an update, increment `CACHE_NAME` in `sw.js` (e.g. `ArK-cache-v2`) to force clients to fetch and cache the new assets on next load.

---

## Project Structure

```
public/
├── index.html          # App shell, form, result area, two info modals
├── style.css           # All styles (dark GitHub-inspired theme)
├── app.js              # Core logic: salt derivation, Argon2id, encoding, UI
├── argon2-bundled.min.js  # Argon2id WASM library (served locally for offline use)
├── sw.js               # Service Worker — cache-first strategy for offline PWA
├── manifest.json       # PWA manifest (name: ArgonKey)
├── 192.png             # App icon (192×192)
└── favicon.ico
```

The modal JS (`openModal` / `closeModal`) is inlined in `index.html` and loaded before `app.js` so there is no load-order dependency. A separate `modal.js` reference is also present at the bottom of the script list for any future extraction.

---

## Important Notes

### Not a password manager
There is no vault, no sync, no storage. It is a **password generator** that recreates passwords from inputs on demand.

### Master password security
- Use a strong, memorable master password (12+ characters recommended)
- Never reuse it for any other purpose
- It is the only secret — if forgotten, all derived passwords are irrecoverable

### Consistency matters
Use the same domain string every time. `google.com` and `accounts.google.com` produce different passwords. Casing does not matter — username and domain are forced to lowercase before the salt is built.

### Password rotation
To rotate a password for a service, append a version suffix to the domain or use the Salt Pepper field (e.g. pepper `v2`).

### Client-side only
All computation happens in your browser. The master password is cleared from the input immediately after it is read — before hashing begins. Nothing is ever sent to a server or written to any storage.

### Handle the details panel with care
The full hash and salt are exposed for verification purposes. The salt alone is not secret, but there is no reason to paste these values into chats, screenshots, or bug reports — treat them with the same care as the password itself.

### No backups
There is no central storage. Remember your master password and use a consistent naming scheme for usernames and domains.

## Credits & Dependencies
- [argon2-browser](https://github.com/Antelle/argon2-browser) - Compiled Argon2 library for browser environments (MIT License).

