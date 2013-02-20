var Stream = require('stream'),
    Util = require('util');

function BufferReadStream(buffer) {
    this.readable = true;
    this.writable = false;
    this._buffer = buffer;
};
Util.inherits(BufferReadStream, Stream);

BufferReadStream.prototype.write = function () {
  var args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['data'].concat([this._buffer]));
};
BufferReadStream.prototype.end = function () {
  var args = Array.prototype.slice.call(arguments, 0);
  this.emit.apply(this, ['end'].concat(args));
};
module.exports = BufferReadStream;