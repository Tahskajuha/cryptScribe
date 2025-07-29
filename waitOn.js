import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import testEnv from "./test100.js";

const agent = new SocksProxyAgent("socks://127.0.0.1:9050");

const waitOn = async (url) => {
  let retries = 30;

  while (retries--) {
    try {
      const res = await fetch(url + "/void", { agent });
      if (res.ok) {
        console.log("Backend is up");
        process.exit(0);
      }
    } catch (err) {
      process.stdout.write(".");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.error("Failed to connect to backend");
  process.exit(1);
};

await waitOn(testEnv);
