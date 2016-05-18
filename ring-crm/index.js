#!/usr/bin/env node
var SDK = require('ringcentral');
var sdk = new SDK({
    //server: 'https://platform.devtest.ringcentral.com', // SANDBOX 
    server: 'https://platform.ringcentral.com',
    appKey: 'yourAppKey',
    appSecret: 'yourAppSecret'
});
