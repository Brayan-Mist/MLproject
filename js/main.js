const state = {
    currentUser: null,
    pendingAvatarData: "",
    removeAvatar: false,
    activeModal: null,
    pendingAdPhotos: [],
    pendingAdVideos: [],
    activeCountryFilter: "",
    activeCityFilter: "",
    expandedCountries: new Set()
};

const refs = {};

init();

function init() {
    AppCore.enablePageTransitions();
    AppCore.enableRippleEffects(document);

    AppCore.migrateUsers();
    AppCore.incrementVisits();
    AppCore.resetHourlyVisitsIfNeeded();
    AppCore.trackHourlyVisit();

    cacheRefs();
    initAdLocationOptions();
    initAdLocationSelectUi();
    bindHeaderEvents();
    bindModalEvents();
    renderCountries();
    renderHeader();
    if (window.Supa?.enabled) {
        loadSupabaseCurrentUser().then(() => {
            renderHeader();
            renderAdsFeed();
        });
    } else {
        renderAdsFeed();
    }

    window.requestAnimationFrame(() => {
        refs.countriesPanel?.classList.add("sidebar-ready");
    });
}

async function loadSupabaseCurrentUser() {
    try {
        const session = await window.Supa.getSession();
        const userId = session?.user?.id;
        if (!userId) {
            state.currentUser = null;
            return null;
        }
        const profileResult = await window.Supa.getProfile(userId);
        const profile = profileResult.ok ? profileResult.profile : null;
        state.currentUser = {
            id: userId,
            email: String(session.user.email || ""),
            role: String(profile?.role || "user"),
            profile: {
                nickname: String(profile?.nickname || "").trim(),
                username: "",
                bio: "",
                avatar: profile?.avatar_path ? window.Supa.getPublicUrl("avatars", profile.avatar_path) : "",
                country: String(profile?.country || ""),
                city: String(profile?.city || "")
            }
        };
        return state.currentUser;
    } catch {
        state.currentUser = null;
        return null;
    }
}

function cacheRefs() {
    refs.guestActions = document.getElementById("guestActions");
    refs.userMenu = document.getElementById("userMenu");
    refs.profileTrigger = document.getElementById("profileTrigger");
    refs.headerAvatar = document.getElementById("headerAvatar");
    refs.headerNickname = document.getElementById("headerNickname");
    refs.profileDropdown = document.getElementById("profileDropdown");
    refs.dropdownAvatar = document.getElementById("dropdownAvatar");
    refs.dropdownNickname = document.getElementById("dropdownNickname");
    refs.dropdownEmail = document.getElementById("dropdownEmail");
    refs.dropdownAdminLink = document.getElementById("dropdownAdminLink");
    refs.countriesPanel = document.getElementById("countriesPanel");
    refs.clearLocationFilterBtn = document.getElementById("clearLocationFilterBtn");

    refs.adsGrid = document.getElementById("adsGrid");
    refs.adsEmpty = document.getElementById("adsEmpty");

    refs.viewProfileModal = document.getElementById("viewProfileModal");
    refs.closeViewProfileModal = document.getElementById("closeViewProfileModal");
    refs.viewProfileAvatar = document.getElementById("viewProfileAvatar");
    refs.viewProfileNickname = document.getElementById("viewProfileNickname");
    refs.viewProfileEmail = document.getElementById("viewProfileEmail");
    refs.viewProfileRole = document.getElementById("viewProfileRole");

    refs.editProfileModal = document.getElementById("editProfileModal");
    refs.closeEditProfileModal = document.getElementById("closeEditProfileModal");
    refs.cancelEditProfileBtn = document.getElementById("cancelEditProfileBtn");
    refs.editProfileForm = document.getElementById("editProfileForm");
    refs.editProfileNickname = document.getElementById("editProfileNickname");
    refs.editProfileEmail = document.getElementById("editProfileEmail");
    refs.editProfileAvatarInput = document.getElementById("editProfileAvatarInput");
    refs.editProfileAvatarPreview = document.getElementById("editProfileAvatarPreview");
    refs.removeAvatarBtn = document.getElementById("removeAvatarBtn");
    refs.editProfileMessage = document.getElementById("editProfileMessage");

    refs.changePasswordModal = document.getElementById("changePasswordModal");
    refs.closePasswordModal = document.getElementById("closePasswordModal");
    refs.cancelPasswordBtn = document.getElementById("cancelPasswordBtn");
    refs.changePasswordForm = document.getElementById("changePasswordForm");
    refs.currentPassword = document.getElementById("currentPassword");
    refs.newPassword = document.getElementById("newPassword");
    refs.confirmNewPassword = document.getElementById("confirmNewPassword");
    refs.changePasswordMessage = document.getElementById("changePasswordMessage");

    refs.adModal = document.getElementById("adModal");
    refs.closeAdModal = document.getElementById("closeAdModal");
    refs.cancelAdBtn = document.getElementById("cancelAdBtn");
    refs.adForm = document.getElementById("adForm");
    refs.adText = document.getElementById("adText");
    refs.adCountry = document.getElementById("adCountry");
    refs.adCity = document.getElementById("adCity");
    refs.adPhotosInput = document.getElementById("adPhotosInput");
    refs.adVideosInput = document.getElementById("adVideosInput");
    refs.adPhotosInfo = document.getElementById("adPhotosInfo");
    refs.adVideosInfo = document.getElementById("adVideosInfo");
    refs.adMediaPreview = document.getElementById("adMediaPreview");
    refs.deleteAdBtn = document.getElementById("deleteAdBtn");
    refs.saveAdBtn = document.getElementById("saveAdBtn");
    refs.adMessage = document.getElementById("adMessage");
    refs.adCountrySelectUi = null;
    refs.adCitySelectUi = null;
}

function initAdLocationOptions() {
    if (!refs.adCountry || !refs.adCity) {
        return;
    }

    const countries = Object.keys(AppCore.LOCATION_DATA || {});
    refs.adCountry.innerHTML = '<option value="">Выберите страну</option>';

    countries.forEach((country) => {
        const option = document.createElement("option");
        option.value = country;
        option.textContent = country;
        refs.adCountry.appendChild(option);
    });

    fillAdCityOptions("", "");
}

function initAdLocationSelectUi() {
    refs.adCountrySelectUi = AppCore.enhanceSelect(refs.adCountry);
    refs.adCitySelectUi = AppCore.enhanceSelect(refs.adCity);
    refs.adCountrySelectUi?.refresh();
    refs.adCitySelectUi?.refresh();
}

