const http = require("http");
const express = require("express");
const wss = require("./wss.js");
const fs = require("fs/promises");
const logger = require("./lib/logger.js");
const path = require("path");
const mime = require("mime");

const app = express();

app.use("/js", async (req, res, next) => {
    try {
        let pth = path.join(__dirname, "public", "js", path.join("/", req.url));
        res.setHeader("content-type", mime.getType(path.extname(pth))).send(await fs.readFile(pth));
        let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        logger.log("HTTP", `${address} ${req.method} /js${req.url} 200 OK`);
    } catch (err) {
        next();
    }
});
app.use("/css", async (req, res, next) => {
    try {
        let pth = path.join(__dirname, "public", "css", path.join("/", req.url));
        res.setHeader("content-type", mime.getType(path.extname(pth))).send(await fs.readFile(pth));
        let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        logger.log("HTTP", `${address} ${req.method} /css${req.url} 200 OK`);
    } catch (err) {
        next();
    }
});
app.use("/res", express.static("public/res"));

app.get("/favicon.ico", async (req, res) => {
    let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.log("HTTP", `${address} ${req.method} ${req.url} 200 OK`);
    res.send(await fs.readFile("public/favicon.ico", "utf-8"));
});

app.get("/", async (req, res) => {
    let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.log("HTTP", `${address} ${req.method} ${req.url} 200 OK`);
    res.send(await fs.readFile("public/index.html", "utf-8"));
});

app.get(/^\/([a-z0-9]{8}\-[a-z0-9]{8})$/i, async (req, res) => {
    let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.log("HTTP", `${address} ${req.method} ${req.url} 200 OK`);
    res.send(await fs.readFile("public/room.html", "utf-8"));
});

app.get("/*", (req, res) => {
    let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.log("HTTP", `${address} ${req.method} ${req.url} 404 - Redirecting to /`);
    res.redirect("/");
});

app.use((req, res) => {
    let address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    logger.log("HTTP", `${address} ${req.method} ${req.url}`);
    return res.status(404).send("");
});

const server = http.createServer(app);

server.on("upgrade", (req, res, head) => {
    wss.handleUpgrade(req, res, head, (socket) => {
        socket.address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        wss.emit("connection", socket);
    });
});

server.listen(8080, () => {
    logger.log("HTTP", "Listening on :" + server.address().port);
});