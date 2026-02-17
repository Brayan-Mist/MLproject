const refs = {};
let registerPending = false;

init();

function init() {
    AppCore.enablePageTransitions();
    AppCore.enableRippleEffects(document);

    AppCore.ensureAdminExists();
    AppCore.migrateUsers();
    AppCore.resetTodayLoginsIfNeeded();

    cacheRefs();
    initLocationFields();
    bindEvents();

    if (window.location.hash === "#register") {
        openRegister();
    } else {
        openLogin();
    }
}

function cacheRefs() {
    refs.loginTab = document.getElementById("loginTab");
    refs.registerTab = document.getElementById("registerTab");
    refs.loginForm = document.getElementById("loginForm");
    refs.registerForm = document.getElementById("registerForm");
    refs.authTitle = document.getElementById("authTitle");
    refs.authMessage = document.getElementById("authMessage");

    refs.loginEmail = document.getElementById("loginEmail");
    refs.loginPassword = document.getElementById("loginPassword");

    refs.registerNickname = document.getElementById("registerNickname");
    refs.registerEmail = document.getElementById("registerEmail");
    refs.registerPassword = document.getElementById("registerPassword");
    refs.registerConfirm = document.getElementById("registerConfirm");
    refs.registerCountry = document.getElementById("registerCountry");
    refs.registerCity = document.getElementById("registerCity");
    refs.registerCountrySelectUi = null;
    refs.registerCitySelectUi = null;
}

function initLocationFields() {
    if (!refs.registerCountry || !refs.registerCity) {
        return;
    }

    const countries = Object.keys(AppCore.LOCATION_DATA || {});
    refs.registerCountry.innerHTML = '<option value="">Выберите страну</option>';
    countries.forEach((country) => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        refs.registerCountry.appendChild(option);
    });

    fillCityOptions("");

    refs.registerCountrySelectUi = AppCore.enhanceSelect(refs.registerCountry);
    refs.registerCitySelectUi = AppCore.enhanceSelect(refs.registerCity);
    refs.registerCountrySelectUi?.refresh();
    refs.registerCitySelectUi?.refresh();
}

function bindEvents() {
    refs.loginTab?.addEventListener("click", openLogin);
    refs.registerTab?.addEventListener("click", openRegister);
    refs.loginForm?.addEventListener("submit", onLogin);
    refs.registerForm?.addEventListener("submit", onRegister);
    refs.registerCountry?.addEventListener("change", () => {
        fillCityOptions(refs.registerCountry.value);
    });
}

function fillCityOptions(country, selectedCity = "") {
    if (!refs.registerCity) {
        return;
    }

    const cities = AppCore.getCitiesByCountry(country);
    refs.registerCity.innerHTML = "";

    if (!cities.length) {
        refs.registerCity.disabled = true;
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Сначала выберите страну";
        refs.registerCity.appendChild(option);
        refs.registerCitySelectUi?.refresh();
        return;
    }

    refs.registerCity.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите город";
    refs.registerCity.appendChild(placeholder);

    cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        if (city === selectedCity) {
            option.selected = true;
        }
        refs.registerCity.appendChild(option);
    });

    refs.registerCitySelectUi?.refresh();
}

function openLogin() {
    refs.authTitle.textContent = "Вход";
    refs.loginForm.classList.remove("hidden");
    refs.registerForm.classList.add("hidden");
    refs.loginTab.classList.add("active");
    refs.registerTab.classList.remove("active");
    clearMessage();
}

function openRegister() {
    refs.authTitle.textContent = "Регистрация";
    refs.registerForm.classList.remove("hidden");
    refs.loginForm.classList.add("hidden");
    refs.registerTab.classList.add("active");
    refs.loginTab.classList.remove("active");
    fillCityOptions(refs.registerCountry?.value || "", refs.registerCity?.value || "");
    refs.registerCountrySelectUi?.refresh();
    refs.registerCitySelectUi?.refresh();
    clearMessage();
}

function onLogin(event) {
    event.preventDefault();

    const email = AppCore.normalizeEmail(refs.loginEmail.value);
    const password = String(refs.loginPassword.value || "").trim();

    if (!email || !password) {
        setMessage("Введите email и пароль.", "error");
        return;
    }

    if (!AppCore.isValidEmail(email)) {
        setMessage("Введите корректный email.", "error");
        return;
    }

    if (email === AppCore.ADMIN_EMAIL && AppCore.isAdminPasswordValid(password)) {
        const adminUser = AppCore.ensureAdminExists();
        AppCore.incrementTodayLogins();

        if (!AppCore.setSessionFromUser(adminUser)) {
            setMessage("Не удалось сохранить сессию администратора. Проверьте localStorage.", "error");
            return;
        }

        localStorage.setItem(AppCore.KEYS.adminBypass, String(Date.now()));
        location.href = "admin.html?admin=1";
        return;
    }

    const user = AppCore.getUsers().find((item) => AppCore.normalizeEmail(item.email) === email);
    if (!user) {
        setMessage("Неверный email или пароль.", "error");
        return;
    }

    AppCore.verifyPassword(user.password, password).then((isValid) => {
        if (!isValid) {
            setMessage("Неверный email или пароль.", "error");
            return;
        }

        // Миграция: если пароль был сохранён в открытом виде, обновляем на hash (md5(sha1()))
        if (typeof user.password === "string" && !user.password.startsWith("md5sha1:")) {
            AppCore.hashPassword(password)
                .then((hashed) => {
                    const users = AppCore.getUsers();
                    const idx = users.findIndex((item) => AppCore.normalizeEmail(item.email) === email);
                    if (idx !== -1) {
                        users[idx] = { ...users[idx], password: hashed };
                        AppCore.saveUsers(users);
                    }
                })
                .catch(() => {
                    // ignore
                });
        }

        AppCore.incrementTodayLogins();

        if (!AppCore.setSessionFromUser(user)) {
            setMessage("Не удалось сохранить сессию. Проверьте доступ к localStorage (лучше запускать через http://localhost).", "error");
            return;
        }

        if (AppCore.isAdmin(user)) {
            location.href = "admin.html";
            return;
        }

        location.href = "index.html";
    });

}

