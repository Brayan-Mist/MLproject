const state = {
    ad: null,
    owner: null,
    mediaItems: [],
    activeIndex: 0,
    objectUrls: [],
    activeVideo: null,
    detachActiveVideo: null
};

const AD_LOCATOR_MAX_AGE_MS = 15 * 60 * 1000;

const refs = {};

init();

function init() {
    AppCore.enablePageTransitions();
    AppCore.enableRippleEffects(document);
    AppCore.migrateUsers();

    cacheRefs();
    bindEvents();
    if (window.Supa?.enabled) {
        loadAdFromQuerySupabase();
    } else {
        loadAdFromQuery();
    }
}

function loadAdFromQuerySupabase() {
    const query = new URLSearchParams(window.location.search);
    const adId = String(query.get("id") || "").trim() || String(window.sessionStorage.getItem("selectedAdId") || "").trim();

    if (!adId) {
        showPageState("Объявление не найдено или ссылка повреждена.");
        return;
    }

    window.Supa
        .getAdDetails(adId)
        .then((result) => {
            if (!result.ok) {
                showPageState(result.error || "Не удалось загрузить объявление.");
                return;
            }
            if (!result.ad) {
                showPageState("Объявление не найдено или уже удалено.");
                return;
            }

            const owner = result.ad.profiles || {};
            const photos = (result.photos || []).map((p) => window.Supa.getPublicUrl("ad-photos", p.path));
            const videos = (result.videos || []).map((v) => ({
                id: String(v.id || ""),
                mimeType: String(v.mime_type || "video/mp4"),
                name: "video",
                size: Number(v.size || 0),
                poster: v.poster_path ? window.Supa.getPublicUrl("ad-posters", v.poster_path) : "",
                dataUrl: window.Supa.getPublicUrl("ad-videos", v.path)
            }));

            const cover = result.ad.cover_path ? window.Supa.getPublicUrl("ad-photos", result.ad.cover_path) : (photos[0] || "");

            const mappedAd = {
                id: result.ad.id,
                ownerEmail: String(owner.email || ""),
                ownerNickname: String(owner.nickname || "").trim(),
                ownerAvatar: owner.avatar_path ? window.Supa.getPublicUrl("avatars", owner.avatar_path) : "",
                updatedAt: Date.parse(result.ad.updated_at) || Date.now(),
                country: String(result.ad.country || ""),
                city: String(result.ad.city || ""),
                text: String(result.ad.text || ""),
                photos,
                videos,
                cover
            };

            state.ad = mappedAd;
            state.owner = null;
            state.mediaItems = buildMediaItems(mappedAd);
            state.activeIndex = 0;

            renderAdInfo();
            renderThumbs();
            showCard();
            showMediaByIndex(0);
        })
        .catch(() => {
            showPageState("Не удалось загрузить объявление.");
        });
}

function cacheRefs() {
    refs.adPageState = document.getElementById("adPageState");
    refs.adPageCard = document.getElementById("adPageCard");
    refs.adStage = document.getElementById("adStage");
    refs.adThumbs = document.getElementById("adThumbs");
    refs.adPrevBtn = document.getElementById("adPrevBtn");
    refs.adNextBtn = document.getElementById("adNextBtn");
    refs.adMediaCounter = document.getElementById("adMediaCounter");
    refs.adPlayerBar = document.getElementById("adPlayerBar");
    refs.adPlayPauseBtn = document.getElementById("adPlayPauseBtn");
    refs.adSeekInput = document.getElementById("adSeekInput");
    refs.adTimeLabel = document.getElementById("adTimeLabel");
    refs.adMuteBtn = document.getElementById("adMuteBtn");
    refs.adVolumeInput = document.getElementById("adVolumeInput");
    refs.adFullscreenBtn = document.getElementById("adFullscreenBtn");

    refs.adOwnerAvatar = document.getElementById("adOwnerAvatar");
    refs.adOwnerName = document.getElementById("adOwnerName");
    refs.adUpdatedAt = document.getElementById("adUpdatedAt");
    refs.adLocationText = document.getElementById("adLocationText");
    refs.adDescriptionText = document.getElementById("adDescriptionText");
}