function fillAdCityOptions(country, selectedCity = "") {
    if (!refs.adCity) {
        return;
    }

    const cities = AppCore.getCitiesByCountry(country);
    refs.adCity.innerHTML = "";

    if (!cities.length) {
        refs.adCity.disabled = true;
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Сначала выберите страну";
        refs.adCity.appendChild(option);
        refs.adCitySelectUi?.refresh();
        return;
    }

    refs.adCity.disabled = false;

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите город";
    refs.adCity.appendChild(placeholder);

    cities.forEach((city) => {
        const option = document.createElement("option");
        option.value = city;
        option.textContent = city;
        if (city === selectedCity) {
            option.selected = true;
        }
        refs.adCity.appendChild(option);
    });

    refs.adCitySelectUi?.refresh();
}

function bindHeaderEvents() {
    refs.profileTrigger?.addEventListener("click", toggleDropdown);
    refs.clearLocationFilterBtn?.addEventListener("click", clearLocationFilter);

    // Одно делегирование на весь dropdown избавляет от дублей обработчиков.
    refs.profileDropdown?.addEventListener("click", (event) => {
        const actionNode = event.target.closest("[data-action]");
        if (!actionNode) {
            return;
        }

        const action = actionNode.dataset.action;
        if (action === "view-profile") {
            openViewProfileModal();
            return;
        }

        if (action === "edit-profile") {
            openEditProfileModal();
            return;
        }

        if (action === "change-password") {
            openChangePasswordModal();
            return;
        }

        if (action === "logout") {
            onLogout();
        }
    });

    document.addEventListener("click", (event) => {
        if (!refs.userMenu || !refs.profileDropdown || refs.profileDropdown.classList.contains("hidden")) {
            return;
        }

        if (!refs.userMenu.contains(event.target)) {
            closeDropdown();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeDropdown();
            closeActiveModal();
        }
    });
}

function bindModalEvents() {
    refs.closeViewProfileModal?.addEventListener("click", () => closeModal(refs.viewProfileModal));
    refs.closeEditProfileModal?.addEventListener("click", () => closeModal(refs.editProfileModal));
    refs.closePasswordModal?.addEventListener("click", () => closeModal(refs.changePasswordModal));
    refs.closeAdModal?.addEventListener("click", () => closeModal(refs.adModal));

    refs.cancelEditProfileBtn?.addEventListener("click", () => closeModal(refs.editProfileModal));
    refs.cancelPasswordBtn?.addEventListener("click", () => closeModal(refs.changePasswordModal));
    refs.cancelAdBtn?.addEventListener("click", () => closeModal(refs.adModal));

    refs.viewProfileModal?.addEventListener("click", (event) => {
        if (event.target === refs.viewProfileModal) {
            closeModal(refs.viewProfileModal);
            return;
        }

        const actionNode = event.target.closest("[data-action]");
        if (!actionNode) {
            return;
        }

        if (actionNode.dataset.action === "from-view-edit") {
            openEditProfileModal();
            return;
        }

        if (actionNode.dataset.action === "from-view-password") {
            openChangePasswordModal();
            return;
        }

        if (actionNode.dataset.action === "from-view-ad") {
            openAdModal();
        }
    });

    refs.editProfileModal?.addEventListener("click", (event) => {
        if (event.target === refs.editProfileModal) {
            closeModal(refs.editProfileModal);
        }
    });

    refs.changePasswordModal?.addEventListener("click", (event) => {
        if (event.target === refs.changePasswordModal) {
            closeModal(refs.changePasswordModal);
        }
    });

    refs.adModal?.addEventListener("click", (event) => {
        if (event.target === refs.adModal) {
            closeModal(refs.adModal);
        }
    });

    refs.editProfileAvatarInput?.addEventListener("change", onAvatarInputChange);
    refs.removeAvatarBtn?.addEventListener("click", onRemoveAvatar);

    refs.editProfileForm?.addEventListener("submit", onEditProfileSubmit);
    refs.changePasswordForm?.addEventListener("submit", onChangePasswordSubmit);

    refs.adCountry?.addEventListener("change", () => {
        fillAdCityOptions(refs.adCountry.value);
    });
    refs.adPhotosInput?.addEventListener("change", onAdPhotosInputChange);
    refs.adVideosInput?.addEventListener("change", onAdVideosInputChange);
    refs.deleteAdBtn?.addEventListener("click", onDeleteAd);
    refs.adForm?.addEventListener("submit", onAdSubmit);
}

function renderCountries() {
    const host = document.getElementById("countriesList");
    if (!host) {
        return;
    }

    host.innerHTML = "";

    const entries = Object.entries(AppCore.LOCATION_DATA || {});
    entries.forEach(([country, cities], countryIndex) => {
        const card = document.createElement("div");
        card.className = "country-card";
        card.style.animationDelay = `${Math.min(countryIndex * 60, 360)}ms`;

        const button = document.createElement("button");
        button.className = "country-btn";
        button.type = "button";
        button.textContent = country;

        const isCountryActive = state.activeCountryFilter === country && !state.activeCityFilter;
        if (isCountryActive) {
            button.classList.add("active");
        }

        const citiesContainer = document.createElement("div");
        citiesContainer.className = "cities";

        const isExpanded = state.expandedCountries.has(country) || state.activeCountryFilter === country;
        if (isExpanded) {
            citiesContainer.classList.add("open");
            button.classList.add("open");
            state.expandedCountries.add(country);
        }

        cities.forEach((city, cityIndex) => {
            const cityButton = document.createElement("button");
            cityButton.className = "city-item";
            cityButton.type = "button";
            cityButton.textContent = city;
            cityButton.style.transitionDelay = `${cityIndex * 40}ms`;

            if (state.activeCountryFilter === country && state.activeCityFilter === city) {
                cityButton.classList.add("active");
            }

            cityButton.addEventListener("click", () => {
                state.activeCountryFilter = country;
                state.activeCityFilter = city;
                state.expandedCountries.add(country);
                renderCountries();
                renderAdsFeed();
            });

            citiesContainer.appendChild(cityButton);
        });

        button.addEventListener("click", () => {
            const currentlyActiveCountryOnly = state.activeCountryFilter === country && !state.activeCityFilter;

            if (currentlyActiveCountryOnly) {
                state.activeCountryFilter = "";
                state.activeCityFilter = "";
            } else {
                state.activeCountryFilter = country;
                state.activeCityFilter = "";
            }

            if (state.expandedCountries.has(country)) {
                state.expandedCountries.delete(country);
            } else {
                state.expandedCountries.add(country);
            }

            if (state.activeCountryFilter === country) {
                state.expandedCountries.add(country);
            }

            renderCountries();
            renderAdsFeed();
        });

        card.appendChild(button);
        card.appendChild(citiesContainer);
        host.appendChild(card);
    });

    refs.clearLocationFilterBtn?.classList.toggle("active", !state.activeCountryFilter && !state.activeCityFilter);
}

