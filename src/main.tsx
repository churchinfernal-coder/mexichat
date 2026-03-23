import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./styles/theme-platinum.css";
import "./styles/theme-diamond.css";
import "./styles/theme-gold.css";

createRoot(document.getElementById("root")!).render(<App />);
