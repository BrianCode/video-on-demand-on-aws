/*********************************************************************************************************************
 *  Copyright 2016 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance        *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://aws.amazon.com/asl/                                                                                    *
 *                                                                                                                    *
 *  or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

/**
 * @author Solution Builders
 Cloudformation custom resource to create and configure resources as part of the cloudformation deployment.
 Each Create resource has a corrisponding delete functions to clean up the resource on a Stack Delete
 **/
'use strict';
const fs = require('fs');
const response = require('cfn-response');
const s3Config = require('./lib/s3.js');
const cfConfig = require('./lib/cloudfront.js');
const etsConfig = require('./lib/ets.js');
const stepFunctions = require('./lib/step-functions.js');
const MetricsHelper = require('./lib/metrics-helper.js');
const uuid = require('uuid');
const moment = require('moment');
const metricsHelper = new MetricsHelper();

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (event.RequestType === 'Create') {

    switch (event.ResourceProperties.Resource) {

      case 'StepFunction':
        // Creates the Ingest Process and Publish workflow step functions
        stepFunctions.createSteps(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS,responseData,responseData.StepsArn);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'S3':
        //Conigures the s3 source bucket notification configuration to trigger the ingest-execute Lambda function
        s3Config.s3Notification(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'Watermark':
        //uploads an example watermark file to the s3 source bucket
        s3Config.putObject(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'CloudFrontIdentity':
        // creates a CloudFrontIdentity for the ABR destination bucket
        cfConfig.createIdentity(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS, responseData);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'Pipeline':
        // Creates the MP4 and ABR Elastic Transcoder Pipelines
        etsConfig.createPipeline(event)
          .then(responseData => {
            response.send(event, context, response.SUCCESS, responseData, responseData.PipelineId);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'Presets':
        // Creates the MP4 and ABR Elastic Transcoder custom presets for MP4, HLS and DASH
        etsConfig.createPreset()
          .then(responseData => {
            response.send(event, context, response.SUCCESS,responseData);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case ('SendMetric'):
        //Sends annonomous useage data to AWS
        let metric = {
            Solution: event.ResourceProperties.SolutionId,
            UUID: event.ResourceProperties.UUID,
            TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
            Data: {
                Version: event.ResourceProperties.Version,
                Launched: moment().utc().format()
            }
        };

        metricsHelper.sendAnonymousMetric(metric, function(err, data) {
          if (err) {
            console.log(err, err.stack);
          } else {
            console.log('data sent: ', metric);
            response.send(event, context, response.SUCCESS);
            return;
          }
        });
        break;

      case ('UUID'):
        //Creates a UUID for the MetricsHelper function
        let responseData = {
          UUID: uuid.v4()
        };
        response.send(event, context, response.SUCCESS, responseData);
        break;

      default:
        console.log('no case match, sending success response');
        response.send(event, context, response.SUCCESS);
        // defualt response if Resource or RequestType (delete update) not defined.
    }

  }

  if (event.RequestType === 'Delete') {

    switch (event.ResourceProperties.Resource) {

      case 'StepFunction':

        stepFunctions.deleteSteps(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'Pipeline':

        etsConfig.deletePipeline(event)
          .then(() => {
            response.send(event, context, response.SUCCESS);
          })
          .catch(err => {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case 'Presets':

        etsConfig.deletePreset()
          .then(res => {
            console.log(res);
            response.send(event, context, response.SUCCESS);
          })
          .catch(function(err) {
            console.log(err, err.stack);
            response.send(event, context, response.FAILED);
          });
        break;

      case ('SendMetric'):

        let metric = {
            Solution: event.ResourceProperties.solutionId,
            UUID: event.ResourceProperties.UUID,
            TimeStamp: moment().utc().format('YYYY-MM-DD HH:mm:ss.S'),
            Data: {
                Version: event.ResourceProperties.version,
                Deleted: moment().utc().format()
            }
        };

        metricsHelper.sendAnonymousMetric(metric, function(err, data) {
          if (err) {
            console.log(err, err.stack);
          } else {
            console.log('data sent');
            response.send(event, context, response.SUCCESS);
            return;
          }
        });
        break;

      default:
        console.log('no case match, sending success response');
        response.send(event, context, response.SUCCESS);
        // defualt response if Resource or RequestType (delete update) not defined.
    }
  }
};
