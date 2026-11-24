"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getProfile,
  isUnauthorizedError,
  updateProfile,
} from "../../lib/auth";
import { getGameHistory } from "../../lib/games";
import GameHistoryList from "../../components/profile/GameHistoryList";
import AccountMenu from "../../components/navigation/AccountMenu";

import type { AuthProfile, AuthUser } from "../../lib/auth";
import type { GameHistoryItem } from "../../lib/games";

function profileInitials(username: string): string {
  return username
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type EditableField = "username" | "country" | "dateOfBirth" | "bio";

function EditableProfileField({
  label,
  value,
  field,
  inputType = "text",
  multiline = false,
  editingField,
  draftValue,
  saving,
  saveError,
  onBegin,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  value: string | null;
  field: EditableField;
  inputType?: "text" | "date";
  multiline?: boolean;
  editingField: EditableField | null;
  draftValue: string;
  saving: boolean;
  saveError: string;
  onBegin: (field: EditableField, value: string) => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isEditing = editingField === field;

  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wide text-[#7f8b88]">{label}</p>
        {!isEditing && (
          <button
            type="button"
            className="text-xs font-semibold text-[#c9a968] transition hover:text-[#dfc181]"
            onClick={() => onBegin(field, value ?? "")}
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-3">
          {multiline ? (
            <textarea
              autoFocus
              className="min-h-24 w-full resize-y rounded-lg border border-[#c9a968]/50 bg-[#11191a] px-3 py-2 text-sm text-[#efe9d0] outline-none focus:border-[#dfc181]"
              maxLength={160}
              value={draftValue}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <input
              autoFocus
              className="w-full rounded-lg border border-[#c9a968]/50 bg-[#11191a] px-3 py-2 text-sm text-[#efe9d0] outline-none focus:border-[#dfc181]"
              maxLength={field === "username" ? 30 : undefined}
              type={inputType}
              value={draftValue}
              onChange={(event) => onChange(event.target.value)}
            />
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#a9b0ae] transition hover:bg-white/10 disabled:opacity-50"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-full bg-[#c9a968] px-3 py-1.5 text-xs font-semibold text-[#182022] transition hover:bg-[#dfc181] disabled:opacity-50"
              disabled={saving}
              onClick={onSave}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
          {saveError && (
            <p className="mt-2 text-xs text-red-300" role="alert">{saveError}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-sm text-[#efe9d0]">
          {value || "Not provided"}
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const user = await getCurrentUser();

        if (active) setUser(user);

        if (user.kind !== "registered") {
          return;
        }

        const [data, history] = await Promise.all([
          getProfile(),
          getGameHistory(),
        ]);

        if (active) {
          setProfile(data);
          setGames(history);
        }
      } catch (err) {
        if (active) {
          if (isUnauthorizedError(err)) {
            router.replace("/login");
            return;
          }

          setError(
            err instanceof Error
              ? err.message
              : "Could not load your profile",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [router]);

  function beginEdit(field: EditableField, value: string) {
    setEditingField(field);
    setDraftValue(value);
    setSaveError("");
  }

  function cancelEdit() {
    if (saving) return;
    setEditingField(null);
    setDraftValue("");
    setSaveError("");
  }

  async function saveField() {
    if (!profile || !editingField || saving) return;

    const value = editingField === "username"
      ? draftValue.trim()
      : draftValue.trim() || null;

    if (editingField === "username" && !value) {
      setSaveError("Username is required.");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      const updates = { [editingField]: value } as Parameters<typeof updateProfile>[0];
      const updatedProfile = await updateProfile(updates);

      setProfile(updatedProfile);
      setUser((currentUser) => currentUser
        ? { ...currentUser, displayName: updatedProfile.username }
        : currentUser);
      setEditingField(null);
      setDraftValue("");
    } catch (err) {
      if (isUnauthorizedError(err)) {
        router.replace("/login");
        return;
      }

      setSaveError(err instanceof Error ? err.message : "Could not save this field");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Loading your profile...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#151b1d] px-5 py-10 text-[#efe9d0]">
      <div className="w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
            Smothered
          </Link>
          {user && <AccountMenu user={user} />}
        </header>

        <section className="rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
              SMOTHERED
            </p>
            <h1 className="text-3xl font-semibold">Your Profile</h1>
            <p className="mt-2 text-sm text-[#a9b0ae]">
              Your account and player information.
            </p>
          </div>

          {profile ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div
                  aria-label={`${profile.username} avatar`}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#c9a968]/50 bg-[#c9a968]/15 text-2xl font-semibold text-[#dfc181]"
                >
                  {profileInitials(profile.username)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold">
                    {profile.username}
                  </h2>
                  <p className="truncate text-sm text-[#a9b0ae]">
                    {profile.email}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <EditableProfileField
                  draftValue={draftValue}
                  editingField={editingField}
                  field="username"
                  label="Username"
                  onBegin={beginEdit}
                  onCancel={cancelEdit}
                  onChange={setDraftValue}
                  onSave={saveField}
                  saveError={saveError}
                  saving={saving}
                  value={profile.username}
                />
                <EditableProfileField
                  draftValue={draftValue}
                  editingField={editingField}
                  field="country"
                  label="Country"
                  onBegin={beginEdit}
                  onCancel={cancelEdit}
                  onChange={setDraftValue}
                  onSave={saveField}
                  saveError={saveError}
                  saving={saving}
                  value={profile.country}
                />
                <EditableProfileField
                  draftValue={draftValue}
                  editingField={editingField}
                  field="dateOfBirth"
                  inputType="date"
                  label="Date of birth"
                  onBegin={beginEdit}
                  onCancel={cancelEdit}
                  onChange={setDraftValue}
                  onSave={saveField}
                  saveError={saveError}
                  saving={saving}
                  value={profile.dateOfBirth}
                />
              </div>

              <EditableProfileField
                draftValue={draftValue}
                editingField={editingField}
                field="bio"
                label="About"
                multiline
                onBegin={beginEdit}
                onCancel={cancelEdit}
                onChange={setDraftValue}
                onSave={saveField}
                saveError={saveError}
                saving={saving}
                value={profile.bio}
              />
            </div>
          ) : user?.kind === "guest" ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div
                  aria-label={`${user.displayName} avatar`}
                  className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-[#c9a968]/50 bg-[#c9a968]/15 text-2xl font-semibold text-[#dfc181]"
                >
                  {profileInitials(user.displayName)}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-semibold">{user.displayName}</h2>
                  <p className="text-sm text-[#a9b0ae]">Guest session</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#c9a968]/25 bg-[#c9a968]/[0.06] p-4">
                <p className="text-sm leading-6 text-[#c4cbc7]">
                  You are playing as a guest. Guest sessions can play live games, but profile details and game history are only saved for registered accounts.
                </p>
                <Link
                  className="mt-4 inline-flex rounded-full bg-[#c9a968] px-4 py-2 text-sm font-semibold text-[#182022] transition hover:bg-[#dfc181]"
                  href="/login?mode=register"
                >
                  Create a registered account
                </Link>
              </div>
            </div>
          ) : (
            error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )
          )}

          <Link
            href="/"
            className="mt-6 block text-center text-sm text-[#c9a968] hover:text-[#dfc181]"
          >
            ← Back to dashboard
          </Link>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#c9a968]">
                History
              </p>
              <h2 className="text-2xl font-semibold">Your games</h2>
              <p className="mt-2 text-sm text-[#a9b0ae]">
                Your latest games against registered players.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[#a9b0ae]">
              {games.length} {games.length === 1 ? "game" : "games"}
            </span>
          </div>

          {user?.kind === "guest" ? (
            <p className="rounded-xl border border-white/10 bg-black/15 p-4 text-sm leading-6 text-[#a9b0ae]">
              Guest game history is not saved. Create a registered account to keep your matches here.
            </p>
          ) : (
            <GameHistoryList games={games} />
          )}
        </section>
      </div>
    </main>
  );
}
