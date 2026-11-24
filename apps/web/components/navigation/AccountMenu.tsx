"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { logoutUser } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AccountMenu({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logoutUser();
    } finally {
      setOpen(false);
      if (onLogout) {
        onLogout();
      } else {
        router.replace("/");
      }
    }
  }

  const isRegistered = user.kind === "registered";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Open account menu for ${user.displayName}`}
        className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1 pr-2 transition hover:border-[#c9a968]/50 hover:bg-white/[0.08]"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#c9a968] text-xs font-bold text-[#182022]">
          {initials(user.displayName) || "S"}
        </span>
        <span className="hidden max-w-32 truncate text-xs font-semibold text-[#e7dfc9] sm:block">
          {user.displayName}
        </span>
        <svg aria-hidden="true" className={`h-3.5 w-3.5 text-[#9ca8a4] transition ${open ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          aria-label="Account menu"
          className="absolute right-0 top-[calc(100%+10px)] z-20 w-56 border border-white/10 bg-[#182122] p-2 shadow-[0_18px_45px_rgb(0_0_0_/_0.35)]"
          role="menu"
        >
          <div className="border-b border-white/8 px-3 pb-3 pt-2">
            <p className="truncate text-sm font-semibold text-[#f4edda]">{user.displayName}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#74817e]">
              {user.kind === "registered" ? "Member account" : "Guest session"}
            </p>
          </div>

          <div className="py-1">
            <Link
              className="block px-3 py-2 text-sm text-[#d6d0bd] transition hover:bg-white/[0.06] hover:text-white"
              href="/profile"
              role="menuitem"
            >
              Profile
            </Link>
            {isRegistered && (
              <Link
                className="block px-3 py-2 text-sm text-[#d6d0bd] transition hover:bg-white/[0.06] hover:text-white"
                href="/history"
                role="menuitem"
              >
                Game history
              </Link>
            )}
            {!isRegistered && (
              <Link
                className="block px-3 py-2 text-sm text-[#d6d0bd] transition hover:bg-white/[0.06] hover:text-white"
                href="/login?mode=register"
                role="menuitem"
              >
                Create an account
              </Link>
            )}
            <Link
              className="block px-3 py-2 text-sm text-[#d6d0bd] transition hover:bg-white/[0.06] hover:text-white"
              href="/play"
              role="menuitem"
            >
              Play a game
            </Link>
          </div>

          <div className="border-t border-white/8 pt-1">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#c9a968] transition hover:bg-[#c9a968]/10 disabled:opacity-50"
              disabled={loggingOut}
              onClick={handleLogout}
              role="menuitem"
            >
              <span>{loggingOut ? "Signing out..." : "Sign out"}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
