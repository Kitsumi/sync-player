const { genRandomId } = require("./util.js");

class User {
    constructor(socket) {
        this.id = genRandomId();
        this.socket = socket;
        this.room = null;
        this.name = "Guest";
        this.skip = false;

        this.lastQueue = 0;
        this.lastNameChange = 0;
        this.lastVoteSkip = 0;
    }
}

module.exports = User;