init();

function init() {
    AppCore.enablePageTransitions();
    AppCore.enableRippleEffects(document);

    AppCore.migrateUsers();

    if (!guardAdminAccess()) {
        return;
    }

    fillStats();
    drawVisitsChart();

    const logoutBtn = document.getElementById("adminLogoutBtn");
    logoutBtn?.addEventListener("click", () => {
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

function guardAdminAccess() {
    const params = new URLSearchParams(window.location.search);

    if (params.get("admin") === "1") {
        const adminUser = AppCore.ensureAdminExists();
        AppCore.setSessionFromUser(adminUser);
        localStorage.removeItem(AppCore.KEYS.adminBypass);
        return true;
    }

    const bypassAt = Number(localStorage.getItem(AppCore.KEYS.adminBypass) || 0);
    if (bypassAt && Date.now() - bypassAt < 5 * 60 * 1000) {
        const adminUser = AppCore.ensureAdminExists();
        AppCore.setSessionFromUser(adminUser);
        localStorage.removeItem(AppCore.KEYS.adminBypass);
        return true;
    }

    const currentUser = AppCore.getCurrentUser();
    if (!currentUser || !AppCore.isAdmin(currentUser)) {
        location.href = "auth.html";
        return false;
    }

    return true;
}

function fillStats() {
    const users = AppCore.getUsers();

    document.getElementById("visitCount").textContent = localStorage.getItem(AppCore.KEYS.visits) || "0";
    document.getElementById("userCount").textContent = String(users.length);
    document.getElementById("todayLogins").textContent = localStorage.getItem(AppCore.KEYS.todayLogins) || "0";
}

function drawVisitsChart() {
    const canvas = document.getElementById("visitsChart");
    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
        return;
    }

    const valuesRaw = AppCore.safeReadJSON(AppCore.KEYS.hourlyVisits, new Array(24).fill(0));
    const values = Array.isArray(valuesRaw) && valuesRaw.length === 24 ? valuesRaw : new Array(24).fill(0);

    const width = canvas.width;
    const height = canvas.height;
    const padLeft = 40;
    const padRight = 20;
    const padTop = 18;
    const padBottom = 34;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    const maxValue = Math.max(1, ...values.map((item) => Number(item || 0)));

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#151922";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 120, 184, 0.2)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = padTop + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(width - padRight, y);
        ctx.stroke();
    }

    const barW = plotW / values.length;
    for (let i = 0; i < values.length; i += 1) {
        const value = Number(values[i] || 0);
        const barH = (value / maxValue) * plotH;
        const x = padLeft + i * barW + 2;
        const y = padTop + plotH - barH;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barH + 1);
        gradient.addColorStop(0, "#ff52a8");
        gradient.addColorStop(1, "#d91871");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, Math.max(2, barW - 4), barH);
    }

    ctx.fillStyle = "#c6becc";
    ctx.font = "12px Segoe UI";
    ctx.fillText("00", padLeft - 8, height - 10);
    ctx.fillText("06", padLeft + barW * 6 - 8, height - 10);
    ctx.fillText("12", padLeft + barW * 12 - 8, height - 10);
    ctx.fillText("18", padLeft + barW * 18 - 8, height - 10);
    ctx.fillText("23", width - padRight - 18, height - 10);

    ctx.fillStyle = "#ffe6f2";
    ctx.font = "bold 12px Segoe UI";
    ctx.fillText(`Макс: ${maxValue}`, width - 88, 14);
}