function bindEvents() {
    refs.adPrevBtn?.addEventListener("click", () => showRelativeMedia(-1));
    refs.adNextBtn?.addEventListener("click", () => showRelativeMedia(1));
    refs.adPlayPauseBtn?.addEventListener("click", onPlayPauseClick);
    refs.adSeekInput?.addEventListener("input", onSeekInput);
    refs.adVolumeInput?.addEventListener("input", onVolumeInput);
    refs.adMuteBtn?.addEventListener("click", onMuteClick);
    refs.adFullscreenBtn?.addEventListener("click", onFullscreenClick);

    // Освобождаем objectURL видео при уходе со страницы.
    window.addEventListener("beforeunload", releaseObjectUrls);
    window.addEventListener("pagehide", releaseObjectUrls);
}

function loadAdFromQuery() {
    const query = new URLSearchParams(window.location.search);
    const ownerEmail = AppCore.normalizeEmail(query.get("user"));
    const updatedAt = Number(query.get("ts")) || 0;

    const ad = resolveAd(ownerEmail, updatedAt);
    if (!ad) {
        showPageState("Объявление не найдено или уже удалено.");
        return;
    }

    state.ad = ad;
    state.owner = AppCore.findUserByEmail(AppCore.normalizeEmail(ad.ownerEmail));
    state.mediaItems = buildMediaItems(ad);
    state.activeIndex = 0;

    renderAdInfo();
    renderThumbs();
    showCard();
    showMediaByIndex(0);
}

function resolveAd(ownerEmail, updatedAt) {
    const feed = AppCore.getAdsFeed();

    if (ownerEmail) {
        const direct = AppCore.getAdByUser(ownerEmail);
        if (direct) {
            return direct;
        }

        const fromFeedByEmail = feed.find(
            (item) => AppCore.normalizeEmail(item.ownerEmail) === ownerEmail
        );
        if (fromFeedByEmail) {
            return fromFeedByEmail;
        }
    }

    if (updatedAt) {
        const fromFeedByTimestamp = feed.find((item) => Number(item.updatedAt) === updatedAt);
        if (fromFeedByTimestamp) {
            return fromFeedByTimestamp;
        }
    }

    const payload = readSavedAdPayload(ownerEmail, updatedAt);
    if (payload) {
        return payload;
    }

    const savedLocator = readSavedAdLocator();
    if (!savedLocator) {
        return null;
    }

    return findAdByLocator(feed, savedLocator);
}

function readSavedAdLocator() {
    try {
        const raw = window.sessionStorage.getItem("selectedAdLocator");
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }

        return {
            ownerEmail: AppCore.normalizeEmail(parsed.ownerEmail),
            updatedAt: Number(parsed.updatedAt) || 0,
            ownerNickname: String(parsed.ownerNickname || "").trim(),
            country: String(parsed.country || "").trim(),
            city: String(parsed.city || "").trim(),
            savedAt: Number(parsed.savedAt) || 0
        };
    } catch {
        return null;
    }
}

function readSavedAdPayload(ownerEmail, updatedAt) {
    try {
        const raw = window.sessionStorage.getItem("selectedAdPayload");
        if (!raw) {
            return null;
        }

        const payload = JSON.parse(raw);
        if (!payload || typeof payload !== "object") {
            return null;
        }

        const savedAt = Number(payload.savedAt) || 0;
        if (savedAt && Date.now() - savedAt > AD_LOCATOR_MAX_AGE_MS) {
            return null;
        }

        const payloadOwnerEmail = AppCore.normalizeEmail(payload.ownerEmail);
        const payloadUpdatedAt = Number(payload.updatedAt) || 0;

        if (ownerEmail && payloadOwnerEmail !== ownerEmail) {
            return null;
        }

        if (updatedAt && payloadUpdatedAt !== updatedAt) {
            return null;
        }

        return {
            ownerEmail: payloadOwnerEmail,
            ownerNickname: String(payload.ownerNickname || "").trim() || AppCore.nicknameFromEmail(payloadOwnerEmail),
            ownerAvatar: String(payload.ownerAvatar || ""),
            updatedAt: payloadUpdatedAt,
            country: String(payload.country || "").trim(),
            city: String(payload.city || "").trim(),
            text: String(payload.text || "").trim(),
            photos: Array.isArray(payload.photos) ? payload.photos : [],
            videos: Array.isArray(payload.videos) ? payload.videos : [],
            cover: String(payload.cover || "")
        };
    } catch {
        return null;
    }
}

