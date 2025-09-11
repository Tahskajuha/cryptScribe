import $ from "jquery";
import utils from "/src/utils.js";
await Promise.all([utils.domReady(), utils.sodiumReady]);

await utils.animations.pageLand();

await utils.wait(2000);

await utils.animations.nuke();
