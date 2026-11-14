"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getProfile,
  updateProfile,
} from "../../lib/auth";

import type { AuthProfile } from "../../lib/auth";

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const user = await getCurrentUser();

        if (user.kind !== "registered") {
          router.replace("/");
          return;
        }

        const data = await getProfile();

        if (active) {
          setProfile(data);
          setDisplayName(data.displayName);
          setBio(data.bio ?? "");
        }
      } catch (err) {
        if (active) {
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

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updatedProfile = await updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() || null,
      });

      setProfile(updatedProfile);
      setDisplayName(updatedProfile.displayName);
      setBio(updatedProfile.bio ?? "");
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your profile",
      );
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
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#20272a] p-8 shadow-2xl">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.4em] text-[#c9a968]">
            SMOTHERED
          </p>

          <h1 className="text-3xl font-semibold">
            Your Profile
          </h1>

          <p className="mt-2 text-sm text-[#a9b0ae]">
            Manage your personal information.
          </p>
        </div>

        {profile ? (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm">
                Email address
              </label>

              <input
                type="email"
                value={profile.email}
                disabled
                className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-[#7f8b88]"
              />

              <p className="mt-1 text-xs text-[#7f8b88]">
                Email address cannot be changed here.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm">
                Display name
              </label>

              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                maxLength={50}
                className="w-full rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#c9a968]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm">
                Bio
              </label>

              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={160}
                rows={4}
                placeholder="Tell others a little about yourself..."
                className="w-full resize-none rounded-lg border border-white/10 bg-black/20 px-4 py-3 outline-none focus:border-[#c9a968]"
              />

              <p className="mt-1 text-right text-xs text-[#7f8b88]">
                {bio.length}/160
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
              >
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-[#c9a968] py-3 font-semibold text-[#151b1d] transition hover:bg-[#dfc181] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
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
          ← Back to game
        </Link>
      </section>
    </main>
  );
}