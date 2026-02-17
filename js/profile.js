const state = {
    user: null,
    pendingAvatarData: "",
    removeAvatar: false
};

const refs = {};

init();

function init() {
    AppCore.enablePageTransitions();
    AppCore.enableRippleEffects(document);

    AppCore.migrateUsers();

    if (window.Supa?.enabled) {
        window.Supa.getSession().then((session) => {
            const userId = session?.user?.id;
            if (!userId) {
                location.href = "auth.html";
                return;
            }
            window.Supa.getProfile(userId).then((res) => {
                const profile = res.ok ? res.profile : null;
                state.user = {
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
                    },
                    _avatarPath: String(profile?.avatar_path || "")
                };
                cacheRefs();
                bindEvents();
                renderUser();

                if (refs.adminLink) {
                    refs.adminLink.classList.toggle("hidden", !AppCore.isAdmin(state.user));
                }
            });
        });
        return;
    }

    state.user = AppCore.getCurrentUser();
    if (!state.user) {
        location.href = "auth.html";
        return;
    }

    cacheRefs();
    bindEvents();
    renderUser();

    if (refs.adminLink) {
        refs.adminLink.classList.toggle("hidden", !AppCore.isAdmin(state.user));
    }
}

function cacheRefs() {
    refs.profileDisplayName = document.getElementById("profileDisplayName");
    refs.profileEmail = document.getElementById("profileEmail");
    refs.profileAvatarPreview = document.getElementById("profileAvatarPreview");
    refs.profileAvatarInput = document.getElementById("profileAvatarInput");
    refs.profileNickname = document.getElementById("profileNickname");
    refs.profileForm = document.getElementById("profileForm");
    refs.removeAvatarBtn = document.getElementById("removeAvatarBtn");
    refs.profileMessage = document.getElementById("profileMessage");
    refs.logoutBtn = document.getElementById("logoutBtn");
    refs.adminLink = document.getElementById("adminLink");
}

function bindEvents() {
    refs.profileAvatarInput?.addEventListener("change", onAvatarInputChange);
    refs.removeAvatarBtn?.addEventListener("click", onRemoveAvatar);
    refs.profileForm?.addEventListener("submit", onProfileSubmit);

    refs.logoutBtn?.addEventListener("click", () => {
        if (window.Supa?.enabled) {
            window.Supa.signOut().finally(() => {
                location.href = "index.html";
            });
            return;
        }
        AppCore.clearSession();
        location.href = "index.html";
    });
}

function renderUser() {
    const nickname = state.user.profile?.nickname || AppCore.nicknameFromEmail(state.user.email);

    refs.profileDisplayName.textContent = nickname;
    refs.profileEmail.textContent = state.user.email;
    refs.profileNickname.value = nickname;

    AppCore.setImageWithFallback(refs.profileAvatarPreview, state.user.profile?.avatar || "", nickname);
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

        refs.profileAvatarPreview.onerror = null;
        refs.profileAvatarPreview.src = dataURL;
        setMessage("");
    } catch (error) {
        state.pendingAvatarData = "";
        refs.profileAvatarInput.value = "";
        setMessage(error.message || "Ошибка загрузки изображения.", "error");
    }
}

function onRemoveAvatar() {
    state.removeAvatar = true;
    state.pendingAvatarData = "";

    const nickname = AppCore.sanitizeNickname(refs.profileNickname.value) || "Пользователь";
    AppCore.setImageWithFallback(refs.profileAvatarPreview, "", nickname);
    setMessage("");
}

function onProfileSubmit(event) {
    event.preventDefault();

    const nickname = AppCore.sanitizeNickname(refs.profileNickname.value);
    if (!nickname) {
        setMessage("Имя не может быть пустым.", "error");
        refs.profileNickname.focus();
        return;
    }

    let avatar = state.user.profile?.avatar || "";
    if (state.removeAvatar) {
        avatar = "";
    } else if (state.pendingAvatarData) {
        avatar = state.pendingAvatarData;
    }

    if (window.Supa?.enabled) {
        window.Supa.getSession().then((session) => {
            const userId = session?.user?.id;
            if (!userId) {
                setMessage("Сессия истекла. Войдите снова.", "error");
                return;
            }

            const uploadAvatar = () => {
                if (state.removeAvatar) {
                    return Promise.resolve({ ok: true, avatar_path: "" });
                }
                const file = refs.profileAvatarInput?.files?.[0];
                if (!file) {
                    return Promise.resolve({ ok: true, avatar_path: String(state.user._avatarPath || "") });
                }
                const path = window.Supa.buildAvatarPath(userId, file.name);
                return window.Supa.uploadPublicFile("avatars", path, file, { contentType: file.type }).then((res) => {
                    if (!res.ok) {
                        return { ok: false, error: res.error };
                    }
                    return { ok: true, avatar_path: path };
                });
            };

            uploadAvatar().then((avatarRes) => {
                if (!avatarRes.ok) {
                    setMessage(avatarRes.error || "Не удалось загрузить аватар.", "error");
                    return;
                }

                window.Supa.upsertProfile({
                    id: userId,
                    email: String(session.user.email || ""),
                    nickname,
                    avatar_path: String(avatarRes.avatar_path || "")
                }).then((saveRes) => {
                    if (!saveRes.ok) {
                        setMessage(saveRes.error || "Не удалось сохранить профиль.", "error");
                        return;
                    }
                    const profile = saveRes.profile || {};
                    state.user.profile.nickname = String(profile.nickname || nickname);
                    state.user._avatarPath = String(profile.avatar_path || "");
                    state.user.profile.avatar = profile.avatar_path
                        ? window.Supa.getPublicUrl("avatars", profile.avatar_path)
                        : "";
                    state.pendingAvatarData = "";
                    state.removeAvatar = false;
                    renderUser();
                    setMessage("Профиль сохранен.", "success");
                });
            });
        });
        return;
    }

    const result = AppCore.updateUserProfile(state.user.email, { nickname, avatar });
    if (!result.ok) {
        setMessage(result.message || "Не удалось сохранить профиль.", "error");
        return;
    }

    state.user = result.user;
    state.pendingAvatarData = "";
    state.removeAvatar = false;

    renderUser();
    setMessage("Профиль сохранен.", "success");
}

function setMessage(text, type = "") {
    refs.profileMessage.textContent = text;
    refs.profileMessage.classList.remove("error", "success");

    if (type) {
        refs.profileMessage.classList.add(type);
    }
}