function findAdByLocator(feed, locator) {
    if (!Array.isArray(feed) || !feed.length || !locator) {
        return null;
    }

    if (locator.savedAt && Date.now() - locator.savedAt > AD_LOCATOR_MAX_AGE_MS) {
        return null;
    }

    if (locator.ownerEmail) {
        const byEmail = feed.find(
            (item) => AppCore.normalizeEmail(item.ownerEmail) === locator.ownerEmail
        );
        if (byEmail) {
            return byEmail;
        }
    }

    if (locator.updatedAt) {
        const byTimestamp = feed.find((item) => Number(item.updatedAt) === locator.updatedAt);
        if (byTimestamp) {
            return byTimestamp;
        }
    }

    if (!locator.ownerNickname && !locator.country && !locator.city) {
        return null;
    }

    return feed.find((item) => {
        const nicknameMatches = !locator.ownerNickname || String(item.ownerNickname || "").trim() === locator.ownerNickname;
        const countryMatches = !locator.country || String(item.country || "").trim() === locator.country;
        const cityMatches = !locator.city || String(item.city || "").trim() === locator.city;
        return nicknameMatches && countryMatches && cityMatches;
    }) || null;
}

function isVideoDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:video/");
}

function isImageDataUrl(value) {
    return typeof value === "string" && value.startsWith("data:image/");
}

function normalizeVideoMediaRef(videoRef) {
    if (isVideoDataUrl(videoRef)) {
        return {
            id: "",
            mimeType: "video/mp4",
            name: "video",
            poster: "",
            dataUrl: String(videoRef)
        };
    }

    if (!videoRef || typeof videoRef !== "object") {
        return null;
    }

    const id = String(videoRef.id || "").trim();
    const directDataUrl = isVideoDataUrl(videoRef.dataUrl) ? String(videoRef.dataUrl) : "";
    const legacyDataUrl = isVideoDataUrl(videoRef.src) ? String(videoRef.src) : "";
    const dataUrl = directDataUrl || legacyDataUrl;

    if (!id && !dataUrl) {
        return null;
    }

    return {
        id,
        mimeType: String(videoRef.mimeType || "video/mp4"),
        name: String(videoRef.name || "video"),
        poster: isImageDataUrl(videoRef.poster)
            ? String(videoRef.poster)
            : (isImageDataUrl(videoRef.cover) ? String(videoRef.cover) : ""),
        dataUrl
    };
}

function createVideoThumbCover(label, posterSrc) {
    const cover = document.createElement("div");
    cover.className = "ad-page-thumb-video-cover";

    const image = document.createElement("img");
    image.className = "ad-page-thumb-image";
    image.src = posterSrc;
    image.alt = `Обложка ${label}`;

    const play = document.createElement("span");
    play.className = "ad-page-thumb-video-play";
    play.setAttribute("aria-hidden", "true");
    play.textContent = "▶";

    cover.appendChild(image);
    cover.appendChild(play);
    return cover;
}

function buildMediaItems(ad) {
    const photos = Array.isArray(ad?.photos) ? ad.photos : [];
    const videosRaw = Array.isArray(ad?.videos) ? ad.videos : [];
    const mediaItems = [];

    photos.forEach((photo, index) => {
        mediaItems.push({
            type: "photo",
            label: `Фото ${index + 1}`,
            src: photo
        });
    });

    const videos = videosRaw
        .map((videoRef) => normalizeVideoMediaRef(videoRef))
        .filter((videoRef) => Boolean(videoRef));

    videos.forEach((videoRef, index) => {
        mediaItems.push({
            type: "video",
            label: `Видео ${index + 1}`,
            ref: videoRef,
            poster: videoRef.poster || "",
            inlineSrc: videoRef.dataUrl || "",
            objectUrl: "",
            loadPromise: null,
            failed: false
        });
    });

    return mediaItems;
}

function renderAdInfo() {
    if (!state.ad) {
        return;
    }

    const nickname = state.ad.ownerNickname
        || state.owner?.profile?.nickname
        || AppCore.nicknameFromEmail(state.ad.ownerEmail || "");

    refs.adOwnerName.textContent = nickname;
    refs.adUpdatedAt.textContent = formatAdDate(state.ad.updatedAt);
    refs.adLocationText.textContent = `${state.ad.country}, ${state.ad.city}`;
    refs.adDescriptionText.textContent = state.ad.text || "Описание объявления не указано.";

    AppCore.setImageWithFallback(
        refs.adOwnerAvatar,
        state.ad.ownerAvatar || state.owner?.profile?.avatar || "",
        nickname
    );
}

