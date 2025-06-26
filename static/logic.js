// Full checkers logic with:
// - Mandatory captures
// - King can move/capture across diagonals
// - Highlight selected piece in green
// - Highlight capturable enemies in red
// - Deselect piece on second click

let assignedColor = null;
let gameId = null;
let gameState;
let board, statusMessage, resignBtn, playerMe, playerOpponent;

function initializeBoard() {
    board.innerHTML = '';
    // const rowOrder = assignedColor === 'dark' ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
    for (let row = 0; row < 8; row++) {
        // const row = rowOrder[r];
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            square.dataset.row = row;
            square.dataset.col = col;
            if ((row + col) % 2 !== 0) {
                if (row < 3) {
                    gameState.board[row][col] = { type: 'piece', color: 'dark', king: false };
                } else if (row > 4) {
                    gameState.board[row][col] = { type: 'piece', color: 'light', king: false };
                }
            }
            square.addEventListener('click', () => handleSquareClick(row, col));
            board.appendChild(square);
        }
    }

    // Flip board for light player visually only
    if (assignedColor === 'dark') { board.classList.add('flipped'); }
    else { board.classList.remove('flipped'); }

    updateBoardView();
    updatePlayerTurn();
}

function startGameAfterColorAssigned(opponent_name, game_id, game_state) {
    gameState = {
        board: Array(8).fill().map(() => Array(8).fill(null)),
        currentPlayer: 'dark',  //dark move first
        selectedPiece: null,
        validMoves: [],
        darkPieces: 12,
        lightPieces: 12,
        gameOver: false
    };
    gameId = game_id;
    initializeBoard();
    receiveGameStateSync(game_state);
    document.getElementById('status-message').textContent = `Game started. You are playing as ${assignedColor}`;
    document.getElementById('opponent_name').textContent = `${opponent_name}`
}

function updateBoardView() {
    document.querySelectorAll('.square').forEach(square => {
        square.innerHTML = '';
        square.classList.remove('highlight', 'threat', 'selected');
    });

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
            if (piece && piece.type === 'piece') {
                const pieceElement = document.createElement('div');
                pieceElement.className = `piece ${piece.color} ${piece.king ? 'king' : ''}`;
                pieceElement.dataset.row = row;
                pieceElement.dataset.col = col;
                square.appendChild(pieceElement);
            }
        }
    }

    if (gameState.selectedPiece) {
        const { row, col } = gameState.selectedPiece;
        const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
        if (square) square.classList.add('selected');
    }

    gameState.validMoves.forEach(move => {
        const target = document.querySelector(`.square[data-row="${move.row}"][data-col="${move.col}"]`);
        if (target) target.classList.add('highlight');

        if (move.capture) {
            const threat = document.querySelector(`.square[data-row="${move.capture.row}"][data-col="${move.capture.col}"]`);
            if (threat) threat.classList.add('threat');
        }
    });

    if (gameState.currentPlayer != assignedColor) { return; }

    // Also highlight mandatory captures even if no piece selected
    const allCaptures = getAllMandatoryCaptures();
    allCaptures.forEach(pos => {
        const square = document.querySelector(`.square[data-row="${pos.row}"][data-col="${pos.col}"]`);
        if (square) {
            const pieceElement = square.querySelector('.piece');
            if (pieceElement) {
                const marker = document.createElement('div');
                marker.className = 'must-capture-marker';
                marker.textContent = '!';
                pieceElement.appendChild(marker);
            }
        }
    
        getValidMoves(pos.row, pos.col).forEach(m => {
            if (m.capture) {
                const threat = document.querySelector(`.square[data-row="${m.capture.row}"][data-col="${m.capture.col}"]`);
                if (threat) threat.classList.add('threat');
            }
        });
    });
}

