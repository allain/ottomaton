var test = require('blue-tape');

var Ottomaton = require('../lib/index');
var Action = Ottomaton.Action;

test('register - supports registration of a single action using regex', function (t) {
  return Ottomaton().register(/^test (.*)$/, function (name) {
    this.test = name;
  }).run(['test Allain Lalonde']).then(function (result) {
    t.equal(result.test, 'Allain Lalonde');
  });
});

test('register - supports registration of an array of matchers for a single handler', function (t) {
  return Ottomaton().register([/^(a)$/, /^(b)$/], function (line) {
    this.result += line;
  }).run(['a', 'b'], {result: ''}).then(function (result) {
    t.equal(result.result, 'ab');
  });
});

test('register - supports registration of a single action using string', function (t) {
  return Ottomaton().register('test "NAME"', function (name) {
    this.test = name;
  }).run(['test Allain']).then(function (result) {
    t.equal(result.test, 'Allain');
  });
});

test('register - supports registration of a single action using function', function (t) {
  return Ottomaton().register(function (line) {
    return [line];
  }, function (l) {
    this.results.push(l);
  }).run(['test Allain'], {results: []}).then(function (result) {
    t.deepEqual(result.results, ['test Allain', Action.FINISH]);
  });
});

test('register - supports registration of a single action', function (t) {
  return Ottomaton().register(new Ottomaton.Action(function (line) {
    return [line];
  }, function (l) {
    this.results.push(l);
  })).run(['test Allain'], {results: []}).then(function (result) {
    t.deepEqual(result.results, ['test Allain', Action.FINISH]);
  });
});

test('register - supports registration of actions array', function (t) {
  var otto = new Ottomaton({common: false});

  otto.register([{
    matcher: /^test$/, handler: function () {
      t.fail('should not be called');
    }
  }]);

  t.equal(otto.registrations.length, 1);
  t.end();
});

test('register - support registration of an array of actions that have array matchers', function(t) {
  var otto = new Ottomaton({common: false});
  otto.register([
    {
      matcher: [
        /^a$/i,
        /^b$/i
      ],

      handler: function(line) {
        this.output.push(line);
      }
    }
  ]);

  return otto.run(['a','b'], {output: []}).then(function(result) {
    t.deepEqual(result.output, ['a', 'b']);
  });
});

test('register - supports registration of an empty actions array', function (t) {
  var otto = new Ottomaton({common: false});

  otto.register([]);

  t.equal(otto.registrations.length, 0);
  t.end();
});

test('register - supports registration of hash', function (t) {
  var otto = new Ottomaton({common: false});
  otto.register({
    'test': function () {
    }
  });

  t.equal(otto.registrations.length, 1);
  t.end();
});

test('register - supports registration of an action generator', function (t) {
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

test('register - supports registration of an action generator that returns a promise', function (t) {
  var ottomaton = Ottomaton({a: 'A!'});

  return ottomaton.register(function (otto) {
    t.equal(ottomaton, otto);

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

test('register - supports registration of a string as the handler', function(t) {
  return Ottomaton().register('a', 'b').register('b', function() {
    this.result = 'B';
  }).run('b').then(function(result) {
    t.equal(result.result, 'B');
  });
});

test('register - supports registration of an array as the handler', function(t) {
  return Ottomaton().register('a', ['b']).register('b', function() {
    this.result = 'B';
  }).run('b').then(function(result) {
    t.equal(result.result, 'B');
  });
});