function renderThumbs() {
    if (!refs.adThumbs) {
        return;
    }

    refs.adThumbs.innerHTML = "";

    if (!state.mediaItems.length) {
        const empty = document.createElement("div");
        empty.className = "ad-page-thumbs-empty";
        empty.textContent = "Медиа не добавлено";
        refs.adThumbs.appendChild(empty);
        updateGalleryControls();
        return;
    }

    state.mediaItems.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ad-page-thumb";
        button.setAttribute("aria-label", item.label);
        button.addEventListener("click", () => {
            showMediaByIndex(index);
        });

        if (item.type === "photo") {
            const image = document.createElement("img");
            image.className = "ad-page-thumb-image";
            image.src = item.src;
            image.alt = item.label;
            button.appendChild(image);
        } else {
            if (item.poster) {
                button.appendChild(createVideoThumbCover(item.label, item.poster));
            } else {
                const label = document.createElement("div");
                label.className = "ad-page-thumb-video";
                label.textContent = item.label;
                button.appendChild(label);

                ensureVideoPoster(item).then((posterSource) => {
                    if (!posterSource || !button.isConnected) {
                        return;
                    }
                    button.innerHTML = "";
                    button.appendChild(createVideoThumbCover(item.label, posterSource));
                });
            }
        }

        refs.adThumbs.appendChild(button);
    });

    updateActiveThumb();
    updateGalleryControls();
}

function showRelativeMedia(step) {
    const total = state.mediaItems.length;
    if (total <= 1) {
        return;
    }

    const nextIndex = (state.activeIndex + step + total) % total;
    showMediaByIndex(nextIndex);
}

function showMediaByIndex(index) {
    if (!refs.adStage) {
        return;
    }

    if (!state.mediaItems.length) {
        renderStageMessage("В этом объявлении нет фото и видео.");
        updateGalleryControls();
        return;
    }

    const safeIndex = Math.min(Math.max(Number(index) || 0, 0), state.mediaItems.length - 1);
    state.activeIndex = safeIndex;

    const item = state.mediaItems[safeIndex];
    if (item.type === "photo") {
        renderPhotoStage(item);
    } else {
        renderVideoStage(item, safeIndex);
    }

    updateActiveThumb();
    updateGalleryControls();
}

function formatPlayerTime(secondsValue) {
    const total = Number(secondsValue);
    if (!Number.isFinite(total) || total < 0) {
        return "00:00";
    }

    const safe = Math.floor(total);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const seconds = safe % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function syncPlayerUi() {
    const video = state.activeVideo;
    if (!video || !refs.adPlayerBar) {
        refs.adPlayerBar?.classList.add("hidden");
        return;
    }

    refs.adPlayerBar.classList.remove("hidden");

    const duration = Number(video.duration || 0);
    const current = Number(video.currentTime || 0);
    const progress = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;

    if (refs.adSeekInput) {
        refs.adSeekInput.disabled = duration <= 0;
        refs.adSeekInput.value = String(progress);
    }

    if (refs.adPlayPauseBtn) {
        refs.adPlayPauseBtn.textContent = video.paused ? "Play" : "Pause";
    }

    if (refs.adMuteBtn) {
        refs.adMuteBtn.textContent = video.muted || video.volume === 0 ? "Unmute" : "Mute";
    }

    if (refs.adVolumeInput) {
        refs.adVolumeInput.value = String(video.muted ? 0 : Number(video.volume || 0));
    }

    if (refs.adTimeLabel) {
        refs.adTimeLabel.textContent = `${formatPlayerTime(current)} / ${formatPlayerTime(duration)}`;
    }
}

function detachVideoController() {
    if (typeof state.detachActiveVideo === "function") {
        state.detachActiveVideo();
    }

    state.detachActiveVideo = null;
    state.activeVideo = null;

    if (refs.adPlayerBar) {
        refs.adPlayerBar.classList.add("hidden");
    }
}

function attachVideoController(video, requestedIndex) {
    detachVideoController();
    if (!video) {
        return;
    }

    state.activeVideo = video;
    syncPlayerUi();

    const syncWhenActive = () => {
        if (state.activeIndex !== requestedIndex || state.activeVideo !== video) {
            return;
        }
        syncPlayerUi();
    };

    const events = ["play", "pause", "timeupdate", "loadedmetadata", "durationchange", "volumechange", "seeking", "seeked", "ended"];
    events.forEach((eventName) => {
        video.addEventListener(eventName, syncWhenActive);
    });

    state.detachActiveVideo = () => {
        events.forEach((eventName) => {
            video.removeEventListener(eventName, syncWhenActive);
        });
    };
}

function onPlayPauseClick() {
    const video = state.activeVideo;
    if (!video) {
        return;
    }

    if (video.paused) {
        video.play().catch(() => {
            // ignore
        });
    } else {
        video.pause();
    }
    syncPlayerUi();
}

function onSeekInput(event) {
    const video = state.activeVideo;
    if (!video) {
        return;
    }

    const duration = Number(video.duration || 0);
    if (duration <= 0) {
        return;
    }

    const ratio = Math.min(100, Math.max(0, Number(event.target.value || 0)));
    video.currentTime = (ratio / 100) * duration;
    syncPlayerUi();
}

function onVolumeInput(event) {
    const video = state.activeVideo;
    if (!video) {
        return;
    }

    const volumeValue = Math.min(1, Math.max(0, Number(event.target.value || 0)));
    video.volume = volumeValue;
    video.muted = volumeValue === 0;
    syncPlayerUi();
}

function onMuteClick() {
    const video = state.activeVideo;
    if (!video) {
        return;
    }

    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) {
        video.volume = 0.5;
    }
    syncPlayerUi();
}

