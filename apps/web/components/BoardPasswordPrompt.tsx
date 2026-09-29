"use client";

import { useState } from "react";

export function BoardPasswordPrompt({ onSubmit }: { onSubmit(password: string): void }) {
  const [pw, setPw] = useState("");
  return (
    <div className="board-password-gate" data-testid="board-password-gate">
      <p>This board is password protected.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(pw);
        }}
      >
        <input
          type="password"
          data-testid="board-password-input"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Board password"
          autoComplete="current-password"
        />
        <button type="submit" data-testid="board-password-submit">
          Join
        </button>
      </form>
    </div>
  );
}
