import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";

const app = express();
const webPort = 3000;

app.listen(webPort, () => {
  console.log(`Active on port ${webPort}`);
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", (req, res) => {
  res.send("Content!");
});
