#!/usr/bin/env node
//require('node-monkey').start({host: "127.0.0.1", port:"50500"});
var http = require('http');
var _ = require('lodash');
var ElasticSearchClient = require('elasticsearchclient');

var host = 'root:xyz786@office.uitoux.com';
var port = '5988';
var dbname = 'txprintco_dev_stage16';

var nano = require("nano")('http://'+host+':'+port);
var db = nano.db.use(dbname);

var txprintco = {
    host: host,
    port: port,
    database: db,
    client: nano,
    db: db,
    design_doc: 'txprintco'
};

var elasticSearchClient = new ElasticSearchClient({
    host: 'localhost',
    port: 9200
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

http.request({
  host: 'localhost',
  port: 9200,
  path: '/product',
  method: 'DELETE'
}).end();

console.log('Building New Index');
//Build New Index
txprintcoData.makeDataRequest('filters-object',
                {},
                function(req, res) {
                  var docs = [];

                  _.each(res, function(rows) {
                    var vocabs = rows['value']['categories'];
                    var product_type = rows['key'];

                    var mapping = {};
                    mapping[product_type] = {
                      "properties": {
                        "product_type": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "term_name": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "vocab_machine_name": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "vocab_name": {
                          "type": "string",
                          "index": "not_analyzed"
                        },
                        "product_id": {
                          "type": "string",
                          "index": "not_analyzed"
                        }
                      }
                    };

                    http.request({
                      host: 'localhost',
                      port: 9200,
                      path: '/product/'+doc.product_type+'/_mapping',
                      method: 'PUT'
                    }).write(JSON.stringify(mapping)).end();

                    _.each(vocabs, function(vocab) {
                      _.each(vocab.options, function(term) {
                        _.each(term.products, function(product) {
                          var doc = {
                              product_type: product_type,
                              term_name: term.term_name,
                              vocab_machine_name: vocab.vocabulary_machine_name,
                              vocab_name: vocab.vocabulary_en_name,
                              product_id: product
                          };
                          docs.push(doc);
                        });
                      });
                    });
                  });

                  _.each(docs, function(doc) {
                    elasticSearchClient.index('product', doc.product_type, doc)
                      .on('data', function(data) {
                          console.log(data)
                      }).exec();
                  });


                },
                function() {
                  console.log('Error contacting database.');
                });
