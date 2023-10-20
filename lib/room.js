const { getYoutubeVideoData, genRandomId } = require("./util.js");
const logger = require("./logger.js");

class Room {
    constructor(code) {
        this.code = code;
        this.usersById = {};
        this.clients = [];
        this.video = null;
        this.queue = [];
        this.videoTimer = null;
        this.host = null;
    }

    broadcast(data, exclude) {
        if (!Array.isArray(exclude)) {
            exclude = [exclude];
        }
    
        for (var i = 0; i < this.clients.length; i++) {
            let user = this.clients[i];
            if (user.socket.readyState == 1 && exclude.indexOf(user) == -1) {
                user.socket.send(JSON.stringify(data));
            }
        }
    }

    addUser(user) {
        const self = this;

        let ids = Object.keys(this.usersById);
        let changedId = false;
        let oldId = user.id;
        while (ids.indexOf(user.id) > -1) { 
            user.id = genRandomId();
            changedId = true;
        }
        if (changedId) {
            logger.log("Users", `Changed '${user.name}'(${oldId}) to '${user.name}'(${user.id})`);
            user.socket.send(JSON.stringify({
                type: "user_info",
                name: user.name,
                id: user.id
            }));
        }

        /*
        for (var i = 0; i < this.clients.length; i++) {
            let alt = this.clients[i];

            if (alt.socket.address == user.socket.address) {
                if (self.host?.id == alt.id) this.setHost(user);
                alt.socket.send(JSON.stringify({
                    type: "disconnect",
                    message: "Connected from a different device or window"
                }));
                alt.socket.close();
            }
        }
        */

        logger.log("Rooms", `[${this.code}]`, `Added '${user.name}'(${user.id})`);

        user.socket.send(JSON.stringify({
            type: "join_room",
            room: this.code
        }));

        this.broadcast({type: "user_add", user: {
            id: user.id,
            name: user.name,
            host: user.id == this.host?.id
        }});

        for (var i = 0; i < this.clients.length; i++) {
            user.socket.send(JSON.stringify({
                type: "user_add",
                user: {
                    id: this.clients[i].id,
                    name: this.clients[i].name,
                    host: this.clients[i].id == this.host.id
                }
            }));
        }

        this.clients.push(user);
        this.usersById[user.id] = user;

        if (this.video) {
            user.socket.send(JSON.stringify({ "type": "play_video", "video": this.video }));
        }

        user.socket.send(JSON.stringify({
            type: "queue",
            videos: this.queue
        }));

        user.socket.on("message", (data) => {
            try {
                data = JSON.parse(data);
            } catch (err) { return; }

            self.onUserMessage(user, data);
        });

        user.socket.on("close", () => {
            self.onUserLeave(user);
        });

        if (self.host == null) {
            self.setHost(user);
        }

        if (this.video) this.voteToSkip();
    }

    setHost(user) {
        this.host = user;
        this.broadcast({
            type: "set_host",
            user: this.host.id
        });
        logger.log("Rooms", `[${this.code}]`, `Set host to '${user.name}'(${user.id})`);
    }