function clearLocationFilter() {
    state.activeCountryFilter = "";
    state.activeCityFilter = "";
    renderCountries();
    renderAdsFeed();
}

function renderHeader() {
    if (!window.Supa?.enabled) {
        state.currentUser = AppCore.getCurrentUser();
    }

    if (!refs.guestActions || !refs.userMenu) {
        return;
    }

    if (!state.currentUser) {
        refs.guestActions.classList.remove("hidden");
        refs.userMenu.classList.add("hidden");
        closeDropdown();
        closeActiveModal();
        return;
    }

    const nickname = state.currentUser.profile?.nickname || AppCore.nicknameFromEmail(state.currentUser.email);

    refs.guestActions.classList.add("hidden");
    refs.userMenu.classList.remove("hidden");

    refs.headerNickname.textContent = nickname;
    AppCore.setImageWithFallback(refs.headerAvatar, state.currentUser.profile?.avatar || "", nickname);
    AppCore.setImageWithFallback(refs.dropdownAvatar, state.currentUser.profile?.avatar || "", nickname);
    refs.dropdownNickname.textContent = nickname;
    refs.dropdownEmail.textContent = state.currentUser.email;

    if (refs.dropdownAdminLink) {
        refs.dropdownAdminLink.classList.toggle("hidden", !AppCore.isAdmin(state.currentUser));
    }
}

function renderAdsFeed() {
    if (!refs.adsGrid || !refs.adsEmpty) {
        return;
    }

    if (window.Supa?.enabled) {
        refs.adsGrid.innerHTML = "";
        refs.adsEmpty.textContent = "Загрузка...";
        refs.adsEmpty.classList.remove("hidden");
        window.Supa
            .listAdsFeed()
            .then(async (result) => {
                if (!result.ok) {
                    refs.adsEmpty.textContent = result.error || "Не удалось загрузить ленту.";
                    return;
                }

                const mapped = await Promise.all((result.ads || []).map(async (row) => {
                    const owner = row.profiles || {};
                    let photos = [];
                    let videos = [];
                    try {
                        const details = await window.Supa.getAdDetails(row.id);
                        if (details.ok) {
                            photos = (details.photos || []).map((p) => window.Supa.getPublicUrl("ad-photos", p.path));
                            videos = (details.videos || []).map((v) => ({
                                id: String(v.id || ""),
                                mimeType: String(v.mime_type || "video/mp4"),
                                name: "video",
                                size: Number(v.size || 0),
                                poster: v.poster_path ? window.Supa.getPublicUrl("ad-posters", v.poster_path) : "",
                                dataUrl: window.Supa.getPublicUrl("ad-videos", v.path)
                            }));
                        }
                    } catch {
                        photos = [];
                        videos = [];
                    }

                    const cover = row.cover_path ? window.Supa.getPublicUrl("ad-photos", row.cover_path) : (photos[0] || "");
                    return {
                        id: row.id,
                        ownerEmail: String(owner.email || ""),
                        ownerNickname: String(owner.nickname || "").trim() || "Пользователь",
                        ownerAvatar: owner.avatar_path ? window.Supa.getPublicUrl("avatars", owner.avatar_path) : "",
                        updatedAt: Date.parse(row.updated_at) || Date.now(),
                        country: String(row.country || ""),
                        city: String(row.city || ""),
                        text: String(row.text || ""),
                        photos,
                        videos,
                        cover
                    };
                }));

                const filtered = mapped.filter((ad) => {
                    if (state.activeCountryFilter && ad.country !== state.activeCountryFilter) {
                        return false;
                    }
                    if (state.activeCityFilter && ad.city !== state.activeCityFilter) {
                        return false;
                    }
                    return true;
                });

                refs.adsGrid.innerHTML = "";
                if (!filtered.length) {
                    refs.adsEmpty.textContent = state.activeCityFilter
                        ? `По фильтру "${state.activeCountryFilter}, ${state.activeCityFilter}" объявлений пока нет.`
                        : state.activeCountryFilter
                            ? `По стране "${state.activeCountryFilter}" объявлений пока нет.`
                            : "Пока нет объявлений.";
                    refs.adsEmpty.classList.remove("hidden");
                    return;
                }
                refs.adsEmpty.classList.add("hidden");
                filtered.forEach((ad, index) => {
                    refs.adsGrid.appendChild(createAdCard(ad, index));
                });
            })
            .catch(() => {
                refs.adsEmpty.textContent = "Не удалось загрузить ленту.";
                refs.adsEmpty.classList.remove("hidden");
            });
        return;
    }

    const allAds = AppCore.getAdsFeed();
    const ads = allAds.filter((ad) => {
        if (state.activeCountryFilter && ad.country !== state.activeCountryFilter) {
            return false;
        }

        if (state.activeCityFilter && ad.city !== state.activeCityFilter) {
            return false;
        }

        return true;
    });

    refs.adsGrid.innerHTML = "";

    if (!ads.length) {
        refs.adsEmpty.textContent = state.activeCityFilter
            ? `По фильтру "${state.activeCountryFilter}, ${state.activeCityFilter}" объявлений пока нет.`
            : state.activeCountryFilter
                ? `По стране "${state.activeCountryFilter}" объявлений пока нет.`
                : "Пока нет объявлений. Откройте профиль и создайте первое объявление.";
        refs.adsEmpty.classList.remove("hidden");
        return;
    }

    refs.adsEmpty.classList.add("hidden");

    ads.forEach((ad, index) => {
        const card = createAdCard(ad, index);
        refs.adsGrid.appendChild(card);
    });
}

