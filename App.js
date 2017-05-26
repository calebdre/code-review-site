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

function composeHtml(data) {
    const dataItem = Array.isArray(data) ? data[0] : data;

    dataItem["tag"] = `<${dataItem["tag"]}>`;
    const $el = $(dataItem["tag"]).addClass(dataItem["class"]);
    if (dataItem.hasOwnProperty("data")) {
        $el.html(dataItem["data"]);
    }
    if (dataItem.hasOwnProperty("children")) {
        for (let i = 0; i < dataItem["children"].length; i++) {
            $el.append(composeHtml(dataItem["children"][i]));
        }
    }

    if (data.length > 1) {
        const composedSibling = composeHtml(data.slice(1));
        return $el.add(composedSibling);
    }

    return $el;
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

const commentList = new CommentList();
const commentEditor = new CommentEditor();
const previewButton = new PreviewButtonState();
const lineNumberCounter = new SelectedLinesCounter();
const showdownConverter = new showdown.Converter();

$('document').ready(() => {
    generateLineNumbers();
    transformCodeHtml();
    attachListeners();

    const reviews = fetchReviews();
    reviews.then((r) => {
        r['reviews'].forEach((item) => {
            applyReview(item);
        });
    });
});