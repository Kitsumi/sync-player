const util = require("util");
const path = require("path");

function getCallingInfo() {
    let e = new Error();
    let s = (e.stack || "").split("\n");
    let parts = s[3].trim().split(":");

    let col = parts.pop();
    col = col.substring(0, col.length - 1);
    let line = parts.pop();
    let file = parts.join(":").split("(");
    file = file[file.length - 1]
    file = file.split(" ");
    file = path.relative(path.resolve(__dirname, ".."), file[file.length - 1]);

    return file + ":" + line + ":" + col;
}

function getTimeStamp() {
    let d = new Date();

    return d.toLocaleTimeString([], {
        "year": "numeric",
        "month": "2-digit",
        "day": "2-digit",
        "hour": "numeric",
        "minute": "2-digit",
        "second": "2-digit",
        "fractionalSecondDigits": 3
    })
}

class Logger {
    constructor() {
        this.outputs = [];
    }

    writeToOutputs(string) {
        for (var i = 0; i < this.outputs.length; i++) {
            this.outputs[i].write(string + "\n");
        }
    }

    debug() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}] [DEBUG] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }

    log() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}]  [INFO] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }

    info() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}]  [INFO] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }

    warn() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}]  [WARN] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }

    error() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}] [ERROR] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }

    fatal() {
        let args = [...arguments];
        let namespace = args.shift();
        let callInfo = getCallingInfo();
        
        this.writeToOutputs(`[${getTimeStamp()}] [FATAL] [${callInfo}] [${namespace}] ${args.map(x => util.format(x)).join(" ")}`);
    }
}

let logger = new Logger();
logger.outputs.push(process.stdout);

module.exports = logger;