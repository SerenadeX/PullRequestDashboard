class GitHub {

    constructor(options) {
        this._username = options.username;
        this._password = options.password;
        this._token = options.token;
        this._auth = options.auth;
    }

    getUser(cb) {
        if (this._username != null) {
            cb(null, this._username);
        } else {
            this._request("GET", "/user", null, function(err, user) {
                cb(err, user);
            });
        }
    }

    getUserRepos(cb, page, previous_repos) {
        page = page || 1;
        previous_repos = previous_repos || [];
        var self = this
        this._request("GET", "/user/repos?page=" + page + "&per_page=200", null, function(err, repos) {
            if (repos && repos.length > 0) {
                self.getUserRepos(cb, page + 1, previous_repos.concat(repos));
            } else {
                cb(err, previous_repos);
            }
        })
    }

    getRepoPulls(repo, cb) {
        this._request("GET", "/repos/" + repo.full_name + "/pulls?state=open", null, function(err, pulls) {
           cb(err, pulls);
        });
    }

    getStatuses(repo, sha, cb) {
        this._request("GET", "/repos/" + repo.full_name + "/commits/" + sha + "/status", null, function(err, status) {
           cb(err, status);
        });
    }

    getPullRequestReviews(repo, pull, cb) {
        this._request("GET", "/repos/" + repo.full_name + "/pulls/" + pull.number + "/reviews", null, function(err, reviews) {
            cb(err, reviews);
        });
    }

    _request(method, path, data, cb) {
        var url = "https://api.github.com" + path;
        var xhr = new XMLHttpRequest();

        xhr.open(method, url, true);
        xhr.onreadystatechange = function() {
            if (this.readyState == 4) {
                if (this.status >= 200 && this.status < 300 || this.status === 304) {
                    cb(null, JSON.parse(this.responseText));
                } else {
                    cb({path: path, request: this, error: this.status});
                }
            }
        }
        xhr.setRequestHeader('Accept', 'application/vnd.github.raw+json');
        xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
        if (this._token) {
            xhr.setRequestHeader('Authorization', 'token ' + options.token)
        } else if (this._username && this._password) {
            xhr.setRequestHeader('Authorization', 'Basic ' + Base64.encode(auth.username + ':' + auth.password));
        } else {
            cb({path: path, request: this, error: "No authentication"})
        }
        data ? xhr.send(JSON.stringify(data)) : xhr.send()
    }

}
