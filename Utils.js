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

class LoginService {
    constructor() {
        this._githubState = "";
    }

    generateGithubAuthLink() {
        const clientId = "d6c63e9c626024140ba6";
        const scope = "user:email user";
        const state = generateUUID();
        const redirectUri = "https://us-central1-d2l-scraper.cloudfunctions.net/registerGithub";

        const authLink = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`

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
            if (localStorage.getItem("current_user") !== null &&
                localStorage.getItem("access_token") !== null) {
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
        return JSON.parse(localStorage.getItem("current_user"));
    }

    getCurrentUserToken() {
        return localStorage.getItem("access_token");
    }
}