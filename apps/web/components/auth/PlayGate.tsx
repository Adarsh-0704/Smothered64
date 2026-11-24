"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { clearStoredAuthToken, getCurrentUser, logoutUser } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";
import GameBoardDemo from "../chess/GameBoardDemo";

export default function PlayGate() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
        }
      } catch {
        clearStoredAuthToken();
        if (active) {
          router.replace("/login");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      router.replace("/");
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Checking your session...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] px-5 text-center text-[#efe9d0]">
        <p>
          Your session has expired. <a className="text-[#c9a968]" href="/login">Log in again</a>.
        </p>
      </main>
    );
  }

  return <GameBoardDemo user={user} onLogout={handleLogout} />;
}
