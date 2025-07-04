import $ from "jquery";
import utils from "/utils.js";
await utils.domReady();

await utils.animations.pageLand();

$("#login").on("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  $("#content").addClass("hidden");
  let uid = await utils.tth16(data.get("username"));
  let secretTalks = await Promise.all([
    $.ajax({
      url: "/void/regilo",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        uid: uid[1],
        intent: login,
      }),
    }),
    argon2.hash({
      pass: data.get("password"),
      salt: uid[0],
      time: 5,
      mem: 65536,
      parallelism: 1,
      hashLen: 24,
      type: argon2.ArgonType.Argon2id,
    }),
  ]);
  if (secretTalks[0].found === 1) {
  } else if (secretTalks[0].found === 0) {
    await utils.wait(2000);
    $("#content").removeClass("hidden");
    $("#pwdReset").removeClass("hidden");
    $("#loginErr").removeClass("hidden");
  } else {
    console.log("Internal Server Error");
  }
});

$("#emailWarning").on("mouseenter touchstart mousedown", async (e) => {
  const rect = e.target.getBoundingClientRect();
  $("#warningText").css({
    top: rect.top - 40 + "px",
    left: rect.left + 60 + "px",
    display: "block",
  });
  $("#warningText").removeClass("hidden");
});
$("#emailWarning").on("mouseleave touchend mouseup touchcancel", () => {
  $("#warningText").addClass("hidden");
});

$("#pwdGen, #pwdConfirm").on("blur", () => {
  const pwd = $("#pwdGen").val();
  const pwdC = $("#pwdConfirm").val();
  if (pwd === pwdC) {
    $("#pwdCheck").addClass("hidden");
    $("#registerButton").prop("disabled", false);
  } else {
    $("#pwdCheck").removeClass("hidden");
    $("#registerButton").prop("disabled", true);
  }
});

$("#register").on("submit", async (e) => {
  e.preventDefault();
  const data = new FormData(e.target);
  $("#content").addClass("hidden");
  const uid = await utils.tth16(data.get("username"));
  const res = await $.ajax({
    url: "/void/regi",
    method: "POST",
    contentType: "application/json",
    data: JSON.stringify({
      uid: uid[1],
    }),
  });
  if (res.found === 0) {
    await utils.animations.pageLeave();
  } else {
    await utils.wait(2000);
    $("#content").removeClass("hidden");
    $("#pwdReset").removeClass("hidden");
    $("#registerErr").removeClass("hidden");
  }
});
