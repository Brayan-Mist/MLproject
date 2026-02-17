(function (window) {
    "use strict";

    const ADMIN_EMAIL = "admin@site.com";
    const ADMIN_PASSWORD = "Admin123!";
    const ADMIN_PASSWORD_ALT = "admin123";
    const MEDIA_DB_NAME = "escortHubMedia";
    const MEDIA_DB_STORE = "videos";
    const MEDIA_DB_VERSION = 1;

    const LOCATION_DATA = Object.freeze({
        "США": ["Нью-Йорк", "Лос-Анджелес", "Чикаго", "Сиэтл", "Майами"],
        "Германия": ["Берлин", "Мюнхен", "Гамбург", "Кельн"],
        "Франция": ["Париж", "Лион", "Марсель", "Ницца"],
        "Италия": ["Рим", "Милан", "Флоренция", "Неаполь"],
        "Япония": ["Токио", "Осака", "Киото", "Саппоро"],
        "Канада": ["Торонто", "Ванкувер", "Монреаль", "Калгари"],
        "Испания": ["Мадрид", "Барселона", "Севилья", "Валенсия"]
    });

    const MAX_NICKNAME_LENGTH = 24;
    const MAX_BIO_LENGTH = 180;
    const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
    const MAX_AD_PHOTOS = 5;
    const MAX_AD_VIDEOS = 3;
    const MAX_AD_TEXT_LENGTH = 1800;
    const MAX_AD_IMAGE_SIZE_BYTES = 900 * 1024;
    const MAX_AD_VIDEO_SIZE_BYTES = 120 * 1024 * 1024;
    const VIDEO_POSTER_MAX_WIDTH = 960;
    const VIDEO_POSTER_TIME_SEC = 0.15;
    const VIDEO_POSTER_QUALITY = 0.86;
    const MIN_PASSWORD_LENGTH = 6;

    const PASSWORD_HASH_PREFIX = "md5sha1:";

    const KEYS = {
        users: "users",
        session: "session",
        adminBypass: "adminBypass",
        ads: "ads",
        visits: "visits",
        hourlyVisits: "hourlyVisits",
        hourlyVisitsDate: "hourlyVisitsDate",
        todayLogins: "todayLogins",
        todayLoginsDate: "todayLoginsDate"
    };

    function getSessionStorage() {
        try {
            return window.sessionStorage;
        } catch {
            return null;
        }
    }

    function getItem(key) {
        try {
            return window.localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    function setItem(key, value) {
        try {
            window.localStorage.setItem(key, value);
            return true;
        } catch {
            return false;
        }
    }

    function removeItem(key) {
        try {
            window.localStorage.removeItem(key);
            return true;
        } catch {
            return false;
        }
    }

    function safeReadJSON(key, fallback) {
        const raw = getItem(key);
        if (raw === null) {
            return fallback;
        }

        try {
            return JSON.parse(raw);
        } catch {
            removeItem(key);
            return fallback;
        }
    }

    function safeWriteJSON(key, value) {
        return setItem(key, JSON.stringify(value));
    }

    function safeReadSessionJSON(fallback) {
        const localRaw = getItem(KEYS.session);
        if (localRaw) {
            try {
                return JSON.parse(localRaw);
            } catch {
                removeItem(KEYS.session);
            }
        }

        const storage = getSessionStorage();
        if (!storage) {
            return fallback;
        }

        const sessionRaw = storage.getItem(KEYS.session);
        if (!sessionRaw) {
            return fallback;
        }

        try {
            return JSON.parse(sessionRaw);
        } catch {
            storage.removeItem(KEYS.session);
            return fallback;
        }
    }

    function writeSession(payload) {
        const serialized = JSON.stringify(payload);
        const localOk = setItem(KEYS.session, serialized);

        const storage = getSessionStorage();
        if (!storage) {
            return localOk;
        }

        let sessionOk = false;
        try {
            storage.setItem(KEYS.session, serialized);
            sessionOk = true;
        } catch {
            sessionOk = false;
        }

        return localOk || sessionOk;
    }

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    async function digestHex(algorithm, text) {
        const data = new TextEncoder().encode(String(text ?? ""));
        const hashBuffer = await crypto.subtle.digest(algorithm, data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    async function md5Hex(text) {
        const msg = unescape(encodeURIComponent(String(text ?? "")));
        const m = [
            1732584193,
            -271733879,
            -1732584194,
            271733878
        ];

        function cmn(q, a, b, x, s, t) {
            a = (a + q + x + t) | 0;
            return (((a << s) | (a >>> (32 - s))) + b) | 0;
        }

        function ff(a, b, c, d, x, s, t) {
            return cmn((b & c) | (~b & d), a, b, x, s, t);
        }

        function gg(a, b, c, d, x, s, t) {
            return cmn((b & d) | (c & ~d), a, b, x, s, t);
        }

        function hh(a, b, c, d, x, s, t) {
            return cmn(b ^ c ^ d, a, b, x, s, t);
        }

        function ii(a, b, c, d, x, s, t) {
            return cmn(c ^ (b | ~d), a, b, x, s, t);
        }

        function md5cycle(state, k) {
            let [a, b, c, d] = state;

            a = ff(a, b, c, d, k[0], 7, -680876936);
            d = ff(d, a, b, c, k[1], 12, -389564586);
            c = ff(c, d, a, b, k[2], 17, 606105819);
            b = ff(b, c, d, a, k[3], 22, -1044525330);
            a = ff(a, b, c, d, k[4], 7, -176418897);
            d = ff(d, a, b, c, k[5], 12, 1200080426);
            c = ff(c, d, a, b, k[6], 17, -1473231341);
            b = ff(b, c, d, a, k[7], 22, -45705983);
            a = ff(a, b, c, d, k[8], 7, 1770035416);
            d = ff(d, a, b, c, k[9], 12, -1958414417);
            c = ff(c, d, a, b, k[10], 17, -42063);
            b = ff(b, c, d, a, k[11], 22, -1990404162);
            a = ff(a, b, c, d, k[12], 7, 1804603682);
            d = ff(d, a, b, c, k[13], 12, -40341101);
            c = ff(c, d, a, b, k[14], 17, -1502002290);
            b = ff(b, c, d, a, k[15], 22, 1236535329);

            a = gg(a, b, c, d, k[1], 5, -165796510);
            d = gg(d, a, b, c, k[6], 9, -1069501632);
            c = gg(c, d, a, b, k[11], 14, 643717713);
            b = gg(b, c, d, a, k[0], 20, -373897302);
            a = gg(a, b, c, d, k[5], 5, -701558691);
            d = gg(d, a, b, c, k[10], 9, 38016083);
            c = gg(c, d, a, b, k[15], 14, -660478335);
            b = gg(b, c, d, a, k[4], 20, -405537848);
            a = gg(a, b, c, d, k[9], 5, 568446438);
            d = gg(d, a, b, c, k[14], 9, -1019803690);
            c = gg(c, d, a, b, k[3], 14, -187363961);
            b = gg(b, c, d, a, k[8], 20, 1163531501);
            a = gg(a, b, c, d, k[13], 5, -1444681467);
            d = gg(d, a, b, c, k[2], 9, -51403784);
            c = gg(c, d, a, b, k[7], 14, 1735328473);
            b = gg(b, c, d, a, k[12], 20, -1926607734);

            a = hh(a, b, c, d, k[5], 4, -378558);
            d = hh(d, a, b, c, k[8], 11, -2022574463);
            c = hh(c, d, a, b, k[11], 16, 1839030562);
            b = hh(b, c, d, a, k[14], 23, -35309556);
            a = hh(a, b, c, d, k[1], 4, -1530992060);
            d = hh(d, a, b, c, k[4], 11, 1272893353);
            c = hh(c, d, a, b, k[7], 16, -155497632);
            b = hh(b, c, d, a, k[10], 23, -1094730640);
            a = hh(a, b, c, d, k[13], 4, 681279174);
            d = hh(d, a, b, c, k[0], 11, -358537222);
            c = hh(c, d, a, b, k[3], 16, -722521979);
            b = hh(b, c, d, a, k[6], 23, 76029189);
            a = hh(a, b, c, d, k[9], 4, -640364487);
            d = hh(d, a, b, c, k[12], 11, -421815835);
            c = hh(c, d, a, b, k[15], 16, 530742520);
            b = hh(b, c, d, a, k[2], 23, -995338651);

            a = ii(a, b, c, d, k[0], 6, -198630844);
            d = ii(d, a, b, c, k[7], 10, 1126891415);
            c = ii(c, d, a, b, k[14], 15, -1416354905);
            b = ii(b, c, d, a, k[5], 21, -57434055);
            a = ii(a, b, c, d, k[12], 6, 1700485571);
            d = ii(d, a, b, c, k[3], 10, -1894986606);
            c = ii(c, d, a, b, k[10], 15, -1051523);
            b = ii(b, c, d, a, k[1], 21, -2054922799);
            a = ii(a, b, c, d, k[8], 6, 1873313359);
            d = ii(d, a, b, c, k[15], 10, -30611744);
            c = ii(c, d, a, b, k[6], 15, -1560198380);
            b = ii(b, c, d, a, k[13], 21, 1309151649);
            a = ii(a, b, c, d, k[4], 6, -145523070);
            d = ii(d, a, b, c, k[11], 10, -1120210379);
            c = ii(c, d, a, b, k[2], 15, 718787259);
            b = ii(b, c, d, a, k[9], 21, -343485551);

            state[0] = (state[0] + a) | 0;
            state[1] = (state[1] + b) | 0;
            state[2] = (state[2] + c) | 0;
            state[3] = (state[3] + d) | 0;
        }

        function md5blk(str) {
            const blocks = [];
            for (let i = 0; i < 64; i += 4) {
                blocks[i >> 2] =
                    str.charCodeAt(i) +
                    (str.charCodeAt(i + 1) << 8) +
                    (str.charCodeAt(i + 2) << 16) +
                    (str.charCodeAt(i + 3) << 24);
            }
            return blocks;
        }

        function md51(str) {
            let n = str.length;
            let state = [...m];
            let i;
            for (i = 64; i <= n; i += 64) {
                md5cycle(state, md5blk(str.substring(i - 64, i)));
            }
            str = str.substring(i - 64);
            const tail = new Array(16).fill(0);
            for (i = 0; i < str.length; i += 1) {
                tail[i >> 2] |= str.charCodeAt(i) << ((i % 4) << 3);
            }
            tail[i >> 2] |= 0x80 << ((i % 4) << 3);
            if (i > 55) {
                md5cycle(state, tail);
                for (i = 0; i < 16; i += 1) {
                    tail[i] = 0;
                }
            }
            tail[14] = n * 8;
            md5cycle(state, tail);
            return state;
        }

        function rhex(n) {
            let s = "";
            for (let j = 0; j < 4; j += 1) {
                s += ((n >> (j * 8 + 4)) & 0x0f).toString(16);
                s += ((n >> (j * 8)) & 0x0f).toString(16);
            }
            return s;
        }

        const state = md51(msg);
        return rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3]);
    }

    async function hashPassword(password) {
        const sha1 = await digestHex("SHA-1", String(password ?? ""));
        const md5 = await md5Hex(sha1);
        return `${PASSWORD_HASH_PREFIX}${md5}`;
    }

    async function verifyPassword(storedPassword, providedPassword) {
        const stored = String(storedPassword ?? "");
        const provided = String(providedPassword ?? "");
        if (!stored) {
            return false;
        }
        if (stored.startsWith(PASSWORD_HASH_PREFIX)) {
            const expected = stored.slice(PASSWORD_HASH_PREFIX.length);
            const actual = (await hashPassword(provided)).slice(PASSWORD_HASH_PREFIX.length);
            return expected === actual;
        }
        return stored === provided;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
    }

    function sanitizeNickname(value) {
        return String(value || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, MAX_NICKNAME_LENGTH);
    }

    function sanitizeAdText(value) {
        return String(value || "")
            .replace(/\r/g, "")
            .trim()
            .slice(0, MAX_AD_TEXT_LENGTH);
    }

    function sanitizeLocation(value) {
        return String(value || "")
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 48);
    }

    function getCitiesByCountry(countryValue) {
        const country = sanitizeLocation(countryValue);
        const list = LOCATION_DATA[country];
        return Array.isArray(list) ? [...list] : [];
    }

    function sanitizeUsername(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/^@+/, "")
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_.]/g, "")
            .slice(0, MAX_NICKNAME_LENGTH);
    }

    function nicknameFromEmail(email) {
        return normalizeEmail(email).split("@")[0] || "Пользователь";
    }

    function usernameFromNickname(nickname) {
        return sanitizeUsername(nickname) || "user";
    }

    function escapeXml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function initialsFromName(value) {
        const words = sanitizeNickname(value)
            .split(" ")
            .filter(Boolean);

        if (words.length === 0) {
            return "U";
        }

        if (words.length === 1) {
            return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
        }

        const first = Array.from(words[0])[0] || "";
        const second = Array.from(words[1])[0] || "";
        return (first + second).toUpperCase();
    }

    function makeAvatarPlaceholder(name) {
        const initials = escapeXml(initialsFromName(name));
        const svg = `
            <svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>
                <defs>
                    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
                        <stop offset='0%' stop-color='#ff2f92' />
                        <stop offset='100%' stop-color='#d91871' />
                    </linearGradient>
                </defs>
                <rect width='128' height='128' rx='64' fill='url(#g)' />
                <text x='64' y='74' text-anchor='middle' font-size='44' font-family='Arial' font-weight='700' fill='#ffffff'>${initials}</text>
            </svg>
        `;

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    function normalizeLocationPair(countryValue, cityValue) {
        const country = sanitizeLocation(countryValue);
        const city = sanitizeLocation(cityValue);

        if (!country || !city) {
            return { country: "", city: "" };
        }

        const cities = getCitiesByCountry(country);
        if (!cities.includes(city)) {
            return { country: "", city: "" };
        }

        return { country, city };
    }

    function buildProfile(user) {
        const email = normalizeEmail(user?.email || "");
        const profile = user?.profile && typeof user.profile === "object" ? user.profile : {};

        const nickname = sanitizeNickname(profile.nickname) || nicknameFromEmail(email);
        const username = sanitizeUsername(profile.username) || usernameFromNickname(nickname);
        const location = normalizeLocationPair(profile.country, profile.city);

        return {
            nickname,
            username,
            bio: String(profile.bio || "").trim().slice(0, MAX_BIO_LENGTH),
            avatar: typeof profile.avatar === "string" ? profile.avatar : "",
            country: location.country,
            city: location.city
        };
    }

    function getUsers() {
        const parsed = safeReadJSON(KEYS.users, []);
        return Array.isArray(parsed) ? parsed : [];
    }

    function saveUsers(users) {
        const list = Array.isArray(users) ? users : [];
        safeWriteJSON(KEYS.users, list);
    }

    // Нормализуем и удаляем дубликаты пользователей по email.
    function dedupeUsersByEmail(users) {
        const map = new Map();
        users.forEach((user, index) => {
            if (!user || typeof user !== "object") {
                return;
            }

            const email = normalizeEmail(user.email || `user${index}@local.invalid`);
            if (map.has(email)) {
                return;
            }

            const profile = buildProfile({ email, profile: user.profile });
            map.set(email, {
                email,
                password: typeof user.password === "string" ? user.password : "",
                role: user.role === "admin" || email === ADMIN_EMAIL ? "admin" : "user",
                profile
            });
        });

        return Array.from(map.values());
    }

    function migrateUsers() {
        const originalUsers = getUsers();
        const migratedUsers = dedupeUsersByEmail(originalUsers);

        if (JSON.stringify(originalUsers) !== JSON.stringify(migratedUsers)) {
            saveUsers(migratedUsers);
        }

        return migratedUsers;
    }

    function findUserByEmail(email) {
        const normalized = normalizeEmail(email);
        if (!normalized) {
            return null;
        }

        return getUsers().find((user) => normalizeEmail(user.email) === normalized) || null;
    }

    function isAdmin(entity) {
        if (!entity) {
            return false;
        }

        return entity.role === "admin" || normalizeEmail(entity.email) === ADMIN_EMAIL;
    }

    function getSession() {
        const session = safeReadSessionJSON(null);
        if (!session || typeof session !== "object") {
            return null;
        }

        const email = normalizeEmail(session.email);
        if (!email) {
            removeItem(KEYS.session);
            return null;
        }

        return {
            email,
            role: session.role === "admin" || email === ADMIN_EMAIL ? "admin" : "user",
            nickname: sanitizeNickname(session.nickname),
            username: sanitizeUsername(session.username),
            avatar: typeof session.avatar === "string" ? session.avatar : "",
            country: sanitizeLocation(session.country),
            city: sanitizeLocation(session.city),
            at: Number(session.at) || 0
        };
    }

    function setSessionFromUser(user) {
        if (!user || !user.email) {
            return false;
        }

        const profile = buildProfile(user);
        return writeSession({
            email: normalizeEmail(user.email),
            role: isAdmin(user) ? "admin" : "user",
            nickname: profile.nickname,
            username: profile.username,
            avatar: profile.avatar,
            country: profile.country,
            city: profile.city,
            at: Date.now()
        });
    }

    function clearSession() {
        const localOk = removeItem(KEYS.session);
        const storage = getSessionStorage();
        if (storage) {
            try {
                storage.removeItem(KEYS.session);
            } catch {
                // ignore
            }
        }
        return localOk;
    }

    function getCurrentUser() {
        const session = getSession();
        if (!session) {
            return null;
        }

        const user = findUserByEmail(session.email);
        if (user) {
            return user;
        }

        // Если users поврежден, восстанавливаем минимальный профиль из session.
        const recovered = {
            email: session.email,
            role: session.role === "admin" ? "admin" : "user",
            profile: {
                nickname: session.nickname || nicknameFromEmail(session.email),
                username: session.username || usernameFromNickname(session.nickname || nicknameFromEmail(session.email)),
                bio: "",
                avatar: session.avatar || "",
                country: sanitizeLocation(session.country),
                city: sanitizeLocation(session.city)
            }
        };

        const users = getUsers();
        users.push(recovered);
        saveUsers(users);

        return recovered;
    }
    function ensureAdminExists() {
        const users = getUsers();
        const index = users.findIndex((user) => normalizeEmail(user.email) === ADMIN_EMAIL);

        const defaultProfile = {
            nickname: "Админ",
            username: "admin",
            bio: "Управление сайтом",
            avatar: "",
            country: "",
            city: ""
        };

        let adminUser;

        if (index === -1) {
            adminUser = {
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                role: "admin",
                profile: defaultProfile
            };
            users.push(adminUser);
            saveUsers(users);
        } else {
            const existing = users[index];
            const mergedProfile = buildProfile({ email: ADMIN_EMAIL, profile: existing.profile });
            const normalizedProfile = {
                nickname: mergedProfile.nickname || defaultProfile.nickname,
                username: mergedProfile.username || defaultProfile.username,
                bio: mergedProfile.bio || defaultProfile.bio,
                avatar: mergedProfile.avatar,
                country: mergedProfile.country,
                city: mergedProfile.city
            };

            adminUser = {
                email: ADMIN_EMAIL,
                password: typeof existing.password === "string" ? existing.password : ADMIN_PASSWORD,
                role: "admin",
                profile: normalizedProfile
            };

            users[index] = adminUser;
            saveUsers(users);
        }

        // Если пароль ещё не хеширован — хешируем асинхронно при каждом вызове
        if (typeof adminUser.password === "string" && !adminUser.password.startsWith(PASSWORD_HASH_PREFIX)) {
            hashPassword(adminUser.password)
                .then((hashed) => {
                    const refreshed = getUsers();
                    const idx = refreshed.findIndex((user) => normalizeEmail(user.email) === ADMIN_EMAIL);
                    if (idx !== -1 && !refreshed[idx].password.startsWith(PASSWORD_HASH_PREFIX)) {
                        refreshed[idx] = { ...refreshed[idx], password: hashed };
                        saveUsers(refreshed);
                    }
                })
                .catch(() => {
                    // ignore
                });
        }

        return adminUser;
    }

    function isAdminPasswordValid(password) {
        return password === ADMIN_PASSWORD || password === ADMIN_PASSWORD_ALT;
    }

    // Обновляем только разрешенные поля профиля и синхронизируем сессию.
    function updateUserProfile(email, updates) {
        const normalized = normalizeEmail(email);
        if (!normalized) {
            return { ok: false, message: "Не удалось определить пользователя." };
        }

        const users = getUsers();
        const index = users.findIndex((user) => normalizeEmail(user.email) === normalized);

        if (index === -1) {
            return { ok: false, message: "Пользователь не найден." };
        }

        const currentUser = users[index];
        const currentProfile = buildProfile(currentUser);

        const hasNickname = Object.prototype.hasOwnProperty.call(updates || {}, "nickname");
        const nextNickname = hasNickname ? sanitizeNickname(updates.nickname) : currentProfile.nickname;

        if (!nextNickname) {
            return { ok: false, message: "Имя не может быть пустым." };
        }

        const hasAvatar = Object.prototype.hasOwnProperty.call(updates || {}, "avatar");
        const hasBio = Object.prototype.hasOwnProperty.call(updates || {}, "bio");
        const hasUsername = Object.prototype.hasOwnProperty.call(updates || {}, "username");
        const hasCountry = Object.prototype.hasOwnProperty.call(updates || {}, "country");
        const hasCity = Object.prototype.hasOwnProperty.call(updates || {}, "city");

        let nextUsername = hasUsername ? sanitizeUsername(updates.username) : currentProfile.username;
        if (!nextUsername) {
            nextUsername = usernameFromNickname(nextNickname);
        }

        const nextProfile = {
            nickname: nextNickname,
            username: nextUsername,
            bio: hasBio ? String(updates.bio || "").trim().slice(0, MAX_BIO_LENGTH) : currentProfile.bio,
            avatar: hasAvatar ? String(updates.avatar || "") : currentProfile.avatar,
            ...normalizeLocationPair(
                hasCountry ? updates.country : currentProfile.country,
                hasCity ? updates.city : currentProfile.city
            )
        };

        users[index] = {
            email: normalized,
            password: typeof currentUser.password === "string" ? currentUser.password : "",
            role: isAdmin(currentUser) ? "admin" : "user",
            profile: nextProfile
        };

        saveUsers(users);

        const session = getSession();
        if (session && normalizeEmail(session.email) === normalized) {
            setSessionFromUser(users[index]);
        }

        return { ok: true, user: users[index] };
    }

    // Обновляем email + профиль пользователя с проверками уникальности.
    function updateUserAccount(email, updates) {
        const normalized = normalizeEmail(email);
        if (!normalized) {
            return { ok: false, message: "Не удалось определить пользователя." };
        }

        const users = getUsers();
        const index = users.findIndex((user) => normalizeEmail(user.email) === normalized);
        if (index === -1) {
            return { ok: false, message: "Пользователь не найден." };
        }

        const currentUser = users[index];
        const currentProfile = buildProfile(currentUser);

        const nextNickname = sanitizeNickname(
            Object.prototype.hasOwnProperty.call(updates || {}, "nickname")
                ? updates.nickname
                : currentProfile.nickname
        );
        if (!nextNickname) {
            return { ok: false, message: "Имя не может быть пустым." };
        }

        const nextEmail = normalizeEmail(
            Object.prototype.hasOwnProperty.call(updates || {}, "email")
                ? updates.email
                : currentUser.email
        );
        if (!nextEmail || !isValidEmail(nextEmail)) {
            return { ok: false, message: "Введите корректный email." };
        }

        const hasDuplicate = users.some(
            (user, userIndex) => userIndex !== index && normalizeEmail(user.email) === nextEmail
        );
        if (hasDuplicate) {
            return { ok: false, message: "Такой email уже используется." };
        }

        const hasAvatar = Object.prototype.hasOwnProperty.call(updates || {}, "avatar");
        const hasBio = Object.prototype.hasOwnProperty.call(updates || {}, "bio");
        const hasUsername = Object.prototype.hasOwnProperty.call(updates || {}, "username");
        const hasCountry = Object.prototype.hasOwnProperty.call(updates || {}, "country");
        const hasCity = Object.prototype.hasOwnProperty.call(updates || {}, "city");

        let nextUsername = hasUsername ? sanitizeUsername(updates.username) : currentProfile.username;
        if (!nextUsername) {
            nextUsername = usernameFromNickname(nextNickname);
        }

        users[index] = {
            email: nextEmail,
            password: typeof currentUser.password === "string" ? currentUser.password : "",
            role: isAdmin(currentUser) ? "admin" : "user",
            profile: {
                nickname: nextNickname,
                username: nextUsername,
                bio: hasBio ? String(updates.bio || "").trim().slice(0, MAX_BIO_LENGTH) : currentProfile.bio,
                avatar: hasAvatar ? String(updates.avatar || "") : currentProfile.avatar,
                ...normalizeLocationPair(
                    hasCountry ? updates.country : currentProfile.country,
                    hasCity ? updates.city : currentProfile.city
                )
            }
        };

        saveUsers(users);

        // Если email изменился, переносим объявление на новый ключ владельца.
        if (normalized !== nextEmail) {
            const adsMap = getAdsMap();
            if (adsMap[normalized]) {
                adsMap[nextEmail] = {
                    ...adsMap[normalized],
                    ownerEmail: nextEmail,
                    updatedAt: Date.now()
                };
                delete adsMap[normalized];
                saveAdsMap(adsMap);
            }
        }

        const session = getSession();
        if (session && normalizeEmail(session.email) === normalized) {
            setSessionFromUser(users[index]);
        }

        return { ok: true, user: users[index] };
    }

    function isDataUrlForType(value, mimePrefix) {
        if (typeof value !== "string" || !value.startsWith("data:")) {
            return false;
        }

        if (typeof mimePrefix !== "string" || !mimePrefix) {
            return true;
        }

        return value.startsWith(`data:${mimePrefix}`);
    }

    function extractMimeTypeFromDataUrl(value) {
        if (typeof value !== "string" || !value.startsWith("data:")) {
            return "";
        }

        const markerIndex = value.indexOf(";");
        if (markerIndex <= 5) {
            return "";
        }

        return value.slice(5, markerIndex).trim().toLowerCase();
    }

    function sanitizeVideoPoster(value) {
        return isDataUrlForType(value, "image/") ? String(value) : "";
    }

    function normalizeVideoRef(item) {
        if (isDataUrlForType(item, "video/")) {
            const mimeType = extractMimeTypeFromDataUrl(item) || "video/mp4";
            return {
                id: "",
                mimeType,
                name: "video",
                size: 0,
                poster: "",
                dataUrl: String(item)
            };
        }

        if (!item || typeof item !== "object") {
            return null;
        }

        const id = String(item.id || "").trim();
        const directDataUrl = isDataUrlForType(item.dataUrl, "video/") ? String(item.dataUrl) : "";
        const legacySrcDataUrl = isDataUrlForType(item.src, "video/") ? String(item.src) : "";
        const dataUrl = directDataUrl || legacySrcDataUrl;

        let mimeType = String(item.mimeType || "").trim().toLowerCase();
        if (!mimeType && dataUrl) {
            mimeType = extractMimeTypeFromDataUrl(dataUrl);
        }

        if (!mimeType.startsWith("video/")) {
            return null;
        }

        if (!id && !dataUrl) {
            return null;
        }

        return {
            id,
            mimeType,
            name: String(item.name || "video"),
            size: Number(item.size || 0),
            poster: sanitizeVideoPoster(item.poster || item.cover),
            dataUrl
        };
    }

    function isVideoRef(value) {
        return Boolean(normalizeVideoRef(value));
    }

    function normalizeAdPayload(ownerEmail, payload) {
        const normalizedEmail = normalizeEmail(ownerEmail);
        if (!normalizedEmail) {
            return null;
        }

        const text = sanitizeAdText(payload?.text);
        const photosRaw = Array.isArray(payload?.photos) ? payload.photos : [];
        const videosRaw = Array.isArray(payload?.videos) ? payload.videos : [];
        const location = normalizeLocationPair(payload?.country, payload?.city);

        const photos = photosRaw
            .filter((item) => isDataUrlForType(item, "image/"))
            .slice(0, MAX_AD_PHOTOS);

        const videos = videosRaw
            .map((item) => normalizeVideoRef(item))
            .filter((item) => Boolean(item))
            .slice(0, MAX_AD_VIDEOS)
            .map((item) => ({
                id: String(item.id || ""),
                mimeType: String(item.mimeType || "video/mp4"),
                name: String(item.name || "video"),
                size: Number(item.size || 0),
                poster: String(item.poster || ""),
                dataUrl: isDataUrlForType(item.dataUrl, "video/") ? String(item.dataUrl) : ""
            }));

        const cover = String(payload?.cover || "");

        return {
            ownerEmail: normalizedEmail,
            text,
            photos,
            videos,
            cover,
            country: location.country,
            city: location.city,
            updatedAt: Number(payload?.updatedAt) || Date.now()
        };
    }

    function getAdsMap() {
        const raw = safeReadJSON(KEYS.ads, {});
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return {};
        }

        const next = {};

        Object.entries(raw).forEach(([email, payload]) => {
            const normalized = normalizeAdPayload(email, payload);
            if (!normalized) {
                return;
            }

            if (!normalized.text || normalized.photos.length === 0) {
                return;
            }

            if (!normalized.country || !normalized.city) {
                return;
            }

            next[normalized.ownerEmail] = normalized;
        });

        return next;
    }

    function saveAdsMap(map) {
        return safeWriteJSON(KEYS.ads, map);
    }

    function getAdByUser(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return null;
        }

        const adsMap = getAdsMap();
        return adsMap[normalizedEmail] || null;
    }

    function saveAdForUser(email, adPayload) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return { ok: false, message: "Не удалось определить пользователя." };
        }

        const normalized = normalizeAdPayload(normalizedEmail, adPayload);
        if (!normalized) {
            return { ok: false, message: "Некорректные данные объявления." };
        }

        if (!normalized.text) {
            return { ok: false, message: "Текст объявления не может быть пустым." };
        }

        if (normalized.photos.length === 0) {
            return { ok: false, message: "Добавьте минимум 1 фото для обложки." };
        }

        if (normalized.photos.length > MAX_AD_PHOTOS) {
            return { ok: false, message: `Можно загрузить не более ${MAX_AD_PHOTOS} фото.` };
        }

        if (normalized.videos.length > MAX_AD_VIDEOS) {
            return { ok: false, message: `Можно загрузить не более ${MAX_AD_VIDEOS} видео.` };
        }

        if (!normalized.country || !normalized.city) {
            return { ok: false, message: "Укажите страну и город объявления." };
        }

        const adsMap = getAdsMap();
        const previous = adsMap[normalizedEmail];
        adsMap[normalizedEmail] = {
            ...normalized,
            updatedAt: Date.now()
        };

        if (Array.isArray(previous?.videos)) {
            const nextIds = new Set(
                adsMap[normalizedEmail].videos
                    .map((item) => String(item.id || "").trim())
                    .filter(Boolean)
            );
            previous.videos.forEach((videoRef) => {
                const prevId = String(videoRef?.id || "").trim();
                if (prevId && !nextIds.has(prevId)) {
                    deleteStoredVideo(prevId).catch(() => {
                        // ignore
                    });
                }
            });
        }

        if (!saveAdsMap(adsMap)) {
            return { ok: false, message: "Не удалось сохранить объявление. Проверьте доступ к localStorage." };
        }

        return { ok: true, ad: adsMap[normalizedEmail] };
    }

    function deleteAdForUser(email) {
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return { ok: false, message: "Не удалось определить пользователя." };
        }

        const adsMap = getAdsMap();
        if (!Object.prototype.hasOwnProperty.call(adsMap, normalizedEmail)) {
            return { ok: true };
        }

        const existing = adsMap[normalizedEmail];
        if (Array.isArray(existing?.videos)) {
            existing.videos.forEach((videoRef) => {
                const videoId = String(videoRef?.id || "").trim();
                if (!videoId) {
                    return;
                }
                deleteStoredVideo(videoId).catch(() => {
                    // ignore
                });
            });
        }

        delete adsMap[normalizedEmail];
        if (!saveAdsMap(adsMap)) {
            return { ok: false, message: "Не удалось удалить объявление." };
        }

        return { ok: true };
    }

    function getAdsFeed() {
        const adsMap = getAdsMap();
        const users = getUsers();
        const userByEmail = new Map(users.map((item) => [normalizeEmail(item.email), item]));

        return Object.values(adsMap)
            .map((ad) => {
                const user = userByEmail.get(ad.ownerEmail);
                const profile = buildProfile(user || { email: ad.ownerEmail, profile: {} });

                return {
                    ...ad,
                    ownerNickname: profile.nickname,
                    ownerAvatar: profile.avatar,
                    country: ad.country || profile.country,
                    city: ad.city || profile.city
                };
            })
            .filter((ad) => ad.country && ad.city)
            .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    }

    async function changeUserPassword(email, currentPassword, newPassword) {
        const normalized = normalizeEmail(email);
        if (!normalized) {
            return { ok: false, message: "Не удалось определить пользователя." };
        }

        const users = getUsers();
        const index = users.findIndex((user) => normalizeEmail(user.email) === normalized);
        if (index === -1) {
            return { ok: false, message: "Пользователь не найден." };
        }

        const user = users[index];
        const currentValue = String(currentPassword || "").trim();
        const nextValue = String(newPassword || "").trim();

        if (!currentValue || !nextValue) {
            return { ok: false, message: "Заполните все поля пароля." };
        }

        // Проверяем текущий пароль через verifyPassword (поддерживает хеши md5sha1:)
        const isValid = await verifyPassword(user.password, currentValue);
        if (!isValid) {
            return { ok: false, message: "Текущий пароль введен неверно." };
        }

        if (nextValue.length < MIN_PASSWORD_LENGTH) {
            return { ok: false, message: `Новый пароль минимум ${MIN_PASSWORD_LENGTH} символов.` };
        }

        if (currentValue === nextValue) {
            return { ok: false, message: "Новый пароль должен отличаться от текущего." };
        }

        // Хешируем новый пароль перед сохранением
        const hashedPassword = await hashPassword(nextValue);
        users[index] = {
            ...user,
            password: hashedPassword
        };

        saveUsers(users);

        return { ok: true, message: "Пароль успешно изменен." };
    }

    function setImageWithFallback(imageElement, avatar, nickname) {
        if (!imageElement) {
            return;
        }

        const fallback = makeAvatarPlaceholder(nickname);
        imageElement.onerror = () => {
            imageElement.onerror = null;
            imageElement.src = fallback;
        };

        imageElement.src = avatar || fallback;
    }

    function readFileAsDataURL(file, options = {}) {
        const acceptPrefix = String(options.acceptPrefix || "");
        const maxSizeBytes = Number(options.maxSizeBytes || 0) || MAX_AVATAR_SIZE_BYTES;
        const typeError = String(options.typeError || "Недопустимый тип файла.");
        const sizeError = String(options.sizeError || "Файл слишком большой.");

        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("Файл не выбран."));
                return;
            }

            if (acceptPrefix && !String(file.type || "").startsWith(acceptPrefix)) {
                reject(new Error(typeError));
                return;
            }

            if (Number(file.size || 0) > maxSizeBytes) {
                reject(new Error(sizeError));
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = () => reject(new Error("Не удалось прочитать файл."));
            reader.readAsDataURL(file);
        });
    }

    // Проверяем размер/тип файла перед сохранением base64 в localStorage.
    function readImageAsDataURL(file, maxSizeBytes = MAX_AVATAR_SIZE_BYTES) {
        return readFileAsDataURL(file, {
            acceptPrefix: "image/",
            maxSizeBytes,
            typeError: "Можно загрузить только изображение.",
            sizeError: `Файл слишком большой (максимум ${Math.round(maxSizeBytes / (1024 * 1024)) || 1} MB).`
        });
    }

    function captureVideoPoster(file) {
        return new Promise((resolve) => {
            if (!file || !String(file.type || "").startsWith("video/")) {
                resolve("");
                return;
            }

            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement("video");
            let settled = false;
            let fallbackTimer = 0;

            const cleanup = () => {
                if (fallbackTimer) {
                    window.clearTimeout(fallbackTimer);
                    fallbackTimer = 0;
                }

                try {
                    video.pause();
                    video.removeAttribute("src");
                    video.load();
                } catch {
                    // ignore
                }

                try {
                    URL.revokeObjectURL(objectUrl);
                } catch {
                    // ignore
                }
            };

            const settle = (posterData) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                resolve(String(posterData || ""));
            };

            const drawPoster = () => {
                const width = Number(video.videoWidth || 0);
                const height = Number(video.videoHeight || 0);
                if (!width || !height) {
                    settle("");
                    return;
                }

                const scale = width > VIDEO_POSTER_MAX_WIDTH
                    ? VIDEO_POSTER_MAX_WIDTH / width
                    : 1;

                const targetWidth = Math.max(1, Math.round(width * scale));
                const targetHeight = Math.max(1, Math.round(height * scale));

                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const context = canvas.getContext("2d");
                if (!context) {
                    settle("");
                    return;
                }

                context.drawImage(video, 0, 0, targetWidth, targetHeight);
                settle(canvas.toDataURL("image/jpeg", VIDEO_POSTER_QUALITY));
            };

            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;

            video.onloadeddata = () => {
                const duration = Number(video.duration || 0);
                const targetTime = duration > 0
                    ? Math.min(VIDEO_POSTER_TIME_SEC, Math.max(duration * 0.1, 0))
                    : 0;

                if (targetTime > 0) {
                    try {
                        video.currentTime = targetTime;
                        return;
                    } catch {
                        drawPoster();
                        return;
                    }
                }

                drawPoster();
            };

            video.onseeked = drawPoster;
            video.onerror = () => settle("");
            video.onabort = () => settle("");

            fallbackTimer = window.setTimeout(() => {
                settle("");
            }, 9000);

            video.src = objectUrl;
            try {
                video.load();
            } catch {
                settle("");
            }
        });
    }

    function openMediaDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("Ваш браузер не поддерживает IndexedDB."));
                return;
            }

            const request = window.indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);

            request.onupgradeneeded = () => {
                const database = request.result;
                if (!database.objectStoreNames.contains(MEDIA_DB_STORE)) {
                    database.createObjectStore(MEDIA_DB_STORE, { keyPath: "id" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error("Не удалось открыть хранилище медиа."));
        });
    }

    function runMediaStore(mode, runner) {
        return openMediaDatabase().then((database) => new Promise((resolve, reject) => {
            const transaction = database.transaction(MEDIA_DB_STORE, mode);
            const store = transaction.objectStore(MEDIA_DB_STORE);

            let settled = false;
            const settleResolve = (value) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(value);
            };
            const settleReject = (error) => {
                if (settled) {
                    return;
                }
                settled = true;
                reject(error);
            };

            transaction.oncomplete = () => {
                database.close();
            };
            transaction.onerror = () => {
                database.close();
                settleReject(transaction.error || new Error("Ошибка транзакции медиа-хранилища."));
            };
            transaction.onabort = () => {
                database.close();
                settleReject(transaction.error || new Error("Транзакция медиа-хранилища прервана."));
            };

            try {
                runner(store, settleResolve, settleReject);
            } catch (error) {
                database.close();
                settleReject(error instanceof Error ? error : new Error("Неизвестная ошибка медиа-хранилища."));
            }
        }));
    }

    function storeVideoFile(file, maxSizeBytes = MAX_AD_VIDEO_SIZE_BYTES, meta = {}) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("Файл не выбран."));
                return;
            }

            if (!String(file.type || "").startsWith("video/")) {
                reject(new Error("Можно загрузить только видео."));
                return;
            }

            if (Number(file.size || 0) > maxSizeBytes) {
                reject(new Error(`Видео слишком большое (максимум ${Math.floor(maxSizeBytes / (1024 * 1024))} MB).`));
                return;
            }

            const id = `video_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            const payload = {
                id,
                mimeType: String(file.type || "video/mp4"),
                name: String(file.name || "video"),
                size: Number(file.size || 0),
                poster: sanitizeVideoPoster(meta.poster),
                blob: file
            };

            runMediaStore("readwrite", (store, done, fail) => {
                const request = store.put(payload);
                request.onsuccess = () => {
                    done({
                        id: payload.id,
                        mimeType: payload.mimeType,
                        name: payload.name,
                        size: payload.size,
                        poster: payload.poster,
                        dataUrl: isDataUrlForType(meta.dataUrl, "video/") ? String(meta.dataUrl) : ""
                    });
                };
                request.onerror = () => fail(new Error("Не удалось сохранить видео в IndexedDB."));
            }).then(resolve).catch(reject);
        });
    }

    function getStoredVideoBlob(videoId) {
        const id = String(videoId || "");
        if (!id) {
            return Promise.resolve(null);
        }

        return runMediaStore("readonly", (store, done, fail) => {
            const request = store.get(id);
            request.onsuccess = () => {
                const row = request.result;
                done(row && row.blob ? row.blob : null);
            };
            request.onerror = () => fail(new Error("Не удалось прочитать видео из IndexedDB."));
        }).catch(() => null);
    }

    function deleteStoredVideo(videoId) {
        const id = String(videoId || "");
        if (!id) {
            return Promise.resolve(false);
        }

        return runMediaStore("readwrite", (store, done, fail) => {
            const request = store.delete(id);
            request.onsuccess = () => done(true);
            request.onerror = () => fail(new Error("Не удалось удалить видео из IndexedDB."));
        }).catch(() => false);
    }

    function incrementVisits() {
        const current = Number(getItem(KEYS.visits) || 0);
        setItem(KEYS.visits, String(current + 1));
    }

    function resetHourlyVisitsIfNeeded() {
        const today = new Date().toISOString().slice(0, 10);
        const storedDate = getItem(KEYS.hourlyVisitsDate);

        if (storedDate !== today) {
            setItem(KEYS.hourlyVisitsDate, today);
            safeWriteJSON(KEYS.hourlyVisits, new Array(24).fill(0));
        }
    }

    function trackHourlyVisit() {
        const raw = safeReadJSON(KEYS.hourlyVisits, new Array(24).fill(0));
        const data = Array.isArray(raw) && raw.length === 24 ? raw : new Array(24).fill(0);
        const hour = new Date().getHours();

        data[hour] = Number(data[hour] || 0) + 1;
        safeWriteJSON(KEYS.hourlyVisits, data);
    }

    function resetTodayLoginsIfNeeded() {
        const today = new Date().toISOString().slice(0, 10);
        const storedDate = getItem(KEYS.todayLoginsDate);

        if (storedDate !== today) {
            setItem(KEYS.todayLoginsDate, today);
            setItem(KEYS.todayLogins, "0");
        }
    }

    function incrementTodayLogins() {
        const count = Number(getItem(KEYS.todayLogins) || 0);
        setItem(KEYS.todayLogins, String(count + 1));
    }

    function enableRippleEffects(root = document) {
        if (!root || root.__rippleBound) {
            return;
        }

        root.__rippleBound = true;
        root.addEventListener("click", (event) => {
            const target = event.target.closest(".btn, .dropdown-item, .country-btn, .icon-btn, .tabs button, .avatar-edit-btn");
            if (!target || target.classList.contains("no-ripple")) {
                return;
            }

            const rect = target.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const ripple = document.createElement("span");
            ripple.className = "ripple-effect";
            ripple.style.width = `${size}px`;
            ripple.style.height = `${size}px`;
            ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
            ripple.style.top = `${event.clientY - rect.top - size / 2}px`;

            const computed = window.getComputedStyle(target);
            if (computed.position === "static") {
                target.style.position = "relative";
            }
            target.style.overflow = "hidden";

            target.appendChild(ripple);
            window.setTimeout(() => ripple.remove(), 500);
        });
    }

    function enablePageTransitions() {
        const body = document.body;
        if (!body || body.__pageTransitionBound) {
            return;
        }

        body.__pageTransitionBound = true;
        body.classList.add("page-fade-enter");
        window.requestAnimationFrame(() => {
            body.classList.add("page-fade-enter-active");
        });

        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[href]");
            if (!link) {
                return;
            }

            const href = link.getAttribute("href") || "";
            const target = link.getAttribute("target");
            if (
                target === "_blank" ||
                href.startsWith("#") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("javascript:")
            ) {
                return;
            }

            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            const nextUrl = new URL(link.href, window.location.href);
            const currentUrl = new URL(window.location.href);
            if (nextUrl.origin !== currentUrl.origin) {
                return;
            }

            event.preventDefault();
            body.classList.add("page-fade-leave");
            window.setTimeout(() => {
                window.location.href = link.href;
            }, 280);
        });
    }

    // Превращаем нативный select в стилизованный dropdown, но оставляем
    // исходный select в DOM для совместимости с текущей логикой и валидацией.
    function enhanceSelect(selectElement) {
        if (!selectElement || selectElement.dataset.enhancedSelect === "1") {
            return null;
        }

        const parent = selectElement.parentElement;
        if (!parent) {
            return null;
        }

        selectElement.dataset.enhancedSelect = "1";
        selectElement.classList.add("native-select-hidden");
        selectElement.tabIndex = -1;

        const wrapper = document.createElement("div");
        wrapper.className = "smart-select";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "smart-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");

        const valueNode = document.createElement("span");
        valueNode.className = "smart-select-value";

        const arrowNode = document.createElement("span");
        arrowNode.className = "smart-select-arrow";
        arrowNode.setAttribute("aria-hidden", "true");
        arrowNode.textContent = "▾";

        trigger.appendChild(valueNode);
        trigger.appendChild(arrowNode);

        const menu = document.createElement("div");
        menu.className = "smart-select-menu hidden";
        menu.setAttribute("role", "listbox");

        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);

        parent.insertBefore(wrapper, selectElement);

        function closeMenu() {
            wrapper.classList.remove("open");
            trigger.setAttribute("aria-expanded", "false");
            menu.classList.add("hidden");
        }

        function openMenu() {
            if (selectElement.disabled) {
                return;
            }

            document.querySelectorAll(".smart-select.open").forEach((opened) => {
                if (opened !== wrapper) {
                    opened.classList.remove("open");
                    const openedTrigger = opened.querySelector(".smart-select-trigger");
                    const openedMenu = opened.querySelector(".smart-select-menu");
                    openedTrigger?.setAttribute("aria-expanded", "false");
                    openedMenu?.classList.add("hidden");
                }
            });

            wrapper.classList.add("open");
            trigger.setAttribute("aria-expanded", "true");
            menu.classList.remove("hidden");
        }

        function setValue(value) {
            selectElement.value = String(value ?? "");
            selectElement.dispatchEvent(new Event("change", { bubbles: true }));
        }

        function renderMenu() {
            menu.innerHTML = "";
            const options = Array.from(selectElement.options);

            if (!options.length) {
                const emptyNode = document.createElement("div");
                emptyNode.className = "smart-select-empty";
                emptyNode.textContent = "Нет вариантов";
                menu.appendChild(emptyNode);
                return;
            }

            options.forEach((option) => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "smart-select-option";
                item.textContent = option.textContent || "";
                item.dataset.value = option.value;
                item.disabled = option.disabled;

                if (option.selected) {
                    item.classList.add("active");
                }

                item.addEventListener("click", () => {
                    if (option.disabled) {
                        return;
                    }

                    setValue(option.value);
                    closeMenu();
                });

                menu.appendChild(item);
            });
        }

        function renderTrigger() {
            const selectedOption = selectElement.selectedOptions?.[0] || selectElement.options?.[0] || null;
            const selectedText = selectedOption?.textContent || "Выберите вариант";
            const selectedValue = selectElement.value;

            valueNode.textContent = selectedText;
            trigger.classList.toggle("is-placeholder", !selectedValue);
            wrapper.classList.toggle("is-disabled", Boolean(selectElement.disabled));
            trigger.disabled = Boolean(selectElement.disabled);
        }

        function refresh() {
            renderTrigger();
            renderMenu();
        }

        trigger.addEventListener("click", () => {
            if (wrapper.classList.contains("open")) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        selectElement.addEventListener("change", refresh);

        const onDocumentClick = (event) => {
            if (!wrapper.contains(event.target)) {
                closeMenu();
            }
        };
        document.addEventListener("click", onDocumentClick);

        const onEscape = (event) => {
            if (event.key === "Escape") {
                closeMenu();
            }
        };
        document.addEventListener("keydown", onEscape);

        const observer = new MutationObserver(() => {
            refresh();
        });
        observer.observe(selectElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["disabled", "selected"]
        });

        refresh();

        return {
            refresh,
            destroy() {
                closeMenu();
                observer.disconnect();
                document.removeEventListener("click", onDocumentClick);
                document.removeEventListener("keydown", onEscape);
                selectElement.removeEventListener("change", refresh);
                wrapper.remove();
                selectElement.classList.remove("native-select-hidden");
                selectElement.tabIndex = 0;
            }
        };
    }

    window.AppCore = Object.freeze({
        LOCATION_DATA,
        ADMIN_EMAIL,
        ADMIN_PASSWORD,
        ADMIN_PASSWORD_ALT,
        MAX_AVATAR_SIZE_BYTES,
        MAX_AD_PHOTOS,
        MAX_AD_VIDEOS,
        MAX_AD_TEXT_LENGTH,
        MAX_AD_IMAGE_SIZE_BYTES,
        MAX_AD_VIDEO_SIZE_BYTES,
        MAX_NICKNAME_LENGTH,
        MIN_PASSWORD_LENGTH,
        PASSWORD_HASH_PREFIX,
        KEYS,
        normalizeEmail,
        isValidEmail,
        hashPassword,
        verifyPassword,
        sanitizeNickname,
        sanitizeLocation,
        sanitizeAdText,
        sanitizeUsername,
        getCitiesByCountry,
        nicknameFromEmail,
        usernameFromNickname,
        makeAvatarPlaceholder,
        safeReadJSON,
        safeWriteJSON,
        getUsers,
        saveUsers,
        migrateUsers,
        findUserByEmail,
        isAdmin,
        getSession,
        setSessionFromUser,
        clearSession,
        getCurrentUser,
        ensureAdminExists,
        isAdminPasswordValid,
        updateUserProfile,
        updateUserAccount,
        getAdByUser,
        saveAdForUser,
        deleteAdForUser,
        getAdsFeed,
        changeUserPassword,
        setImageWithFallback,
        readFileAsDataURL,
        readImageAsDataURL,
        captureVideoPoster,
        storeVideoFile,
        getStoredVideoBlob,
        deleteStoredVideo,
        incrementVisits,
        resetHourlyVisitsIfNeeded,
        trackHourlyVisit,
        resetTodayLoginsIfNeeded,
        incrementTodayLogins,
        enableRippleEffects,
        enablePageTransitions,
        enhanceSelect
    });
})(window);


