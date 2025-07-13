import $ from "jquery";
import React from "react";
import ReactDOM from "react-dom/client";
import utils from "/src/utils.js";

function App() {
  return <h1>Hello World</h1>;
}

await utils.domReady();
await utils.animations.pageLand();

const root = ReactDOM.createRoot(document.getElementById("content"));

root.render(<App />);
