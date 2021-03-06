var mongodb = process.env['TEST_NATIVE'] != null ? require('../../lib/mongodb').native() : require('../../lib/mongodb').pure();
var noReplicasetStart = process.env['NO_REPLICASET_START'] != null ? true : false;

var testCase = require('nodeunit').testCase,
  debug = require('util').debug,
  inspect = require('util').inspect,
  gleak = require('../../dev/tools/gleak'),
  ReplicaSetManager = require('../tools/replica_set_manager').ReplicaSetManager,
  Db = mongodb.Db,
  ReplSetServers = mongodb.ReplSetServers,
  Server = mongodb.Server,
  Step = require("step");  

// Keep instance of ReplicaSetManager
var serversUp = false;
var retries = 120;
var RS = RS == null ? null : RS;

var ensureConnection = function(test, numberOfTries, callback) {
  // Replica configuration
  var replSet = new ReplSetServers( [ 
      new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
      new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
      new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
    ], 
    {rs_name:RS.name}
  );
  
  if(numberOfTries <= 0) return callback(new Error("could not connect correctly"), null);

  var db = new Db('integration_test_', replSet);
  db.open(function(err, p_db) {
    db.close();
    if(err != null) {
      // Wait for a sec and retry
      setTimeout(function() {
        numberOfTries = numberOfTries - 1;
        ensureConnection(test, numberOfTries, callback);
      }, 1000);
    } else {
      return callback(null, p_db);
    }    
  })            
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.setUp = function(callback) {
  // Create instance of replicaset manager but only for the first call
  if(!serversUp && !noReplicasetStart) {
    serversUp = true;
    RS = new ReplicaSetManager({retries:120, 
        arbiter_count:0, 
        secondary_count:1, 
        passive_count:0});
    RS.startSet(true, function(err, result) {      
      if(err != null) throw err;
      // Finish setup
      callback();      
    });      
  } else {    
    RS.restartKilledNodes(function(err, result) {
      if(err != null) throw err;
      callback();        
    })
  }
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.tearDown = function(callback) {
  numberOfTestsRun = numberOfTestsRun - 1;
  if(numberOfTestsRun == 0) {
    // Finished kill all instances
    RS.killAll(function() {
      callback();              
    })
  } else {
    callback();            
  }  
}
  
exports.shouldCorrectlyExecuteSafeFindAndModify = function(test) {
  // Replica configuration
  var replSet = new ReplSetServers( [ 
      new Server( RS.host, RS.ports[1], { auto_reconnect: true } ),
      new Server( RS.host, RS.ports[0], { auto_reconnect: true } ),
      // new Server( RS.host, RS.ports[2], { auto_reconnect: true } )
    ], 
    {rs_name:RS.name, read_secondary:false}
  );

  // Insert some data
  var db = new Db('integration_test_', replSet);
  db.open(function(err, p_db) {
    // Check if we got an error
    if(err != null) debug("shouldWorkCorrectlyWithInserts :: " + inspect(err));

    // Drop collection on replicaset
    p_db.dropCollection('testsets', function(err, r) {
      if(err != null) debug("shouldWorkCorrectlyWithInserts :: " + inspect(err));
      // Recreate collection on replicaset
      p_db.createCollection('testsets', function(err, collection) {
        if(err != null) debug("shouldWorkCorrectlyWithInserts :: " + inspect(err));  
        // Insert a dummy document
        collection.insert({a:20}, {safe: {w:1, wtimeout: 10000}}, function(err, r) {            
          // Execute a findAndModify
          collection.findAndModify({'a':20}, [['a', 1]], {'$set':{'b':3}}, {'new':true, safe: {w:7, wtimeout: 10000}}, function(err, updated_doc) {
            test.equal('timeout', err.err)
            test.equal(true, err.wtimeout)
            p_db.close();        
            test.done();
          });              
        });
      });
    });
  });
} 

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
exports.noGlobalsLeaked = function(test) {
  var leaks = gleak.detectNew();
  test.equal(0, leaks.length, "global var leak detected: " + leaks.join(', '));
  test.done();
}

/**
 * Retrieve the server information for the current
 * instance of the db client
 * 
 * @ignore
 */
var numberOfTestsRun = Object.keys(this).length - 2;
















