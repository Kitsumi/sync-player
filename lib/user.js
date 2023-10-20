const { genRandomId } = require("./util.js");

class User {
    constructor(socket) {
        this.id = genRandomId();
        this.socket = socket;
        this.room = null;
        this.name = "Guest";
        this.skip = false;
    }
}

module.exports = User;