function onFullscreenClick() {
    const video = state.activeVideo;
    if (!video) {
        return;
    }

    const currentFullscreen = document.fullscreenElement;
    if (currentFullscreen) {
        document.exitFullscreen?.();
        return;
    }

    if (video.requestFullscreen) {
        video.requestFullscreen().catch(() => {
            // ignore
        });
    }
}

function renderPhotoStage(item) {
    detachVideoController();
    refs.adStage.innerHTML = "";

    const image = document.createElement("img");
    image.className = "ad-page-stage-image";
    image.src = item.src;
    image.alt = item.label;
    refs.adStage.appendChild(image);
}

function renderVideoStage(item, requestedIndex) {
    refs.adStage.innerHTML = "";

    const loading = document.createElement("div");
    loading.className = "ad-page-stage-loading";
    loading.textContent = `${item.label} загружается...`;
    refs.adStage.appendChild(loading);

    ensureVideoObjectUrl(item).then((objectUrl) => {
        if (state.activeIndex !== requestedIndex) {
            return;
        }

        refs.adStage.innerHTML = "";

        if (!objectUrl) {
            if (item.poster) {
                const image = document.createElement("img");
                image.className = "ad-page-stage-image";
                image.src = item.poster;
                image.alt = `${item.label} (обложка)`;
                refs.adStage.appendChild(image);
                return;
            }

            renderStageMessage("Видео недоступно или было удалено.");
            return;
        }

        const video = document.createElement("video");
        video.className = "ad-page-stage-video";
        video.controls = true;
        video.preload = "metadata";
        video.playsInline = true;
        if (item.poster) {
            video.poster = item.poster;
        }

        let sourceSwitched = false;
        const isStillRequested = () => state.activeIndex === requestedIndex;

        const showVideoErrorState = () => {
            if (!isStillRequested()) {
                return;
            }
            detachVideoController();
            const reason = String(item.failedReason || "");
            if (reason === "missing_blob") {
                renderStageMessage("Видео не найдено в хранилище браузера. Откройте 'Мое объявление' и загрузите видео заново.");
                return;
            }

            const mimeType = String(item.ref?.mimeType || "");
            if (mimeType && !mimeType.startsWith("video/mp4")) {
                renderStageMessage(`Формат ${mimeType} может не поддерживаться. Рекомендуется MP4 (H.264/AAC).`);
                return;
            }

            renderStageMessage("Видео не удалось воспроизвести. Перезагрузите видео в формате MP4 (H.264/AAC).");
        };

        const trySwitchSource = () => {
            const currentSource = String(video.currentSrc || video.src || objectUrl);
            const fallbackSrc = getAlternativeVideoSource(item, currentSource);
            if (!fallbackSrc || fallbackSrc === currentSource) {
                showVideoErrorState();
                return false;
            }

            sourceSwitched = true;
            video.src = fallbackSrc;
            video.load();
            return true;
        };

        video.addEventListener("loadedmetadata", () => {
            if (!isStillRequested()) {
                return;
            }
            attachVideoController(video, requestedIndex);
        }, { once: true });

        video.onerror = () => {
            if (!isStillRequested()) {
                return;
            }
            item.failedReason = "playback_error";
            if (!sourceSwitched && trySwitchSource()) {
                return;
            }
            showVideoErrorState();
        };

        video.src = objectUrl;
        refs.adStage.appendChild(video);
        attachVideoController(video, requestedIndex);
        video.load();
    });
}

