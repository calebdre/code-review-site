class SubmitButton {
    constructor() {
        this._submitButton = $(".submit-button");
    }

    applyListeners() {
        let repo = new UserRepository();
        this._submitButton.click(e => {
            fileList.saveCurrentData();
            const files = fileList.getFiles().filter(item => {
                return item["name"].trim() !== "" && item["content"].trim() !== "";
            });

            const token = repo.getCurrentUserToken();
            const user = repo.getCurrentUser();
            const submissionData = {
                "user_token": token,
                "user": user,
                "files": files,
                "tags": tags.getTagValues(),
                "context": $("#input-context").val()
            }

            const database = firebase.database();
            const submissionRef = database.ref("/submissions").push(submissionData);
            const submissionRefKey = submissionRef.key;
            database.ref(`users/${token}/submissions`)
                .push(submissionRefKey);
        });
    }
}

class FileList {
    constructor() {
        this._files = [];
        this._fileList = $(".file-list");
        this._nameInput =  $("#input-filename");
        this._activeIndex = 0;
        this._untrackedFileIndex = 0;
    }

    applyListeners() {
        $("#add-file").click(e => {
            const currentFileInfo = {
                "name": $("#input-filename").val(),
                "content": editor.getValue()
            };

            this.append(currentFileInfo);
        });
    }

    append(fileInfo) {
        const duplicateIndex = this._files.reduce((accumulator, item, index) => {
            return item["name"] === fileInfo["name"] ? index : accumulator;
        }, -1);

        if (duplicateIndex !== -1) {
            const el = this._fileList.find(".file").eq(duplicateIndex);

            el.addClass("bounce");
            this._nameInput.prop("disabled", true)
            setTimeout(() => {
                el.removeClass("bounce");
                this._nameInput.prop("disabled", false)
            }, 1200);

            return;
        }

        const elData = {"class": "file", "tag": "li", "children": [
            {"class": "file-name", "tag": "span", "data": fileInfo["name"]},
            {"class": "close", "tag": "button", "data": "x"}
        ]};

        const $html = composeHtml(elData);

        this._files.push(fileInfo);
        this._fileList.append($html);;
        $html.find(".close").click(e => {
            this.remove($(e.currentTarget).parent().index());
        });
        $html.click(e => {
            const selectedIndex = $(e.currentTarget).index();
            if (this._activeIndex === selectedIndex) {
                this.show(this._untrackedFileIndex);
            } else {
                this.show(selectedIndex);
            }
        })

        this._activeIndex = this._files.length;
        this._untrackedFileIndex = this._files.length;
        this._nameInput.val("");
        editor.setValue("");
    }

    saveCurrentData() {
        this._files[this._activeIndex] = {
            name: this._nameInput.val(),
            content: editor.getValue()
        }
        this._fileList.find(".file")
            .eq(this._activeIndex)
            .find(".file-name")
            .text(this._nameInput.val())
    }

    show(index) {
        this.saveCurrentData();
        const fileData = this._files[index];
        this._fileList
            .find(".file.active")
            .removeClass("active");

        this._fileList
            .find(".file")
            .eq(index)
            .addClass("active");

        this._nameInput.val(fileData["name"]);
        editor.setValue(fileData["content"]);
        this._activeIndex = index;
    }

    remove(index) {
        this._files.splice(index, 1);
        this._fileList
            .find(".file")
            .eq(index)
            .remove();

        this._nameInput.val("");
        editor.setValue("");
    }

    getFiles() {
        return this._files;
    }
}

//https://dribbble.com/shots/1856405-Taringa-Creacion-de-post
CodeMirror.modeURL = "/code_review_site_not_react/mode/%N/%N.js"
var editor = CodeMirror.fromTextArea($("#input-code").get(0), {
    "lineNumbers": true,
    "placeholder": "console.log('Hello world!');"
});

const tags = new Taggle("input-tags", {
    duplicateTagClass: 'bounce',
    placeholder: "Type some tags related to your code"
})
$("#input-filename").keyup((e) => {
    const input = $(e.currentTarget).val();
    const info = CodeMirror.findModeByFileName(input);
    if (info) {
        editor.setOption("mode", info.mime);
        CodeMirror.autoLoadMode(editor, info.mode)
        $(".file-type").text(`${info.name}`);
    }
});

const filetypeData = {
    "class": "file-type", "tag": "span"
};

$(".CodeMirror").append(composeHtml(filetypeData));

let fileList = new FileList();
fileList.applyListeners();
new SubmitButton().applyListeners();