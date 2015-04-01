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
    nodemailer = require('nodemailer'),
    parsers = require('./parsers/payload'),
    confFile = 'config.yml',
    winston = require('winston'),
    logFileOutput = './log.txt',
    transporter,
    sendEmail,
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

// Email config
if (app.conf.email){
    transporter = nodemailer.createTransport({
        service: app.conf.email.provider,
        auth: {
            user: app.conf.email.login,
            pass: app.conf.email.password
        }
    });
}

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

// Sends email to admin
sendEmail = function(subject, body){
    var mailOptions = {
        from: 'Webhook <'+app.conf.email.login+'>', // sender address
        to: app.conf.email.to, // list of receivers
        subject: subject, // Subject line
        html: body // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, function(error, info){
        if(error){
            logger.error(error);
        }else{
            logger.info('Message sent: ' + info.response);
        }
    });
};

app.post('/webhook/incoming', jsonParser, function (req, res) {
    var i,
        payload,
        command,
        execResult,
        dir,
        actualConf,
        errorMsg,
        start,
        date,
        name,
        parsedData;

    start = moment();
    payload = req.body;
    logger.info('Starting deploy!');

    for (name in app.conf.deploys){
        actualConf = app.conf.deploys[name];

        // Invalid parser config
        if (!parsers[actualConf.type]){
            errorMsg = 'Invalid parser config';
            logger.error(errorMsg);
            return res.status(500)
                .json({parser: actualConf.type, message: errorMsg});
        }

        parsedData = parsers[actualConf.type](payload);

        // Url matches
        if (parsedData.url != actualConf.url){
            continue;
        }

        // Different repos
        parsedData.url = parsedData.url.replace('.git', '');
        // Different branches
        if (parsedData.branch != actualConf.branch){
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
                sendEmail('Server is burn!', '<h1>'+actualConf.name+'</h1><p>Command error</p><br/><br/> ' +
                    JSON.stringify(execResult));
                return 0;
            }
        }

        date = moment() - start;
        logger.info('Deploy finished! (' + moment.utc(date).format('HH:mm:ss') + ')');
        return sendEmail(actualConf.name+' deploy finished!', 'Deploy finished! (' +
            moment.utc(date).format('HH:mm:ss') + ')');
    }

    // No repository error
    errorMsg = 'Invalid repository';
    logger.error(errorMsg, req.body);
    return res.status(406)
        .json({message: errorMsg});
});

serverPort = serverPort || 3000;
logger.info('Starting web server...');
app.listen(serverPort);
logger.info('Server running on port ' + serverPort);
module.exports = app;