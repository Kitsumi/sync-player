let CAT = document.getElementById("cat");
let playerContainer = document.getElementById("player");
let queueList = document.getElementById("queue");
let userList = document.getElementById("users");
let queueSubmit = document.getElementById("queue-submit");
let menubox = document.getElementById("menu");

var roomcode = window.location.pathname.match(/([a-z0-9]{8}\-[a-z0-9]{8})/i);
roomcode = (roomcode ? roomcode[0] : "N/A");
document.getElementById("room-code").innerText = roomcode;

let localuser = null;
let users = {};
let queue = [];
let video = null;
let skipped = false;
let disconnectMessage = "Connection lost";
let player;

function formatTime(sec) {
    let seconds = Math.floor(sec) % 60;
    let minutes = Math.floor(sec / 60) % 60;
    let hours = Math.floor(sec / 60 / 60);

    if (hours > 0) {
        return hours.toString() + ":" + minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
    } else {
        return minutes.toString().padStart(2, "0") + ":" + seconds.toString().padStart(2, "0");
    }
}

function extractVideoID(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[7].length == 11) {
        return match[7];
    } else {
        return false;
    }
}

function ordinal_suffix_of(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}

function prompt(text, placeholder, onSubmit) {
    let promptShadow = document.createElement("div");
    let _closeWindow = () => {
        promptShadow.parentNode.removeChild(promptShadow);
    };
    promptShadow.classList.add("prompt-shadow");
    promptShadow.addEventListener("click", (evt) => {
        if (evt.target != promptShadow) return;

        _closeWindow();
    });

    let promptContainer = document.createElement("div");
    promptContainer.classList.add("prompt");
    promptShadow.appendChild(promptContainer);

    if (text instanceof HTMLElement) {
        if (!text.classList.contains("label")) text.classList.add("label");
        promptContainer.appendChild(text);
    } else {
        let label = document.createElement("div");
        label.classList.add("label");
        label.innerText = text;
        promptContainer.appendChild(label);
    }

    let input = document.createElement("input");
    input.classList.add("textarea");
    input.type = "text";
    input.placeholder = placeholder;
    input.addEventListener("keydown", (evt) => {
        if (evt.code == "Enter") {
            onSubmit(input.value);
            _closeWindow();
        }
    });
    promptContainer.appendChild(input);

    let buttonContainer = document.createElement("div");
    buttonContainer.classList.add("buttons");
    promptContainer.appendChild(buttonContainer);

    let cancelBtn = document.createElement("span");
    cancelBtn.classList.add("button");
    cancelBtn.classList.add("cancel");
    cancelBtn.innerText = "Cancel";
    cancelBtn.addEventListener("click", (evt) => {
        if (evt.target != cancelBtn) return;

        _closeWindow();
    });
    buttonContainer.appendChild(cancelBtn);

    let submitBtn = document.createElement("span");
    submitBtn.classList.add("button");
    submitBtn.classList.add("submit");
    submitBtn.innerText = "Submit";
    submitBtn.addEventListener("click", (evt) => {
        if (evt.target != submitBtn) return;

        onSubmit(input.value);
        _closeWindow();
    });
    buttonContainer.appendChild(submitBtn);

    document.body.appendChild(promptShadow);
}

function alert(text, onClose) {
    let promptShadow = document.createElement("div");
    let _closeWindow = () => {
        promptShadow.parentNode.removeChild(promptShadow);
        onClose();
    };
    promptShadow.classList.add("prompt-shadow");
    promptShadow.addEventListener("click", (evt) => {
        if (evt.target != promptShadow) return;

        _closeWindow();
    });

    let promptContainer = document.createElement("div");
    promptContainer.classList.add("prompt");
    promptShadow.appendChild(promptContainer);

    if (text instanceof HTMLElement) {
        if (!text.classList.contains("label")) text.classList.add("label");
        promptContainer.appendChild(text);
    } else {
        let label = document.createElement("div");
        label.classList.add("label");
        label.innerText = text;
        promptContainer.appendChild(label);
    }

    let buttonContainer = document.createElement("div");
    buttonContainer.classList.add("buttons");
    promptContainer.appendChild(buttonContainer);

    let submitBtn = document.createElement("span");
    submitBtn.classList.add("button");
    submitBtn.classList.add("submit");
    submitBtn.style.flexGrow = "1";
    submitBtn.innerText = "Ok";
    submitBtn.addEventListener("click", (evt) => {
        if (evt.target != submitBtn) return;

        _closeWindow();
    });
    buttonContainer.appendChild(submitBtn);

    document.body.appendChild(promptShadow);
}

