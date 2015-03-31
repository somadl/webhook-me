'use strict';

/*
 * Load modules
 */
var express = require('express'),
    bodyParser = require('body-parser'),
    yaml = require('js-yaml'),
    fs = require('fs'),
    syncExec = require('sync-exec'),
    path = require('path'),
    app = express(),
    jsonParser = bodyParser.json();

app.conf = yaml.safeLoad(fs.readFileSync('config.yml', 'utf8'));

app.post('/webhook/incoming', jsonParser, function (req, res) {
    var i,
        payload,
        branch,
        command,
        execResult,
        dir,
        repoUrl,
        actualConf;

    payload = req.body;

    // Different repos
    repoUrl = payload.repository ? payload.repository.url : '';
    repoUrl = repoUrl.replace('.git', '');
    if (!payload.repository || !app.conf[repoUrl]){
        return res.status(406)
            .json({message: 'Repository not sent'});
    }

    actualConf = app.conf[repoUrl];
    branch = payload.ref.split('/').pop();

    // Different branches
    if (branch != actualConf.branch){
        return res.status(304)
            .json({message: 'Branch was not found in configuration file'});
    }

    // Resolve path
    dir = path.resolve(actualConf.path);
    if (!fs.existsSync(dir)){
        return res.status(500)
                  .json({path: dir, message: 'Invalid path'});
    }

    // Exec commands
    for (i in actualConf.commands){
        command = actualConf.commands[i];
        execResult = syncExec(command, {cwd: dir});
        if (execResult.status){
            return res.status(500)
                      .json({command: command, error: execResult.stderr });
        }
    }

    res.sendStatus(200);
});

app.listen(3000);
module.exports = app;