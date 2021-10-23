class DataSet {

  constructor(bytes) {
    this.bytes = bytes;
    this.length = bytes.length;
    this.sections = [];
    this.indexBuffer = [];
    this.pos = 0;
  }

  get EOF() {
    return this.pos >= this.bytes.length;
  }

  readByte = function(desc = null) {
    if (desc) this.startMarking();
    if (this.EOF) throw("Attempted to read byte past end of stream.");
    var b = this.bytes[this.pos++];
    if (desc) this.stopMarking(`0x${decToHex(b)} = ${b}`, desc);
    return b;
  }

  readByteArray = function(n = null, desc = null) {
    if (n == null) n = this.readULEB128();
    if (this.pos + n > this.bytes.length) throw("Attempted to read byte past end of stream.");
    if (desc) this.startMarking();
    var arr = this.bytes.slice(this.pos, this.pos + n);
    this.pos += n;
    if (desc) this.stopMarking("Array(" + arr.length + ")", desc)
    return Array.from(arr);
  }

  readUInt32 = function(desc = null) {
    if (desc) this.startMarking();
    var x = 0;
    for (let i = 0; i < 4; i++) {
      x += this.readByte() * Math.pow(2, 8*i);
    }
    if (desc) this.stopMarking(x, desc);
    return x;
  }

  readStringWithLength(length = null, desc = null) {
    var str = "";
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.readByte());
    }
    return str;
  }

  readString = function(desc = null) {
    if (desc) this.startMarking();
    var length = this.readByte();
    var str = this.readStringWithLength(length);
    if (desc) this.stopMarking(str, desc);
    return str;
  }

  readULEB128 = function(desc = null) {
    var x = 0;
    var i = 0;
    var stop = false;
    if (desc) this.startMarking();
    while (!stop) {
      let b = this.readByte()
      x += (b % 128) * Math.pow(2, 7*i++);
      stop = ((b & 128) == 0);
    }
    if (desc) this.stopMarking(x, desc);
    return x;
  }

  readLEB128 = function() {
    var x = 0;
    var i = 0;
    var stop = false;
    while (!stop) {
      let b = this.readByte()
      x += (b % 128) * Math.pow(2, 7*i++);
      stop = ((b & 128) == 0);
      if (stop) x-= (b & 128) * Math.pow(2, 7*(i-1));
    }
    return x;
  }

  startMarking = function(value = null, name = null, start = null) {
    if (start === null) start = this.pos;
    this.indexBuffer.push(this.sections.length);
    this.sections.push({
      start: start,
      end: null,
      length: null,
      value: value,
      name: name
    })
  }

  stopMarking = function(value = null, name = null, end = null) {
    if (end === null) end = this.pos;
    var index = this.indexBuffer.pop();
    var section = this.sections[index];
    section.end = end - 1;
    section.length = section.end - section.start + 1;
    if (value !== null) section.value = value;
    if (name !== null) section.name = name;  
    section.toString = () => {
      return (section.name + ":").padEnd(12, " ") + " " + section.value;
    };
  }

  markSection = function(start, length, value, name) {
    var end = start + length;
    this.startMarking(start, value, name);
    this.stopMarking(end);
  }

  getSections = function(byte) {
    return this.sections.filter(section =>
      byte >= section.start && byte <= section.end);
  }
  
  removeAllSections = function() {
    this.sections = [];
  }

  inject = function(bytes, pos) {
    var srcleft = this.bytes.slice(0, pos);
    var srcright = this.bytes.slice(pos);
    this.bytes = new Uint8Array(srcleft.length + srcright.length + bytes.length);
    this.bytes.set(srcleft);
    this.bytes.set(bytes, srcleft.length);
    this.bytes.set(srcright, srcleft.length + bytes.length)
  }

  printHex = function(offset, length, toConsole = true) {
    var col = (offset + 1) % 16;
    var ic = 16 - col;
    var hexStr = " ".repeat(3 * col - 3) +
    Array.from(this.bytes).slice(offset, offset + length).map((x, i) =>
      decToHex(x) + (i % 16 == ic ? "\r\n " : " ")
    ).join("");
    if (toConsole) console.log(hexStr);
    return hexStr;
  }

}