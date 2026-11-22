# Smothered server

The server uses PostgreSQL for registered users and profiles. The Prisma
schema and migrations implement the tables from `dbms/03_schema.sql`:
`users`, `user_profiles`, `games`, and `game_moves`. The migration from the
older `User`/`Profile` tables preserves registered users and profile bio/name
data, converting old display names into unique usernames.

Configure `DATABASE_URL` and apply migrations before starting the server:

```bash
pnpm --filter @smothered/server db:migrate:deploy
```

Use `db:migrate:dev` for local schema development, `db:status` to check applied
migrations, and `db:generate` to regenerate Prisma Client after schema changes.

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

Registered users can retrieve their most recent games with:

```http
GET /api/v1/games/history
```

The endpoint requires the authenticated HTTP-only cookie and returns up to 50
games by default. Pass `?limit=100` to request up to 100 games.

Guest users and live matchmaking state are currently in-memory. Restarting the
server clears those sessions and active matches. Once a human game finishes,
matches between two registered users are written to `games` and `game_moves`;
games involving guests remain in memory because guest users have no row in the
schema's `users` table.
