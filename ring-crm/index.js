#!/usr/bin/env node
var SDK = require('ringcentral');
var rcsdk = new SDK({
    //server: 'https://platform.devtest.ringcentral.com', // SANDBOX 
    server: 'https://platform.devtest.ringcentral.com',
    appKey: 'PFrF_L1lT6Kh1WtDshqYsQ',
    appSecret: 'B1ki_yEpRHOMQ8s7sexwCgjLXeipEQSk69JlKQ1cp_bQ'
});

var platform = rcsdk.platform();
rcsdk.platform()
    .login({
        username: '18007899736', // phone number in full format 
        extension: '', // leave blank if direct number is used 
        password: 'Mushtaq!1'
    })
    .then(function(response) {
	  console.log('Login Successful!');
          // your code here 
	  var subscription = rcsdk.createSubscription();
	  subscription.on(subscription.events.notification, function(msg) {
    	    console.log(msg, msg.body);
	  });
    })
    .catch(function(e) {
        alert(e.message  || 'Server cannot authorize user');
    });
