var test = require('blue-tape');

var Ottomaton = require('..');
var Action = Ottomaton.Action;

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

test('if a matcher returns an empty array, then the arg will be the entire line', function (t) {
  return Ottomaton().register(/^a$/, function (line) {
    t.equal(line, 'a');
  }).run('a');
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

test('passes current line into handler as this.LINE', function(t) {
  return Ottomaton().register(/^Hello (.*)$/i, function(value) {
    t.equal(value, 'World!');
    t.equal(this.LINE, 'Hello World!');
  }).run('Hello World!').then(function(result) {
    t.equal(result.LINE, undefined);
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

test('handlers can rewrite current line by returning its mutation', function (t) {
  return Ottomaton().register({
    'a': function () {
      return 'b';
    },
    'b': function () {
      this.b = 'B!';
    }
  }).run(['a']).then(function (result) {
    t.equal(result.b, 'B!');
  });
});

test('actions can expand current line into a script', function (t) {
  return Ottomaton().register({
    'a': function () {
      this.result += 'A';
    },
    'b': function () {
      this.result += 'B';
    },
    'c': function () {
      // suports array
      return ['a', 'b'];
    },
    'd': function () {
      // supports string
      return 'a\nb';
    }
  }).run(['c', 'd'], {result: ''}).then(function (result) {
    t.equal(result.result, 'ABAB');
  });
});

test('handler "this" is same passed in state across runs', function (t) {
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

test('implicitly adds a FINISH line at end of scripts', function (t) {
  var ottomaton = Ottomaton();

  ottomaton.register(Action.FINISH, function () {
    t.end();
  }).run([]);
});


test('returning DONE causes any other matching actions to be skipped', function (t) {
  return Ottomaton().register('a', function () {
    return Action.DONE;
  }).register('a', t.fail).run('a');
});

test('supports commented lines', function (t) {
  return Ottomaton().register('a', function () {
    this.a = 'A';
  }).run([
    '# This is ignored',
    '#This',
    'Rem This is ignored',
    'a'
  ]).then(function (result) {
    t.equal(result.a, 'A');
  });
});

test('actions can see Ottomaton through this', function(t) {
  var otto =  Ottomaton();

  return otto.register('a', function() {
    t.equal(otto, this.ottomaton);
  }).run('a');
});

test('run returns state without ottomaton in it', function(t) {
  return Ottomaton().run('').then(function(result) {
    t.strictEqual(result.ottomaton, undefined);
  });
});

test('supports disabling common actions', function (t) {
  return Ottomaton({common: false}).run('# not a comment').then(t.fail, function (err) {
    t.ok(err instanceof Error, 'expects an error');
  });
});

test('does not add FINISH if it is already there', function (t) {
  Ottomaton().register(Action.FINISH, function () {
    t.end();
  }).run([Action.FINISH]);
});

test('ALL_CAPS get treated as reference to props in the state', function (t) {
  return Ottomaton().register('print "MESSAGE"', function (msg) {
    this.output.push(msg);
  }).run([
    'print a',
    'print FULL_NAME',
    'print "HELLO"'
  ], {output: [], FULL_NAME: 'Allain Lalonde'}).then(function (result) {
    t.deepEqual(result.output, [
      'a',
      'Allain Lalonde',
      'HELLO'
    ]);
  });
});