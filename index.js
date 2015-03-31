'use strict';

/*
 * Load modules
 */
var express = require('express'),
    bodyParser = require('body-parser'),
    yaml = require('js-yaml'),
    fs = require('fs'),
    syncExec = require('sync-exec'),
    moment = require('moment'),
    path = require('path'),
    app = express(),
    jsonParser = bodyParser.json(),
    serverPort,
    confFile = 'config.yml',
    winston = require('winston'),
    logFileOutput = './log.txt',
    logger;

// Gets commandline args
process.argv.forEach(function (val, index, array) {
    if (!val){
        return 0;
    }
    if (val === '--conf' || val === '-c'){
        confFile = array[index+1] || confFile;
    } else if (val === '--port' || val === '-p'){
        serverPort = array[index+1] || serverPort;
    } else if (val === '--log' || val === '-l'){
        logFileOutput = array[index+1] || logFileOutput;
    }
});

app.conf = yaml.safeLoad(fs.readFileSync(confFile, 'utf8'));

// Gets server config
if (app.conf.server){
    serverPort = serverPort || app.conf.server.port;
    logFileOutput = logFileOutput || app.conf.server.logFile;
}

// Log file output
logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ level: 'info' }),
        new (winston.transports.File)({ filename: logFileOutput })
    ]
});

app.post('/webhook/incoming', jsonParser, function (req, res) {
    var i,
        payload,
        branch,
        command,
        execResult,
        dir,
        repoUrl,
        actualConf,
        errorMsg,
        start,
        date;

    start = moment();
    payload = req.body;
    logger.info('Starting deploy!');

    // Different repos
    repoUrl = payload.repository ? payload.repository.url : '';
    repoUrl = repoUrl.replace('.git', '');
    if (!payload.repository || !app.conf || !app.conf.deploys[repoUrl]){
        errorMsg = 'Invalid repository';
        logger.error(errorMsg, req.body);
        return res.status(406)
            .json({message: errorMsg});
    }

    actualConf = app.conf.deploys[repoUrl];
    branch = payload.ref.split('/').pop();

    // Different branches
    if (branch != actualConf.branch){
        errorMsg = 'Branch was not found in configuration file';
        logger.error(errorMsg, req.body);
        return res.status(304)
            .json({message: errorMsg});
    }

    // Resolve path
    dir = path.resolve(actualConf.path);
    if (!fs.existsSync(dir)){
        errorMsg = 'Invalid path';
        logger.error(errorMsg, req.body);
        return res.status(500)
                  .json({path: dir, message: errorMsg});
    }
    res.sendStatus(200);

    // Exec commands
    for (i in actualConf.commands){
        command = actualConf.commands[i];
        logger.info('Running: ' + command);
        execResult = syncExec(command, {cwd: dir});
        if (execResult.status){
            logger.error('Command error!',
                {command: command, error: execResult.stderr });
        }
    }

    date = moment() - start;
    logger.info('Deploy finished! (' + moment.utc(date).format('HH:mm:ss') + ')');
});

serverPort = serverPort || 3000;
logger.info('Starting web server...');
app.listen(serverPort);
logger.info('Server running on port ' + serverPort);
module.exports = app;