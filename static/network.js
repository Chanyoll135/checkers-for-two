let ws;
let BACKEND_URL = getBackendUrl();

function getBackendUrl() {
    const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const protocol = location.protocol === 'https:' ? 'https' : 'http';
    const host = isLocal ? 'localhost' : location.hostname;
    const port = 8000; // match FastAPI backend port
    return `${protocol}://${host}:${port}`;
}

async function connectWebSocket(nickname) {
    const wsUrl = `${BACKEND_URL}/ws?nickname=${nickname}`;
    ws = new WebSocket(wsUrl);

    try {
        await waitForWebSocket(ws, 5000); // wait up to 5 seconds
        console.log('WebSocket connected. Waiting for init...');
    } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        return;
    }

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Message from server:', message);

        if (message.type === 'player_connect') {
            // setPlayerColor(message.color);
            if (message.opponent) {
                setPlayerColor(message.color);
                startGameAfterColorAssigned(message.opponent, message.game_id, message.game_state);
            } else {
                document.getElementById("status-message").textContent = "Waiting for opponent...";
            }
        }
        else if (message.type === 'opponent_move') {
            const { from, to, capture } = message.data;
            makeMove(from.row, from.col, to.row, to.col, capture, true);
        }
        else if (message.type === 'opponent_resign') {
            opponentResign();
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected.');
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
}

function waitForWebSocket(ws, timeout = 5000) {
    return new Promise((resolve, reject) => {
        if (ws.readyState === WebSocket.OPEN) return resolve();

        const onOpen = () => {
            clearTimeout(timer);
            resolve();
        };
        const onError = (err) => {
            clearTimeout(timer);
            reject(err);
        };

        ws.addEventListener('open', onOpen, { once: true });
        ws.addEventListener('error', onError, { once: true });

        const timer = setTimeout(() => {
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('error', onError);
            reject(new Error('WebSocket connection timed out'));
        }, timeout);
    });
}

function sendMessage(data) {
    if (!ws) {
        console.warn("WebSocket not initialized");
        return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not open");
    }
    else {
        ws.send(JSON.stringify({ type: data.type, data: data.msg }));
        console.log(`msg ${data.type} sent to ${ws}`)
    }
}
