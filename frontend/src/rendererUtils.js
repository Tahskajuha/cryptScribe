import $ from "jquery";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function domReady() {
  return new Promise((resolve) => {
    $(resolve);
  });
}

const animations = {
  async pageLand() {
    $("#whiteScreen").addClass("hidden");
    await wait(800);
    $("#content").removeClass("hidden");
    return 1;
  },
  async pageLeave() {
    $("#background").addClass("hidden");
    await wait(2500);
    const video = $("#leave")[0];
    video.play();
    await wait(2000);
    $("#whiteScreen").removeClass("hidden");
    await wait(2000);
    return 1;
  },
  async nuke() {
    const bg = $("#background");
    const confirm = $("#nuke");
    bg.on("timeupdate", (e) => {
      const bgvid = bg[0];
      const nukevid = confirm[0];
      if (bgvid.currentTime >= bgvid.duration - 0.05) {
        bg.addClass("hidden");
        confirm.removeClass("hidden");
        nukevid.play();
        bg.off("timeupdate");
      }
    });
  },
};

export default {
  wait,
  domReady,
  animations,
};