function createAdCard(ad, index) {
    const card = document.createElement("article");
    card.className = "ad-card";
    card.style.animationDelay = `${Math.min(index * 70, 490)}ms`;
    card.tabIndex = 0;

    const coverWrap = document.createElement("div");
    coverWrap.className = "ad-cover-wrap";

    if (ad.cover) {
        const coverImage = document.createElement("img");
        coverImage.className = "ad-cover";
        coverImage.alt = "Обложка объявления";
        coverImage.src = ad.cover;
        coverWrap.appendChild(coverImage);
    } else {
        const coverPlaceholder = document.createElement("div");
        coverPlaceholder.className = "ad-cover-placeholder";
        coverPlaceholder.textContent = "Нет фото";
        coverWrap.appendChild(coverPlaceholder);
    }

    const content = document.createElement("div");
    content.className = "ad-content";

    const ownerRow = document.createElement("div");
    ownerRow.className = "ad-owner-row";

    const ownerAvatar = document.createElement("img");
    ownerAvatar.className = "ad-owner-avatar";
    ownerAvatar.alt = "avatar";
    AppCore.setImageWithFallback(ownerAvatar, ad.ownerAvatar || "", ad.ownerNickname || "Пользователь");

    const ownerMeta = document.createElement("div");
    ownerMeta.className = "ad-owner-meta";

    const ownerName = document.createElement("p");
    ownerName.className = "ad-owner-name";
    ownerName.textContent = ad.ownerNickname || "Пользователь";

    const adDate = document.createElement("p");
    adDate.className = "ad-updated-at";
    adDate.textContent = formatAdDate(ad.updatedAt);

    ownerMeta.appendChild(ownerName);
    ownerMeta.appendChild(adDate);

    ownerRow.appendChild(ownerAvatar);
    ownerRow.appendChild(ownerMeta);

    const adText = document.createElement("p");
    adText.className = "ad-text";
    adText.textContent = ad.text || "";

    const adLocation = document.createElement("p");
    adLocation.className = "ad-location";
    adLocation.textContent = `${ad.country}, ${ad.city}`;

    const adMeta = document.createElement("div");
    adMeta.className = "ad-meta";
    adMeta.textContent = `Фото: ${ad.photos.length} • Видео: ${ad.videos.length}`;

    content.appendChild(ownerRow);
    content.appendChild(adText);
    content.appendChild(adLocation);
    content.appendChild(adMeta);

    card.appendChild(coverWrap);
    card.appendChild(content);

    card.addEventListener("click", () => {
        openAdDetailsPage(ad);
    });
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openAdDetailsPage(ad);
        }
    });

    return card;
}

function openAdDetailsPage(ad) {
    const params = new URLSearchParams();
    const adId = String(ad?.id || "").trim();

    if (window.Supa?.enabled && adId) {
        params.set("id", adId);
        try {
            window.sessionStorage.setItem("selectedAdId", adId);
        } catch {
            // ignore
        }
    } else {
        saveAdLocator(ad);

        const ownerEmail = AppCore.normalizeEmail(ad?.ownerEmail);
        const updatedAt = Number(ad?.updatedAt) || 0;
        if (ownerEmail) {
            params.set("user", ownerEmail);
        }
        if (updatedAt) {
            params.set("ts", String(updatedAt));
        }
    }

    const nextUrl = `ad.html${params.toString() ? `?${params.toString()}` : ""}`;
    const body = document.body;

    if (!body) {
        window.location.href = nextUrl;
        return;
    }

    body.classList.add("page-fade-leave");
    window.setTimeout(() => {
        window.location.href = nextUrl;
    }, 280);
}

function saveAdLocator(ad) {
    const locator = {
        ownerEmail: AppCore.normalizeEmail(ad?.ownerEmail),
        updatedAt: Number(ad?.updatedAt) || 0,
        ownerNickname: String(ad?.ownerNickname || "").trim(),
        country: String(ad?.country || "").trim(),
        city: String(ad?.city || "").trim(),
        savedAt: Date.now()
    };

    try {
        window.sessionStorage.setItem("selectedAdLocator", JSON.stringify(locator));
        window.sessionStorage.setItem("selectedAdPayload", JSON.stringify({
            ownerEmail: AppCore.normalizeEmail(ad?.ownerEmail),
            ownerNickname: String(ad?.ownerNickname || "").trim(),
            ownerAvatar: String(ad?.ownerAvatar || ""),
            updatedAt: Number(ad?.updatedAt) || 0,
            country: String(ad?.country || "").trim(),
            city: String(ad?.city || "").trim(),
            text: String(ad?.text || "").trim(),
            photos: Array.isArray(ad?.photos) ? ad.photos : [],
            videos: Array.isArray(ad?.videos) ? ad.videos : [],
            cover: String(ad?.cover || ""),
            savedAt: Date.now()
        }));
    } catch {
        // ignore
    }
}

function formatAdDate(value) {
    const timestamp = Number(value);
    if (!timestamp) {
        return "Обновлено недавно";
    }

    try {
        return `Обновлено ${new Date(timestamp).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        })}`;
    } catch {
        return "Обновлено недавно";
    }
}

function toggleDropdown() {
    if (!state.currentUser || !refs.profileDropdown || !refs.profileTrigger) {
        return;
    }

    const isHidden = refs.profileDropdown.classList.contains("hidden");
    if (isHidden) {
        openDropdown();
    } else {
        closeDropdown();
    }
}

function openDropdown() {
    refs.profileDropdown?.classList.remove("hidden");
    refs.profileTrigger?.setAttribute("aria-expanded", "true");
}

function closeDropdown() {
    refs.profileDropdown?.classList.add("hidden");
    refs.profileTrigger?.setAttribute("aria-expanded", "false");
}

function openViewProfileModal() {
    if (!state.currentUser) {
        location.href = "auth.html";
        return;
    }

    closeDropdown();
    closeActiveModal();

    const nickname = state.currentUser.profile?.nickname || AppCore.nicknameFromEmail(state.currentUser.email);
    const roleLabel = AppCore.isAdmin(state.currentUser) ? "Роль: администратор" : "Роль: пользователь";
    const locationLabel = state.currentUser.profile?.country && state.currentUser.profile?.city
        ? `${state.currentUser.profile.country}, ${state.currentUser.profile.city}`
        : "Локация не указана";

    refs.viewProfileNickname.textContent = nickname;
    refs.viewProfileEmail.textContent = state.currentUser.email;
    refs.viewProfileRole.textContent = `${roleLabel} • ${locationLabel}`;
    AppCore.setImageWithFallback(refs.viewProfileAvatar, state.currentUser.profile?.avatar || "", nickname);

    openModal(refs.viewProfileModal);
}

function openEditProfileModal() {
    if (!state.currentUser) {
        location.href = "auth.html";
        return;
    }

    closeDropdown();
    closeActiveModal();

    const nickname = state.currentUser.profile?.nickname || AppCore.nicknameFromEmail(state.currentUser.email);

    state.pendingAvatarData = "";
    state.removeAvatar = false;

    refs.editProfileNickname.value = nickname;
    refs.editProfileEmail.value = state.currentUser.email;
    refs.editProfileAvatarInput.value = "";
    AppCore.setImageWithFallback(refs.editProfileAvatarPreview, state.currentUser.profile?.avatar || "", nickname);
    setMessage(refs.editProfileMessage, "");

    openModal(refs.editProfileModal);
}

