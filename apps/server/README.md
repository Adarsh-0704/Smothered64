# Smothered server

The server uses PostgreSQL for registered users and profiles. Configure
`DATABASE_URL` and run the migrations before starting the server:

```bash
pnpm --filter @smothered/server db:migrate:deploy
```

Authentication is stored in an HTTP-only cookie. Create a guest session with:

```http
POST /api/v1/auth/guest
```

The web client sends the cookie automatically. API clients that cannot use
cookies may still pass a bearer token when one is available.

The Socket.IO client should connect with credentials enabled:

```ts
io("http://localhost:3001", { withCredentials: true });
```

After connecting, join the matchmaking queue:

```ts
socket.emit("matchmaking:join");
```

The server emits `matchmaking:waiting` while queued and `match-found` when paired. The `match-found` payload contains `matchId`, `color`, and the opponent’s public identity. Clients can leave with `matchmaking:leave`; disconnecting notifies the opponent with `match-ended`.

Guest users and matches are currently in-memory. Restarting the server clears them, so a persistent user store should replace `src/db/user-store.ts` when persistence is needed.
