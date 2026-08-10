import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import InvadersGame from "../Invaders";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InvadersGame />
  </StrictMode>,
);