function openChangePasswordModal() {
    if (!state.currentUser) {
        location.href = "auth.html";
        return;
    }

    closeDropdown();
    closeActiveModal();

    refs.changePasswordForm.reset();
    setMessage(refs.changePasswordMessage, "");

    openModal(refs.changePasswordModal);
}

function openAdModal() {
    if (!state.currentUser) {
        location.href = "auth.html";
        return;
    }

    closeDropdown();
    closeActiveModal();
    releasePendingVideoUrls();

    if (window.Supa?.enabled) {
        refs.adText.value = "";
        refs.adPhotosInput.value = "";
        refs.adVideosInput.value = "";
        state.pendingAdPhotos = [];
        state.pendingAdVideos = [];
        updateAdCounters();
        renderAdMediaPreview();
        setMessage(refs.adMessage, "Загрузка...", "");
        openModal(refs.adModal);

        window.Supa
            .listAdsFeed()
            .then((res) => {
                if (!res.ok) {
                    setMessage(refs.adMessage, res.error || "Не удалось загрузить объявление.", "error");
                    return;
                }
                const current = (res.ads || []).find((row) => String(row.owner_id || "") === String(state.currentUser.id || ""));
                if (!current) {
                    refs.deleteAdBtn?.classList.add("hidden");
                    if (refs.saveAdBtn) {
                        refs.saveAdBtn.textContent = "Опубликовать";
                    }
                    setMessage(refs.adMessage, "", "");
                    return;
                }
                window.Supa.getAdDetails(current.id).then((details) => {
                    if (!details.ok || !details.ad) {
                        setMessage(refs.adMessage, details.error || "Не удалось загрузить объявление.", "error");
                        return;
                    }

                    refs.adText.value = String(details.ad.text || "");
                    const defaultCountry = String(details.ad.country || state.currentUser.profile?.country || "");
                    const defaultCity = String(details.ad.city || state.currentUser.profile?.city || "");
                    refs.adCountry.value = defaultCountry;
                    fillAdCityOptions(defaultCountry, defaultCity);
                    refs.adCity.value = defaultCity;
                    refs.adCountrySelectUi?.refresh();
                    refs.adCitySelectUi?.refresh();

                    state.pendingAdPhotos = (details.photos || []).map((p) => window.Supa.getPublicUrl("ad-photos", p.path));
                    state.pendingAdVideos = (details.videos || []).map((v) => ({
                        mode: "stored",
                        ref: {
                            id: String(v.id || ""),
                            mimeType: String(v.mime_type || "video/mp4"),
                            name: "video",
                            size: Number(v.size || 0),
                            poster: v.poster_path ? window.Supa.getPublicUrl("ad-posters", v.poster_path) : "",
                            dataUrl: window.Supa.getPublicUrl("ad-videos", v.path)
                        }
                    }));

                    try {
                        window.sessionStorage.setItem("currentSupabaseAdId", String(details.ad.id || ""));
                    } catch {
                        // ignore
                    }

                    refs.deleteAdBtn?.classList.remove("hidden");
                    if (refs.saveAdBtn) {
                        refs.saveAdBtn.textContent = "Обновить объявление";
                    }
                    updateAdCounters();
                    renderAdMediaPreview();
                    setMessage(refs.adMessage, "", "");
                });
            })
            .catch(() => {
                setMessage(refs.adMessage, "Не удалось загрузить объявление.", "error");
            });

        return;
    }

    const currentAd = AppCore.getAdByUser(state.currentUser.email);
    state.pendingAdPhotos = Array.isArray(currentAd?.photos) ? [...currentAd.photos] : [];
    state.pendingAdVideos = Array.isArray(currentAd?.videos)
        ? currentAd.videos.map((videoRef) => {
            const source = videoRef && typeof videoRef === "object" ? videoRef : {};
            const inlineDataUrl = typeof videoRef === "string" && videoRef.startsWith("data:video/")
                ? videoRef
                : String(source.dataUrl || source.src || "");

            return {
                mode: "stored",
                ref: {
                    id: String(source.id || ""),
                    mimeType: String(source.mimeType || "video/mp4"),
                    name: String(source.name || "video"),
                    size: Number(source.size || 0),
                    poster: String(source.poster || source.cover || ""),
                    dataUrl: inlineDataUrl.startsWith("data:video/") ? inlineDataUrl : ""
                }
            };
        })
        : [];

    const defaultCountry = currentAd?.country || state.currentUser.profile?.country || "";
    const defaultCity = currentAd?.city || state.currentUser.profile?.city || "";

    refs.adText.value = currentAd?.text || "";
    refs.adCountry.value = defaultCountry;
    fillAdCityOptions(defaultCountry, defaultCity);
    refs.adCity.value = defaultCity;
    refs.adCountrySelectUi?.refresh();
    refs.adCitySelectUi?.refresh();

    refs.adPhotosInput.value = "";
    refs.adVideosInput.value = "";

    refs.deleteAdBtn?.classList.toggle("hidden", !currentAd);
    if (refs.saveAdBtn) {
        refs.saveAdBtn.textContent = currentAd ? "Обновить объявление" : "Опубликовать";
    }

    updateAdCounters();
    renderAdMediaPreview();
    setMessage(refs.adMessage, "");

    openModal(refs.adModal);
}

function openModal(modalElement) {
    if (!modalElement) {
        return;
    }

    // Класс modal-open запускает CSS-анимацию появления.
    modalElement.classList.remove("hidden");
    modalElement.classList.add("modal-open");
    modalElement.setAttribute("aria-hidden", "false");
    state.activeModal = modalElement;
}

function closeModal(modalElement) {
    if (!modalElement) {
        return;
    }

    modalElement.classList.remove("modal-open");
    modalElement.classList.add("hidden");
    modalElement.setAttribute("aria-hidden", "true");

    if (modalElement === refs.adModal) {
        releasePendingVideoUrls();
    }

    if (state.activeModal === modalElement) {
        state.activeModal = null;
    }
}

function closeActiveModal() {
    if (!state.activeModal) {
        return;
    }

    closeModal(state.activeModal);
}

function releasePendingVideoUrls() {
    state.pendingAdVideos.forEach((item) => {
        if (item.mode === "new" && item.previewUrl) {
            try {
                URL.revokeObjectURL(item.previewUrl);
            } catch {
                // ignore
            }
        }
    });
}

