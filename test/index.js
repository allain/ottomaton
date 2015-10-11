var test = require('blue-tape');

var Ottomaton = require('../lib/index');
var Action = Ottomaton.Action;

test('core - can be created using constructor', function (t) {
  var opts = {};
  var otto = new Ottomaton(opts);
  // Duck type only, I dono't care what it actually is
  t.equal(typeof otto.run, 'function');
  t.equal(typeof otto.register, 'function');
  t.strictEqual(otto.opts, opts);
  t.end();
});

test('core - can be created using factory', function (t) {
  var opts = {};
  var otto = new Ottomaton(opts);
  // Duck type only, I dono't care what it actually is
  t.equal(typeof otto.run, 'function');
  t.equal(typeof otto.register, 'function');
  t.strictEqual(otto.opts, opts);
  t.end();
});

test('core - can disable dereferencing when building action', function(t) {
  Ottomaton().register(Action(/^(.*)$/, function(varName) {
    t.equal(varName, 'VAR_NAME');
    t.end();
  }, {deref: false})).run(['VAR_NAME']).catch(t.end);
});

test('core - if a matcher returns an empty array, then the arg will be the entire line', function (t) {
  return Ottomaton().register(/^a$/, function (line) {
    t.equal(line, 'a');
  }).run('a');
});

test('core - invokes matching actions when run', function (t) {
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

test('core - passes current line into handler as this.LINE', function(t) {
  return Ottomaton().register(/^Hello (.*)$/i, function(value) {
    t.equal(value, 'World!');
    t.equal(this.LINE, 'Hello World!');
  }).run('Hello World!').then(function(result) {
    t.equal(result.LINE, undefined);
  });
});

test('core - nothing is executed if a line does not have any actions', function (t) {
  return Ottomaton().register({
    'a': function () {
      t.fail('this should never be executed');
    }
  }).run(['a', 'huh?']).then(t.fail, function (err) {
    t.ok(err instanceof Error);
    t.equal(err.message, 'Line Errors:\nUnrecognized Line: huh?');
  });
});

test('core - handlers can rewrite current line by returning its mutation', function (t) {
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

test('core - actions can expand current line into a script', function (t) {
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

test('core - handler "this" is same passed in state across runs', function (t) {
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

test('core - implicitly adds a FINISH line at end of scripts', function (t) {
  var ottomaton = Ottomaton();

  ottomaton.register(Action.FINISH, function () {
    t.end();
  }).run([]);
});


test('core - returning DONE causes any other matching actions to be skipped', function (t) {
  return Ottomaton().register('a', function () {
    return Action.DONE;
  }).register('a', t.fail).run('a');
});

test('core - supports commented lines', function (t) {
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

test('core - actions can see Ottomaton through this', function(t) {
  var otto =  Ottomaton();

  otto.register('a', function() {
    t.equal(otto, this.ottomaton);
  }).register(Action.FINISH, function() {
    t.end();
  }).run('a').catch(t.fail);
});

test('core - run returns state without ottomaton in it', function(t) {
  return Ottomaton().run('').then(function(result) {
    t.strictEqual(result.ottomaton, undefined);
  });
});

test('core - supports disabling common actions', function (t) {
  return Ottomaton({common: false}).run('# not a comment').then(t.fail, function (err) {
    t.ok(err instanceof Error, 'expects an error');
  });
});


test('core - lines after FINISH are not examined at all', function (t) {
  Ottomaton().register(Action.FINISH, function () {
    t.end();
  }).run([Action.FINISH, 'MISSING']).catch(t.end);
});


test('core - lines after FINISH are not executed', function (t) {
  Ottomaton().register(Action.FINISH, function () {
    t.end();
  }).register('a', function() {
    t.fail('should not get executed');
  }).run([Action.FINISH, 'a', Action.FINISH]).catch(t.end);
});

test('core - if error occurs running an action, script still calls finish', function(t) {
  Ottomaton().register(Action.FINISH, function () {
    t.end();
  }).register('a', function() {
    throw new Error('FAILURE');
  }).run(['a']);
});

test('core - string lines FINISH is treated as Action.FINISH', function (t) {
  Ottomaton().register(Action.FINISH, function () {
    t.end();
  }).register('a', function() {
    t.fail('should not get executed');
  }).run(['FINISH', 'a', Action.FINISH]).catch(t.end);
});

test('core - ALL_CAPS get treated as reference to props in the state', function (t) {
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
