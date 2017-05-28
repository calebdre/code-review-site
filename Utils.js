/**
 * @param Object data
 * @returns $
 */
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

function generateUUID () { // Public Domain/MIT
    var d = Date.now();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function'){
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}