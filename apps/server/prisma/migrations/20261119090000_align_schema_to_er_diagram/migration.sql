-- Bring the original auth tables in line with dbms/03_schema.sql while
-- preserving registered users and their existing profile data.
BEGIN;

CREATE TYPE "account_status" AS ENUM ('active', 'inactive', 'suspended', 'banned', 'deleted');
CREATE TYPE "game_type" AS ENUM ('rated', 'casual');
CREATE TYPE "game_mode" AS ENUM ('human', 'computer');
CREATE TYPE "game_status" AS ENUM ('completed', 'abandoned', 'cancelled');
CREATE TYPE "game_visibility" AS ENUM ('public', 'private');
CREATE TYPE "time_control_category" AS ENUM ('bullet', 'blitz', 'rapid', 'classical', 'unlimited');
CREATE TYPE "game_result" AS ENUM ('white_win', 'black_win', 'draw');

ALTER TABLE "User" RENAME TO users;
ALTER TABLE "Profile" RENAME TO user_profiles;

ALTER TABLE user_profiles DROP CONSTRAINT "Profile_userId_fkey";
ALTER TABLE users DROP CONSTRAINT "User_pkey";
ALTER TABLE users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE users RENAME COLUMN id TO user_id;
ALTER TABLE users RENAME COLUMN "passwordHash" TO password_hash;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users DROP COLUMN "updatedAt";
ALTER TABLE users ALTER COLUMN user_id SET DEFAULT gen_random_uuid();
ALTER TABLE users ALTER COLUMN created_at TYPE TIMESTAMPTZ(6)
    USING created_at AT TIME ZONE 'UTC';
ALTER TABLE users ALTER COLUMN email TYPE VARCHAR(255);
ALTER TABLE users DROP COLUMN kind;
ALTER TABLE users ADD COLUMN username VARCHAR(30);
ALTER TABLE users ADD COLUMN account_status "account_status" NOT NULL DEFAULT 'active';

-- Existing profile display names were not unique. Create stable, distinct
-- usernames that retain a readable prefix and include a user-specific suffix.
UPDATE users AS u
SET username =
    LEFT(
        COALESCE(
            NULLIF(REGEXP_REPLACE(LOWER(BTRIM((
                SELECT p."displayName"
                FROM user_profiles AS p
                WHERE p."userId" = u.user_id
            ))), '[^a-z0-9_]+', '_', 'g'), ''),
            NULLIF(REGEXP_REPLACE(LOWER(SPLIT_PART(u.email, '@', 1)), '[^a-z0-9_]+', '_', 'g'), ''),
            'player'
        ),
        20
    ) || '_' || LEFT(MD5(u.user_id::text), 9);

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER INDEX "User_email_key" RENAME TO users_email_key;
ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);

ALTER TABLE user_profiles DROP CONSTRAINT "Profile_pkey";
DROP INDEX "Profile_userId_key";
ALTER TABLE user_profiles RENAME COLUMN "userId" TO user_id;
ALTER TABLE user_profiles ALTER COLUMN bio TYPE TEXT;
ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN country TEXT;
ALTER TABLE user_profiles ADD COLUMN date_of_birth DATE;
ALTER TABLE user_profiles DROP COLUMN id;
ALTER TABLE user_profiles DROP COLUMN "displayName";
ALTER TABLE user_profiles DROP COLUMN "createdAt";
ALTER TABLE user_profiles DROP COLUMN "updatedAt";
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE NO ACTION;

DROP TYPE "UserKind";

CREATE TABLE games (
    game_id UUID NOT NULL DEFAULT gen_random_uuid(),
    game_type "game_type" NOT NULL,
    game_mode "game_mode" NOT NULL,
    game_status "game_status" NOT NULL DEFAULT 'completed',
    visibility "game_visibility" NOT NULL DEFAULT 'public',
    time_control_category "time_control_category" NOT NULL,
    white_player_id UUID NOT NULL,
    black_player_id UUID NOT NULL,
    computer_level SMALLINT,
    initial_time_seconds INTEGER NOT NULL,
    increment_seconds INTEGER NOT NULL DEFAULT 0,
    result "game_result",
    termination_reason TEXT,
    allow_spectators BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ(6),
    ended_at TIMESTAMPTZ(6),

    CONSTRAINT games_pkey PRIMARY KEY (game_id),
    CONSTRAINT fk_games_white_player FOREIGN KEY (white_player_id)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_games_black_player FOREIGN KEY (black_player_id)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_different_players CHECK (white_player_id <> black_player_id),
    CONSTRAINT chk_computer_level CHECK (
        (game_mode = 'computer' AND computer_level IS NOT NULL) OR
        (game_mode = 'human' AND computer_level IS NULL)
    ),
    CONSTRAINT chk_initial_time CHECK (
        time_control_category = 'unlimited' OR initial_time_seconds > 0
    ),
    CONSTRAINT chk_increment CHECK (increment_seconds >= 0)
);

CREATE TABLE game_moves (
    move_id UUID NOT NULL DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL,
    move_number INTEGER NOT NULL,
    uci TEXT NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),

    CONSTRAINT game_moves_pkey PRIMARY KEY (move_id),
    CONSTRAINT fk_game_moves_game FOREIGN KEY (game_id)
        REFERENCES games(game_id) ON DELETE CASCADE ON UPDATE NO ACTION,
    CONSTRAINT uq_game_move_number UNIQUE (game_id, move_number),
    CONSTRAINT chk_positive_move_number CHECK (move_number > 0)
);

COMMIT;
