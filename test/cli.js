var test = require('blue-tape');

var Ottomaton = require('..');

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

