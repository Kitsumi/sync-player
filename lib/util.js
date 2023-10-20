const linkedom = require("linkedom");
const axios = require("axios");
const logger = require("./logger.js");

function genRandomId() {
    let a = Date.now().toString(36).split("").reverse();
    let b = Math.floor(Math.random() * 2740506767242 + 80603140213).toString(36);
    return a.reduce((str, v, k) => str + b.charAt(k) + v + (k == 3 ? "-" : ""), "");
}

function YTDurationToSeconds(duration) {
    var match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  
    match = match.slice(1).map(function(x) {
      if (x != null) {
          return x.replace(/\D/, '');
      }
    });
  
    var hours = (parseInt(match[0]) || 0);
    var minutes = (parseInt(match[1]) || 0);
    var seconds = (parseInt(match[2]) || 0);
  
    return hours * 3600 + minutes * 60 + seconds;
}

async function getYoutubeVideoData(id) {
    logger.log("YouTube Scraper", "Getting info for " + id);
    let { document } = linkedom.parseHTML((await axios.get("https://www.youtube.com/watch?v=" + id)).data);
    let tags = document.querySelectorAll("meta");

    let data = {};
    let found = false;
    for (var i = 0; i < tags.length; i++) {
        if (tags[i].getAttribute("itemprop") == "duration") {
            data.duration = YTDurationToSeconds(tags[i].getAttribute("content"));
            found = true;
        } else if (tags[i].getAttribute("itemprop") == "name") {
            data.title = tags[i].getAttribute("content");
            found = true;
        }
    }
    
    if (found) {
        return data;
    } else {
        throw new Error();
    }
}

module.exports = {
    genRandomId,
    getYoutubeVideoData
};