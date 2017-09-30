function generateLineNumbers($codeRef, $lineNumsRef) {
    $codeRef.text()
        .split("\n")
        .map((el, i) => {
            const data = [
                {"class": "", "tag": "div", "data": i + 1}
            ]
            return composeHtml(data);
        }).forEach((item) => {
            $lineNumsRef.append(item);
        }
    );
}

function transformCodeHtml($codeRef) {
    let mapped = $codeRef.html()
        .split("\n")
        .map((el, i) => {
            const data = [
                {"class": "","tag": "div", "data": el}
            ]
            return composeHtml(data);
        })
        .reduce((accumulator, el) => {
            return accumulator + el.get(0).outerHTML;
        }, "");

    $codeRef.html(mapped);
}

function attachListeners() {
    $("body").mouseup((e) => {
        window.isMouseDown = false;
    });

    $("body").mousedown((e) => {
        window.isMouseDown = true;
    });

    $(".button.toggle-preview").click(e => {
       commentEditor.togglePreview();
    });

    $(".button.paste-selected-lines").click(e => {
        commentEditor.pasteSelectedLines();
    })
    commentEditor.applyListeners();
    codeDisplay.applyListeners();
}

class CommentList {
    constructor() {
        this._$commentsContainer = $(".all-comments");
        this._list = [];
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
     * @param CommentRepository.Comment[] data
     */
    fromData(data) {
        if (Array.isArray(data)) {
            data.forEach(item => {
                this.append(new UserComment(item));
            });
        } else {
            this.append(new UserComment(data));
        }
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
        let userUpvotedClass = "";
        let upvotes = 0;
        if (this._data.upvotes !== undefined) {
            const currentUserKey = userRepo.getCurrentUserToken();
            const keys = Object.keys(this._data.upvotes);
            userUpvotedClass = keys.indexOf(currentUserKey) !== -1 ? "upvoted": "";
            upvotes = keys.length;
            console.log(this._data);
        }

        const imageUrl = this._data.user.avatar_url;
        const username = this._data.user.login;
        const postedTime = moment(this._data.postTime).fromNow();
        const commentHtml = this._data.commentHtml;
        const reputation = this._data.reputation === undefined ? 0 : this._data.reputation;
        const viewCodeInEditorText = "see in code view"
        var elData = [
            {"class" : "user-comment", "tag": "div", "children": [
                {"class":  "upvote-area", "tag": "div", "children" : [
                    {"class": "upvote-holder", "tag": "div", "children": [
                        {"class": "fa fa-caret-up upvote-button " + userUpvotedClass, "tag": "i"},
                        {"class": "upvote-count", "tag": "span", "data": upvotes}
                    ]},
                ]},
                {"class": "comment-area", "tag": "div", "children": [
                    {"class": "comment", "tag": "div", "data": commentHtml},
                    {"class": "user-info", "tag": "div", "children": [
                        {"class": "posted-time-area", "tag": "div", "children": [
                            {"class": "view-code", "tag": "a", "data": viewCodeInEditorText},
                            {"class": "posted-time", "tag": "p", "data": "posted " + postedTime},
                        ]},
                        {"class": "profile-area", "tag": "div", "children": [
                            {"class": "", "tag": "figure", "children": [
                                {"class": "profile-picture", "tag": "img", "attrs": [{
                                    "name": "src", "value": imageUrl
                                }]},
                                {"class":"profile-info", "tag": "figcaption", "children": [
                                    {"class":"username", "tag": "span", "data": username},
                                    {"class": "reputation", "tag": "span", "data": reputation}
                                ]}
                            ]}
                        ]}
                    ]}
                ]}
            ]}
        ];

        const $html = composeHtml(elData);
        this.bindListeners($html);
        return $html;
    }

    bindListeners($html) {
        $html.find(".upvote-button").click(e => {
            upvoteService.recordUpvote(subKey, userRepo.getCurrentUserToken(), this._data.key)
                .then(recordingData => {
                    if (recordingData.success) {
                        const $upvoteButton = $(e.currentTarget);
                        console.log(recordingData.upvote_count);
                        $upvoteButton.parent().find(".upvote-count").text(recordingData.upvote_count);
                        $upvoteButton.toggleClass("upvoted")
                    }
                });
        });

        $html.find(".view-code").click(e => {
            if ($html.hasClass("selected")) {
                for (let i = 0; i <codeDisplay.getCodeDisplayCount(); i++) {
                    codeDisplay.getCodeDisplay(i).removeHighlightedLines();
                }
                $html.removeClass("selected");
                return;
            }

            $html.parent().find(".selected").removeClass("selected")
            $html.addClass("selected");
            for (var key in this._data["lines"]) {
                const fileName = this._data["lines"][key]["filename"] + "." + this._data["lines"][key]["extension"];
                for (let i = 0; i < codeDisplay.getCodeDisplayCount(); i++) {
                    if (codeDisplay.getCodeDisplay(i).getFileName() === fileName) {
                        const lines = this._data["lines"][key]["lines"].split(",");
                        lines.map(item => {
                            return item + 1;
                        });
                        if (lines.length > 0 && lines[0] !== "") {
                            codeDisplay.getCodeDisplay(i).highlightLines(lines);
                        }
                    }
                }
            }
        });
    }
}

class CommentEditor {
    constructor() {
        this._textarea = $("#commentbox");
        this._editor = new SimpleMDE({
            element: this._textarea.get(0),
            toolbar: ["code", "guide"],
            status: false,
            placeholder: "start writing your review"
        });
        this._submitButton = $("#submit-comment-button");
    }

