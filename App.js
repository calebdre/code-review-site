async function fetchReviews() {
    let t = await fetch("comments.json")
        .then((r) => r.json())
    return t;
}

function onLineClick(e) {
    const $target = $(e.currentTarget).parent();

    $target.toggleClass("active");
    if ($target.hasClass("active")) {
        lineNumberCounter.increment($target.index() + 1);
    } else if (!$target.hasClass("active")) {
        lineNumberCounter.decrement($target.index() + 1);
    }
}

function generateLineNumbers() {
    $("#code").text()
        .split("\n")
        .slice(0,-1)
        .map((el, i) => {
            return $("<div>", {
                text: (i+1)
            });
        }).forEach((item) => {
        $(".linenums").append(item);
    });
}

function transformCodeHtml() {
    const $code = $("#code");
    let mapped = $code.html()
        .split("\n")
        .map((el) => {
            return $("<div>")
                .append($("<div>").append(el));
        })
        .reduce((accumulator, el) => {
            return accumulator + el.get(0).outerHTML;
        }, "");

    $code.html(mapped);
}

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function attachListeners() {
    $('#code > div > div').click(onLineClick);
    $("body").mouseup((e) => {
        window.isMouseDown = false;
    });

    $("body").mousedown((e) => {
        window.isMouseDown = true;
    });

    previewButton.applyListener();
    commentEditor.applyListeners();

    $("#code > div").mouseenter((e) => {
        if (window.isMouseDown === true) {
            const $el = $(e.currentTarget);
            $el.toggleClass("active");
            if ($el.hasClass("active")) {
                lineNumberCounter.increment($el.index() + 1);
            } else {
                lineNumberCounter.decrement($el.index() + 1);
            }
        }
    });
}

function applyReview(item) {
    item["comments"].forEach((comment => {
        // applyComment(comment);
    }));
}

class CommentList {
    constructor() {
        this._$commentsContainer = $(".all-comments");
        this._list = [];
    }

    /**
     * @param UserComment[] list
     */
    setList(list) {
        this._list = list;
    }

    render() {
        var htmlComments = [];
        for (let comment in this._list) {
            const commentHtml = comment.generateHtml();
            htmlComments.push(commentHtml);
        }

        this._$commentsContainer.append(htmlComments);
    }

    /**
     * @param UserComment comment
     */
    append(comment) {
        this._list.push(comment);
        this._$commentsContainer.append(comment.generateHtml());
    }
}

class UserComment {
    constructor(commentData) {
        this._data = commentData;
        this._$commentsContainer = $(".all-comments");
    }

    generateHtml() {
        var elData = [
            {"class" : "user-comment", "tag": "div", "children": [
                {"class":  "username", "tag": "p", "data": this._data["user"]},
                {"class":  "time-since color-muted", "tag": "p", "data": this._data["postTime"]},
                {"class":  "comment-wrapper", "tag": "div", "data": this._data["commentHtml"]}
            ]
            },
            {"class": "comment-separator", "tag": "hr"}
        ];

        return composeHtml(elData);
    }

    applyHoverListener() {
        // $("");
    }
}

class CommentEditor {
    constructor() {
        this._textarea = $("#commentbox");
        this._editor = new SimpleMDE({
            element: this._textarea.get(0),
            toolbar: false,
            status: false
        });
        this._submitButton = $("#submit-comment-button");
    }

    applyListeners() {
        this._submitButton.click((e) => {
            const commentData = {
                "user": "username",
                "postTime" : "right now",
                "commentHtml": showdownConverter.makeHtml(this.getCommentMarkdown()),
                "lines": lineNumberCounter.getSelectedLines()
            };

            commentList.append(new UserComment(commentData));
        });
    }

    togglePreview() {
        this._editor.togglePreview();
    }

    getCommentMarkdown() {
        return this._editor.value();
    }
}

class SelectedLinesCounter {
    constructor() {
        this._count = 0;
        this._$counterEl = $(".lines-selected");
        this.selectedLines = [];
    }

    increment(index) {
        this._count++;
        this.selectedLines.push(index);
        this._refreshText();
    }

    decrement(index) {
        this._count--;
        this.selectedLines.splice(this.selectedLines.indexOf(index), 1);
        this._refreshText();
    }

    getSelectedLines() {
        return this.selectedLines;
    }

    _refreshText() {
        this._$counterEl.text(this._count + " lines selected.");
    }
}

class PreviewButtonState {
    constructor() {
        this._isPreviewActive = false;
        this._el = $(".comment .buttons .preview");
    }

    togglePreview() {
        this._isPreviewActive = !this._isPreviewActive;
        commentEditor.togglePreview();

        if (this._isPreviewActive) {
            this._el.text("Edit");
        } else {
            this._el.text("Preview");
        }
    }

    applyListener() {
        this._el.click(this.togglePreview.bind(this));
    }
}

class ReviewsRepository {
    constructor() {
        this.database = firebase.database();
    }
}

class UserRepository {
    constructor() {
        this.database = firebase.database();
    }

    _user(props) {
        return [
            "avatar_url",
            "email",
            "name",
            "login",
            "url"
        ].reduce((accumulator, iteration) => {
            if(props.hasOwnProperty(iteration)) {
                accumulator[iteration] = props[iteration];
            }
            return accumulator;
        }, {});
    }

    async getOrCreateGithubUser(accessToken) {
        return await new Promise((resolve, reject) => {
            if (localStorage.getItem("current_user") !== null) {
                resolve(JSON.parse(localStorage.getItem("current_user")));
            }
            this.database.ref("users")
                .child(accessToken)
                .once("value", async (snapshot) => {
                    if (snapshot.val() === null) {
                        resolve(await this.createUser(accessToken));
                    } else {
                        resolve(snapshot.val());
                    }
                })
        })
    }

    async createUser(accessToken) {
        let headers = new Headers();
        headers.append("Accept", "application/vnd.github.v3+json");
        headers.append("Authorization", "token " + accessToken);
        const  data = await fetch("https://api.github.com/user", {
            headers: headers,
            method: "GET"
        }).then(response => response.json())

        const user = this._user(data);
        await this.database.ref(`users/${accessToken}`).set(user);
        localStorage.setItem("current_user", JSON.stringify(user));
        localStorage.setItem("access_token", accessToken);
        return user;
    }

    getCurrentUser() {
        return localStorage.getItem("current_user");
    }
}

const commentList = new CommentList();
const commentEditor = new CommentEditor();
const previewButton = new PreviewButtonState();
const lineNumberCounter = new SelectedLinesCounter();
const showdownConverter = new showdown.Converter();

$('document').ready(() => {
    generateLineNumbers();
    transformCodeHtml();
    attachListeners();


    if (getURLParameter("access_token") !== null) {
        const repo = new UserRepository();
        const r = repo.getOrCreateGithubUser(getURLParameter("access_token"));
        r.then(e => {
            console.log(e);
        });
    }

    const reviews = fetchReviews();
    reviews.then((r) => {
        r['reviews'].forEach((item) => {
            applyReview(item);
        });
    });
});