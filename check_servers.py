import socket
import struct


HOST = "TestTest112233.aternos.me"
PORT = 19132


def bedrock_ping(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(10)

    # Minecraft Bedrock Unconnected Ping
    packet = (
        b"\x01"
        + struct.pack(">Q", 0)
        + bytes.fromhex("00ffff00fefefefefdfdfdfd12345678")
        + struct.pack(">Q", 2)
        + bytes.fromhex("0000000000000000")
    )

    sock.sendto(packet, (host, port))

    data, address = sock.recvfrom(4096)

    sock.close()

    return data, address


try:
    data, address = bedrock_ping(HOST, PORT)

    print("SERVER ANTWORTET!")
    print("Adresse:", address)
    print("Antwort:", data)

except Exception as error:

    print("SERVER ANTWORTET NICHT")
    print("Fehler:", error)