function reorderVideoElements() {
    for (var i = 0; i < queue.length; i++) {
        queue[i].element.style.order = i + 1;
        queue[i].element.children[0].children[0].innerText = i == 0 ? "Up Next" : ordinal_suffix_of(i + 1);
    }
}

function createVideoQueueElement(vid) {
    let element = document.createElement("div");
    element.classList.add("video");
    if (localuser && vid && vid?.queuedBy?.id == localuser?.id) element.classList.add("owned");

    let statusArea = document.createElement("div");
    statusArea.classList.add("status");
    element.appendChild(statusArea);

    let subtext = document.createElement("span");
    subtext.classList.add("subtext");
    statusArea.appendChild(subtext);
    
    let spacer = document.createElement("div");
    spacer.style.flexGrow = 1;
    statusArea.appendChild(spacer);

    let deleteBtn = document.createElement("div");
    deleteBtn.classList.add("button");
    deleteBtn.classList.add("delete");
    deleteBtn.innerHTML = `<i class="ri-delete-bin-fill"></i>`;
    statusArea.appendChild(deleteBtn);

    deleteBtn.addEventListener("click", (evt) => {
        let idx = (parseInt(element.style.order) || 0) - 1;
        if (idx > -1) {
            client.send(JSON.stringify({
                type: "queue_remove",
                index: idx
            }));
        }
    });

    let link = "https://youtu.be/" + vid.id;
    let titleContainer = document.createElement("a");
    titleContainer.classList.add("title");
    titleContainer.target = "_blank";
    titleContainer.href = link;
    console.log(titleContainer.href);
    titleContainer.innerText = vid.title;

    let infoContainer = document.createElement("div");
    infoContainer.classList.add("info");

    let durationContainer = document.createElement("span");
    durationContainer.classList.add("duration");
    durationContainer.innerText = formatTime(vid.duration);
    infoContainer.appendChild(durationContainer);

    let userContainer = document.createElement("span");
    userContainer.classList.add("user");
    userContainer.innerText = vid.queuedBy.name;
    infoContainer.appendChild(userContainer);

    element.appendChild(titleContainer);
    element.appendChild(infoContainer);

    return element;
}

function removeVideoFromQueue(idx) {
    let video = queue[idx];
    queue.splice(idx, 1);

    video.element.parentNode.removeChild(video.element);
    reorderVideoElements();
}

function addVideoToQueue(video) {
    video.element = createVideoQueueElement(video);
    queue.push(video);
    queueList.appendChild(video.element);
    reorderVideoElements();
}

function createUserElement(user) {
    let element = document.createElement("div");
    element.classList.add("user");
    element.id = user.id;

    if (user.host) {
        element.classList.add("host");
    }

    let iconlist = document.createElement("div");
    iconlist.classList.add("icons");
    element.appendChild(iconlist);

    let uid = document.createElement("span");
    uid.classList.add("uid");
    uid.innerText = user.id;
    iconlist.appendChild(uid);

    let kick = document.createElement("i");
    kick.classList.add("icon");
    kick.classList.add("host-only");
    kick.classList.add("ri-logout-box-fill");
    kick.addEventListener("click", (evt) => {
        client.send(JSON.stringify({
            type: "kick",
            user: user.id
        }));
    });
    iconlist.appendChild(kick);

    let crown = document.createElement("i");
    crown.classList.add("icon");
    crown.classList.add("crown");
    crown.classList.add("ri-vip-crown-fill");
    iconlist.appendChild(crown);

    let give_crown = document.createElement("i");
    give_crown.classList.add("icon");
    give_crown.classList.add("host-only");
    give_crown.classList.add("gift-crown");
    give_crown.classList.add("ri-vip-crown-line");
    give_crown.addEventListener("click", (evt) => {
        client.send(JSON.stringify({
            type: "set_host",
            user: user.id
        }));
    });
    iconlist.appendChild(give_crown);

    let username = document.createElement("span");
    username.classList.add("username");
    username.innerText = user.name;
    element.appendChild(username);

    return element;
}

function removeUserElement(user) {
    user.element.parentNode.removeChild(user.element);
}