async function onAvatarInputChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
        return;
    }

    try {
        const dataURL = await AppCore.readImageAsDataURL(file);
        state.pendingAvatarData = dataURL;
        state.removeAvatar = false;

        refs.editProfileAvatarPreview.onerror = null;
        refs.editProfileAvatarPreview.src = dataURL;
        setMessage(refs.editProfileMessage, "");
    } catch (error) {
        state.pendingAvatarData = "";
        refs.editProfileAvatarInput.value = "";
        setMessage(refs.editProfileMessage, error.message || "Ошибка загрузки изображения.", "error");
    }
}

function onRemoveAvatar() {
    state.removeAvatar = true;
    state.pendingAvatarData = "";

    const nickname = AppCore.sanitizeNickname(refs.editProfileNickname.value) || "Пользователь";
    AppCore.setImageWithFallback(refs.editProfileAvatarPreview, "", nickname);
    setMessage(refs.editProfileMessage, "");
}

function isVideoTypePlayableInBrowser(mimeType) {
    const normalizedType = String(mimeType || "").trim();
    if (!normalizedType) {
        return true;
    }

    const probe = document.createElement("video");
    const capability = String(probe.canPlayType(normalizedType) || "");
    return capability === "probably" || capability === "maybe";
}

function onEditProfileSubmit(event) {
    event.preventDefault();

    if (!state.currentUser) {
        setMessage(refs.editProfileMessage, "Сессия истекла. Войдите снова.", "error");
        return;
    }

    const nickname = AppCore.sanitizeNickname(refs.editProfileNickname.value);
    const email = AppCore.normalizeEmail(refs.editProfileEmail.value);

    if (!nickname) {
        setMessage(refs.editProfileMessage, "Имя не может быть пустым.", "error");
        refs.editProfileNickname.focus();
        return;
    }

    if (!AppCore.isValidEmail(email)) {
        setMessage(refs.editProfileMessage, "Введите корректный email.", "error");
        refs.editProfileEmail.focus();
        return;
    }

    let avatar = state.currentUser.profile?.avatar || "";
    if (state.removeAvatar) {
        avatar = "";
    } else if (state.pendingAvatarData) {
        avatar = state.pendingAvatarData;
    }

    const result = AppCore.updateUserAccount(state.currentUser.email, { nickname, email, avatar });
    if (!result.ok) {
        setMessage(refs.editProfileMessage, result.message || "Не удалось сохранить профиль.", "error");
        return;
    }

    state.currentUser = result.user;
    state.pendingAvatarData = "";
    state.removeAvatar = false;

    renderHeader();
    renderAdsFeed();
    setMessage(refs.editProfileMessage, "Профиль сохранен.", "success");

    window.setTimeout(() => {
        openViewProfileModal();
    }, 180);
}

function onChangePasswordSubmit(event) {
    event.preventDefault();

    if (!state.currentUser) {
        setMessage(refs.changePasswordMessage, "Сессия истекла. Войдите снова.", "error");
        return;
    }

    const currentPassword = String(refs.currentPassword.value || "").trim();
    const newPassword = String(refs.newPassword.value || "").trim();
    const confirmPassword = String(refs.confirmNewPassword.value || "").trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
        setMessage(refs.changePasswordMessage, "Заполните все поля.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        setMessage(refs.changePasswordMessage, "Новые пароли не совпадают.", "error");
        return;
    }

    setMessage(refs.changePasswordMessage, "Сохраняем...", "");

    AppCore.changeUserPassword(state.currentUser.email, currentPassword, newPassword)
        .then((result) => {
            if (!result.ok) {
                setMessage(refs.changePasswordMessage, result.message || "Не удалось изменить пароль.", "error");
                return;
            }

            refs.changePasswordForm.reset();
            setMessage(refs.changePasswordMessage, result.message, "success");
        })
        .catch(() => {
            setMessage(refs.changePasswordMessage, "Не удалось изменить пароль. Попробуйте позже.", "error");
        });
}

async function onAdPhotosInputChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
        return;
    }

    if (files.length > AppCore.MAX_AD_PHOTOS) {
        event.target.value = "";
        setMessage(refs.adMessage, `Можно выбрать максимум ${AppCore.MAX_AD_PHOTOS} фото.`, "error");
        return;
    }

    try {
        const imageList = await Promise.all(
            files.map((file) => AppCore.readImageAsDataURL(file, AppCore.MAX_AD_IMAGE_SIZE_BYTES))
        );

        state.pendingAdPhotos = imageList;
        updateAdCounters();
        renderAdMediaPreview();
        setMessage(refs.adMessage, "");
    } catch (error) {
        event.target.value = "";
        setMessage(refs.adMessage, error.message || "Не удалось загрузить фото.", "error");
    }
}

async function onAdVideosInputChange(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
        return;
    }

    if (files.length > AppCore.MAX_AD_VIDEOS) {
        event.target.value = "";
        setMessage(refs.adMessage, `Можно выбрать максимум ${AppCore.MAX_AD_VIDEOS} видео.`, "error");
        return;
    }

    releasePendingVideoUrls();
    state.pendingAdVideos = [];
    const prepared = [];

    try {
        for (const file of files) {
            if (!String(file.type || "").startsWith("video/")) {
                throw new Error("Можно загрузить только видео.");
            }

            if (!isVideoTypePlayableInBrowser(file.type)) {
                throw new Error("Этот формат видео не поддерживается браузером. Используйте MP4 (H.264/AAC).");
            }

            if (Number(file.size || 0) > AppCore.MAX_AD_VIDEO_SIZE_BYTES) {
                throw new Error(`Видео слишком большое (максимум ${Math.floor(AppCore.MAX_AD_VIDEO_SIZE_BYTES / (1024 * 1024))} MB).`);
            }

            const previewUrl = URL.createObjectURL(file);
            let poster = "";
            try {
                poster = await AppCore.captureVideoPoster(file);
            } catch {
                poster = "";
            }

            prepared.push({
                mode: "new",
                file,
                previewUrl,
                poster
            });
        }

        state.pendingAdVideos = prepared;

        updateAdCounters();
        renderAdMediaPreview();
        setMessage(refs.adMessage, "");
    } catch (error) {
        prepared.forEach((item) => {
            if (item.previewUrl) {
                try {
                    URL.revokeObjectURL(item.previewUrl);
                } catch {
                    // ignore
                }
            }
        });
        releasePendingVideoUrls();
        state.pendingAdVideos = [];
        refs.adVideosInput.value = "";
        setMessage(refs.adMessage, error.message || "Не удалось загрузить видео.", "error");
    }
}

