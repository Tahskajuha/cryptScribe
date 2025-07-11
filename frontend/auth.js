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
        intent: "login",
      }),
      error: function (xhr, textStatus, errorThrown) {
        if (xhr.status === 500) {
          alert(
            "Sorry about that, looks like the server is facing some issues. Please try again later!",
          );
          window.location.reload();
        }
      },
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
    let salt = await utils.fromB64(secretTalks[0].salt);
    let nonce = await utils.fromB64(secretTalks[0].nonce);
    const apikeyh = await argon2.hash({
      pass: secretTalks[1].hash,
      salt: salt,
      time: 5,
      mem: 65536,
      parallelism: 1,
      hashLen: 32,
      type: argon2.ArgonType.Argon2id,
    });
    const hmac = await utils.mac(apikeyh.hash, nonce);
    const hmacB64 = await utils.toB64(hmac);
    const loginResponse = await $.ajax({
      url: "/void/gin",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        hmac: hmacB64,
        nonce: secretTalks[0].nonce,
      }),
      error: function (xhr, textStatus, errorThrown) {
        if (xhr.status === 500) {
          alert(
            "Sorry about that, looks like the server is facing some issues. Please try again later!",
          );
          window.location.reload();
        }
      },
    });
    if (loginResponse.verified === 1) {
      const token = loginResponse.token;
      sessionStorage.setItem("token", token);
      await utils.animations.pageLeave();
    } else if (loginResponse.verified === 0) {
      await utils.wait(1000);
      $("#content").removeClass("hidden");
      $("#pwdReset").removeClass("hidden");
      $("#loginErr").removeClass("hidden");
    } else {
      alert("Internal Server Error!");
    }
  } else if (secretTalks[0].found === 0) {
    await utils.wait(2000);
    $("#content").removeClass("hidden");
    $("#pwdReset").removeClass("hidden");
    $("#loginErr").removeClass("hidden");
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
  let secretTalks = await Promise.all([
    $.ajax({
      url: "/void/regilo",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        uid: uid[1],
        intent: "register",
      }),
      error: function (xhr, textStatus, errorThrown) {
        if (xhr.status === 500) {
          alert(
            "Sorry about that, looks like the server is facing some issues. Please try again later!",
          );
          window.location.reload();
        }
      },
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
  if (secretTalks[0].found === 0) {
    let salt = await utils.fromB64(secretTalks[0].salt);
    let nonce = await utils.fromB64(secretTalks[0].nonce);
    await utils.wait(1000);
    $("#secret").removeClass.hidden;
    const hashes = await Promise.all([
      argon2.hash({
        pass: secretTalks[1].hash,
        salt: salt,
        time: 5,
        mem: 65536,
        parallelism: 1,
        hashLen: 32,
        type: argon2.ArgonType.Argon2id,
      }),
      utils.keygen(),
    ]);
    $("#key").val(hashes[1][0]);
    $("#copy").on("click", () => {
      navigator.clipboard.writeText(hashes[1][0]);
    });
    $("#secret").removeClass("hidden");
    const hashB64 = await utils.toB64(hashes[0].hash);
    const regResponse = await $.ajax({
      url: "/void/ster",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({
        apikeyh: hashB64,
        enckeyh: hashes[1][1],
        nonce: secretTalks[0].nonce,
      }),
      error: function (xhr, textStatus, errorThrown) {
        if (xhr.status === 500) {
          alert(
            "Sorry about that, looks like the server is facing some issues. Please try again later!",
          );
          window.location.reload();
        }
      },
    });
    if (regResponse.verified === 1) {
      const token = regResponse.token;
      sessionStorage.setItem("token", token);
      $("#keyConfirmButton").prop("disabled", false);
      $("#keyConfirmButton").on("click", async () => {
        await utils.animations.pageLeave();
      });
    } else if (regResponse.verified === 0) {
      await utils.wait(2000);
      $("#content").removeClass("hidden");
      $("#pwdReset").removeClass("hidden");
      $("#registerErr").removeClass("hidden");
    }
  } else if (secretTalks[0].found === 1) {
    await utils.wait(2000);
    $("#content").removeClass("hidden");
    $("#pwdReset").removeClass("hidden");
    $("#registerErr").removeClass("hidden");
  }
});