function getValidMoves(row, col) {
    const piece = gameState.board[row][col];
    if (!piece || piece.type !== 'piece') return [];

    const moves = [];
    const directions = [
        { row: -1, col: -1 }, { row: -1, col: 1 },
        { row: 1, col: -1 }, { row: 1, col: 1 }
    ];

    for (const dir of directions) {
        let stepLimit = piece.king ? 7 : 1;
        for (let step = 1; step <= stepLimit; step++) {
            const r = row + dir.row * step;
            const c = col + dir.col * step;

            if (r < 0 || r >= 8 || c < 0 || c >= 8) break;

            const midPiece = gameState.board[r][c];

            if (!midPiece && step === 1 && !piece.king) {
                // Only allow forward move
                const forward = (piece.color === 'dark' && dir.row === 1) || (piece.color === 'light' && dir.row === -1);
                if (forward) {
                    moves.push({ row: r, col: c, capture: null });
                }
                break;
            }
            else if (!midPiece && piece.king) {
                moves.push({ row: r, col: c, capture: null });
            }
            else if (midPiece && midPiece.color !== piece.color) {
                if (piece.king) {
                    for (let landStep = 1; landStep <= 7; landStep++) {
                        const jumpR = r + dir.row * landStep;
                        const jumpC = c + dir.col * landStep;
                        if (jumpR < 0 || jumpR >= 8 || jumpC < 0 || jumpC >= 8) break;
                        if (!gameState.board[jumpR][jumpC]) {
                            moves.push({ row: jumpR, col: jumpC, capture: { row: r, col: c } });
                        } else {
                            break;
                        }
                    }
                }
                else {
                    const jumpR = r + dir.row;
                    const jumpC = c + dir.col;
                    if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8 && !gameState.board[jumpR][jumpC]) {
                        moves.push({ row: jumpR, col: jumpC, capture: { row: r, col: c } });
                    }
                }
                break;
            }
            else {
                break; 
            }
        }
    }
    return moves;
}

function handleSquareClick(row, col) {
    if (gameState.gameOver) return;
    if (gameState.currentPlayer !== assignedColor) return;

    
    const piece = gameState.board[row][col];
    const allCaptures = getAllMandatoryCaptures();
    const mustCapture = allCaptures.length > 0;

    if (gameState.selectedPiece && gameState.selectedPiece.row === row && gameState.selectedPiece.col === col) {
        gameState.selectedPiece = null;
        gameState.validMoves = [];
        updateBoardView();
        return;
    }

    if (piece && piece.type === 'piece' && piece.color === gameState.currentPlayer) {
        const moves = getValidMoves(row, col);
        const captures = moves.filter(m => m.capture);
        if (mustCapture && captures.length === 0) return;
        gameState.selectedPiece = { row, col };
        gameState.validMoves = mustCapture ? captures : moves;
        updateBoardView();
        return;
    }

    if (gameState.selectedPiece) {
        const move = gameState.validMoves.find(m => m.row === row && m.col === col);
        if (move) {
            makeMove(gameState.selectedPiece.row, gameState.selectedPiece.col, row, col, move.capture);
        }
    }
}

function getAllMandatoryCaptures() {
    const captures = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.board[row][col];
            if (piece && piece.color === gameState.currentPlayer) {
                const moves = getValidMoves(row, col).filter(m => m.capture);
                if (moves.length) captures.push({ row, col });
            }
        }
    }
    return captures;
}

function makeMove(fromRow, fromCol, toRow, toCol, capture, isRemote = false) {
    const piece = gameState.board[fromRow][fromCol];
    gameState.board[toRow][toCol] = { ...piece };
    gameState.board[fromRow][fromCol] = null;

    if (capture) {
        gameState.board[capture.row][capture.col] = null;
        if (piece.color === 'dark') gameState.lightPieces--;
        else gameState.darkPieces--;
    }

    if ((piece.color === 'dark' && toRow === 7) || (piece.color === 'light' && toRow === 0)) {
        gameState.board[toRow][toCol].king = true;
    }

    const nextCaptures = getValidMoves(toRow, toCol).filter(m => m.capture);
    if (capture && nextCaptures.length > 0) {
        console.log("Chained capture continues at", toRow, toCol);
        gameState.selectedPiece = { row: toRow, col: toCol };
        gameState.validMoves = nextCaptures;
        statusMessage.textContent = `Player ${gameState.currentPlayer}: Continue capturing!`;
        updateBoardView();
        return;
    }

    if (gameState.darkPieces === 0) {
        updateBoardView();
        setTimeout(() => endGame('light'), 100);
        return;
    }
    if (gameState.lightPieces === 0) {
        updateBoardView();
        setTimeout(() => endGame('dark'), 100);
        return;
    }

    gameState.selectedPiece = null;
    gameState.validMoves = [];
    gameState.currentPlayer = gameState.currentPlayer === 'dark' ? 'light' : 'dark';
    updatePlayerTurn();
    updateBoardView();

    if (isRemote === false) {
        sendMessage({
            type: "move",
            msg: {
                from: { row: fromRow, col: fromCol },
                to: { row: toRow, col: toCol },
                capture
            }
        });
        sendMessage({ type: 'sync', msg: gameState });
    }
}

