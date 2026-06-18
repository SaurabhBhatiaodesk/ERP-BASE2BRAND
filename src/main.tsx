import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { installNetworkDebug } from "@/lib/networkDebug";

installNetworkDebug();

createRoot(document.getElementById("root")!).render(<App />);  