    applyListeners() {
        this._submitButton.click((e) => {
            const fileData = codeDisplay.getSelectedLines();
            let hasAtLeastOneLineSelectedInFile = false;
            for (let key in fileData) {
                if (fileData[key].length !== 0) {
                    hasAtLeastOneLineSelectedInFile = true;
                    const lines = fileData[key].join(",");
                    fileData[key] = {lines: lines};
                } else {
                    fileData[key] = {lines: ""};
                }


                const splitted = key.split(".");
                const filename = splitted.slice(0, splitted.length - 1).join("");
                const extension = splitted[splitted.length - 1];
                const newKey = splitted.join("");
                fileData[newKey] = fileData[key];
                delete fileData[key];
                fileData[newKey]["filename"] = filename;
                fileData[newKey]["extension"] = extension;
            }

            if (!hasAtLeastOneLineSelectedInFile) {
                alert("Please select lines to apply your review to.");
                return;
            }

            const commentData = {
                "user": userRepo.getCurrentUser(),
                "postTime" : Date.now(),
                "commentHtml": this._editor.markdown(this.getCommentMarkdown()),
                "lines": fileData
            };
            console.log(commentData);

            commentRepo.create(commentData);
            commentList.append(new UserComment(commentData));
            $(".all-comments").animate({ scrollTop: $('.all-comments').prop("scrollHeight")}, 400);
        });
    }

    getCommentMarkdown() {
        return this._editor.value();
    }

    togglePreview(){
        this._editor.togglePreview();
    }

    pasteSelectedLines() {
        let linesContent = "```\n";
        for(var i = 0; i < codeDisplay.getCodeDisplayCount(); i++){
            let display = codeDisplay.getCodeDisplay(i);
            let content = display.getSelectedLines()
                .sort(((a, b) => a - b))
                .map(item => {
                    return display.getLineText(item - 1) + "\n";
                })
                .join("");
            linesContent += content;
        }

        linesContent += "```";

        this._editor.codemirror.replaceSelection(linesContent);
    }
}

class SelectedLinesCounter {
    constructor() {
        this._count = 0;
        this.selectedLines = [];
    }

    increment(index) {
        this._count++;
        this.selectedLines.push(index);
    }

    decrement(index) {
        this._count--;
        this.selectedLines.splice(this.selectedLines.indexOf(index), 1);
    }

    getSelectedLines() {
        return this.selectedLines;
    }
}

class CodeDisplayList {
    constructor() {
        this._$list = $(".files");
        this._displays = [];
    }

    applyListeners() {
        this._displays.forEach(display => {
            display.applyListeners();
        })
    }

    append(files) {
        for (var i = 0; i < files.length; i++) {
            const file = files[i];
            const display = new CodeDisplay(file);
            const $filesHtml = display.generateHtml();
            this._displays.push(display);
            this._$list.append($filesHtml);
            const $codeRef = $filesHtml.find(".code");
            hljs.highlightBlock($codeRef.get(0));
            generateLineNumbers($codeRef, $filesHtml.find(".linenums"));
            transformCodeHtml($codeRef);
        }
    }

    getCodeDisplay(index) {
        return this._displays[index];
    }

    getCodeDisplayCount() {
        return this._displays.length;
    }

    /**
     * @returns { filename: [selected_line_numbers] }
     */
    getSelectedLines() {
        return this._displays.reduce((accumulator, item) => {
            accumulator[item.getFileName()] = item.getSelectedLines();
            return accumulator;
        }, {});
    }
}

class CodeDisplay {
    constructor(file) {
        this._file = file;
        this.linesCounter = new SelectedLinesCounter();
    }

