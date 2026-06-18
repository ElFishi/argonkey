# 🔐 Argon2id Password Generator

A stateless, deterministic password generator that runs entirely in your browser. No data is ever stored or transmitted. Passwords are derived on-demand from a master password and contextual information.

## 📋 Table of Contents
- [How It Works](#how-it-works)
- [Password Generation Process](#password-generation-process)
- [Character Set](#character-set)
- [Full Hash & Salt Details](#full-hash--salt-details)
- [Security Parameters](#security-parameters)
- [Usage Example](#usage-example)
- [Important Notes](#important-notes)

---

## How It Works

This is a **deterministic password manager**. Instead of storing passwords in a vault, it generates them mathematically from four inputs:

1. **Master Password** - The secret you memorize (never stored)
2. **Username** - Your login name for the service (forced to lowercase)
3. **Domain** - The website or service name (forced to lowercase)
4. **Salt Pepper** (optional) - Additional entropy for uniqueness

**Key Principle:** The same inputs will always produce the same password. This means you can regenerate any password from memory without needing a database.

---

## Password Generation Process

The generation follows these exact steps:

### Step 1: Build the Deterministic Salt
The salt is derived from the username, domain, and optional pepper:
```
raw_salt = username + ":" + domain + ":" + pepper
```

The raw string is UTF-8 encoded and hashed with SHA-256 using the browser's `crypto.subtle` API, producing a 32-byte digest. The salt actually passed to Argon2id is the **first 16 bytes (128 bits)** of that digest — not the full 32 bytes. Because `crypto.subtle` requires a secure context (HTTPS or `localhost`), the page must be served over HTTPS for this step to work; there is no fallback salt algorithm.

### Step 2: Encode the Master Password
The master password is UTF-8 encoded into bytes.

### Step 3: Compute Argon2id Hash
The encoded password and salt are passed through the **Argon2id** key derivation function with these parameters:
- **Memory:** 64 MiB (65,536 KiB)
- **Iterations:** 3
- **Parallelism:** 1
- **Output Length:** 32 bytes (256 bits)
- **Type:** Argon2id

Argon2id is the current industry standard for password hashing. It's resistant to both GPU and side-channel attacks.

The output is a 32-byte hash.

### Step 4: Convert to Base64URL (No Padding)
The 32-byte hash is encoded using **Base64URL**:
1. Convert bytes to standard Base64
2. Replace `+` with `-` and `/` with `_`
3. Strip padding characters (`=`)

This produces a 43-character string.

### Step 5: Truncate to 16 Characters
The Base64URL string is truncated to 16 characters. If the string is shorter, it's padded with zeros.

**Final Password Length:** Exactly 16 characters

---

## Character Set

The generated password uses only the **Base64URL** alphabet:

| Character Type | Characters |
| :--- | :--- |
| Uppercase Letters | `A B C D E F G H I J K L M N O P Q R S T U V W X Y Z` |
| Lowercase Letters | `a b c d e f g h i j k l m n o p q r s t u v w x y z` |
| Digits | `0 1 2 3 4 5 6 7 8 9` |
| Special Characters | `-` (hyphen) and `_` (underscore) |

**Not Included:** `! @ # $ % ^ & * ( ) [ ] { } < > ? / + =`

> ⚠️ **Compatibility Note:** If a service requires special characters beyond `-` and `_`, this generator will not produce a valid password for that service. You would need to modify the character mapping to include them.

---

## Full Hash & Salt Details

Below the generated password, a collapsible **"Show full hash & salt"** panel exposes the raw cryptographic material behind it, for verification or advanced use cases:

| Field | Contents |
| :--- | :--- |
| **Full Hash (Base64)** | The complete, untruncated 32-byte Argon2id output, base64-encoded. The 16-character password is just the first 16 characters of the Base64URL version of this same value. |
| **Salt (Hex)** | The 16-byte salt (see Step 1 above) as a hexadecimal string. |
| **Salt (Base64)** | The same 16-byte salt, base64-encoded. |

Each field has its own copy-to-clipboard button. The panel is collapsed by default and is mainly useful for confirming that two browsers/devices produce an identical result for the same inputs, or for piping the raw key material into another tool that needs more than 16 characters of derived key.

---

## Security Parameters

These are the fixed parameters used for Argon2id:

```javascript
const ARGON2_CONFIG = {
    time: 3,          // Iterations
    mem: 65536,       // Memory in KiB (64 MiB)
    hashLen: 32,      // Output length in bytes
    parallelism: 1    // Single-threaded
};
```

**Recommended by OWASP:** These parameters exceed the OWASP baseline recommendations for Argon2id (`m=19MiB, t=2, p=1`), providing a strong defense against brute-force attacks.

> ℹ️ The small "Argon2id: m=64MiB • t=3 • p=1 • dkLen=32" line shown under the result in the app is generated at runtime directly from this same `ARGON2_CONFIG` object, so it always reflects the parameters actually used — not just a hardcoded label.

---

## Usage Example

### Inputs
- **Master Password:** `mySecureMasterPw!`
- **Username:** `alice`
- **Domain:** `example.com`
- **Salt Pepper:** (not provided)

### Process
1. **Salt:** SHA-256(`alice:example.com:default`) → first 16 bytes → `[16 bytes]`
2. **Hash:** Argon2id(`mySecureMasterPw!`, salt) → `[32 bytes]`
3. **Encoding:** Base64URL → `Xm7kRpQn3tYz5F8gHjKl9VbNcD2eS6wA` (43 chars)
4. **Truncation:** First 16 chars → `Xm7kRpQn3tYz5F8g`

**Generated Password:** `Xm7kRpQn3tYz5F8g`

### What the "Show full hash & salt" panel would display
- **Full Hash (Base64):** `Xm7kRpQn3tYz5F8gHjKl9VbNcD2eS6wA==` (the full 32-byte hash, standard base64 with padding — this is the same value the password is derived from, just before the Base64URL conversion and truncation)
- **Salt (Hex):** `7a3f9c1e8b2d4f60a5c7e91b3d8f2a4c`
- **Salt (Base64):** `ej+cHostT2Clx+kbPY8qTA==`

(These salt and full-hash values are illustrative placeholders, not an actual computed result.)

---

## Important Notes

### ✅ This is Not a Password Manager
It doesn't store, sync, or manage passwords. It's a **password generator** that recreates them from inputs.

### 🔑 Master Password Security
- Use a strong, memorable master password (at least 12 characters)
- Never reuse it for any other purpose
- Your master password is the only secret. If forgotten, all passwords are irrecoverable.

### 🌐 Domain vs Subdomain
The domain should be consistent. For `accounts.google.com`, use either `google.com` or `accounts.google.com`. Changing it will produce a different password.  Casing doesn't matter though — `Google.com` and `google.com` are treated identically, since both username and domain are lowercased before the salt is built.

### 🔄 Password Rotation
This generator doesn't support password rotation out-of-the-box. To rotate a password, append a version number or date to the domain or pepper (e.g., `example.com_v2` or use the Salt Pepper field with `v2`).

### 🔐 Client-Side Only
All computations happen in your browser. The master password is never transmitted or stored. The page can work offline once loaded.

### 🔍 Handle the Full Hash & Salt Panel Carefully
The optional "Show full hash & salt" panel is meant for verification and debugging, not everyday use. The salt isn't secret on its own, but there's no good reason to paste the full hash or salt into chats, screenshots, or tickets — treat them with the same care you'd give the password itself.

### 📦 No Backups
Since there's no central storage, you must remember your master password and the structure of your inputs. Consider writing down a "hint" or using a consistent naming scheme for domains.

