// ============================================================
// Argon2id Password Generator — Client-Side PWA
// Using @argon2/argon2 library (browser-ready)
// ============================================================

// ---------- RECOMMENDED PARAMETERS ----------
const ARGON2_CONFIG = {
    time: 3,                  // iterations (passes)
    mem: 2 ** 16,             // 64 MiB (in KiB)
    hashLen: 32,              // 32 bytes => 256-bit derived key
    parallelism: 1,
};

// ---------- DOM References ----------
const masterPwInput = document.getElementById('masterPw');
const pwToggleBtn = document.getElementById('pwToggleBtn');
const usernameInput = document.getElementById('username');
const domainInput = document.getElementById('domain');
const saltPepperInput = document.getElementById('saltPepper');
const generateBtn = document.getElementById('generateBtn');
const clearBtn = document.getElementById('clearBtn');
const hashDisplay = document.getElementById('hashDisplay');
const fullHashDisplay = document.getElementById('fullHashDisplay');
const saltHexDisplay = document.getElementById('saltHexDisplay');
const saltB64Display = document.getElementById('saltB64Display');
const errorMsg = document.getElementById('errorMsg');
const statusMsg = document.getElementById('statusMsg');
const paramsInfoH = document.getElementById('paramsInfoH');
const paramsInfoW = document.getElementById('paramsInfoW');

// ---------- Status presentation ----------
const STATUS_COLORS = {
    success: '#3fb950',
    error: '#f85149',
    pending: '#d29922',
    info: '#58a6ff',
};

function setStatus(message, type = 'pending') {
    statusMsg.textContent = message;
    statusMsg.style.color = STATUS_COLORS[type] || STATUS_COLORS.pending;
}

// ---------- Check if Argon2id library loaded ----------
function isArgon2idLoaded() {
    return typeof argon2 !== 'undefined';
}

// ---------- Byte encoding helpers ----------
function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
    return btoa(String.fromCharCode(...bytes));
}

// ---------- Render the params-info footer from the actual config in use ----------
function renderParamsInfo() {
    const { mem, time, parallelism, hashLen } = ARGON2_CONFIG;

    let paramsText =
        `Argon2id: m=${mem}kB • t=${time} • p=${parallelism} • hashLen=${hashLen}`;

    paramsInfo.textContent  = paramsText;
    paramsInfoH.textContent = paramsText;
    paramsInfoW.textContent = paramsText;
}

// ---------- Helper: Build a deterministic salt ----------
async function buildSalt(username, domain, pepper) {
    const raw = `${username}:${domain}:${pepper}`; // :${pepper || 'Astronaut'}`;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(raw);

    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const fullSalt = new Uint8Array(digest);

    return fullSalt.slice(0, 16);
}

// ---------- Helper: normalize whatever shape argon2.hash() returns ----------
// Different argon2 WASM/JS builds have returned the hash as a bare Uint8Array,
// wrapped in a `.hash` property, or as a plain array. This is the one place that
// needs to know about all of those shapes, so generatePassword() doesn't have to.
function normalizeHashResult(result) {
    if (result instanceof Uint8Array) return result;
    if (result?.hash instanceof Uint8Array) return result.hash;
    if (Array.isArray(result?.hash)) return new Uint8Array(result.hash);
    if (result?.length !== undefined) return new Uint8Array(result);
    throw new Error('Unexpected hash format from argon2 library.');
}

// ---------- Core: Generate Argon2id hash ----------
async function generatePassword(masterPw, username, domain, salt) {
    // Input validation
    if (!masterPw || masterPw.length < 4) {
        throw new Error('Master password must be at least 4 characters.');
    }
    if (!username || !domain) {
        throw new Error('Username and Domain are required.');
    }
    if (!isArgon2idLoaded()) {
        throw new Error('Argon2id library not loaded. Please check your internet connection and reload.');
    }

    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(masterPw);

    try {
        const result = await argon2.hash({
            pass: passwordBytes,
            salt,
            type: argon2.ArgonType.Argon2id,
            ...ARGON2_CONFIG, // time, mem, hashLen, parallelism - defined above
        });
        return normalizeHashResult(result);
    } catch (err) {
        console.error('Argon2id error:', err);
        throw new Error(`Hashing failed: ${err.message || 'Unknown error'}`);
    }
}

// ---------- Helper: Convert Uint8Array to a usable password string ----------
function bytesToPassword(bytes, length = 16) {
    try {
        let base64 = btoa(String.fromCharCode(...bytes));
        let safe = base64
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        if (safe.length > length) {
            safe = safe.slice(0, length);
        } else {
            safe = safe.padEnd(length, '0');
        }
        return safe;
    } catch (e) {
        // Fallback: use hex encoding
        return Array.from(bytes)
            .slice(0, Math.ceil(length / 2))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .slice(0, length);
    }
}

// ---------- UI Functions ----------
function setDisplayValue(el, value) {
    el.textContent = value;
    el.classList.remove('placeholder');
    el.dataset.value = value;
}

function clearDisplayValue(el, placeholderText) {
    el.textContent = placeholderText;
    el.classList.add('placeholder');
    el.dataset.value = '';
}

function displayResult(passwordString, hashBytes, salt) {
    setDisplayValue(hashDisplay, passwordString);
    setDisplayValue(fullHashDisplay, bytesToBase64(hashBytes));
    setDisplayValue(saltHexDisplay, bytesToHex(salt));
    setDisplayValue(saltB64Display, bytesToBase64(salt));
    setStatus('Password generated!', 'success');
    errorMsg.textContent = '';
}

