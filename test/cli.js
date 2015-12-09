var test = require('blue-tape');

test('cli - works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./libraries/a.js ./libraries/b ./fixtures/cli-test.txt', function (err, out) {
    t.error(err, 'no error');
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('cli - passes command line arguments in as part of the initial state', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js --test HELLO ./libraries/print.js ./fixtures/print-test.txt', function (err, out) {
    t.error(err);
    t.equal(out, 'HELLO\n');
    t.end();
  });
});

test('cli - piping works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('cat ./fixtures/cli-test.txt | ../lib/bin/otto.js ./libraries/a.js ./libraries/b', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('cli - missing lib failures work', function (t) {
  process.chdir(__dirname);

  require('child_process').exec('../lib/bin/otto.js ./libraries/missing.js ./fixtures/cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.ok(stderr.match(/ERROR: unable to register library ".*\/libraries\/missing.js"\n$/));
    t.end();
  });
});

test('cli - line errors work', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./libraries/a.js ./fixtures/cli-test.txt', function (err, out, stderr) {
    t.ok(err, 'error is returned');
    t.equal(stderr, 'ERROR: Unrecognized Line: b\n', 'error is correct one');
    t.equal(out, '', 'no stdout');
    t.end();
  });
});

test.skip('cli - outputs all additional state to stdout', function(t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./libraries/set.js ./fixtures/cli-output.txt', function (err, out, stderr) {
    t.ok(!err, 'no error output');
    t.equal(out, [
      'X = 10',
      'VAR_NAME = 20',
      'abc = Testing 1, 2, 3',
      ''
    ].join('\n'), 'outputs new state to stdout');
    t.end();
  });
});

test('cli - outputs all additional state as json when output is specified as such', function(t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./fixtures/cli-output.txt --output json', function (err, out, stderr) {
    t.ok(!err, 'no error output');
    t.equal(out, JSON.stringify(
      {X: '10', VAR_NAME: '20', abc: 'Testing 1, 2, 3'}) + '\n',
      'outputs new state as JSON'
    );
    t.end();
  });
});
