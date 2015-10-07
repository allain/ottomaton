var test = require('blue-tape');

var Ottomaton = require('..');

test('can be created using constructor', function (t) {
  var otto = new Ottomaton();
  t.ok(otto instanceof Ottomaton, 'creates instance of Ottomaton');
  t.end();
});

test('can be created using factory', function (t) {
  var otto = Ottomaton();
  t.ok(otto instanceof Ottomaton, 'creates instance of Ottomaton');
  t.end();
});

test('supports registration of a single action using regex', function (t) {
  return Ottomaton().register(/^test (.*)$/, function (name) {
    this.test = name;
  }).run(['test Allain Lalonde']).then(function (result) {
    t.equal(result.test, 'Allain Lalonde');
  });
});

test('supports registration of a single action using string', function (t) {
  return Ottomaton().register('test "NAME"', function (name) {
    this.test = name;
  }).run(['test Allain']).then(function (result) {
    t.equal(result.test, 'Allain');
  });
});

test('supports registration of a single action using function', function (t) {
  return Ottomaton().register(function (line) {
    return [line];
  }, function (name) {
    this.test = name;
  }).run(['test Allain']).then(function (result) {
    t.equal(result.test, 'test Allain');
  });
});

test('supports registration of a single action using function', function (t) {
  return Ottomaton().register(new Ottomaton.Action(function (line) {
    return [line];
  }, function (name) {
    this.test = name;
  })).run(['test Allain']).then(function (result) {
    t.equal(result.test, 'test Allain');
  });
});

test('supports registration of actions array', function (t) {
  var otto = new Ottomaton();
  otto.register([{
    matcher: /^test$/, handler: function () {
      t.fail('should not be called');
    }
  }]);

  t.equal(otto.actions.length, 1);
  t.end();
});

test('supports registration of hash', function (t) {
  var otto = new Ottomaton();
  otto.register({
    'test': function () {
    }
  });

  t.equal(otto.actions.length, 1);
  t.end();
});

test('invokes matching actions when run', function (t) {
  var testCalls = 0;

  return Ottomaton().register({
    matcher: /^test$/,
    handler: function () {
      testCalls++;
    }
  }).run([
    'test',
    'test',
    'test'
  ]).then(function () {
    t.equal(testCalls, 3);
  });
});

test('nothing is executed if a line does not have any actions', function (t) {
  return Ottomaton().register({
    'a': function () {
      t.fail('this should never be executed');
    }
  }).run(['a', 'huh?']).then(t.fail, function (err) {
    t.ok(err instanceof Error);
    t.equal(err.message, 'Line Errors:\nUnrecognized Line: #2: huh?');
  });
});

test('actions can odify current line', function(t) {
  return Ottomaton().register({
    'a': function () {
      return 'b';
    },
    'b': function() {
      this.b = 'B!';
    }
  }).run(['a']).then(function(result) {
    t.equal(result.b, 'B!');
  });
});

test('action "this" is same passed in state across runs', function (t) {
  var state = {handled: 0};

  return Ottomaton().register({
    matcher: /^test$/,
    handler: function () {
      this.handled++;
      t.strictEqual(this, state, 'should always be same object');
    }
  }).run([
    'test',
    'test',
    'test'
  ], state).then(function (result) {
    t.equal(result.handled, 3);
  });
});