function onRegister(event) {
    event.preventDefault();
    if (registerPending) {
        return;
    }

    const nickname = AppCore.sanitizeNickname(refs.registerNickname.value);
    const email = AppCore.normalizeEmail(refs.registerEmail.value);
    const password = String(refs.registerPassword.value || "").trim();
    const confirm = String(refs.registerConfirm.value || "").trim();
    const country = AppCore.sanitizeLocation(refs.registerCountry?.value || "");
    const city = AppCore.sanitizeLocation(refs.registerCity?.value || "");

    if (!nickname || !email || !password || !confirm || !country || !city) {
        setMessage("Заполните все поля.", "error");
        return;
    }

    const validCities = AppCore.getCitiesByCountry(country);
    if (!validCities.includes(city)) {
        setMessage("Выберите корректную страну и город.", "error");
        return;
    }

    if (!AppCore.isValidEmail(email)) {
        setMessage("Введите корректный email.", "error");
        return;
    }

    if (password.length < 6) {
        setMessage("Пароль минимум 6 символов.", "error");
        return;
    }

    if (password !== confirm) {
        setMessage("Пароли не совпадают.", "error");
        return;
    }

    if (window.Supa?.enabled) {
        setRegisterPending(true);
        setMessage("Создаем аккаунт...", "");
        window.Supa
            .signUp(email, password)
            .then((result) => {
                if (!result.ok) {
                    setMessage(mapRegisterError(result.error), "error");
                    return;
                }

                // Email confirm включен: пользователь должен подтвердить почту.
                // Профиль создастся триггером в БД.
                setMessage("Аккаунт создан. Подтвердите email (письмо от Supabase) и затем выполните вход.", "success");
                refs.loginEmail.value = email;
                refs.loginPassword.value = "";
                openLogin();
            })
            .catch(() => {
                setMessage("Ошибка регистрации.", "error");
            })
            .finally(() => {
                setRegisterPending(false);
            });
        return;
    }

    const users = AppCore.getUsers();
    const exists = users.some((item) => AppCore.normalizeEmail(item.email) === email);

    if (exists) {
        setMessage("Пользователь с таким email уже существует.", "error");
        return;
    }

    AppCore.hashPassword(password)
        .then((hashedPassword) => {
            const newUser = {
                email,
                password: hashedPassword,
                role: "user",
                profile: {
                    nickname,
                    username: AppCore.usernameFromNickname(nickname),
                    bio: "",
                    avatar: "",
                    country,
                    city
                }
            };

            users.push(newUser);
            AppCore.saveUsers(users);
            AppCore.incrementTodayLogins();

            if (!AppCore.setSessionFromUser(newUser)) {
                setMessage("Аккаунт создан, но сессия не сохранилась. Проверьте доступ к localStorage (лучше запускать через http://localhost).", "error");
                return;
            }

            setMessage("Регистрация успешна. Переход на главную...", "success");

            setTimeout(() => {
                location.href = "index.html";
            }, 300);
        })
        .catch(() => {
            setMessage("Не удалось обработать пароль. Попробуйте другой браузер.", "error");
        });
}

function setMessage(text, type = "") {
    refs.authMessage.textContent = text;
    refs.authMessage.classList.remove("error", "success");

    if (type) {
        refs.authMessage.classList.add(type);
    }
}

function clearMessage() {
    setMessage("");
}

function setRegisterPending(pending) {
    registerPending = Boolean(pending);
    const submitButton = refs.registerForm?.querySelector('button[type="submit"]');
    if (!submitButton) {
        return;
    }
    submitButton.disabled = registerPending;
    if (registerPending) {
        submitButton.setAttribute("aria-busy", "true");
    } else {
        submitButton.removeAttribute("aria-busy");
    }
}

function mapRegisterError(error) {
    const raw = String(error || "").trim();
    const message = raw.toLowerCase();

    if (message.includes("email rate limit exceeded")) {
        return "Слишком много попыток. Подождите 1-2 минуты и повторите регистрацию.";
    }

    if (message.includes("user already registered")) {
        return "Пользователь с таким email уже зарегистрирован.";
    }

    return raw || "Ошибка регистрации.";
}
