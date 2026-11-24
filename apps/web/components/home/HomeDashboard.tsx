"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { getCurrentUser } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";

const previewBoard = [
  ["br", "bn", "bb", "bq", "bk", "bb", "", "br"],
  ["bp", "bp", "bp", "", "", "bp", "bp", "bp"],
  ["", "", "", "", "bp", "", "", ""],
  ["", "", "", "bp", "", "", "", ""],
  ["", "", "", "wp", "", "", "", ""],
  ["", "", "", "", "wp", "", "", ""],
  ["wp", "wp", "wp", "", "", "wp", "wp", "wp"],
  ["wr", "wn", "wb", "wq", "wk", "wb", "wn", "wr"],
] as const;

function ChessPreview() {
  return (
    <div className="home-board-shell">
      <div className="home-board-topline">
        <span className="home-live-dot" />
        <span>Ready when you are</span>
        <span className="home-board-move">White to move</span>
      </div>

      <div className="home-board-frame">
        <div className="home-board" aria-label="Chess board preview" role="img">
          {previewBoard.flatMap((row, rowIndex) =>
            row.map((piece, columnIndex) => {
              const isLight = (rowIndex + columnIndex) % 2 === 0;
              const isHighlight = rowIndex === 4 && columnIndex === 3;

              return (
                <div
                  className={`home-square ${isLight ? "home-square-light" : "home-square-dark"} ${isHighlight ? "home-square-highlight" : ""}`}
                  key={`${rowIndex}-${columnIndex}`}
                >
                  {piece && (
                    <Image
                      alt=""
                      className="home-piece"
                      height={150}
                      src={`/chess/pieces/wood/${piece}.png`}
                      width={150}
                    />
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      <div className="home-board-footer">
        <div>
          <span className="home-player-mark home-player-mark-light">A</span>
          <span>Anonymous</span>
        </div>
        <span className="home-board-clock">10:00</span>
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        // Public visitors can use the home screen without a session.
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const playHref = user ? "/play" : "/login";

  return (
    <main className="home-page">
      <div className="home-glow home-glow-left" />
      <div className="home-glow home-glow-right" />

      <div className="home-wrap">
        <header className="home-header">
          <Link aria-label="Smothered home" className="home-brand" href="/">
            <span className="home-brand-mark">S</span>
            <span>Smothered</span>
          </Link>

          <div className="home-account">
            {checking ? (
              <span className="home-account-muted">Checking session</span>
            ) : user ? (
              <>
                <span className="home-account-muted">Playing as</span>
                <span className="home-account-name">{user.displayName}</span>
              </>
            ) : (
              <>
                <span className="home-account-muted hidden sm:inline">Already have an account?</span>
                <Link className="home-sign-in" href="/login">Sign in</Link>
              </>
            )}
          </div>
        </header>

        <section className="home-hero">
          <div className="home-copy">
            <p className="home-kicker"><span /> Online chess, simply played</p>
            <h1>Make room<br />for your <em>next move.</em></h1>
            <p className="home-intro">
              A focused place to play chess. Find a match, play the board, and leave the noise behind.
            </p>

            <div className="home-actions">
              <Link className="home-primary-action" href={playHref}>
                <span>{user ? "Play now" : "Play a game"}</span>
                <svg aria-hidden="true" className="home-arrow-icon" viewBox="0 0 20 20" fill="none">
                  <path d="M4 16 16 4M7 4h9v9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                </svg>
              </Link>
            </div>

            <div className="home-note">
              <svg aria-hidden="true" className="home-note-icon" viewBox="0 0 24 24" fill="none">
                <path d="M12 4.25a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z" fill="currentColor" />
                <path d="M8.9 11.25c.15 1.25-.48 2.3-1.45 3.16-1.02.9-1.7 2-1.7 3.34h12.5c0-1.34-.68-2.44-1.7-3.34-.97-.86-1.6-1.91-1.45-3.16a4.75 4.75 0 0 1-6.2 0Z" fill="currentColor" />
                <path d="M5 19.75h14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
              </svg>
              <span>{user ? "Your games are ready when you are." : "No account needed to start playing."}</span>
            </div>
          </div>

          <div className="home-visual">
            <ChessPreview />
            <div className="home-visual-caption">
              <span>01</span>
              <span>Good games start with a single move.</span>
            </div>
          </div>
        </section>

        <footer className="home-footer">
          <span>Play with intention.</span>
          <span className="home-footer-line" />
          <span>Smothered Chess</span>
        </footer>
      </div>
    </main>
  );
}
