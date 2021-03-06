//AWS_REGION='us-east-1' mocha ingest/ingest-sns.spec.js
'use strict';

let assert = require('chai').assert;
let expect = require('chai').expect;
var path = require('path');
let AWS = require('aws-sdk-mock');
AWS.setSDK(path.resolve('./node_modules/aws-sdk'));

let lambda = require('../publish-execute.js');

describe('lambda', function() {
  let _event = {
    "Records": [{
      "Sns": {
        "Message": "{\"userMetadata\": {\"guid\": \"1234\",\"preset\": \"dash\"}}"
      }
    }]
  }

  describe('#handler', function() {

    beforeEach(function() {
      process.env.PublishWorkflow = 'arn:aws:states:us-east-1:::example';
    });

    afterEach(function() {
      AWS.restore('StepFunctions');
      AWS.restore('SNS');
      delete process.env.PublishWorkflow;
    });

    it('should return "Success" when step execute successful', function(done) {

      AWS.mock('StepFunctions', 'startExecution', Promise.resolve('sucess'));

      lambda.handler(_event, null, function(err, data) {
        if (err) done(err);
        else {
          assert.equal(data, 'success');
          done();
        }
      });
    });
    it('should return "Success" when step execute successful', function(done) {

      AWS.mock('StepFunctions', 'startExecution', Promise.reject('step error'));

      AWS.mock('SNS', 'publish', Promise.resolve('sucess'));

      lambda.handler(_event, null, function(err, data) {
        if (err) {
          expect(err).to.equal('step error');
          done();
        } else {
          done('invalid failure for negative test');
        }
      });
    });
    it('should return "Success" when step execute successful', function(done) {

      AWS.mock('StepFunctions', 'startExecution', Promise.reject('step error'));

      AWS.mock('SNS', 'publish', Promise.reject('sns error'));

      lambda.handler(_event, null, function(err, data) {
        if (err) {
          expect(err).to.equal('step error');
          done();
        } else {
          done('invalid failure for negative test');
        }
      });
    });
  });
});
