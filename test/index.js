var test = require('blue-tape');

var Ottomaton = require('..');

test('can be created using constructor', function(t) {
  var otto = new Ottomaton();
  t.ok(otto instanceof Ottomaton, 'creates instance of Ottomaton');
  t.end();
});

test('can be created using factory', function(t) {
  var otto = Ottomaton();
  t.ok(otto instanceof Ottomaton, 'creates instance of Ottomaton');
  t.end();
});

test('supports registration of a single action using regex', function(t) {
  var otto = new Ottomaton();
  return otto.register(/^test (.*)$/, function(name) {
    this.test = name;
  }).run(['test Allain Lalonde']).then(function(result) {
    t.equal(result.test, 'Allain Lalonde'); 
  });
});

test('supports registration of a single action using string', function(t) {
  var otto = new Ottomaton();
  return otto.register('test "NAME"', function(name) {
    this.test = name;
  }).run(['test Allain']).then(function(result) {
    t.equal(result.test, 'Allain'); 
  });
});

test('supports registration of a single action using function', function(t) {
  var otto = new Ottomaton();
  return otto.register(function(line) {
    return [line];
  }, function(name) {
    this.test = name;
  }).run(['test Allain']).then(function(result) {
    t.equal(result.test, 'test Allain'); 
  });
});


test('supports registration of actions array during construction', function(t) {
  var otto = new Ottomaton({
    actions: [{ matcher: /^test$/, handler: function() {}}]
  });
  
  t.equal(otto.actions.length, 1);
  t.end();
});

test('supports registration of actions hash during construction', function(t) {
  var otto = new Ottomaton({
    actions: [{ 'test': function() {}}]
  });
  
  t.equal(otto.actions.length, 1);
  t.end();
});

test('invokes matching actions when run', function(t) {
  var testCalls = 0;

  var otto = new Ottomaton({
    actions: [
      {
        matcher: /^test$/,
        handler: function() { 
          testCalls ++;
        } 
      }
    ]
  });

  return otto.run([
    'test',
    'test',     
    'test'     
  ]).then(function() {
    t.equal(testCalls, 3);
  }); 
});

test('action "this" is same passed in state across runs', function(t) {
  var state = { handled: 0 };

  var otto = new Ottomaton({
    actions: [
      {
        matcher: /^test$/,
        handler: function() {
          this.handled++;
          t.strictEqual(this, state, 'should always be same object'); 
        } 
      }
    ]
  });

  return otto.run([
    'test',
    'test',     
    'test'     
  ], state).then(function(result) {
    t.equal(result.handled, 3);
  }); 
});


