# ottomaton

A Node.js toolkit for writing automation script DSLs. It is heavily influenced by Cucumber.

## Installation

```bash
npm install ottomaton
```

For CLI Usage:

```bash
npm install -g ottomaton
```

## Example CLI Usage

```bash
# run a script file
otto ./libs/a.js ./libs/b script.txt

# run script and pass in params as properties of state available to actions
cat print message | otto --message "Hello World" ./libs/print-param.js

# run the piped script
cat script.txt | otto libs/a.js libs/b

```

## Example Usage

```js
var otto = Ottomaton();

otto.register({
  'add "a" and "b"': function(a, b) {
    this.result = parseInt(a, 10) + parseInt(b, 10);
  },
  'multiply it by "c"': function(c) {
    this.result = this.result *= parseInt(c, 10);
  },
  'print it': function() {
    console.log(this.result);
  }
});

otto.run([
  'add 1 and 2',
  'multiply it by 3',
  'print it'
]).then(function(state) {
  // if you want it
  console.log(JSON.stringify(state));
});
```

## API

### Ottomaton([opts])

Returns an Ottomaton instance.

### Ottomaton.run(src) : Promise

Performs the src using all registered actions. If src is a string, it will be split to become lines.

If many actions match a line, they will all be performed in the order in which they were executed.

If no actions match a line, the entire script will be  will be rejected and no actions will be execute. Better to do this than to fail half way through.

Returns a Promise resolving to the computed state of the handlers.

### Ottomaton.register(...)

Registers one or more actions with Ottomaton and returns Ottomaton, so support chaining.

When the handler function for an action is executed it has the same "this" binding as all other handlers. So you can basically use "this" as a scratch pad to remember state as the script runs.

If a handler returns a string, then the string is interpreted as a rewriting of the line being executed.

Many approaches may be used while registering:

```js
// Register using a RegExp
ottomaton.register(/^Greet (.*)$/, function(name) {
  console.log('Hello ' + name);
});

// Register the same action using a String instead. Any quoted portions are treated as Params 
ottomaton.register('Greet "Name"', function(name) {
  console.log('Hello ' + name);
});

// Register an action using a function matcher. This is the most flexible approach
ottomaton.register(function(line) {
  return line.split(/\s+/g);
}, function wordCounter(words) {
  console.log(words.length);
});

// Register a single action as an object
ottomaton.register({
  matcher: /^Greet (.*)$/,
  handler: function(name) {
    console.log(name);
  }
});

// Register an array of actions
ottomaton.register([{
  matcher: /^Greet (.*)$/,
  handler: function(name) {
    console.log(name);
  }
}]);

// Register a collection of actions using a hash shorthand. Only supports string matchers
ottomaton.register({
  'Greet "Name"': function(name) {
    console.log('Hello ' + name); 
  },
  'Snub "Name"': function(name) {
    console.log('Who is ' + name + '?');
  }
});

// Also keep in mind that libraries of actions can be registered by doing:
ottomaton.register(require('library/web-browser'));
```
```


