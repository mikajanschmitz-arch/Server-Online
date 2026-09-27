const API_URL =
    "https://minecraft-monitor.mikajan-schmitz.workers.dev";


let clientId =
    localStorage.getItem("minecraftMonitorClientId");


if (!clientId) {

    clientId =
        crypto.randomUUID();

    localStorage.setItem(
        "minecraftMonitorClientId",
        clientId
    );
}


let servers = [];


// ==========================================
// SERVERKONFIGURATION LADEN
// ==========================================

async function loadConfig() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/config/${clientId}`
            );


        if (!response.ok) {

            throw new Error(
                "Konfiguration konnte nicht geladen werden."
            );

        }


        const data =
            await response.json();


        servers =
            data.servers || [];


        renderServers();


        await loadStatus();


    } catch (error) {

        showMessage(
            "Fehler: " + error.message
        );

    }

}


// ==========================================
// SERVERSTATUS LADEN
// ==========================================

async function loadStatus() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/status/${clientId}`
            );


        if (!response.ok) {

            return;

        }


        const data =
            await response.json();


        const statuses =
            data.servers || [];


        renderServers(statuses);


    } catch (error) {

        console.error(
            "Status konnte nicht geladen werden:",
            error
        );

    }

}


// ==========================================
// SERVER ANZEIGEN
// ==========================================

function renderServers(statuses = []) {

    const container =
        document.getElementById("servers");


    container.innerHTML = "";


    if (servers.length === 0) {

        container.innerHTML =
            "<p>Noch keine Server hinzugefügt.</p>";

        return;

    }


    servers.forEach(
        (server, index) => {

            const div =
                document.createElement("div");


            div.className =
                "server";


            const status =
                statuses.find(
                    item =>
                        item.id === server.id
                );


            let statusHtml =
                `<div class="server-status">
                    ⚪ Status wird geladen...
                </div>`;


            if (status) {

                if (status.online) {

                    let playerText =
                        `${status.players} Spieler online`;


                    if (
                        status.players === 1
                    ) {

                        playerText =
                            "1 Spieler online";

                    }


                    statusHtml =
                        `
                        <div class="server-status">
                            🟢 Online
                        </div>

                        <div class="server-players">
                            ${playerText}
                        </div>
                        `;


                    if (
                        status.playerNames &&
                        status.playerNames.length > 0
                    ) {

                        statusHtml +=
                            `
                            <div class="server-player-names">
                                ${status.playerNames
                                    .map(
                                        name =>
                                            escapeHtml(name)
                                    )
                                    .join(", ")}
                            </div>
                            `;

                    }

                } else {

                    statusHtml =
                        `
                        <div class="server-status">
                            🔴 Offline
                        </div>
                        `;

                }

            }


            div.innerHTML = `

                <div class="server-info">

                    <div class="server-name">

                        ${escapeHtml(server.name)}

                    </div>

                    ${statusHtml}

                </div>


                <input
                    type="checkbox"
                    ${server.enabled ? "checked" : ""}
                    onchange="toggleServer(${index})"
                >


                <button
                    class="danger"
                    onclick="deleteServer(${index})"
                >

                    Löschen

                </button>

            `;


            container.appendChild(div);

        }
    );

}


// ==========================================
// SERVER SPEICHERN
// ==========================================

