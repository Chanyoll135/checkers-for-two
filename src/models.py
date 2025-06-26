from uuid import uuid4
from tinydb import TinyDB, Query
from tinydb.storages import JSONStorage
from tinydb.middlewares import CachingMiddleware

DARK, LIGHT = 'dark', 'light'

db = TinyDB('db.json', storage=CachingMiddleware(JSONStorage))
players_db = db.table('players')
games_db = db.table('games')


def find_game(player_name: str) -> str:
    game_id, player_color, opponent_name, game_state = check_existing_game(player_name)
    if game_id: # player already in a game
        return game_id, player_color, opponent_name, game_state

    if game := games_db.get(Query().vacant == True): # join vacant game
        game_id = game['id']
        games_db.update({'vacant': False}, Query().id == game_id)
        player_color = LIGHT
        opponent_name = players_db.get((Query().game_id == game_id) & (Query().color == DARK))['name']
    else: # create and join new game
        game_id = str(uuid4())
        games_db.insert({'id': game_id, 'vacant': True, 'state': {}, 'closed': False})
        player_color = DARK
        opponent_name = None
    players_db.update({'game_id': game_id, 'color': player_color}, Query().name == player_name)
    return game_id, player_color, opponent_name, game_state

def check_existing_game(player_name: str) -> str:
    player = players_db.get(Query().name == player_name)
    if not player: # just in case, should never happen
        raise Exception(f"SHIET NO PLAYER named {player_name}")
        check_player(player_name)
    if not player['game_id']:
        return None, None, None, None
    if not player['color']:
        raise Exception(f"SHIET NO COLOR for {player_name} in a {player['game_id']}")
    
    game = games_db.get(Query().id == player['game_id'])
    if game["closed"]:
        print(f"no open games with {player_name}")
        return None, None, None, None
    
    game_id = game['id']
    opponent = players_db.get((Query().game_id == game_id) & ~(Query().name == player_name))
    if not opponent:
        print(f"opponent not found for {player_name}, {game_id}")
    else:
        print(f"opponent {opponent['name']} found for {player_name}, {game_id} with state {game['state'] != {}}")
    return game_id, player['color'], opponent['name'] if opponent else None, game['state']

def check_player(player_name: str) -> None:
    if not players_db.get(Query().name == player_name):
        players_db.insert({'name': player_name, 'game_id': None, 'color': None})
        print(f"{player_name} added")

def sync_game_state(player_name: str, game_state: dict):
    player = players_db.get(Query().name == player_name)
    if not player:
        print(f"Can't sync: no such player {player_name}")
        return
    game_id = player['game_id']
    if not game_id:
        print(f"Can't sync: player {player_name} not in any game")
        return
    games_db.update({"state": game_state}, Query().id == game_id)
    print(f"Game state synced by {player_name} for game {game_id}")

def close_game(game_id: str):
    game = games_db.get(Query().id == game_id)
    if not game:
        print(f"Game with id {game_id} doesn't exist!")
        return
    games_db.update({'closed': True}, Query().id == game_id)
    print(f"Game {game_id} closed!")