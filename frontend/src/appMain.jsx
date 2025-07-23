import React from "react";
import $ from "jquery";
import ReactDOM from "react-dom/client";
import utils from "/src/utils.js";
import App from "/src/app.jsx";

const [, , udata] = await Promise.all([
  utils.domReady(),
  utils.sodiumReady,
  $.ajax({
    url: "/void",
    method: "GET",
    headers: {
      Authorization: sessionStorage.read,
    },
    data: {
      intent: "read",
    },
    error: (xhr, status, error) => {
      if (xhr.status === 500) {
        alert(
          "Sorry about that! Looks like the server is facing some issues. Please try again later.",
        );
        window.location.href = "/index.html";
      } else if (xhr.status === 401) {
        console.log("Token expired");
        window.location.href = "/index.html";
      } else {
        console.log(error);
      }
    },
  }),
]);
await utils.animations.pageLand();

const root = ReactDOM.createRoot(document.getElementById("content"));
root.render(<App mainObj={udata} />);
