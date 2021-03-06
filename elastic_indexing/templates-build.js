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

var mapping = {};
mapping["mappings"] = {
  "_default_": {
    "properties": {
      "category_name": {
        "type": "string",
        "index": "not_analyzed"
      },
      "dimensions": {
          "type": "string",
          "index": "not_analyzed"
      },
      "extension": {
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
  }
};

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
req.write(JSON.stringify(mapping));
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

                    //Cluster Products
                    var templates = {};

                    _.each(template_files, function(fileSet, fileType) {
                      _.each(fileSet.files, function(files, i) {
                        _.each(files, function(file, i) {
                          var fileNameP = file.path.split("/");
                          var fileName = fileNameP[fileNameP.length-1];
                          var tags = '';
                          if(!_.isEmpty(fileSet.subcat)) {
                            tags = ' (' + fileSet.subcat + ')';
                          }
                          _.each(file.type, function(t) {
                            tags += ' ('+t+')';
                          });
                          var regex = /\d+(\.\d+)?/g;
                          var dimensions = [];
                          var dimension = '';
                          while((dimension = regex.exec(file.text)) != null) {
                            dimensions.push(dimension[0]);
                          }

                          templates[fileName] = {
                            extension: /(?:\.([^.]+))?$/.exec(fileName)[1],
                            fileName: fileName,
                            filePath: file.path,
                            dimensions: dimensions.join(" x "),
                            name: file.text+tags,
                            category_name: category.text,
                            category_key: category.key,
                            category_id: category.id
                          };
                        });
                      });
                    });

                    _.each(templates, function(file, fileName) {
                     populateDocument(file);
                    });
                  });
                },
                function(err) {
                  console.log(err);
                  console.log('Error contacting database.');
                });
