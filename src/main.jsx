import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";

import { Login } from "./pages/Login/Login.jsx";
import { Main } from "./pages/Main/Main.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>

        
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/main" element={<Main />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);