    applyListeners() {
        this._$display.find('.code > div').mouseenter((e) => {
            if (window.isMouseDown === true) {
                const $el = $(e.currentTarget);
                $el.toggleClass("active");
                if ($el.hasClass("active")) {
                    this.linesCounter.increment($el.index() + 1);
                } else {
                    this.linesCounter.decrement($el.index() + 1);
                }
            }
        });

        this._$display.find('.code > div').click(e => {
            const $target = $(e.currentTarget);

            $target.toggleClass("active");
            if ($target.hasClass("active")) {
                this.linesCounter.increment($target.index() + 1);
            } else if (!$target.hasClass("active")) {
                this.linesCounter.decrement($target.index() + 1);
            }
        });

        this._$display.find(".title").click(e => {
            this.collapseDisplay();
        });
    }

    generateHtml() {
        const htmlData = {
            "class": "file", "tag": "div", "children": [
                {"class": "title", "tag": "p", "children": [
                    {"class": "fa fa-caret-down collapse-button", "tag": "i"},
                    {"class": "", "tag": "span", "data": this._file["name"]}
                ]},
                {"class": "display", "tag": "div", "children" : [
                    {"class": "linenums", "tag": "pre"},
                    {"class": "code-container", "tag": "pre", "children": [
                        {"class": "code", "tag": "code", "data": this._file["content"]}
                    ]}
                ]}
            ]
        };

        this._$display = composeHtml(htmlData);
        return this._$display;
    }

    getLineText(lineNum) {
        return this._$display.find(".code div").eq(lineNum).text();
    }

    getSelectedLines() {
        return this.linesCounter.getSelectedLines();
    }

    getFileName() {
        return this._file["name"];
    }

    collapseDisplay() {
        const $display = this._$display.find(".display");
        if (this.displayHeight === undefined) {
            this.displayHeight = $display.height();
        }

        const toHeight = ($display.hasClass("collapsed")) ? this.displayHeight : "0px";
        this._$display.find(".collapse-button").toggleClass("collapsed");
        if (toHeight !== "0px") {
            $display.css("display","flex");
        }
        $display.animate({"height": toHeight}, 300, () => {
            $display.toggleClass("hidden");
            $display.toggleClass("collapsed");
            if (toHeight === "0px") {
                $display.css("display","none");
            }
        });
    }

    /**
     * @param int[] lines
     */
    highlightLines(lines) {
        const $codeLines = this._$display.find(".code > div");
        $codeLines.removeClass("highlighted");

        for(var i = 0; i < lines.length; i++) {
            let line = lines[i];
            $codeLines
                .eq(line)
                .addClass("highlighted")
        }
    }

    removeHighlightedLines() {
        const $codeLines = this._$display.find(".code > div");
        $codeLines.each(index => {
            $codeLines.eq(index).removeClass("highlighted");
        })
    }
}

new PageTracker().update();

const commentList = new CommentList();
const commentEditor = new CommentEditor();
const upvoteService = new UpvoteService();
const userRepo = new UserRepository();
const subKey = getURLParameter("key");
const commentRepo = new CommentRepository(subKey);
const codeDisplay = new CodeDisplayList();
const subRepo = new SubmissionsRepository();


function generateHeaderData(title, desctription, userLogin, tags, postedTime, numOfReviews) {
    const usernameHtml = composeHtml({"tag": "a", "attrs": [{"name": "href", "value": "https://github.com/" + userLogin}], "data": userLogin})

    return [
        {"class": "title", "tag": "h2", "data": title},
        {"class": "description", "tag": "div", "data": desctription},
        {"class": "stats", "tag": "div", "children": [
            {"class": "stat", "tag": "div", "children": [
                {"class" :"fa fa-tag", "tag": "i", "data": " &nbsp; &nbsp;"},
                {"class" :"stat-tags", "tag": "span", "data": tags.split(",").join(", ")},
            ]},

            {"class": "stat", "tag": "div", "children": [
                {"class" :"fa fa-pencil", "tag": "i", "data": " &nbsp; &nbsp;"},
                {"class" :"stat-reviews", "tag": "span", "data": numOfReviews + ((numOfReviews === 1) ? " review" : " reviews")},
            ]},

            {"class" :"stat stat-posted-time", "tag": "p", "data": "posted by " + usernameHtml.get(0).outerHTML + " " + postedTime}
        ]}
    ]
}
subRepo.get(subKey).then(sub => {
    codeDisplay.append(sub.files);
    attachListeners();
    const $header = composeHtml(generateHeaderData(
        sub["context"],
        sub["description"],
        sub["user"]["login"],
        sub["tags"].split(",").join(", "),
        moment(sub["posted_time"]).fromNow(),
        sub["comments"] === undefined ? 0 : Object.keys(sub["comments"]).length
    ));

    $('.header').append($header);
});

commentRepo.getAll().then(commentsData => {
   if (commentsData !== null) {
       commentList.fromData(commentsData);
   }
});