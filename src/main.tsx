import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Explicit extension: Invaders.jsx and Invaders.tsx are twins, and Vite's
// resolver tries .jsx before .tsx — a bare "../Invaders" silently builds the
// JSX copy and ignores every change made to the TypeScript source.
import InvadersGame from "../Invaders.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InvadersGame />
  </StrictMode>,
);
