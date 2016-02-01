#!/usr/bin/env node
//require('node-monkey').start({host: "127.0.0.1", port:"50500"});
var http = require('http');
var _ = require('lodash');
var ElasticSearchClient = require('elasticsearchclient');

var host = 'root:xyz786@office.uitoux.com';
var port = '5988';
var dbname = 'txprintco_template_maps';

var nano = require("nano")('http://'+host+':'+port);
var db = nano.db.use(dbname);

var txprintco = {
    host: host,
    port: port,
    database: db,
    client: nano,
    db: db,
    design_doc: 'txprintco_templates'
};

var elasticSearchClient = new ElasticSearchClient({
    host: 'office.uitoux.com',
    port: 9200,
    auth: {
      username: "digerpaji",
      password: "xyz786"
    }
});

var txprintcoData = {
	design_doc: txprintco.design_doc,
	db: txprintco.db,
	makeDataRequest: function(view, params, successCB, errorCB) {
		this.db.view(this.design_doc, view, params, _.bind(this.handleCouchResponse, this, successCB, errorCB));
	},
	handleCouchResponse: function(successCB, errorCB, err, data) {
		if(!err && _.isArray(data["rows"]) && data["rows"].length > 0) {
			successCB(err, data["rows"]);
		} else {
			errorCB();
		}
	}
};

//Delete Existing Index
console.log('Deleting Existing Index');
var headers = {
     'Authorization': 'Basic ' + new Buffer('digerpaji' + ':' + 'xyz786').toString('base64')
};

http.request({
  host: 'office.uitoux.com',
  port: 9200,
  path: '/templates',
  method: 'DELETE',
  headers: headers
}, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log("Deleted Index: " + chunk);
    });
}).end();

console.log('Building New Index');

var req = http.request({
  host: 'office.uitoux.com',
  port: 9200,
  path: '/templates',
  method: 'PUT',
  headers: headers
}, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log("Create Fresh Template Index: " + chunk);
    });
});
req.end();

var populateDocument = function(doc) {
  //console.log(doc);
  elasticSearchClient.index('templates', doc.category_id, doc)
    .on('data', function(data) {
        console.log(data)
  }).exec();
}

//Build New Index
txprintcoData.makeDataRequest('templates_details',
                {include_docs: true},
                function(req, res) {
                  var docs = [];

                  _.each(res, function(rows) {
                    var category = rows['value']['category_info'];
                    var template_files = rows['value']['templates'];
                    var category_key = rows['key'];
                    var mapping = {};

                    mapping[category.id] = {
                      "properties": {
                        "category_name": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "category_key": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "category_id": {
                          "type": "string",
                          "index": "not_analyzed"
                        }
                      }
                    };

                    //Cluster Products
                    var templates = {};

                    _.each(template_files, function(fileSet, fileType) {
                      _.each(fileSet.files, function(files, i) {
                        _.each(files, function(file, i) {
                          var fileNameP = file.path.split("/");
                          var fileName = fileNameP[fileNameP.length-1];
                          var tags = '';
                          _.each(file.type, function(t) {
                            tags += ' ('+t+')';
                          });
                          templates[fileName] = {
                            fileName: fileName,
                            filePath: file.path,
                            name: file.text+tags,
                            category_name: category.text,
                            category_key: category.key,
                            category_id: category.id
                          };
                        });
                      });
                    });

                    var req = http.request({
                      host: 'office.uitoux.com',
                      port: 9200,
                      path: '/templates/'+category.id+'/_mapping',
                      method: 'PUT',
  		                headers: headers
                    }, function(res) {
                        res.setEncoding('utf8');
                        res.on('end', function (chunk) {
                            console.log("Setup Mapping ("+category.id+"): " + chunk);
                        });
                    });
                    req.write(JSON.stringify(mapping));
                    req.end();

                    _.each(templates, function(file, fileName) {
                     populateDocument(file);
                    });
                  });
                },
                function(err) {
                  console.log(err);
                  console.log('Error contacting database.');
                });
