// var config = require('./config');
var express = require('express');
var basicAuth = require('basic-auth-connect');
var waterfall = require('async/waterfall');
var ogp = require('ogp-parser');
var _ = require('lodash');
var Slack = require('slack-node');

var app = express();


var user = process.env.BASIC_AUTH_USERNAME || '';
var passwd = process.env.BASIC_AUTH_PASSWORD || '';
var webhookUri = process.env.WEBHOOKURI || '';

if (!user || !passwd || !webhookUri) {
    return;
}

app.use(basicAuth(user, passwd));

var slack = new Slack();
slack.setWebhook(webhookUri);

app.get('/bookmark/:channel', function(req, res) {
    var channel = req.params.channel || '#read_after';
    var query = req.query || {};
    var referrer = query.referrer || '';
    if (!referrer) {
        res.send('Bookmark to ' + channel + ', ' + referrer);
        return;
    }
    waterfall([
        function(cb) {
            ogp.parser(referrer, function(err, data) {
                if (err) {
                    cb(null, {});
                } else {
                    cb(null, {
                        title: _.get(data, 'ogp.og:title.0') || data.title || '',
                        description: _.get(data, 'ogp.og:description.0') || '',
                        url: _.get(data, 'ogp.og:url.0') || referrer,
                        image: _.get(data, 'ogp.og:image.0') || ''
                    });
                }
            }, true);
        },
        function(data, cb) {
            if (_.isEmpty(data)) {
                cb(null, {});
                return;
            }
            slack.webhook({
                channel: channel,
                username: "bookmarkbot",
                attachments: [{
                    // "fallback": "ブックマークしました",
                    "color": "#36a64f",
                    // "pretext": "ブックマークしました",
                    // "author_name": "xyz_i",
                    // "author_link": "http://howtelevision.jp/",
                    "title": data.title,
                    "title_link": data.url,
                    "text": data.description,
                    "image_url": data.image
                }]
            }, function(err, response) {
                cb(err, response);
            });
        }
    ], function (err, result) {
        if (err) {
            res.send('Failed to bookmark to ' + channel + ', ' + referrer);
        } else {
            res.redirect(302, referrer);
            // res.send('Bookmark to ' + channel + ', ' + referrer);
        }
    });
});

app.listen(process.env.PORT || 3000, function() {
  console.log('Example app listening on port ' + (process.env.PORT || 3000));
});
