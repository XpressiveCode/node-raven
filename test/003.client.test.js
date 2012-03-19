var util = require('util');
var should = require('should');
var request = require('request');
var raven = require('../lib/client');
var info = require('../utils/testinfo.js');
var server= require('../lib/client')({ connection_string: info.connection_string });
var client = require('../lib/ravenhttpclient')({ connection_string: info.connection_string });

describe('Client', function() {
	describe('options', function(){
		it('should error if no server_url is passed in', function(){
			(function() { require('../lib/client')(); }).should.throw();
		})
		it('should allow the server_url to be passed in as a string', function(){
			(function() { require('../lib/client')('http://localhost:8080'); }).should.not.throw();
		})
		it('should allow the server_url to be passed in via the options hash', function(){
			(function() { require('../lib/client')({ server_url: 'http://localhost:8080' }); }).should.not.throw();
		})
		it('should allow a database name to be specified', function() {
			var server2 = require('../lib/client')({ server_url: 'http://localhost:8080', database_name: 'testing' });
			server2.server_url.should.equal('http://localhost:8080/databases/testing');
		})
		it('should trim a trailing slash from a server url', function() {
			var server2 = require('../lib/client')({ server_url: 'http://localhost:8080/'});
			server2.server_url.should.equal('http://localhost:8080');
		})
	})

	describe('buildRavenQuery()', function(){
		it('should correctly encode a raven query', function(){
			server.buildRavenQuery({ 'Name' : 'Chris' }).should.equal('Name%3AChris');
		})
		it('should correctly encode a raven query with multiple values', function(){
			server.buildRavenQuery({ 'Name' : 'Chris', 'Surname' : 'Sainty' }).should.equal('Name%3AChris%20Surname%3ASainty');
		})
	})
	
	describe('putDocument()', function() {
		it('should return true when saving a document', function (done) {
			server.putDocument('testdocs/1', { 'message': 'Testing.1.2.3' }, function(error, result, ok){
				should.not.exist(error);
				should.exist(result);
				ok.should.be.true;
				done();
			})
		})
		it('should save a document even though it is out of date if optimistic concurrency is off', function(done){
			var doc = {
				'Name': 'Hip Hop',
				'@metadata': {
					'etag': '00000000-0000-0000-0000-000000000000',
					'raven-entity-name': 'Genres'
				}
			};
			server.putDocument('genres/2', doc, function(error, result, ok) {
				should.not.exist(error);
				should.exist(result);
				should.exist(ok);
				result.statusCode.should.equal(201);
				ok.should.be.true;
				done();
			})
		})

		it('should not save a document with an etag less than on the server when optimistic concurrency is on', function(done){
			var doc
        , myServer;
			doc = {
				'Name': 'Rock',
				'@metadata': {
					'etag': '00000000-0000-0000-0000-000000000000',
					'raven-entity-name': 'Genres'
				}
			};
			myServer= raven({connection_string: info.connection_string, useOptimisticConcurrency: true });
			myServer.putDocument('genres/1', doc, function(error, result, ok) {
				should.not.exist(error);
				should.exist(result);
				should.exist(ok);
				result.statusCode.should.equal(409);
				ok.should.be.false;
				done();
			})
		})
	})
	
	describe('getDocument()', function(){
		it('should return null if document is not found', function (done) {
			server.getDocument('invalidKey', function(error, result, data) {
				should.not.exist(error);
				should.exist(result);
				should.not.exist(data);
				result.statusCode.should.equal(404);
				done();
			});
		})
		it('should return the correct document', function (done) {
			server.getDocument('genres/1', function(error, result, data) {
				should.not.exist(error);
				should.exist(result);
				should.exist(data);
				data.Name.should.equal('Rock');
				done();
			});
		})
		it('should return a document with metadata', function (done) {
			server.getDocument('genres/1', function(error, result, data) {
				should.not.exist(error);
				should.exist(result);
				should.exist(data);
				data.should.have.property('@metadata');
				data['@metadata'].should.have.property('etag');
				data['@metadata'].should.have.property('raven-entity-name');
				data['@metadata']['raven-entity-name'].should.equal('Genres');
				done();
			});			
		})
	})
	
	describe('store()', function() {
		it('should error when there is no metadata available', function(done){
			var doc = {
				'data': 'Test Data'	
			};
			(function() {server.store(doc, function(){ })}).should.throw();
			done();
		})
		it('should generate a key for a new document', function(done){
			var doc = server.createDocument('TestDoc', {
				'data': 'My new test data'
			});
			server.store(doc, function(error, result, ok) {
				should.not.exist(error);
				should.exist(result);
				should.exist(ok);
				ok.should.be.true;
				doc.should.have.property('id');
				done();
			});
		})
		it('should update a document with an existing key', function(done){
			var doc = server.createDocument('TestDoc', {
				'id': 'TestDoc/1',
				'data': 'My new test data'
			});
			server.store(doc, function(error, result, ok) {
				should.not.exist(error);
				should.exist(result);
				should.exist(ok);
				ok.should.be.true;
				doc.should.have.property('id');
				doc.id.should.equal('TestDoc/1');
				done();
			});
		})
	})

	describe('queryIndex()', function(){
		it('should be able to perform a query', function(done){
			server.queryIndex('Artists', { query : { 'Name' : 'AC/DC' }, 'waitForNonStaleResults' : true }, function (error, result, data) {
				should.not.exist(error);
				should.exist(result);
				should.exist(data);
				data.IndexName.should.equal('Artists');
				data.IsStale.should.be.false;
				data.TotalResults.should.equal(1);
				data.should.have.property('Results');
				data.Results.should.be.an.instanceof(Array);
				data.Results.should.have.length(1);
				done();
			});
		})
		it('should be able to perform a query with multiple criteria', function(done){
			server.queryIndex('Artists', { query : { 'Name' : 'A*', 'Id' : 'artists/1' }, 'waitForNonStaleResults' : true }, function (error, result, data) {
				should.not.exist(error);
				should.exist(result);
				should.exist(data);
				data.IndexName.should.equal('Artists');
				data.IsStale.should.be.false;
				data.TotalResults.should.equal(14);
				data.should.have.property('Results');
				data.Results.should.be.an.instanceof(Array);
				data.Results.should.have.length(14);
				done();
			});
		})	
	})
	
	describe('ensureDatabaseExists()', function() {
		if (info.isAdmin) {
      it('should create a database that does not exist', function(done){
  			server.ensureDatabaseExists('node-raven', function(error, result, ok) {
  				should.not.exist(error);
  				should.exist(result);
  				should.exist(ok);
  				ok.should.be.true;
  				done();
  			});
  		})
  		it('should not error when a database already exists', function(done){
  			server.ensureDatabaseExists('node-raven', function(error, result, ok) {
  				should.not.exist(error);
  				should.exist(result);
  				should.exist(ok);
  				ok.should.be.true;
  				done();
  			});
  		})
    }
		it('should not allow a database with invalid character / in the name', function(done){
			server.ensureDatabaseExists('node/raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})
		it('should not allow a database with invalid character \\ in the name', function(done){
			server.ensureDatabaseExists('node\\raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})		
		it('should not allow a database with invalid character < in the name', function(done){
			server.ensureDatabaseExists('node<raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})		
		it('should not allow a database with invalid character > in the name', function(done){
			server.ensureDatabaseExists('node>raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})		
		it('should not allow a database with invalid character \' in the name', function(done){
			server.ensureDatabaseExists('node\'raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})		
		it('should not allow a database with invalid character " in the name', function(done){
			server.ensureDatabaseExists('node"raven', function(error, result, ok) {
				should.exist(error);
				should.exist(ok);
				ok.should.be.false;
				done();
			});
		})		
	})

	describe('useDatabase()', function() {
		it('should alter the server url when using a database', function() {
			var server2 = require('../lib/client')({ connection_string: info.connection_string });
			var oldUrl = server2.server_url;
      server2.useDatabase('testing');
			server2.server_url.should.not.equal(oldUrl);
		})
	})

	describe('createDocument()', function() {
		it('should be able to create a blank document with the propvided metadata set', function() {
			var result = server.createDocument('TestDoc');
			should.exist(result);
			result.should.have.property('@metadata');
			result['@metadata'].should.have.property('raven-entity-name');
			result['@metadata']['raven-entity-name'].should.equal('TestDoc');
		})
		it('should be able to add metadata to the provided document', function() {
			var result = server.createDocument('TestDoc', { 'data' : 'Test Data' });
			should.exist(result);
			result.should.have.property('@metadata');
			result['@metadata'].should.have.property('raven-entity-name');
			result['@metadata']['raven-entity-name'].should.equal('TestDoc');
			result.data.should.equal('Test Data');
		})
	})

	describe('generateDocumentKey()', function(){
		it('should have created a default key generator', function() {
			should.exist(server.keyGenerator);
		})
		it('should assign key to document', function(done) {
			server.generateDocumentKey('Album', { name: 'My Album' }, function(error, entity, key) {
				should.not.exist(error);
				should.exist(key);
				entity.name.should.equal('My Album');
				entity.id.should.equal(key);
				done();
			})
		})
	})

	// Now we have created a database, we can check the getDatabaseNames() function
	describe('getDatabaseNames()', function() {
    if (info.isAdmin) {
      it('should return an array of database names', function(done){
        server.getDatabaseNames(function (error, result, data){
          should.not.exist(error);
          should.exist(result);
          should.exist(data)
          data.should.be.an.instanceof(Array);
          (data.length >= 1).should.be.true;
          done();
        })
      })
    }
	})
})
