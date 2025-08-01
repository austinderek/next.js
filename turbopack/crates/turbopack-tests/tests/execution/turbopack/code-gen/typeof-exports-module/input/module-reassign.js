exports.foo = 1234
module = () => 'hello'
if (typeof module === 'object') throw 'oh no'
