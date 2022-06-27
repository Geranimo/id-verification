'use strict'
const AWS = require('aws-sdk');
const axios = require('axios').default;

exports.handler = async function (event) {
  let response;
  const userId = event.Payload.userId
  try {
    var config = {
      method: 'delete',
      url: `https://xkzd3319q2.execute-api.eu-central-1.amazonaws.com/prod/user/${userId}`,
    };
    const reponse = await axios(config);
    console.log('Request response for cleaning up the resource => ' + response);

  } catch (error) {
    console.log("Errored while processing the update request => " + JSON.stringify(error))
    response = {
      statusCode: 400,
      body: `Errored while processing the storage request for ${userId}\n`
    };
  }
  return response;
};