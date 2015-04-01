var app = require('../index'),
    request = require('supertest'),
    fs = require('fs'),
    agent = request.agent(app),
    payloadGithub = require('./fixtures/payload-github'),
    payloadCircleCi = require('./fixtures/payload-circleci'),
    clone = require('clone'),
    yaml = require('js-yaml');


describe('webhook-me', function() {

    // Tear up
    before(function(done){
        app.conf = yaml.safeLoad(fs.readFileSync('./test/fixtures/config.yml', 'utf8'));
        done();
    });

    // 200
    it('should post webhook github payload', function(done) {
        agent.post('/webhook/incoming')
            .send(payloadGithub)
            .expect(200)
            .end(function(err, res) {
                if (err){
                    throw err;
                }
                done();
            });
    });

    // 200
    it('should post webhook circleci payload', function(done) {
        agent.post('/webhook/incoming')
            .send(payloadCircleCi)
            .expect(200)
            .end(function(err, res) {
                if (err){
                    throw err;
                }
                done();
            });
    });

    // 406
    it('should validate url', function(done) {
        var wrongPayload = clone(payloadGithub);
        wrongPayload.repository.url = 'http://wrong-url.com';
        agent.post('/webhook/incoming')
            .send(wrongPayload)
            .expect(406)
            .end(function(err) {
                if (err){
                    throw err;
                }
                done();
            });
    });

    // 304
    it('should validate branch', function(done) {
        var wrongPayload = clone(payloadGithub);
        wrongPayload.ref = '/wrong/branch';
        agent.post('/webhook/incoming')
            .send(wrongPayload)
            .expect(304)
            .end(function(err) {
                if (err){
                    throw err;
                }
                done();
            });
    });

    // 500
    it('should validate wrong path', function(done) {
        var wrongPayload = clone(payloadGithub);
        wrongPayload.repository.url = 'http://www.wrong-path.com/command';
        agent.post('/webhook/incoming')
            .send(wrongPayload)
            .expect(500)
            .end(function(err) {
                if (err){
                    throw err;
                }
                done();
            });
    });

    // 500
    it('should validate wrong parser', function(done) {
        var originalConf = clone(app.conf);
        app.conf.deploys.webhookme.type = 'invalid';
        agent.post('/webhook/incoming')
            .send(payloadGithub)
            .expect(500)
            .end(function(err) {
                if (err){
                    throw err;
                }
                app.conf = originalConf;
                done();
            });
    });
});