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

test('supports registration of an array of matchers for a single handler', function (t) {  
  return Ottomaton().register([/^(a)$/, /^(b)$/], function (line) {
    this.result += line;
  }).run(['a', 'b'], {result: ''}).then(function (result) {
    t.equal(result.result, 'ab');
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
  }, function (l) {
    this.results.push(l);
  }).run(['test Allain'], {results: []}).then(function (result) {
    t.deepEqual(result.results, ['test Allain', 'FINISH']);
  });
});

test('supports registration of a single action', function (t) {
  return Ottomaton().register(new Ottomaton.Action(function (line) {
    return [line];
  }, function (l) {
    this.results.push(l);
  })).run(['test Allain'], {results: []}).then(function (result) {
    t.deepEqual(result.results, ['test Allain', 'FINISH']);
  });
});

test('supports registration of actions array', function (t) {
  var otto = new Ottomaton();
  otto.register([{
    matcher: /^test$/, handler: function () {
      t.fail('should not be called');
    }
  }]);

  t.equal(otto.registrations.length, 1);
  t.end();
});

test('supports registration of hash', function (t) {
  var otto = new Ottomaton();
  otto.register({
    'test': function () {
    }
  });

  t.equal(otto.registrations.length, 1);
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

test('actions can odify current line', function (t) {
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

test('registering an action generator function works', function (t) {
  var ottomaton = Ottomaton({a: 'A!'});

  return ottomaton.register(function (otto) {
    t.strictEqual(otto, ottomaton, 'ottomaton should be passed as argument to generator');

    return [Ottomaton.Action('a', function () {
      this.result = otto.opts.a;
    })];
  }).run([
    'a'
  ]).then(function (result) {
    t.equal(result.result, 'A!');
  });
});

test('supports an action generator that returns a promise', function (t) {
  var ottomaton = Ottomaton({a: 'A!'});

  return ottomaton.register(function (otto) {
    var actions = [Ottomaton.Action('a', function () {
      this.result = otto.opts.a;
    })];

    return Promise.resolve(actions);
  }).run([
    'a'
  ]).then(function (result) {
    t.equal(result.result, 'A!');
  });
});

test('implicitly adds a FINISH line at end of scripts', function (t) {
  var ottomaton = Ottomaton();

  ottomaton.register('FINISH', function () {
    t.end();
  }).run([]);
});

test('returning DONE causes any other matching actions to be skipped', function (t) {
  return Ottomaton().register('a', function () {
    return 'DONE';
  }).register('a', t.fail).run('a');
});

test('supports commented lines', function () {
  return Ottomaton().register('a', function () {
  }).run([
    '# This is ignored',
    '#This',
    'Rem This is ignored',
    'a'
  ]);
});

test('supports disabling common actions', function(t) {
  return Ottomaton({common: false}).run('# not a comment').then(t.fail, function(err) {
    t.ok(err instanceof Error, 'expects an error');
  });
});

test('does not add FINISH if it is already there', function (t) {
  var ottomaton = Ottomaton();

  ottomaton.register('FINISH', function () {
    t.end();
  }).run(['FINISH']);
});

test('cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../bin/otto --lib ./libraries/a.js --lib ./libraries/b ./cli-test.txt', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('piped cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('cat ./cli-test.txt | ../bin/otto --lib ./libraries/a.js --lib ./libraries/b', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('cli missing lib failures work', function (t) {
  process.chdir(__dirname);

  require('child_process').exec('../bin/otto --lib ./libraries/missing.js ./cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.equal(stderr, 'ERROR: unable to register library "./libraries/missing.js"\n');
    t.end();
  });
});

test('cli line errors work', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../bin/otto --lib ./libraries/a.js ./cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.equal(stderr, 'ERROR: Line Errors:\nUnrecognized Line: #2: b\n');
    t.equal(out, '');
    t.end();
  });
});