function updatePlayerTurn() {
    const myTurn = gameState.currentPlayer === assignedColor; // Check if it's my turn
    const enemyColor = assignedColor === 'dark' ? 'light' : 'dark'; // Determine opponent color

    playerOpponent.classList.remove('active'); 
    playerMe.classList.remove('active'); 
    // Dark move first
    if (myTurn) {
        playerMe.classList.add('active');
    }
    else {
        playerOpponent.classList.add('active'); 
    }

    if (myTurn) {
        playerMe.classList.add('active'); // Highlight self if it's our turn
        statusMessage.textContent = `Your turn (${assignedColor})`;
    } else {
        playerOpponent.classList.add('active'); // Highlight opponent if it's their turn
        statusMessage.textContent = `Opponent's turn (${enemyColor})`;
    }
}

function opponentResign() {
    endGame(assignedColor === 'dark' ? 'dark' : 'light');
}

function endGame(winner_color) {
    gameState.gameOver = true;
    statusMessage.textContent = winner_color === 'dark' ? "Чёрные победили!" : "Белые победили!";

    playerOpponent.classList.remove('active');
    playerMe.classList.remove('active');

    const winnerName = winner_color === assignedColor ? "Вы победили!" : "Вы проиграли.";
    if (winner_color === assignedColor) {
        launchConfetti();
    }
    document.getElementById("endgame-message").textContent = winnerName;
    document.getElementById("endgame-modal").style.display = "flex";
    sendMessage({ type: 'cleanup', msg: { game_id: gameId } });
}

function launchConfetti() {
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 5,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
        });
        confetti({
            particleCount: 5,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
        });
        if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }

function setPlayerColor(color) {
    if (["dark", "light"].includes(color) === false) {
        console.log(`invalid player color ${color}!`);
        return;
    }
    assignedColor = color;
    localStorage.setItem("color", assignedColor);
    document.getElementById("player_color").textContent = `(${assignedColor})`.toUpperCase()
    document.getElementById("opponent_color").textContent = (assignedColor === "dark" ? "(light)" : "(dark)").toUpperCase();
    console.log(`Color ${assignedColor} assigned.`);
}

document.addEventListener('DOMContentLoaded', () => {
    board = document.getElementById('checkers-board');
    statusMessage = document.getElementById('status-message');
    resignBtn = document.getElementById('resign-btn');
    playerMe = document.getElementById('player-me');
    playerOpponent = document.getElementById('player-opponent');

    let gameState = {
        board: Array(8).fill().map(() => Array(8).fill(null)),
        currentPlayer: 'dark',
        selectedPiece: null,
        validMoves: [],
        darkPieces: 12,
        lightPieces: 12,
        gameOver: false
    };

    resignBtn.addEventListener('click', () => {
        if (!gameState.gameOver) {
            document.getElementById('resign-modal').style.display = 'flex';
        }
    });
    document.getElementById('confirm-resign').addEventListener('click', () => {
        document.getElementById('resign-modal').style.display = 'none';
        sendMessage({ type: 'resign', msg: { } });
        const winner = assignedColor === 'dark' ? 'light' : 'dark';
        endGame(winner);
    });

    initGame();
});

async function promptForValidNickname() {
    let nickname = localStorage.getItem("nickname");
    if (nickname) {
        setNicknameUI(nickname);
        return nickname;
    }

    return new Promise((resolve) => {
        const modal = document.getElementById("nickname-modal");
        const input = document.getElementById("nickname-input");
        const button = document.querySelector("#nickname-box button");

        modal.style.display = "flex";

        const submitHandler = async () => {
            const name = input.value.trim() || `Player-${Math.floor(Math.random() * 1000)}`;
            localStorage.setItem("nickname", name);
            setNicknameUI(name);
            modal.style.display = "none";
            button.removeEventListener("click", submitHandler);
            resolve(name);
        };

        button.addEventListener("click", submitHandler);
    });
}

function setNicknameUI(name) {
    document.getElementById("player_name").textContent = name;
}

// Call this from initGame or your DOMContentLoaded async bootstrap
async function initGame() {
    const nickname = await promptForValidNickname();
    await connectWebSocket(nickname);
}

// Call this to replace local state with recovered server state
function receiveGameStateSync(serverState) {
    if (!serverState || typeof serverState !== 'object') {
        console.log("Invalid game_state received");
        return;
    }

    gameState = (Object.keys(serverState).length === 0 ? gameState : serverState);
    updateBoardView();
    updatePlayerTurn();
    console.log("Game state recovered from server");
}