function ensureVideoPoster(item) {
    if (item.poster) {
        return Promise.resolve(item.poster);
    }

    if (item.posterPromise) {
        return item.posterPromise;
    }

    const videoId = String(item.ref?.id || "").trim();
    if (!videoId) {
        return Promise.resolve("");
    }

    item.posterPromise = AppCore.getStoredVideoBlob(videoId)
        .then((blob) => {
            if (!blob) {
                return "";
            }
            return extractPosterFromBlob(blob, item.ref?.mimeType, item.ref?.name);
        })
        .then((posterSource) => {
            if (posterSource) {
                item.poster = posterSource;
                if (item.ref && typeof item.ref === "object") {
                    item.ref.poster = posterSource;
                }
            }
            return posterSource;
        })
        .catch(() => "");

    return item.posterPromise;
}

function extractPosterFromBlob(blob, mimeType, name) {
    const normalizedMime = String(mimeType || blob?.type || "video/mp4");
    if (!normalizedMime.startsWith("video/")) {
        return Promise.resolve("");
    }

    let source = blob;
    try {
        if (!(blob instanceof File)) {
            source = new File([blob], String(name || "video"), { type: normalizedMime });
        }
    } catch {
        source = blob;
    }

    return AppCore.captureVideoPoster(source).catch(() => "");
}

function ensureVideoObjectUrl(item) {
    if (item.objectUrl) {
        return Promise.resolve(item.objectUrl);
    }

    if (item.failed) {
        return Promise.resolve("");
    }

    const videoId = String(item.ref?.id || "").trim();
    if (!videoId) {
        item.failedReason = item.inlineSrc ? "" : "missing_blob";
        return Promise.resolve(item.inlineSrc || "");
    }

    if (!item.loadPromise) {
        item.loadPromise = AppCore.getStoredVideoBlob(videoId)
            .then((blob) => {
                if (!blob) {
                    if (item.inlineSrc) {
                        item.failedReason = "";
                        return item.inlineSrc;
                    }
                    item.failed = true;
                    item.failedReason = "missing_blob";
                    return "";
                }

                const objectUrl = URL.createObjectURL(blob);
                item.objectUrl = objectUrl;
                state.objectUrls.push(objectUrl);
                item.failedReason = "";
                return objectUrl;
            })
            .catch(() => {
                if (item.inlineSrc) {
                    item.failedReason = "";
                    return item.inlineSrc;
                }
                item.failed = true;
                item.failedReason = "storage_error";
                return "";
            });
    }

    return item.loadPromise;
}

function getAlternativeVideoSource(item, currentSource) {
    const inlineSource = String(item.inlineSrc || "");
    if (currentSource === item.objectUrl && inlineSource) {
        return inlineSource;
    }

    if (currentSource === inlineSource && item.objectUrl) {
        return item.objectUrl;
    }

    return "";
}

function renderStageMessage(message) {
    detachVideoController();
    refs.adStage.innerHTML = "";

    const empty = document.createElement("div");
    empty.className = "ad-page-stage-empty";
    empty.textContent = message;
    refs.adStage.appendChild(empty);
}

function updateActiveThumb() {
    const thumbs = refs.adThumbs?.querySelectorAll(".ad-page-thumb") || [];
    thumbs.forEach((thumb, index) => {
        thumb.classList.toggle("active", index === state.activeIndex);
    });
}

function updateGalleryControls() {
    const total = state.mediaItems.length;
    const current = total ? state.activeIndex + 1 : 0;

    if (refs.adMediaCounter) {
        refs.adMediaCounter.textContent = `${current} / ${total}`;
    }

    const disableNav = total <= 1;
    if (refs.adPrevBtn) {
        refs.adPrevBtn.disabled = disableNav;
    }
    if (refs.adNextBtn) {
        refs.adNextBtn.disabled = disableNav;
    }
}

function showPageState(message) {
    detachVideoController();
    if (refs.adPageCard) {
        refs.adPageCard.classList.add("hidden");
    }
    if (refs.adPageState) {
        refs.adPageState.textContent = message;
        refs.adPageState.classList.remove("hidden");
    }
}

function showCard() {
    if (refs.adPageState) {
        refs.adPageState.classList.add("hidden");
    }
    if (refs.adPageCard) {
        refs.adPageCard.classList.remove("hidden");
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

function releaseObjectUrls() {
    detachVideoController();
    state.objectUrls.forEach((url) => {
        try {
            URL.revokeObjectURL(url);
        } catch {
            // ignore
        }
    });
    state.objectUrls = [];
}