function showError(message) {
    errorMsg.textContent = message;
    setStatus('Error', 'error');
    clearDisplayValue(hashDisplay, 'Error generating password');
    clearDisplayValue(fullHashDisplay, '—');
    clearDisplayValue(saltHexDisplay, '—');
    clearDisplayValue(saltB64Display, '—');
}

function resetUI() {
    clearDisplayValue(hashDisplay, 'Generated password will appear here');
    clearDisplayValue(fullHashDisplay, '—');
    clearDisplayValue(saltHexDisplay, '—');
    clearDisplayValue(saltB64Display, '—');
    errorMsg.textContent = '';
    setStatus('Ready', 'pending');
}

// ---------- Main Generate Action ----------
async function handleGenerate() {
    const masterPw = masterPwInput.value;
	masterPwInput.value = '';
    const username = usernameInput.value.trim().toLowerCase();
    const domain = domainInput.value.trim().toLowerCase();
    const pepper = saltPepperInput.value.trim();

    generateBtn.disabled = true;
    generateBtn.textContent = 'Hashing...';
    setStatus('Computing Argon2id... (this may take a moment)', 'pending');
    errorMsg.textContent = '';

    try {
        const salt = await buildSalt(username, domain, pepper);
        const hashBytes = await generatePassword(masterPw, username, domain, salt);
        const password = bytesToPassword(hashBytes, 16);
        displayResult(password, hashBytes, salt);
    } catch (err) {
        showError(err.message);
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Password';
    }
}

// ---------- Copy to Clipboard ----------
function handleCopyClick(targetId) {
    const target = document.getElementById(targetId);
    const value = target?.dataset.value;

    if (!value) {
        showError('Nothing to copy yet. Generate a password first.');
        return;
    }
    copyTextToClipboard(value);
}

function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                setStatus('Copied to clipboard!', 'info');
                setTimeout(() => {
                    if (statusMsg.textContent === 'Copied to clipboard!') {
                        setStatus('Password generated', 'success');
                    }
                }, 2000);
            })
            .catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(password) {
    const textArea = document.createElement('textarea');
    textArea.value = password;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        setStatus('Copied!', 'info');
    } catch (e) {
        showError('Could not copy. Please select and copy manually.');
    }
    document.body.removeChild(textArea);
}

// ---------- Clear All Fields ----------
function handleClear() {
    masterPwInput.value = '';
    usernameInput.value = '';
    domainInput.value = '';
    saltPepperInput.value = '';
    masterPwInput.type = 'password';
    pwToggleBtn.setAttribute('aria-pressed', 'false');
    pwToggleBtn.setAttribute('aria-label', 'Show password');
    pwToggleBtn.querySelector('use').setAttribute('href', '#icon-eye-slash');
    resetUI();
    masterPwInput.focus();
}


// ---------- Force username/domain to lowercase as the user types or pastes ----------
function forceLowercase(e) {
    const input = e.target;
    const { selectionStart, selectionEnd } = input;
    input.value = input.value.toLowerCase();
    input.setSelectionRange(selectionStart, selectionEnd);
}

// ---------- Show/hide Master Password ----------
function handlePwToggle() {
    const isHidden = masterPwInput.type === 'password';
    masterPwInput.type = isHidden ? 'text' : 'password';
    pwToggleBtn.setAttribute('aria-pressed', String(isHidden));
    pwToggleBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    const useEl = pwToggleBtn.querySelector('use');
    useEl.setAttribute('href', isHidden ? '#icon-eye' : '#icon-eye-slash');
    masterPwInput.focus({ preventScroll: true });
}

// ---------- Event Listeners ----------
usernameInput.addEventListener('input', forceLowercase);
domainInput.addEventListener('input', forceLowercase);

generateBtn.addEventListener('click', handleGenerate);
clearBtn.addEventListener('click', handleClear);
pwToggleBtn.addEventListener('click', handlePwToggle);

document.querySelectorAll('.copy-btn[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', () => handleCopyClick(btn.dataset.copyTarget));
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const active = document.activeElement;
        if (active && active.tagName === 'INPUT') {
            handleGenerate();
        }
    }
});

// ---------- Initial state ----------
renderParamsInfo();
resetUI();
console.log('Argon2id Password Generator loaded.');
console.log('Parameters:', ARGON2_CONFIG);

// ---------- Prefill fields from URL parameters ----------
// Supported: ?user=...&domain=...&pepper=...
// Master password is intentionally never accepted via URL.
(function prefillFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const user   = params.get('user')   ?? params.get('name') ?? params.get('username');
    const domain = params.get('domain') ?? params.get('site');
    const pepper = params.get('pepper') ?? params.get('salt');

    if (user)   usernameInput.value   = user.toLowerCase();
    if (domain) domainInput.value     = domain.toLowerCase();
    if (pepper) saltPepperInput.value = pepper;

    if (user || domain || pepper) {
        console.log('Prefilled from URL params:', { user, domain, pepper: pepper ? '***' : undefined });
        masterPwInput.focus();
    }
})();

if (!isArgon2idLoaded()) {
    console.warn('Argon2id library not loaded. Check connection.');
    setStatus('Loading Argon2id library...', 'pending');
} else {
    console.log('Argon2id library loaded successfully.');
    // resetUI() already set status to "Ready" above; nothing more to do here.
}

// ---------- Register Service Worker ----------
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(async reg => {
                // Wait a sec for the service worker to be active and the caches are defined
                const cacheNames = await window.caches.keys();
                console.log(`Service Worker registered. Existing caches: ${cacheNames.join(', ') || 'Keine'}`, reg);
            })
            .catch(err => console.error('Service Worker Error:', err));
    });
}
