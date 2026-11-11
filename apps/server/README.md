# Smothered server

The server creates an in-memory guest identity and returns a JWT:

```http
POST /api/v1/auth/guest
```

Use the returned token in the Socket.IO handshake:

```ts
io("http://localhost:3001", { auth: { token } });
```

After connecting, join the matchmaking queue:

```ts
socket.emit("matchmaking:join");
```

The server emits `matchmaking:waiting` while queued and `match-found` when paired. The `match-found` payload contains `matchId`, `color`, and the opponent’s public identity. Clients can leave with `matchmaking:leave`; disconnecting notifies the opponent with `match-ended`.

Guest users and matches are currently in-memory. Restarting the server clears them, so a persistent user store should replace `src/db/user-store.ts` when persistence is needed.
