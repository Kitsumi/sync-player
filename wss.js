const { WebSocketServer } = require("ws");
const logger = require("./lib/logger.js");
const Room = require("./lib/room.js");
const User = require("./lib/user.js");

const wss = new WebSocketServer({noServer: true});
wss.broadcast = function(data, exclude) {
    if (!Array.isArray(exclude)) {
        exclude = [exclude];
    }

    for (var i = 0; i < wss.clients.length; i++) {
        let socket = wss.clients[i];
        if (socket.readyState == 1 && exclude.indexOf(socket) == -1) {
            socket.send(data);
        }
    }
};

let RoomList = {};

wss.on("connection", (socket) => {
    let user = new User(socket);
    socket.send(JSON.stringify({
        type: "user_info",
        name: user.name,
        id: user.id
    }));

    logger.log("Users", `New User(${user.id}) has connected from ${socket.address}`);

    let keepalive = setInterval(() => {
        if (socket.readyState == 1) socket.send("1");
    }, 5000);

    socket.on("message", (data) => {
        if (data == "2") return socket.send("3");
        try {
            data = JSON.parse(data);
        } catch (err) { return; }

        if (data.type == "join" && user.room == null) {
            let code = typeof data.room == "string" ? data.room.match(/^[a-z0-9]{8}\-[a-z0-9]{8}$/i) : false;
            if (code) { code = code[0] } else { return }

            if (!RoomList.hasOwnProperty(code)) {
                logger.log("Rooms", "Creating new room: " + code);
                RoomList[code] = new Room(code);
            }

            let room = RoomList[code];

            room.addUser(user);
            user.room = room;

            socket.on("close", () => {
                if (room.clients.length == 0) {
                    logger.log("Rooms", "Removing empty room: " + code);
                    delete RoomList[code];
                }
            });
        } else if (data.type == "change_name" && typeof data.name == "string" && data.name.length < 32) {
            let t = data.name.replace(/[^a-z0-9 ]/gi, "").replace(/\s+/gi, " ").trim();
            if (t.length >= 2) {
                logger.log("Users", `User '${user.name}'(${user.id}) changed name to '${t}'`);
                user.name = t;
                socket.send(JSON.stringify({
                    type: "user_update",
                    user: {
                        id: user.id,
                        name: user.name
                    }
                }));
            } else {
                logger.log("Users", `User '${user.name}'(${user.id}) tried invalid name '${t}'`);
            }
        }
    });

    socket.on("close", () => {
        clearInterval(keepalive);
    })
});

module.exports = wss;