// import GitHub from './GitHub';

$(function() {



    var approveStatus = function(status, url) {
        switch (status) {
        case 'approved':
            return '<a class="text-success" href="' + url + '"><span class="glyphicon glyphicon-ok"></span><span class="hidden">1</span></a>';
        case 'pending_review':
            return '<a class="text-primary" href="' + url + '"><span class="glyphicon glyphicon-eye-open"></span><span class="hidden">2</span></a>';
        case 'pending_changes':
            return '<a class="text-danger" href="' + url + '"><span class="glyphicon glyphicon-wrench"></span><span class="hidden">3</span></a>';
        default:
            return '<span class="text-muted">&mdash;<span class="hidden">4</span></span>';
        }
    };

    var updateApprovalStatus = function(githubAPI, repo, pull, cb) {
        githubAPI.getPullRequestReviews(repo, pull, function(err, reviews) {
            var approve_status = 'pending_review'

            for (var i = 0; i < reviews.length; i++) {
                var review = reviews[i];

                if (review.state === 'CHANGES_REQUESTED') {
                    approve_status = 'pending_changes';
                    break;
                } else if (review.state === 'APPROVED') {
                    approve_status = 'approved';
                }
            }


            $('#pull-' + pull.id + ' .approve').html(approveStatus(approve_status, pull.html_url));
            $("#pull-requests").trigger("update");

            cb(err);
        });
    };

    var verifyStatus = function(status) {
        switch (status) {
        case 'success':
            return '<span class="text-success"><span class="glyphicon glyphicon-ok"></span><span class="hidden">1</span></span>';

        case 'pending':
            return '<span class="text-primary"><span class="glyphicon glyphicon-time"></span><span class="hidden">3</span></span>';
        case 'error':
        case 'failure':
            return '<span class="text-danger"><span class="glyphicon glyphicon-remove"></span><span class="hidden">2</span></span>';
        default:
            return '<span class="text-muted">&mdash;<span class="hidden">4</span></span>';
        }
    };

    var updateVerificationStatus = function(githubAPI, repo, pull, cb) {
        githubAPI.getStatuses(repo, pull.head.sha, function(err, status) {
            if (status.statuses.length > 0) {
                $('#pull-' + pull.id + ' .verify').html(verifyStatus(status.state));
                $("#pull-requests").trigger("update");
            }

            cb(err);
        });
    };

    var refresh = function() {
        if ((localStorage['username'] && localStorage['password']) || localStorage['token']) {
            $('#auth').html('<li><p class="navbar-text">Connecting...</p></li>');
            $('#pull-requests tbody').html('');

            if (localStorage['token']) {
                options = {
                    token: localStorage['token'],
                    auth: 'oauth',
                };
            } else {
                options = {
                    username: localStorage['username'],
                    password: localStorage['password'],
                    auth: 'basic',
                };
            }

            var githubAPI = new GitHub(options);

            githubAPI.getUser(function(err, user) {
                if (err) {
                    localStorage.removeItem('password');
                    localStorage.removeItem('token');
                    refresh();
                } else {
                    var template = Handlebars.compile($("#auth-signed-in-template").html());
                    $('#auth').html(template({
                        user: user,
                    }));

                    githubAPI.getUserRepos(function(err, repos) {
                        repos = repos.sort(function compare(a, b) {
                            return a.full_name.localeCompare(b.full_name);
                        })

                        var filteredRepos = [];
                        var repoFilter = localStorage['repo-filter'];
                        if (typeof repoFilter == 'undefined' || repoFilter.length <= 0) {
                            filteredRepos = repos
                        } else {
                            var repoFilter = new RegExp(repoFilter);
                            $.each(repos, function(i, repo) {
                                if (repo.name.match(repoFilter) == null) {
                                   filteredRepos.push(repo);
                                }
                            });
                        }

                        async.forEach(filteredRepos, function(repo, cb) {
                            async.waterfall([
                                function(cb) {
                                    // Get the pull requests for this repo
                                    githubAPI.getRepoPulls(repo, function(err, pulls) {
                                        if (pulls.length > 0) {
                                            $.each(pulls, function(i, pull) {
                                                pull.created_at_humanized = new Date(Date.parse(pull.created_at)).toLocaleString();
                                            });

                                            var template = Handlebars.compile($("#pull-requests-rows-template").html());
                                            $('#pull-requests tbody').append(template({
                                                repo: repo,
                                                pulls: pulls,
                                            }));
                                            $("#pull-requests").trigger("update");
                                        }

                                        cb(err, pulls);
                                    });
                                },
                                function(pulls, cb) {
                                    var tasks = [];

                                    $.each(pulls, function(i, pull) {
                                        tasks.push(function() {
                                            updateVerificationStatus(githubAPI, repo, pull, cb);
                                        });
                                        tasks.push(function() {
                                            updateApprovalStatus(githubAPI, repo, pull, cb);
                                        });
                                    });

                                    async.parallel(tasks, function(err, results) {
                                        cb(err);
                                    });
                                },
                            ], function(err) {
                                cb(err);
                            });
                        });

                    });
                }
            });
        } else {
            var template = Handlebars.compile($("#auth-not-signed-in-template").html());
            $('#auth').html(template());
        }
    }

    $('#auth-modal').on('shown.bs.modal', function() {
        $('#auth-modal-username').focus();
    });

    $(document).on('click', '.auth-sign-out', function() {
        localStorage.removeItem('password');
        localStorage.removeItem('token');
        refresh();

        return false;
    });

    $(document).on('click', '.auth-sign-in', function() {
        $('#auth-modal-username').val(localStorage['username']);
        $('#auth-modal-password').val('');
        $('#auth-modal-token').val('');
        $('#auth-modal').modal('show');

        return false;
    });

    $(document).on('click', '#auth-modal-connect', function() {
        localStorage['username'] = $('#auth-modal-username').val();
        localStorage['password'] = $('#auth-modal-password').val();
        localStorage['token'] = $('#auth-modal-token').val();
        refresh();

        $('#auth-modal').modal('hide');

        return false;
    });

    $.extend($.tablesorter.themes.bootstrap, {
        table: 'table',
        sortNone: '',
        sortAsc: 'glyphicon glyphicon-chevron-up',
        sortDesc: 'glyphicon glyphicon-chevron-down',
    });

    $.tablesorter.addParser({
        id: 'datadate',
        is: function() {
            return false;
        },
        format: function(s, table, cell, cellIndex) {
            return $(cell).data('date');
        },
        type: 'text'
    });

    var filter = localStorage['repo-filter'];
    $('#repo-filter').val(filter);

    $('#repo-filter').change(function() {
        localStorage['repo-filter'] = $('#repo-filter').val();
        refresh();
    });

    $('#repo-filter').closest('form').submit(function(event) {
        localStorage['repo-filter'] = $('#repo-filter').val();
        return false;
    });

    $("#pull-requests").tablesorter({
        theme: 'bootstrap',
        headerTemplate: '{content} {icon}',
        widgets: [ "uitheme" ],
        headers: { 3: { sorter: 'datadate' } },
        sortList: [[3,1]],
    });

    refresh();
});
