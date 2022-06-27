'use strict'
const fs = require("fs");
const path = require("path");

async function convertImage() {
    const base64 = fs.readFileSync(path.join(__dirname, "/blurred-image.jpg"), "base64");
    console.log(JSON.stringify(base64))
}

function testGatewayEvent() {
    const requestBody = JSON.parse(fs.readFileSync(path.join(__dirname,"/resources/apiGatewayEvent.json"))).body;
    console.log("Test event body ==>" + JSON.parse(requestBody).userDocument);
    let buff = Buffer.from(JSON.parse(requestBody).userDocument, 'base64');
    fs.writeFileSync('stack-abuse-logo-out.png', buff);
}

convertImage();