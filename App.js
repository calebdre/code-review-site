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
        const upvotes = this._data.upvotes === undefined ? 0 : this._data.upvotes;
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
                        {"class": "fa fa-caret-up", "tag": "i"},
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

    applyHoverListener() {
        // $("");
    }

    bindListeners($html) {
        $html.find(".view-code").click(e => {
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
            toolbar: ["code", "preview", "guide"],
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
                "commentHtml": showdownConverter.makeHtml(this.getCommentMarkdown()),
                "lines": fileData
            };

            commentRepo.create(commentData);
            commentList.append(new UserComment(commentData));
        });
    }

    getCommentMarkdown() {
        return this._editor.value();
    }

    togglePreview(){
        this._editor.togglePreview();
    }

    pasteSelectedLines() {
        let selectedLinesByFile = codeDisplay.getSelectedLines();
        const keys = Object.keys(selectedLinesByFile);
        let linesContent = "";
        for(var i = 0; i < keys.length; i++){
            let lines = selectedLinesByFile[keys[i]];
            const display = codeDisplay.getCodeDisplay(i);
            lines.forEach(lineNum => {
                linesContent += display.getLineText(lineNum) + "\n";
            });
        }

        this._editor.codemirror.replaceSelection(linesContent);
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
        // this._refreshText();
    }

    decrement(index) {
        this._count--;
        this.selectedLines.splice(this.selectedLines.indexOf(index), 1);
        // this._refreshText();
    }

    getSelectedLines() {
        return this.selectedLines;
    }

    _refreshText() {
        this._$counterEl.text(this._count + " lines selected.");
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
    }

    generateHtml() {
        const htmlData = {
            "class": "file", "tag": "div", "children": [
                {"class": "title", "tag": "p", "data": this._file["name"]},
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
}

const commentList = new CommentList();
const commentEditor = new CommentEditor();
const showdownConverter = new showdown.Converter({
    "headerLevelStart": 5,
    "tables": true
});
const userRepo = new UserRepository();
const subKey = getURLParameter("key");
const commentRepo = new CommentRepository(subKey);
const subRepo = new SubmissionsRepository();
const codeDisplay = new CodeDisplayList();

subRepo.get(subKey).then(sub => {
    codeDisplay.append(sub.files);
    attachListeners();
});

commentRepo.getAll().then(commentsData => {
   if (commentsData !== null) {
       commentList.fromData(commentsData);
   }
});