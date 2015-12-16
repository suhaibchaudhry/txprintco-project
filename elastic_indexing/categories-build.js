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
  path: '/product',
  method: 'DELETE',
  headers: headers
}).end();

console.log('Building New Index');

var req = http.request({
  host: 'office.uitoux.com',
  port: 9200,
  path: '/product',
  method: 'PUT',
  headers: headers
}, function(res) {
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log("Create Fresh Product Index: " + chunk);
    });
});
// req.write(JSON.stringify({
//   "mappings": {
//     "product": {
//       "dynamic_templates": [
//         {
//           "string_template": {
//             "match": "*",
//             "mapping": {
//               "type": "string",
//               "index": "not_analyzed"
//             }
//           }
//         }
//       ],
//       "properties": {
//         "vocabs": {
//           "type": "nested"
//         }
//       }
//     }
//   }
// }));
req.end();

var populateDocument = function(doc, err, data) {
  //console.log(doc);
  doc.base_price = parseFloat(data[0]['value'].base_price);
  elasticSearchClient.index('product', doc.product_type, doc)
    .on('data', function(data) {
        console.log(data)
  }).exec();
}

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
                        "product_id": {
                          "type": "string",
                          "index": "not_analyzed"
                        }
                      }
                    };

                    //Cluster Products
                    var products = {};

                    _.each(vocabs, function(vocab) {
                      _.each(vocab.options, function(term) {
                        _.each(term.products, function(product) {
                          /*var doc = {
                              product_type: product_type,
                              //term_name: term.term_name,
                              //vocab_machine_name: vocab.vocabulary_machine_name,
                              //vocab_name: vocab.vocabulary_en_name,
                              product_id: product
                          };*/
                          if(!_.has(products, product)) {
                            products[product] = {};
                          }

                          mapping[product_type]["properties"][vocab.vocabulary_machine_name] = {
                            "type": "string",
                            "index": "not_analyzed"
                          };

                          products[product][vocab.vocabulary_machine_name] = term.term_name;
                          //docs.push(doc);
                        });
                      });
                    });

                    _.each(products, function(doc, product_id) {
                      doc.product_id = product_id;
                      doc.product_type = product_type;
                      txprintcoData.makeDataRequest('vendor_product_id_map',
                											{key: product_id},
                											_.bind(populateDocument, this, doc),
                											function() {
                                        console.log('Could not fetch product.');
                                      });
                    });



                    var req = http.request({
                      host: 'office.uitoux.com',
                      port: 9200,
                      path: '/product/'+product_type+'/_mapping',
                      method: 'PUT',
  		      headers: headers
                    }, function(res) {
                        res.setEncoding('utf8');
                        res.on('data', function (chunk) {
                            console.log("Setup Mapping ("+product_type+"): " + chunk);
                        });
                    });
                    req.write(JSON.stringify(mapping));
                    req.end();
                  });
                },
                function() {
                  console.log('Error contacting database.');
                });