function updateUserElement(user) {
    user.element.children[1].innerText = user.name;
}

let nowPlayingElement = createVideoQueueElement({title: "N/A", duration: 0, queuedBy: {id: "N/A", name: "N/A"}});
nowPlayingElement.style.display = "none";
nowPlayingElement.classList.add("now-playing");
nowPlayingElement.children[0].innerHTML = `<span class="subtext">Now Playing</span><div style="flex-grow:1"></div>`;
let skipLabel = document.createElement("span");
skipLabel.innerText = `0 / 0`;
nowPlayingElement.children[0].appendChild(skipLabel);
let skipButton = document.createElement("div");
skipButton.classList.add("button");
skipButton.innerHTML = `<i class="ri-skip-forward-line"></i>`;
nowPlayingElement.children[0].appendChild(skipButton);
document.getElementById("menu").appendChild(nowPlayingElement);

var tag = document.createElement('script');

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);


function onYouTubeIframeAPIReady() {
    player = new YT.Player('player-inner', {
        width: window.innerWidth,
        height: window.innerHeight,
        events: {
            playerVars: { 'autoplay': 1 },
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });

    function onPlayerReady(event) {
        if (video) {
            event.target.loadVideoById(video.id, 0);
        }
    }

    function onPlayerStateChange(event) {
        CAT.style.opacity = event.data == 1 ? "" : "0";
        event.target.getIframe().style.display = event.data >= 0 ? "block" : "none";

        if (event.data == 1 && video) {
            let offset = (Date.now() - video.started) / 1000;
            let timestamp = player.getCurrentTime();
            if (Math.abs(offset - timestamp) > 0.5) {
                event.target.seekTo(offset);
            }
        }
    }

    function onPlayerError(event) {
        console.log(event);
    }
}

let client = new WebSocket((window.location.protocol == "http:" ? "ws://" : "wss://") + window.location.host);

client.onopen = function() {
    if (localStorage.getItem("name")) {
        client.send(JSON.stringify({
            type: "change_name",
            name: localStorage.getItem("name")
        }));
    }
}

client.onmessage = function(evt) {
    if (evt.data == "1") return client.send("2");

    let data = evt.data;
    try {
        data = JSON.parse(data);
    } catch (err) { return; }

    console.log(data);

    if (data.type == "user_info") {
        if (localuser?.element) localuser.element.parentNode.removeChild(localuser.element);
        localuser = {
            name: data.name,
            id: data.id
        };
        localuser.element = createUserElement(localuser);
        localuser.element.id = "localuser";
        userList.appendChild(localuser.element);
        users[localuser.id] = localuser;
    } else if (data.type == "play_video") {
        playerContainer.style.display = "block";
        video = data.video;
        document.title = "Vibin' Party - " + video.title;
        nowPlayingElement.children[1].innerText = video.title;
        nowPlayingElement.children[1].href = "https://youtu.be/" + video.id;
        nowPlayingElement.children[2].children[0].innerText = formatTime(video.duration);
        nowPlayingElement.children[2].children[1].innerText = video.queuedBy.name;
        nowPlayingElement.style.display = "block";
        skipped = false;
        skipButton.innerHTML = `<i class="ri-skip-forward-line"></i>`;
        if (player) player.loadVideoById(data.video.id, 0);
    } else if (data.type == "user_add") {
        let user = data.user;
        user.element = createUserElement(user);
        userList.appendChild(user.element);
        users[data.user.id] = user;
    } else if (data.type == "user_remove") {
        removeUserElement(users[data.user]);
        delete users[data.user];
    } else if (data.type == "user_update") {
        let user = users[data.user.id];
        user.name = data.user.name;

        for (var i = 0; i < queue.length; i++) {
            let video = queue[i];
            if (video.queuedBy.id == user.id) {
                video.queuedBy = user;
                video.element.children[2].children[1].innerText = user.name;
            }
        }

        if (video?.queuedBy?.id == user.id) {
            video.queuedBy = user;
            nowPlayingElement.children[2].children[1].innerText = video.queuedBy.name;
        }

        updateUserElement(user);
    } else if (data.type == "no_video") {
        document.title = "Vibin' Party";
        video = null;
        playerContainer.style.display = "none";
        nowPlayingElement.style.display = "none";
        if (player?.stopVideo) {
            player.stopVideo();
        }
    } else if (data.type == "queue_add") {
        addVideoToQueue(data.video, data.index || queue.length);
    } else if (data.type == "queue") {
        for (var i = 0; i < data.videos.length; i++) {
            addVideoToQueue(data.videos[i]);
        }
    } else if (data.type == "queue_remove") {
        removeVideoFromQueue(data.index);
    } else if (data.type == "set_host") {
        if (data.user == localuser.id && !menubox.classList.contains("is-host")) {
            menubox.classList.add("is-host");
        } else if (menubox.classList.contains("is-host")) {
            menubox.classList.remove("is-host");
        }

        let hosts = document.querySelectorAll(".user.host");
        for (var i = 0; i < hosts.length; i++) {
            hosts[i].classList.remove("host");
        }

        users[data.user].element.classList.add("host");
    } else if (data.type == "vote_skip") {
        skipLabel.innerText = data.total + " / " + data.needed;
    } else if (data.type == "disconnect") {
        disconnectMessage = data.message;
    }
};

client.onclose = function() {
    let dcMsg = document.createElement("div");
    dcMsg.style.display = "flex";
    dcMsg.style.flexDirection = "column";
    dcMsg.style.alignItems = "center";
    dcMsg.style.marginBottom = "16px";

    let titleBox = document.createElement("h1");
    titleBox.innerText = "Disconnected";
    titleBox.style.margin = "8px";
    dcMsg.appendChild(titleBox);

    let reasonBox = document.createElement("span");
    reasonBox.innerText = disconnectMessage;
    dcMsg.appendChild(reasonBox);

    alert(dcMsg, () => {
        window.location.href = window.location.origin;
    });

    if (video) video = null;

    if (player?.stopVideo) {
        player.stopVideo();
    }
}

window.addEventListener("resize", (evt) => {
    if (player) player.setSize(window.innerWidth, window.innerHeight);
});

const enterRoomBtn = document.getElementById("enter-room");
enterRoomBtn.addEventListener("click", (evt) => {
    let roomcode = window.location.pathname.match(/([a-z0-9]{8}\-[a-z0-9]{8})/i);

    if (client.readyState == WebSocket.OPEN && roomcode) {
        enterRoomBtn.parentNode.removeChild(enterRoomBtn);

        roomcode = roomcode[0];

        client.send(JSON.stringify({
            "type": "join",
            "room": roomcode
        }));
    }
});

document.addEventListener('fullscreenchange', (evt) => {
    if (player && document.fullscreenElement && evt.target == player.getIframe()) {
        document.exitFullscreen();
    }
});

queueSubmit.onkeydown = function(evt) {
    if (evt.code == "Enter") {
        let id = extractVideoID(queueSubmit.value);
        queueSubmit.value = "";

        if (id) {
            client.send(JSON.stringify({
                type: "request_video",
                id: id
            }));
        }
    }
}

document.getElementById("menu-button").addEventListener("click", (evt) => {
    let btn = document.getElementById("menu-button");
    if (menubox.classList.contains("open")) {
        menubox.classList.remove("open");
        btn.children[0].innerText = "Open Menu";
    } else {
        menubox.classList.add("open");
        btn.children[0].innerText = "Close Menu";
    }
});

document.getElementById("name-button").addEventListener("click", () => {
    prompt("Please enter a new name:", localuser.name, (value) => {
        if (value.length > 0) {
            localStorage.setItem("name", value);
            client.send(JSON.stringify({
                type: "change_name",
                name: value
            }));
        }
    });
});

document.getElementById("cat-button").addEventListener("click", (evt) => {
    let btn = document.getElementById("cat-button");
    if (CAT.classList.contains("hide")) {
        localStorage.setItem("cat", "true");
        CAT.classList.remove("hide");
        btn.children[1].innerText = "Hide Cat";
    } else {
        localStorage.setItem("cat", "false");
        CAT.classList.add("hide");
        btn.children[1].innerText = "Show Cat";
    }
});

if (localStorage.getItem("cat") == "false") {
    CAT.classList.add("hide");
    document.getElementById("cat-button").children[1].innerText = "Show Cat";
}

skipButton.addEventListener("click", (evt) => {
    if (!skipped) {
        skipped = true;
        skipButton.innerHTML = `<i class="ri-skip-forward-fill"></i>`;
    }

    client.send(JSON.stringify({
        "type": "skip"
    }));
});