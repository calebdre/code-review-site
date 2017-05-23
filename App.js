async function fetchReviews() {
    let t = await fetch("comments.json")
        .then((r) => r.json())
    return t;
}

function attachEditor(index) {
    const $line = $(".linenums div").eq(index);
    $line.addClass("active");

    const $elem = $("#code > div");
    $elem.eq(index)
        .data("haseditor", "true")
        .append(
            $("<textarea>", {
                "class": "comment-editor"
            }));
    const $editor = $elem.find("textarea");
    const augmentedEditor = new SimpleMDE({
        element: $editor[0]
    });
    $editor.data("editor", augmentedEditor);
}

function detachEditor(index) {
    $(".linenums div")
        .eq(index)
        .removeClass("active");

    const $el = $("#code > div").eq(index);
    const editor = $el.find("textarea")
        .eq(0)
        .data("editor");

    if (editor === undefined ) {
        return;
    }

    editor.toTextArea();
    $el.find("textarea")
        .eq(0)
        .data("editor", null)

    const find = $el
        .find("div")
        .get(0)
        .outerHTML;

    const newHtml = $(find).click(onLineClick);
    $el.html(newHtml);
}

function calculateEditorPosition(currentActiveIndex) {
    const $activeEls = $("#code > div.active");
    const $lastActiveEl = $activeEls.last();
    if ($activeEls.length > 0 && $lastActiveEl.index() !== currentActiveIndex) {
        if ($activeEls.length !== 1) {
            detachEditor(currentActiveIndex)
        }
        attachEditor($lastActiveEl.index());
    }
}

function onLineClick(e) {
    const $target = $(e.currentTarget).parent();
    const lastEditorPosition = $("#code > div.active").last().index();

    $target.toggleClass("active");
    if ($target.hasClass("active")) {
        calculateEditorPosition(lastEditorPosition);
    } else if (!$target.hasClass("active") && $target.index() === lastEditorPosition) {
        detachEditor(lastEditorPosition);
        calculateEditorPosition($target.index());
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

    $("#code > div").mouseenter((e) => {
        if (window.isMouseDown === true) {
            $(e.currentTarget).toggleClass("active");
        }
    });
}

function applyComment(comment) {
    $(".linenums")
        .find("div")
        .eq(comment.line - 1)
        .addClass("highlight")
}

function applyReview(item) {
    item["comments"].forEach((comment => {
        applyComment(comment);
    }));
}

$('document').ready(() => {
    generateLineNumbers();
    transformCodeHtml();
    attachListeners();
    let e = new SimpleMDE({
        element: $("#commentbox").get(0)
    });
    const reviews = fetchReviews();
    reviews.then((r) => {
        r['reviews'].forEach((item) => {
            applyReview(item);
        });
    })
})