    onUserMessage(user, message) {
        if (message.type == "request_video") {
            getYoutubeVideoData(message.id).then((data) => {
                logger.log("Rooms", `[${this.code}]`, `'${user.name}'(${user.id}) requested video '${video.title}'(${message.id})`);

                let video = {
                    duration: data.duration,
                    title: data.title,
                    id: message.id,
                    queuedBy: {id: user.id, name: user.name}
                };

                this.queue.push(video);
                this.broadcast({
                    type: "queue_add",
                    video,
                    index: this.queue.length - 1
                });
                user.socket.send(JSON.stringify({
                    type: "queue_success",
                    id: message.id
                }));
                if (this.video === null) {
                    this.playNextVideo();
                }
            }).catch((err) => {
                logger.warn("Rooms", `[${this.code}]`, `'${user.name}'(${user.id}) requested invalid video '${message.id}'`, err);
                user.socket.send(JSON.stringify({
                    type: "queue_failure",
                    id: message.id
                }));
            });
        } else if (message.type == "queue_remove") {
            let idx = typeof message.index == "number" ? Math.floor(message.index) : -1;
            if (idx > -1 && idx < this.queue.length) {
                let video = this.queue[idx];

                if (video?.queuedBy?.id == user.id || user.id == this.host?.id) {
                    logger.log("Rooms", `[${this.code}]`, `'${user.name}'(${user.id}) removed video ${idx}: ${video.title} queued by '${video.queuedBy.name}'(${video.queuedBy.id})`);

                    this.queue.splice(idx, 1);

                    this.broadcast({ "type": "queue_remove", "index": idx });
                }
            }
        } else if (message.type == "change_name") {
            this.broadcast({
                type: "user_update",
                user: {
                    id: user.id,
                    name: user.name
                }
            }, user);

            for (var i = 0; i < this.queue.length; i++) {
                let video = this.queue[i];
                if (video.queuedBy.id == user.id) {
                    video.queuedBy.name = user.name;
                }
            }

            if (this.video?.queuedBy?.id == user.id) {
                this.video.queuedBy.name = user.name;
            }
        } else if (message.type == "skip" && this.video) {
            if (this.host?.id == user.id) {
                if (this.video) {
                    logger.log("Rooms", `[${this.code}]`, `Host '${user.name}'(${user.id}) skipped the current video: ${this.video.title} queued by '${this.video.queuedBy.name}'(${this.video.queuedBy.id})`);
                    this.playNextVideo();
                }
            } else {
                user.skip = true;
                logger.log("Rooms", `[${this.code}]`, `User '${user.name}'(${user.id}) has voted to skip the current video: ${this.video.title} queued by '${this.video.queuedBy.name}'(${this.video.queuedBy.id})`);
                this.voteToSkip();
            }
        } else if (message.type == "kick" && this.host?.id == user.id) {
            if (this.usersById.hasOwnProperty(message.user)) {
                let u = this.usersById[message.user];
                logger.log("Rooms", `[${this.code}]`, `Host '${user.name}'(${user.id}) has kicked '${u.name}'(${u.id})`);

                u.socket.send(JSON.stringify({
                    type: "disconnect",
                    message: "You have been kicked"
                }));
                u.socket.close();
            }
        } else if (message.type == "set_host" && this.host?.id == user.id) {
            if (this.usersById.hasOwnProperty(message.user)) {
                let u = this.usersById[message.user];

                logger.log("Rooms", `[${this.code}]`, `Host '${user.name}'(${user.id}) has transferred host to '${u.name}'(${u.id})`);

                this.setHost(u);
            }
        }
    }

    voteToSkip() {
        let votes = 0;
        for (var i = 0; i < this.clients.length; i++) {
            if (this.clients[i].skip) votes++;
        }
        let ratio = Math.min(1, Math.max(0, this.clients.length - 1) / 9) * 0.35 + 0.45;
        if (votes / this.clients.length >= ratio && this.video) {
            this.playNextVideo();
        }
        this.broadcast({
            type: "vote_skip",
            total: votes,
            needed: Math.ceil(ratio * this.clients.length)
        });
    }

    onUserLeave(user) {
        let idx = this.clients.indexOf(user);
        if (idx > -1) {
            this.clients.splice(idx, 1);
            delete this.usersById[user.id];
        }

        logger.log("Rooms", `[${this.code}]`, `'${user.name}'(${user.id}) has left the room`);

        this.broadcast({type: "user_remove", user: user.id });

        if (this.host.id == user.id && this.clients.length > 0) {
            this.setHost(this.clients[0]);
        }

        if (this.video) this.voteToSkip();
    }

    playNextVideo() {
        for (var i = 0; i < this.clients.length; i++) {
            let user = this.clients[i];
            user.skip = false;
        }

        if (this.queue.length <= 0) { 
            this.broadcast({ "type": "no_video" });
            this.video = null;
            return;
        }

        this.video = this.queue.shift();
        this.video.started = Date.now();
        this.broadcast({ "type": "queue_remove", "index": 0 });
        this.broadcast({ "type": "play_video", "video": this.video });
        logger.log("Rooms", `[${this.code}]`, `Playing video '${this.video.title}' queued by '${this.video.queuedBy.name}'(${this.video.queuedBy.id})`);

        this.voteToSkip();

        clearTimeout(this.videoTimer);
        this.videoTimer = setTimeout(this.playNextVideo.bind(this), this.video.duration * 1000);
    }
}

module.exports = Room;