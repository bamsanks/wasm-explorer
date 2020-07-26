class Machine {

  constructor(bytecode, parser) {
    this.bytecode = bytecode;
    this.pc = 0;
    this.stack = [];
    this.parser = parser;
  }

  getFn = function(opcode) {
    var fn;
    switch(opcode) {
      case   0: fn = this.unreachable; break;
      case   1: fn = this.nop; break;
      case   2: fn = this.blockstart; break;
      case  11: fn = this.blockend; break;
      case  16: fn = this.call; break;
      case  65: fn = this.i32const; break;
      case  66: fn = this.i64const; break;
      case  67: fn = this.f32const; break;
      case  68: fn = this.f64const; break;
      case 106: fn = this.add; break;
      default:  throw("Unrecognised opcode");
    }
    return fn;
  }

  static unreachable = function() {
    throw("This code should never be reached.");
  }

  nop = function() {};
  blockstart = function() {
    var blockType = this.readByte();
    console.log("Start of block of type " + blockType);
  }.bind(this);

  call = function() {
    var idx = this.readULEB128();
    console.log("Call function with index " + idx);
    this.parser.getFunction(idx);
  }.bind(this);

  i32const = function() {
    this.stack.push(this.readULEB128());
    console.log("Pushed constant to stack");
  }.bind(this);

  add = function() {
    var arg1 = this.readLEB128();
    var arg2 = this.readLEB128();
    this.stack.push(arg1 + arg2);
    console.log("Pushed add result to stack");
  }.bind(this);

  blockend = function() {
    console.log("End of block.");
  }

  readByte = function() {
    if (this.pc >= this.bytecode.length) throw("Attempt to read past end of stream!");
    return this.bytecode[this.pc++];
  }

  readULEB128 = function() {
    var x = 0;
    var i = 0;
    var stop = false;
    while (!stop) {
      let b = this.readByte()
      x += (b % 128) * Math.pow(2, 7*i++);
      stop = ((b & 128) == 0);
    }
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

  tick = function() {
    var opcode = this.readByte();
    this.getFn(opcode)();
  }
}