async function onAdSubmit(event) {
    event.preventDefault();

    if (!state.currentUser) {
        setMessage(refs.adMessage, "Сессия истекла. Войдите снова.", "error");
        return;
    }

    const text = AppCore.sanitizeAdText(refs.adText.value);
    const country = AppCore.sanitizeLocation(refs.adCountry.value);
    const city = AppCore.sanitizeLocation(refs.adCity.value);

    if (!text) {
        setMessage(refs.adMessage, "Введите текст объявления.", "error");
        refs.adText.focus();
        return;
    }

    const validCities = AppCore.getCitiesByCountry(country);
    if (!country || !city || !validCities.includes(city)) {
        setMessage(refs.adMessage, "Выберите корректные страну и город.", "error");
        return;
    }

    if (state.pendingAdPhotos.length === 0) {
        setMessage(refs.adMessage, "Добавьте минимум 1 фото для обложки.", "error");
        return;
    }

    if (state.pendingAdPhotos.length > AppCore.MAX_AD_PHOTOS) {
        setMessage(refs.adMessage, `Можно загрузить не более ${AppCore.MAX_AD_PHOTOS} фото.`, "error");
        return;
    }

    if (state.pendingAdVideos.length > AppCore.MAX_AD_VIDEOS) {
        setMessage(refs.adMessage, `Можно загрузить не более ${AppCore.MAX_AD_VIDEOS} видео.`, "error");
        return;
    }

    if (window.Supa?.enabled) {
        setMessage(refs.adMessage, "Публикуем...", "");
        const session = await window.Supa.getSession();
        const userId = session?.user?.id;
        if (!userId) {
            setMessage(refs.adMessage, "Сессия истекла. Войдите снова.", "error");
            return;
        }

        const existingAdId = String(window.sessionStorage.getItem("currentSupabaseAdId") || "").trim();

        const upsertRes = await window.Supa.upsertAd({
            id: existingAdId || undefined,
            owner_id: userId,
            text,
            country,
            city,
            cover_path: ""
        });

        if (!upsertRes.ok) {
            setMessage(refs.adMessage, upsertRes.error || "Не удалось сохранить объявление.", "error");
            return;
        }

        const adId = String(upsertRes.ad.id);

        const photoFiles = Array.from(refs.adPhotosInput?.files || []);
        const videoFiles = Array.from(refs.adVideosInput?.files || []);
        if (!photoFiles.length) {
            setMessage(refs.adMessage, "Для Supabase нужно выбрать фото файлами (не только старые превью).", "error");
            return;
        }

        const photoRows = [];
        for (let i = 0; i < photoFiles.length; i += 1) {
            const file = photoFiles[i];
            const path = window.Supa.buildAdPhotoPath(userId, adId, i + 1, file.name);
            const upload = await window.Supa.uploadPublicFile("ad-photos", path, file, { contentType: file.type });
            if (!upload.ok) {
                setMessage(refs.adMessage, upload.error || "Не удалось загрузить фото.", "error");
                return;
            }
            photoRows.push({ path, sort: i });
        }

        const videoRows = [];
        for (let i = 0; i < videoFiles.length; i += 1) {
            const file = videoFiles[i];
            const videoId = `${Date.now()}_${i}`;
            const path = window.Supa.buildAdVideoPath(userId, adId, videoId, file.name);
            const upload = await window.Supa.uploadPublicFile("ad-videos", path, file, { contentType: file.type });
            if (!upload.ok) {
                setMessage(refs.adMessage, upload.error || "Не удалось загрузить видео.", "error");
                return;
            }

            let posterPath = "";
            try {
                const posterDataUrl = await AppCore.captureVideoPoster(file);
                if (posterDataUrl) {
                    const posterBlob = await (await fetch(posterDataUrl)).blob();
                    posterPath = window.Supa.buildAdPosterPath(userId, adId, videoId);
                    const posterUpload = await window.Supa.uploadPublicFile(
                        "ad-posters",
                        posterPath,
                        posterBlob,
                        { contentType: "image/jpeg" }
                    );
                    if (!posterUpload.ok) {
                        posterPath = "";
                    }
                }
            } catch {
                posterPath = "";
            }

            videoRows.push({
                path,
                poster_path: posterPath,
                mime_type: String(file.type || "video/mp4"),
                size: Number(file.size || 0),
                sort: i
            });
        }

        const replaceRes = await window.Supa.replaceAdMedia(adId, {
            photos: photoRows,
            videos: videoRows
        });
        if (!replaceRes.ok) {
            setMessage(refs.adMessage, replaceRes.error || "Не удалось сохранить медиа.", "error");
            return;
        }

        const coverPath = String(photoRows[0]?.path || "");
        await window.Supa.upsertAd({
            id: adId,
            owner_id: userId,
            text,
            country,
            city,
            cover_path: coverPath
        });

        try {
            window.sessionStorage.setItem("currentSupabaseAdId", adId);
        } catch {
            // ignore
        }

        releasePendingVideoUrls();
        refs.deleteAdBtn?.classList.remove("hidden");
        if (refs.saveAdBtn) {
            refs.saveAdBtn.textContent = "Обновить объявление";
        }
        renderAdsFeed();
        setMessage(refs.adMessage, "Объявление опубликовано.", "success");
        return;
    }

    const videoRefs = [];
    const newStoredRefs = [];

    try {
        for (const item of state.pendingAdVideos) {
            if (item.mode === "stored" && item.ref) {
                videoRefs.push({
                    id: String(item.ref.id || ""),
                    mimeType: String(item.ref.mimeType || "video/mp4"),
                    name: String(item.ref.name || "video"),
                    size: Number(item.ref.size || 0),
                    poster: String(item.ref.poster || item.ref.cover || ""),
                    dataUrl: String(item.ref.dataUrl || "")
                });
                continue;
            }

            if (item.mode === "new" && item.file) {
                const stored = await AppCore.storeVideoFile(
                    item.file,
                    AppCore.MAX_AD_VIDEO_SIZE_BYTES,
                    { poster: item.poster || "" }
                );
                videoRefs.push(stored);
                newStoredRefs.push(stored);
            }
        }
    } catch (error) {
        setMessage(refs.adMessage, error.message || "Не удалось сохранить видео.", "error");
        return;
    }

    const result = AppCore.saveAdForUser(state.currentUser.email, {
        text,
        photos: state.pendingAdPhotos,
        videos: videoRefs,
        country,
        city
    });

    if (!result.ok) {
        newStoredRefs.forEach((videoRef) => {
            AppCore.deleteStoredVideo(videoRef.id).catch(() => {
                // ignore
            });
        });
        setMessage(refs.adMessage, result.message || "Не удалось сохранить объявление.", "error");
        return;
    }

    AppCore.updateUserProfile(state.currentUser.email, { country, city });
    state.currentUser = AppCore.getCurrentUser();

    releasePendingVideoUrls();
    state.pendingAdVideos = videoRefs.map((videoRef) => ({ mode: "stored", ref: videoRef }));

    refs.deleteAdBtn?.classList.remove("hidden");
    if (refs.saveAdBtn) {
        refs.saveAdBtn.textContent = "Обновить объявление";
    }

    renderHeader();
    renderCountries();
    renderAdsFeed();
    setMessage(refs.adMessage, "Объявление опубликовано.", "success");

    window.setTimeout(() => {
        openViewProfileModal();
    }, 200);
}