async function saveServers() {

    try {

        const response =
            await fetch(
                `${API_URL}/api/config/${clientId}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            servers: servers
                        })
                }
            );


        if (!response.ok) {

            throw new Error(
                "Server konnten nicht gespeichert werden."
            );

        }


        showMessage(
            "Gespeichert."
        );


    } catch (error) {

        showMessage(
            "Fehler beim Speichern."
        );

    }

}


// ==========================================
// SERVER HINZUFÜGEN
// ==========================================

async function addServer() {

    const name =
        document
            .getElementById("serverName")
            .value
            .trim();


    const host =
        document
            .getElementById("serverHost")
            .value
            .trim();


    const port =
        Number(
            document
                .getElementById("serverPort")
                .value
        );


    if (!name || !host || !port) {

        showMessage(
            "Bitte alle Felder ausfüllen."
        );

        return;

    }


    if (
        port < 1 ||
        port > 65535
    ) {

        showMessage(
            "Ungültiger Port."
        );

        return;

    }


    servers.push({

        id:
            crypto.randomUUID(),

        name:
            name,

        host:
            host,

        port:
            port,

        enabled:
            true

    });


    await saveServers();


    document
        .getElementById("serverName")
        .value = "";


    document
        .getElementById("serverHost")
        .value = "";


    document
        .getElementById("serverPort")
        .value = "";


    renderServers();


    await loadStatus();

}


// ==========================================
// SERVER AKTIVIEREN / DEAKTIVIEREN
// ==========================================

async function toggleServer(index) {

    servers[index].enabled =
        !servers[index].enabled;


    await saveServers();


    await loadStatus();

}


// ==========================================
// SERVER LÖSCHEN
// ==========================================

async function deleteServer(index) {

    if (
        !confirm(
            "Diesen Server wirklich löschen?"
        )
    ) {

        return;

    }


    servers.splice(
        index,
        1
    );


    await saveServers();


    renderServers();


    await loadStatus();

}


// ==========================================
// BENACHRICHTIGUNGEN AKTIVIEREN
// ==========================================

async function enableNotifications() {

    try {

        console.log(
            "1. Benachrichtigungen werden gestartet..."
        );


        if (
            !("serviceWorker" in navigator)
        ) {

            throw new Error(
                "Dieser Browser unterstützt keine Service Worker."
            );

        }


        if (
            !("PushManager" in window)
        ) {

            throw new Error(
                "Dieser Browser unterstützt Web Push nicht."
            );

        }


        const permission =
            await Notification.requestPermission();


        console.log(
            "2. Berechtigung:",
            permission
        );


        if (
            permission !== "granted"
        ) {

            throw new Error(
                "Benachrichtigungen wurden nicht erlaubt."
            );

        }


        const registration =
            await navigator.serviceWorker.ready;


        console.log(
            "3. Service Worker bereit:",
            registration
        );


        const publicKey =
            await getPublicVapidKey();


        console.log(
            "4. VAPID-Key erhalten."
        );


        let subscription =
            await registration
                .pushManager
                .getSubscription();


        console.log(
            "5. Vorhandene Subscription:",
            subscription
        );


        if (!subscription) {

            console.log(
                "6. Erstelle neue Push-Subscription..."
            );


            subscription =
                await registration
                    .pushManager
                    .subscribe({

                        userVisibleOnly:
                            true,

                        applicationServerKey:
                            urlBase64ToUint8Array(
                                publicKey
                            )

                    });


            console.log(
                "7. Subscription erstellt:",
                subscription
            );

        }


        const response =
            await fetch(
                `${API_URL}/api/subscription/${clientId}`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            subscription
                        )
                }
            );


        console.log(
            "8. Subscription an Cloudflare gesendet:",
            response.status
        );


        if (!response.ok) {

            throw new Error(
                "Benachrichtigung konnte nicht registriert werden."
            );

        }


        showMessage(
            "Benachrichtigungen sind aktiviert."
        );


        document
            .getElementById(
                "notificationButton"
            )
            .style.display =
                "none";


    } catch (error) {

        console.error(
            "BENACHRICHTIGUNGS-FEHLER:",
            error
        );


        showMessage(
            "Fehler: " +
            error.message
        );

    }

}


// ==========================================
// PUBLIC VAPID KEY LADEN
// ==========================================

async function getPublicVapidKey() {

    const response =
        await fetch(
            `${API_URL}/api/public-key`
        );


    if (!response.ok) {

        throw new Error(
            "VAPID-Key konnte nicht geladen werden."
        );

    }


    const data =
        await response.json();


    return data.publicKey;

}


// ==========================================
// VAPID KEY UMFORMEN
// ==========================================

function urlBase64ToUint8Array(
    base64String
) {

    const padding =
        "=".repeat(
            (
                4 -
                base64String.length % 4
            ) % 4
        );


    const base64 =
        (
            base64String +
            padding
        )
        .replace(/-/g, "+")
        .replace(/_/g, "/");


    const rawData =
        window.atob(base64);


    return Uint8Array.from(
        [...rawData].map(
            char =>
                char.charCodeAt(0)
        )
    );

}


// ==========================================
// HTML SICHER DARSTELLEN
// ==========================================

function escapeHtml(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


// ==========================================
// MELDUNGEN
// ==========================================

function showMessage(message) {

    document
        .getElementById("message")
        .textContent =
            message;

}


// ==========================================
// AUTOMATISCHEN STATUS AKTUALISIEREN
// ==========================================

setInterval(
    loadStatus,
    30000
);


// ==========================================
// START
// ==========================================

loadConfig();
