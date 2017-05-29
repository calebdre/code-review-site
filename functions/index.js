var functions = require('firebase-functions');
var https = require("https");
var admin = require('firebase-admin');

admin.initializeApp(functions.config().firebase);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
exports.registerGithub = functions.https.onRequest((req, res) => {
    var params = {
        "client_id":"d6c63e9c626024140ba6",
        "client_secret": "b92e42b2274c6d46e754e76b198be3faf7106bd8",
        "code": req.query.code,
        "state": req.query.state
    }

    params = require('querystring').stringify(params);
    var r = https.request({
        "protocol": "https:",
        "host":"github.com",
        "path": "/login/oauth/access_token",
        "method": "POST",
        "headers": {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(params),
            "Accept": "application/json"
        }
    }, (e) => {
        e.setEncoding('utf8');
        var data = "";
        e.on("data", (chunk) => {
            data += chunk;
        });

        e.on("end", () => {
            console.log("ended - here's the data: " + data);
            var responseData = JSON.parse(data);
            const database = admin.database();
            database.ref("/github-login-attempts/" + req.query.state)
                .remove()
                .then(ignored => {
                    res.redirect(303, "http://localhost:8080?login_code=" + req.query.state + "&access_token=" + responseData.access_token);
                });
        });
    });

    r.write(params);
    r.end();
});