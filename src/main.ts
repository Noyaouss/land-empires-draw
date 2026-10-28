import "./style.css";
import { App } from "./ui/app";

void new App().start(document.getElementById("app")!);

if ("serviceWorker" in navigator) void navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }); // always fetch a fresh sw.js
