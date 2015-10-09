var test = require('blue-tape');

test('cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./libraries/a.js ./libraries/b ./fixtures/cli-test.txt', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('cli passes command line arguments in as part of the initial state', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js --test HELLO ./libraries/print.js ./fixtures/print-test.txt', function (err, out) {
    t.error(err);
    t.equal(out, 'HELLO\n');
    t.end();
  });
});

test('piped cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('cat ./fixtures/cli-test.txt | ../lib/bin/otto.js ./libraries/a.js ./libraries/b', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});


test('cli missing lib failures work', function (t) {
  process.chdir(__dirname);

  require('child_process').exec('../lib/bin/otto.js ./libraries/missing.js ./fixtures/cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.ok(stderr.match(/ERROR: unable to register library ".*\/libraries\/missing.js"\n$/));
    t.end();
  });
});

test('cli line errors work', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../lib/bin/otto.js ./libraries/a.js ./fixtures/cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.equal(stderr, 'ERROR: Line Errors:\nUnrecognized Line: #2: b\n');
    t.equal(out, '');
    t.end();
  });
});

