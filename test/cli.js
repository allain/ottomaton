var test = require('blue-tape');

test('cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../bin/otto ./libraries/a.js ./libraries/b ./cli-test.txt', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});

test('piped cli works', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('cat ./cli-test.txt | ../bin/otto ./libraries/a.js ./libraries/b', function (err, out) {
    t.error(err);
    t.equal(out, 'A\nB\n');
    t.end();
  });
});


test('cli missing lib failures work', function (t) {
  process.chdir(__dirname);

  require('child_process').exec('../bin/otto ./libraries/missing.js ./cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.ok(stderr.match(/ERROR: unable to register library ".*\/libraries\/missing.js"\n$/));
    t.end();
  });
});

test('cli line errors work', function (t) {
  process.chdir(__dirname);
  require('child_process').exec('../bin/otto ./libraries/a.js ./cli-test.txt', function (err, out, stderr) {
    t.ok(err);
    t.equal(stderr, 'ERROR: Line Errors:\nUnrecognized Line: #2: b\n');
    t.equal(out, '');
    t.end();
  });
});

