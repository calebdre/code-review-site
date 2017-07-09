// Initialize Firebase
var config = {
    apiKey: "AIzaSyCeeGGImxoRGjokqulhtW791YpsreZpA8o",
    authDomain: "d2l-scraper.firebaseapp.com",
    databaseURL: "https://d2l-scraper.firebaseio.com",
    projectId: "d2l-scraper",
    storageBucket: "d2l-scraper.appspot.com",
    messagingSenderId: "610068683551"
};
firebase.initializeApp(config);

function getURLParameter(name) {
    return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function pick(what, from) {
    return what.reduce((accumulator, iteration) => {
        if(from.hasOwnProperty(iteration)) {
            accumulator[iteration] = from[iteration];
        }
        return accumulator;
    }, {});
}

/**
 * @param Object data
 * @returns $
 */
function composeHtml(data) {
    const dataItem = Array.isArray(data) ? data[0] : data;

    if (!dataItem.hasOwnProperty("tag")) {
        throw "Tag is required";
    }

    dataItem["tag"] = `<${dataItem["tag"]}>`;
    const $el = $(dataItem["tag"]);

    if (dataItem.hasOwnProperty("class")) {
        $el.addClass(dataItem["class"]);
    }

    if (dataItem.hasOwnProperty("id")) {
        $el.addClass(dataItem["id"]);
    }

    if (dataItem.hasOwnProperty("data")) {
        $el.html(dataItem["data"]);
    }

    if (dataItem.hasOwnProperty("attrs")) {
        if (!Array.isArray(dataItem["attrs"])) {
            throw "attr must be an array";
        }
        dataItem["attrs"].forEach(attr => {
           $el.attr(attr["name"], attr["value"]);
        });
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

function replaceObjeysByKeyWithArray(obj) {
    return Object.keys(obj).reduce((accumulator, item) => {
        let newItem = obj[item];
        newItem["key"] =  item;
        accumulator.push(newItem);
        return accumulator;
    }, []);
}

class LoginService {
    constructor() {
        this._githubState = "";
    }

    /**
     * @param boolean redirect
     * @returns string
     */
    generateGithubAuthLink(redirect) {
        const clientId = "d6c63e9c626024140ba6";
        const scope = "user:email user";
        const state = generateUUID();
        const redirectUri = "https://us-central1-d2l-scraper.cloudfunctions.net/registerGithub";
        const r = redirect === undefined || !redirect ? 0 : 1;

        const authLink = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&redirect=${r}`;

        this._githubState = state;
        return authLink;
    }

    recordLoginAttempt() {
        return new Promise((resolve, reject) => {
            const database = firebase.database();
            let attemptData = {}
            attemptData[this._githubState] = "not completed"
            database.ref("github-login-attempts")
                .set(attemptData)
                .then(ignored => {
                    resolve();
                });
        });
    }
}

class SubmissionsRepository {
    constructor() {
        this.database = firebase.database();
    }

    async all() {
        const t = await this.database.ref("/submissions").once("value");
        const subs = t.val();
        return replaceObjeysByKeyWithArray(subs);
    }

    async get(key) {
       return (await this.database.ref(`submissions/${key}`).once("value")).val();
    }
}

class CommentRepository {
    constructor(submissionKey) {
        this.database = firebase.database();
        this.submissionKey = submissionKey;
    }

    _comment(props) {
        return pick([
            "user",
            "postTime",
            "commentHtml",
            "lines"
        ], props);
    }

    async getAll() {
        return replaceObjeysByKeyWithArray((await this.database.ref(`submissions/${this.submissionKey}/comments`).once("value")).val());
    }

    async create(comment) {
        comment = this._comment(comment);
        if (Object.keys(comment).length === 0) {
            throw "supplied params don't match what is needed to create a new comment";
        }

        await this.database.ref(`submissions/${this.submissionKey}/comments`)
            .push(comment);
    }
}

class UpvoteService {
    constructor() {
        this.database = firebase.database();
    }

    /**
     * returns true if the vote was recorded, false if the user has already upvoted
     *
     * @param String userKey
     * @param String commentKey
     * @returns {success: boolean, upvote_count: number, action: String}
     */
    async recordUpvote(submissionKey, userKey, commentKey) {
        const path = `submissions/${submissionKey}/comments/${commentKey}/upvotes`;
        const upvotesRef = await (this.database.ref(path));
        const upvotes = await upvotesRef.once("value");
        const oldVotesCount = upvotes.numChildren();

        if (upvotes.exists) {
            if (!upvotes.hasChild(userKey)) {
                upvotesRef
                    .child(userKey)
                    .set(1);

                var success = true;
                var action = "added";
                var newVotesCount = oldVotesCount + 1;
            } else {
                upvotesRef
                    .child(userKey)
                    .remove();
                var action = "removed";
                var success = true;
                var newVotesCount = oldVotesCount - 1;
            }
        } else {
            // this can't happen, right?
            var success = false;
        }

        return {
            "success": success,
            "action": action,
            "upvote_count": newVotesCount
        };
    }
}

class UserService {

    async getUsedLanguages(accessToken) {
        let headers = new Headers();
        headers.append("Accept", "application/vnd.github.v3+json");
        headers.append("Authorization", "token " + accessToken);
        const  data = await fetch("https://api.github.com/user/repos", {
            headers: headers,
            method: "GET"
        }).then(response => response.json());

        return data
            .map(item => item["language"])
            .filter((item, pos, self) => self.indexOf(item) === pos)
            .filter(item => item !== null);
    }
}

class PageTracker {
    update() {
        localStorage.setItem("current_page", window.location);
    }

    getLastStoredPage(){
        return localStorage.getItem("current_page");
    }
}

class UserRepository {
    constructor() {
        this.database = firebase.database();
    }

    _user(props) {
        return pick([
            "avatar_url",
            "email",
            "name",
            "login",
            "url"
        ], props);
    }

    async getOrCreateGithubUser(accessToken) {
        return await new Promise((resolve, reject) => {
            if (localStorage.getItem("current_user") !== null &&
                localStorage.getItem("access_token") !== null) {
                resolve(JSON.parse(localStorage.getItem("current_user")));
                return;
            }
            this.database.ref("users")
                .child(accessToken)
                .once("value", async (snapshot) => {
                    if (snapshot.val() === null) {
                        resolve(await this.createUser(accessToken));
                    } else {
                        const user = this._user(snapshot.val());
                        const preferredLanguages = await new UserService().getUsedLanguages(accessToken);
                        localStorage.setItem("current_user", JSON.stringify(user));
                        localStorage.setItem("access_token", accessToken);
                        localStorage.setItem("preferred_languages", preferredLanguages.join(","));

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
        const preferredLanguages = await new UserService().getUsedLanguages(accessToken);
        localStorage.setItem("preferred_languages", preferredLanguages.join(","));
        return user;
    }

    isUserLoggedIn() {
        return localStorage.getItem("current_user") !== null;
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem("current_user"));
    }

    getCurrentUserToken() {
        return localStorage.getItem("access_token");
    }

    getCurrentUserPrefferedLanguages() {
        return localStorage.getItem("preferred_languages");
    }
}