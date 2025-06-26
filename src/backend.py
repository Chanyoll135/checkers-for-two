# server.py - FastAPI WebSocket server for assigning player colors
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, WebSocketException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from src.models import check_player, close_game, find_game, DARK, LIGHT, sync_game_state


app = FastAPI()

# Allow CORS for local frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

player_to_ws: dict[str, WebSocket] = {}  # player_name -> websocket
player_to_opponent_ws: dict[str, WebSocket] = {} # player_name -> enemy ws


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def read_index():
    return FileResponse("static/index.html")

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    player_name = ws.query_params.get("nickname")

    if not player_name:
        await ws.send_json({"type": "error", "message": "Missing nickname"})
        await ws.close()
        return

    # If reconnecting, replace old connection
    if player_name in player_to_ws:
        # old_ws = player_to_ws[player_name]
        # await close_ws(old_ws)
        print(f"{player_name} reconnected, opponent is {id(player_to_opponent_ws.get(player_name))}")

    player_to_ws[player_name] = ws

    game_id, player_color, opponent_name, game_state = player_connected(player_name)

    await ws.send_json({
        "type": "player_connect",
        "color": player_color,
        "game_id": game_id,
        "opponent": opponent_name,
        "game_state": game_state
    })
    if opponent_name:
        opponent_ws = player_to_ws[opponent_name]
        if not opponent_ws:
            print(f"{opponent_name} WS disconnected")
        await opponent_ws.send_json({
            "type": "player_connect",
            "color": DARK if player_color == LIGHT else LIGHT,
            "game_id": game_id,
            "opponent": player_name,
            "game_state": game_state,
        })

    try:
        while True:
            msg = await ws.receive_json()
            # print(f"move {msg} received from {id(ws)}")
            if msg["type"] == "move":
                print(f"move {msg} received from {id(ws)}")
                await forward_to_opponent(player_name, msg["data"])
            elif msg["type"] == "sync":
                print(f"state received from {id(ws)}")
                 #blocks whole loop, but safe from race conditions (tinydb writes to file)
                sync_game_state(player_name, msg["data"])
            elif msg["type"] == "resign":
                await resign(player_name)
            elif msg["type"] == "cleanup":
                print(f"{msg} received from {id(ws)}")
                if not msg["data"].get("game_id"):
                    raise Exception("No game_id to cleanup")
                cleanup(msg["data"]["game_id"])

    except WebSocketDisconnect:
        await clean_disconnect(ws, player_name)


def player_connected(player_name: str):
    game_id, player_color, opponent_name = None, None, None
    check_player(player_name)
    game_id, player_color, opponent_name, game_state = find_game(player_name)
    if opponent_name:
        player_to_opponent_ws[player_name] = player_to_ws[opponent_name]
        player_to_opponent_ws[opponent_name] = player_to_ws[player_name]
    print(f"{player_name} got {player_color} in game {game_id} against {opponent_name}")
    return game_id, player_color, opponent_name, game_state


async def invite_player(player_name: str):
    await ws.send_json({
        "type": "player_connect",
        "color": player_color,
        "game_id": game_id,
        "opponent": opponent_name,
        "game_state": game_state
    })

async def clean_disconnect(ws: WebSocket, player_name: str):
    await player_to_opponent_ws[player_name].send_json({"type": "opponent_disconnected"})
    await close_ws(ws)
    player_to_ws[player_name] = None
    


async def forward_to_opponent(player_name, move):
    if not player_to_opponent_ws[player_name]:
        raise Exception(f"No opponent for {player_name}!")

    await player_to_opponent_ws[player_name].send_json({"type": "opponent_move", "data": move})
    print(f"move {move} sent to {id(player_to_opponent_ws[player_name])}")

async def resign(player_name: str):
    if not player_to_opponent_ws[player_name]:
        raise Exception(f"No opponent for {player_name}!")

    await player_to_opponent_ws[player_name].send_json({"type": "opponent_resign"})
    print(f"{player_name} resigned, {id(player_to_opponent_ws[player_name])} won")


def cleanup(game_id: str):
    close_game(game_id)


async def close_ws(ws: WebSocket) -> None:
    try:
        await ws.send_json({"ping": True})
    except Exception as e:
        print(f"WebSocket is closed, {e}")