function onDeleteAd() {
    if (!state.currentUser) {
        setMessage(refs.adMessage, "Сессия истекла. Войдите снова.", "error");
        return;
    }

    if (window.Supa?.enabled) {
        const adId = String(window.sessionStorage.getItem("currentSupabaseAdId") || "").trim();
        if (!adId) {
            setMessage(refs.adMessage, "Объявление не найдено.", "error");
            return;
        }
        window.Supa.client
            .from("ads")
            .delete()
            .eq("id", adId)
            .then(({ error }) => {
                if (error) {
                    setMessage(refs.adMessage, error.message || "Не удалось удалить объявление.", "error");
                    return;
                }
                try {
                    window.sessionStorage.removeItem("currentSupabaseAdId");
                } catch {
                    // ignore
                }
                releasePendingVideoUrls();
                state.pendingAdPhotos = [];
                state.pendingAdVideos = [];
                refs.adText.value = "";
                refs.adPhotosInput.value = "";
                refs.adVideosInput.value = "";
                updateAdCounters();
                renderAdMediaPreview();
                refs.deleteAdBtn?.classList.add("hidden");
                if (refs.saveAdBtn) {
                    refs.saveAdBtn.textContent = "Опубликовать";
                }
                renderAdsFeed();
                setMessage(refs.adMessage, "Объявление удалено.", "success");
            });
        return;
    }

    const result = AppCore.deleteAdForUser(state.currentUser.email);
    if (!result.ok) {
        setMessage(refs.adMessage, result.message || "Не удалось удалить объявление.", "error");
        return;
    }

    releasePendingVideoUrls();
    state.pendingAdPhotos = [];
    state.pendingAdVideos = [];
    refs.adText.value = "";
    refs.adPhotosInput.value = "";
    refs.adVideosInput.value = "";

    updateAdCounters();
    renderAdMediaPreview();
    refs.deleteAdBtn?.classList.add("hidden");
    if (refs.saveAdBtn) {
        refs.saveAdBtn.textContent = "Опубликовать";
    }

    renderAdsFeed();
    setMessage(refs.adMessage, "Объявление удалено.", "success");
}

function updateAdCounters() {
    if (refs.adPhotosInfo) {
        refs.adPhotosInfo.textContent = `Выбрано фото: ${state.pendingAdPhotos.length}/${AppCore.MAX_AD_PHOTOS}`;
    }

    if (refs.adVideosInfo) {
        refs.adVideosInfo.textContent = `Выбрано видео: ${state.pendingAdVideos.length}/${AppCore.MAX_AD_VIDEOS}`;
    }
}

function renderAdMediaPreview() {
    if (!refs.adMediaPreview) {
        return;
    }

    refs.adMediaPreview.innerHTML = "";

    if (!state.pendingAdPhotos.length && !state.pendingAdVideos.length) {
        const empty = document.createElement("div");
        empty.className = "ad-media-empty";
        empty.textContent = "Предпросмотр медиа появится здесь";
        refs.adMediaPreview.appendChild(empty);
        return;
    }

    state.pendingAdPhotos.forEach((photo, index) => {
        const tile = document.createElement("div");
        tile.className = "ad-media-tile";

        const media = document.createElement("img");
        media.className = "ad-media-thumb";
        media.alt = "photo preview";
        media.src = photo;

        const badge = document.createElement("span");
        badge.className = "ad-media-badge";
        badge.textContent = `Фото ${index + 1}`;

        tile.appendChild(media);
        tile.appendChild(badge);
        refs.adMediaPreview.appendChild(tile);
    });

    state.pendingAdVideos.forEach((videoItem, index) => {
        const tile = document.createElement("div");
        tile.className = "ad-media-tile";

        const posterSource = String(
            videoItem.poster
            || videoItem.ref?.poster
            || videoItem.ref?.cover
            || ""
        );
        const inlineVideoSource = String(videoItem.ref?.dataUrl || "");

        if (posterSource) {
            const poster = document.createElement("img");
            poster.className = "ad-media-thumb";
            poster.src = posterSource;
            poster.alt = `Обложка видео ${index + 1}`;
            tile.appendChild(poster);

            const playBadge = document.createElement("span");
            playBadge.className = "ad-media-play";
            playBadge.setAttribute("aria-hidden", "true");
            playBadge.textContent = "▶";
            tile.appendChild(playBadge);
        } else if (inlineVideoSource.startsWith("data:video/")) {
            const inlineVideo = document.createElement("video");
            inlineVideo.className = "ad-media-thumb";
            inlineVideo.src = inlineVideoSource;
            inlineVideo.preload = "metadata";
            inlineVideo.muted = true;
            inlineVideo.playsInline = true;
            tile.appendChild(inlineVideo);
        } else if (videoItem.mode === "new" && videoItem.previewUrl) {
            const video = document.createElement("video");
            video.className = "ad-media-thumb";
            video.src = videoItem.previewUrl;
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;
            tile.appendChild(video);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "ad-video-saved";
            placeholder.textContent = videoItem.ref?.name || "Сохраненное видео";
            tile.appendChild(placeholder);
        }

        const badge = document.createElement("span");
        badge.className = "ad-media-badge";
        badge.textContent = `Видео ${index + 1}`;

        tile.appendChild(badge);
        refs.adMediaPreview.appendChild(tile);
    });
}

function onLogout() {
    if (window.Supa?.enabled) {
        window.Supa.signOut().finally(() => {
            location.reload();
        });
        return;
    }
    AppCore.clearSession();
    location.reload();
}

function setMessage(targetNode, text, type = "") {
    if (!targetNode) {
        return;
    }

    targetNode.textContent = text;
    targetNode.classList.remove("error", "success");

    if (type) {
        targetNode.classList.add(type);
    }
}
