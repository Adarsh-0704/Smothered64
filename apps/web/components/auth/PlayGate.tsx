"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser, logoutUser } from "../../lib/auth";
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

  if (checking || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#151b1d] text-[#efe9d0]">
        Checking your session...
      </main>
    );
  }

  return <GameBoardDemo user={user} onLogout={handleLogout} />;
}
