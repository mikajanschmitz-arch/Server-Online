import json
import os
import requests

from pywebpush import webpush


BACKEND_URL = os.environ["BACKEND_URL"].rstrip("/")
BACKEND_SECRET = os.environ["BACKEND_SECRET"]
VAPID_PRIVATE_KEY = os.environ["VAPID_PRIVATE_KEY"]

STATE_FILE = "state.json"


def load_state():
    if not os.path.exists(STATE_FILE):
        return {}

    with open(STATE_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as file:
        json.dump(state, file, indent=2)


def get_configs():
    response = requests.get(
        f"{BACKEND_URL}/internal/configs",
        headers={
            "Authorization": f"Bearer {BACKEND_SECRET}"
        },
        timeout=20
    )

    response.raise_for_status()

    return response.json()


def check_server(host, port):

    address = f"{host}:{port}"

    url = (
        "https://api.mcstatus.io/v2/"
        f"status/bedrock/{address}"
    )

    try:

        response = requests.get(
            url,
            timeout=15
        )

        # ZUSÄTZLICHE TESTAUSGABE
        print(
            f"mcstatus.io HTTP-Status für {address}: "
            f"{response.status_code}"
        )

        if response.status_code != 200:

            print(
                f"mcstatus.io Antwort: "
                f"{response.text}"
            )

            return False, 0, []

        data = response.json()

        # ZUSÄTZLICHE TESTAUSGABE
        print(
            f"mcstatus.io Antwort für {address}: "
            f"{data}"
        )

        online = bool(
            data.get("online", False)
        )

        players = data.get(
            "players",
            {}
        )

        player_count = players.get(
            "online",
            0
        )

        player_names = []

        player_list = players.get(
            "list",
            []
        )

        if isinstance(player_list, list):

            for player in player_list:

                if isinstance(player, str):

                    player_names.append(
                        player
                    )

                elif isinstance(player, dict):

                    name = player.get("name")

                    if name:
                        player_names.append(
                            name
                        )

        return (
            online,
            player_count,
            player_names
        )

    except Exception as error:

        print(
            f"Fehler bei {address}: {error}"
        )

        return False, 0, []


def send_push(
    subscription,
    server,
    players,
    player_names
):

    if players == 1:

        player_text = "1 Spieler ist online."

    else:

        player_text = (
            f"{players} Spieler sind online."
        )

    if player_names:

        names_text = (
            "\nSpieler: "
            + ", ".join(player_names)
        )

    else:

        names_text = ""

    payload = json.dumps({

        "title":
            f"🟢 {server['name']} ist online!",

        "body":
            player_text + names_text,

        "serverId":
            server["id"]

    })

    webpush(

        subscription_info=subscription,

        data=payload,

        vapid_private_key=VAPID_PRIVATE_KEY,

        vapid_claims={
            "sub":
                "mailto:you@example.com"
        },

        ttl=3600
    )


def save_status_for_user(
    client_id,
    status_servers
):

    response = requests.post(

        f"{BACKEND_URL}/internal/status",

        headers={

            "Authorization":
                f"Bearer {BACKEND_SECRET}",

            "Content-Type":
                "application/json"

        },

        json={

            "clientId":
                client_id,

            "servers":
                status_servers

        },

        timeout=20
    )

    response.raise_for_status()


def main():

    configs = get_configs()

    state = load_state()

    servers = {}


    # ==========================================
    # SERVER ZUSAMMENFASSEN
    # ==========================================

    for config in configs:

        for server in config.get(
            "servers",
            []
        ):

            if not server.get(
                "enabled",
                False
            ):
                continue

            server_key = (
                f"{server['host']}:"
                f"{server['port']}"
            )

            if server_key not in servers:

                servers[server_key] = {

                    "server":
                        server,

                    "users":
                        []

                }

            servers[
                server_key
            ]["users"].append(config)


    # ==========================================
    # SERVER PRÜFEN
    # ==========================================

    checked_servers = {}


    for server_key, info in servers.items():

        server = info["server"]

        online, players, player_names = (
            check_server(
                server["host"],
                server["port"]
            )
        )

        previous = state.get(
            server_key,
            False
        )

        print(
            f"{server['name']}: "
            f"online={online}, "
            f"players={players}, "
            f"names={player_names}"
        )


        checked_servers[
            server_key
        ] = {

            "id":
                server["id"],

            "name":
                server["name"],

            "online":
                online,

            "players":
                players,

            "playerNames":
                player_names

        }


        # ==========================================
        # PUSH-NACHRICHT
        # ==========================================

        if online and not previous:

            for config in info["users"]:

                try:

                    send_push(

                        config["subscription"],

                        server,

                        players,

                        player_names

                    )

                except Exception as error:

                    print(
                        f"Push-Fehler: {error}"
                    )


        state[server_key] = online


    # ==========================================
    # STATUS FÜR JEDEN BENUTZER SPEICHERN
    # ==========================================

    for config in configs:

        client_id = config["clientId"]

        user_servers = []


        for server in config.get(
            "servers",
            []
        ):

            server_key = (
                f"{server['host']}:"
                f"{server['port']}"
            )


            status = checked_servers.get(
                server_key
            )


            if status:

                user_servers.append({

                    "id":
                        status["id"],

                    "name":
                        status["name"],

                    "online":
                        status["online"],

                    "players":
                        status["players"],

                    "playerNames":
                        status["playerNames"]

                })


        try:

            save_status_for_user(

                client_id,

                user_servers

            )

        except Exception as error:

            print(
                "Status konnte nicht "
                f"gespeichert werden: {error}"
            )


    save_state(state)


if __name__ == "__main__":
    main()
