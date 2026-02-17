(function (window) {
    "use strict";

    const SUPABASE_URL = "https://qocaiqusjbarxhktvfhr.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvY2FpcXVzamJhcnhoa3R2ZmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5OTcxNTgsImV4cCI6MjA4NjU3MzE1OH0.GftHUDdtH1ojTPfVF2jRjVLCiS5ATPqQZt3xGe7BLjQ";

    function createClient() {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            return null;
        }
        try {
            return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        } catch {
            return null;
        }
    }

    const client = createClient();

    async function getSession() {
        if (!client) {
            return null;
        }
        const { data, error } = await client.auth.getSession();
        if (error) {
            return null;
        }
        return data?.session || null;
    }

    async function getUser() {
        if (!client) {
            return null;
        }
        const { data, error } = await client.auth.getUser();
        if (error) {
            return null;
        }
        return data?.user || null;
    }

    async function signUp(email, password) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        if (error) {
            return { ok: false, error: error.message || "Ошибка регистрации" };
        }
        return { ok: true, data };
    }

    async function signIn(email, password) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        if (error) {
            return { ok: false, error: error.message || "Ошибка входа" };
        }
        return { ok: true, data };
    }

    async function signOut() {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        const { error } = await client.auth.signOut();
        if (error) {
            return { ok: false, error: error.message || "Ошибка выхода" };
        }
        return { ok: true };
    }

    function onAuthStateChange(callback) {
        if (!client) {
            return () => {};
        }
        const { data } = client.auth.onAuthStateChange((event, session) => {
            try {
                callback?.(event, session);
            } catch {
                // ignore
            }
        });
        return () => {
            try {
                data?.subscription?.unsubscribe?.();
            } catch {
                // ignore
            }
        };
    }

    async function getProfile(userId) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        const { data, error } = await client
            .from("profiles")
            .select("id,email,nickname,country,city,avatar_path,role")
            .eq("id", userId)
            .maybeSingle();

        if (error) {
            return { ok: false, error: error.message || "Ошибка загрузки профиля" };
        }

        return { ok: true, profile: data || null };
    }

    async function upsertProfile(payload) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        const { data, error } = await client
            .from("profiles")
            .upsert(payload, { onConflict: "id" })
            .select("id,email,nickname,country,city,avatar_path,role")
            .single();

        if (error) {
            return { ok: false, error: error.message || "Ошибка сохранения профиля" };
        }

        return { ok: true, profile: data };
    }

    function safeExtFromName(name) {
        const raw = String(name || "").trim();
        const idx = raw.lastIndexOf(".");
        if (idx === -1) {
            return "";
        }
        const ext = raw.slice(idx + 1).toLowerCase();
        if (!ext || ext.length > 8) {
            return "";
        }
        return ext.replace(/[^a-z0-9]/g, "");
    }

    function buildAvatarPath(userId, fileName) {
        const ext = safeExtFromName(fileName) || "jpg";
        return `${userId}/avatar.${ext}`;
    }

    function buildAdPhotoPath(userId, adId, index, fileName) {
        const ext = safeExtFromName(fileName) || "jpg";
        return `${userId}/${adId}/photo_${String(index).padStart(2, "0")}.${ext}`;
    }

    function buildAdVideoPath(userId, adId, videoId, fileName) {
        const ext = safeExtFromName(fileName) || "mp4";
        return `${userId}/${adId}/${videoId}.${ext}`;
    }

    function buildAdPosterPath(userId, adId, videoId) {
        return `${userId}/${adId}/${videoId}.jpg`;
    }

    async function listAdsFeed() {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }

        const { data, error } = await client
            .from("ads")
            .select("id,owner_id,text,country,city,cover_path,created_at,updated_at, profiles:owner_id(id,email,nickname,avatar_path,role,country,city)")
            .order("updated_at", { ascending: false });

        if (error) {
            return { ok: false, error: error.message || "Ошибка загрузки ленты" };
        }

        return { ok: true, ads: Array.isArray(data) ? data : [] };
    }

    async function getAdDetails(adId) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }

        const { data: ad, error: adError } = await client
            .from("ads")
            .select("id,owner_id,text,country,city,cover_path,created_at,updated_at, profiles:owner_id(id,email,nickname,avatar_path,role,country,city)")
            .eq("id", adId)
            .maybeSingle();
        if (adError) {
            return { ok: false, error: adError.message || "Ошибка загрузки объявления" };
        }
        if (!ad) {
            return { ok: true, ad: null, photos: [], videos: [] };
        }

        const { data: photos, error: photosError } = await client
            .from("ad_photos")
            .select("id,ad_id,path,sort")
            .eq("ad_id", adId)
            .order("sort", { ascending: true });
        if (photosError) {
            return { ok: false, error: photosError.message || "Ошибка загрузки фото" };
        }

        const { data: videos, error: videosError } = await client
            .from("ad_videos")
            .select("id,ad_id,path,poster_path,mime_type,size,sort")
            .eq("ad_id", adId)
            .order("sort", { ascending: true });
        if (videosError) {
            return { ok: false, error: videosError.message || "Ошибка загрузки видео" };
        }

        return {
            ok: true,
            ad,
            photos: Array.isArray(photos) ? photos : [],
            videos: Array.isArray(videos) ? videos : []
        };
    }

    async function upsertAd(payload) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }

        const { data, error } = await client
            .from("ads")
            .upsert(payload)
            .select("id,owner_id,text,country,city,cover_path,created_at,updated_at")
            .single();

        if (error) {
            return { ok: false, error: error.message || "Ошибка сохранения объявления" };
        }

        return { ok: true, ad: data };
    }

    async function replaceAdMedia(adId, items) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }
        if (!adId) {
            return { ok: false, error: "Не указан adId" };
        }

        const photos = Array.isArray(items?.photos) ? items.photos : [];
        const videos = Array.isArray(items?.videos) ? items.videos : [];

        const { error: delPhotosError } = await client.from("ad_photos").delete().eq("ad_id", adId);
        if (delPhotosError) {
            return { ok: false, error: delPhotosError.message || "Ошибка очистки фото" };
        }
        const { error: delVideosError } = await client.from("ad_videos").delete().eq("ad_id", adId);
        if (delVideosError) {
            return { ok: false, error: delVideosError.message || "Ошибка очистки видео" };
        }

        if (photos.length) {
            const { error } = await client.from("ad_photos").insert(photos.map((p, index) => ({
                ad_id: adId,
                path: String(p.path || ""),
                sort: Number(p.sort ?? index) || 0
            })));
            if (error) {
                return { ok: false, error: error.message || "Ошибка записи фото" };
            }
        }

        if (videos.length) {
            const { error } = await client.from("ad_videos").insert(videos.map((v, index) => ({
                ad_id: adId,
                path: String(v.path || ""),
                poster_path: String(v.poster_path || ""),
                mime_type: String(v.mime_type || "video/mp4"),
                size: Number(v.size || 0),
                sort: Number(v.sort ?? index) || 0
            })));
            if (error) {
                return { ok: false, error: error.message || "Ошибка записи видео" };
            }
        }

        return { ok: true };
    }

    async function uploadPublicFile(bucket, path, file, options = {}) {
        if (!client) {
            return { ok: false, error: "Supabase не инициализирован." };
        }

        const { data, error } = await client.storage
            .from(bucket)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: true,
                contentType: options.contentType
            });

        if (error) {
            return { ok: false, error: error.message || "Ошибка загрузки файла" };
        }

        return { ok: true, data };
    }

    function getPublicUrl(bucket, path) {
        if (!client) {
            return "";
        }
        if (!path) {
            return "";
        }
        const { data } = client.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl || "";
    }

    window.Supa = Object.freeze({
        enabled: Boolean(client),
        client,
        getSession,
        getUser,
        signUp,
        signIn,
        signOut,
        onAuthStateChange,
        getProfile,
        upsertProfile,
        uploadPublicFile,
        getPublicUrl,
        buildAvatarPath,
        buildAdPhotoPath,
        buildAdVideoPath,
        buildAdPosterPath,
        listAdsFeed,
        getAdDetails,
        upsertAd,
        replaceAdMedia
    });
})(window);
