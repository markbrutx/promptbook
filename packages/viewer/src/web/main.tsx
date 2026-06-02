import { api, subscribeFetchReload } from "./api.js";
import { mountWebApp } from "./mount.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("missing #root element");
}

mountWebApp({ container, api, subscribeReload: subscribeFetchReload });
