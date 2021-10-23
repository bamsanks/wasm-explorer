class Frame {
  constructor(locals) {
    this.locals = locals;
  }
}

class Machine {

  constructor(parser) {
    this._oldpc;
    this.stack = [];
    this.parser = parser;
    this.blockdepth = 0;
    this.frame = null;
    this.globals = []; // TODO: This should live in a "module" class
  }

  get pc() {
    return this.parser.data.pos;
  }
  set pc(x) {
    this._oldpc = this.pc;
    this.parser.data.pos = x;
  }

  loadFunction = function(locals, pos) {
    var f = new Frame(locals);
    this.frame = f;
    this.stack.push(f);
    this.pc = pos;
  }

  resetPc = () => this.pc = this._oldpc;

  getFn = function(opcode) {
    var fn;
    switch(opcode) {
      case   0: fn = this.instr.unreachable; break;
      case   1: fn = this.instr.nop; break;
      case   2: fn = this.instr.blockstart; break;
      case  11: fn = this.instr.blockend; break;
      case  16: fn = this.instr.call; break;
      case  32: fn = this.instr.local_get; break;
      case  33: fn = this.instr.local_set; break;
      case  34: fn = this.instr.local_tee; break
      case  35: fn = this.instr.global_get; break;
      case  36: fn = this.instr.global_set; break;
      case  65: fn = this.instr.i32const; break;
      case  66: fn = this.instr.i64const; break;
      case  67: fn = this.instr.f32const; break;
      case  68: fn = this.instr.f64const; break;
      case 106: fn = this.instr.add; break;
      default:  throw("Unrecognised opcode");
    }
    return fn;
  }

  static unreachable = function() {
    throw("This code should never be reached.");
  }

  executeBlock = function(popAndReturn) {
    var bd = ++this.blockdepth;
    while (this.blockdepth >= bd) {
      this.tick();
    }
    if (popAndReturn) return this.stack.pop();
  }

  instr = {
    nop: function() {},
    blockstart: function() {
      var blockType = this.parser.data.readByte();
      this.blockdepth++;
      console.log(`Start of block of type ${blockType}, depth now ${this.blockDepth}`);
    }.bind(this),
    
    blockend: function() {
      this.blockdepth--;
      console.log("End of block");
    }.bind(this),

    call: function() {
      var idx = this.parser.data.readULEB128();
      console.log("Call function with index " + idx);
      this.parser.getFunction(idx);
    }.bind(this),

    local_get: function() {
      var localIdx = this.parser.data.readULEB128();
      if (localIdx >= this.frame.locals.length) {
        throw("Local doesn't exist!");
      }
      console.log("Get local " + localIdx);
      this.stack.push(this.frame.locals[localIdx]);
    }.bind(this),

    local_set: function() {
      var localIdx = this.parser.data.readULEB128();
      if (localIdx >= this.frame.locals.length) {
        throw("Local doesn't exist!");
      }
      console.log("Set local " + localIdx);
      this.frame.locals[localIdx] = this.stack.pop();
    }.bind(this),

    local_tee: function() {
      var localIdx = this.parser.data.readULEB128();
      if (localIdx >= this.frame.locals.length) {
        throw("Local doesn't exist!");
      }
      console.log("Tee local " + localIdx);
      this.frame.locals[localIdx] = this.stack.pop();
      this.stack.push(this.frame.locals[localIdx]);
    }.bind(this),

    global_get: function() {
      var globalIdx = this.parser.data.readULEB128();
      var val = this.globals[globalIdx];
      if (typeof val === "undefined") {
        throw("Global doesn't exist!");
      }
      this.stack.push(val);
    }.bind(this),

    global_set: function() {
      // TODO: Do we need to instantiate globals anywhere?
      var globalIdx = this.parser.data.readULEB128();
      var val = this.stack.pop();
      this.globals[globalIdx] = val;
    }.bind(this),

    i32const: function() {
      var val = this.parser.data.readULEB128();
      this.stack.push(val);
      console.log("Pushed constant to stack: " + val);
    }.bind(this),

    add: function() {
      var arg1 = this.stack.pop(); // this.parser.data.readLEB128();
      var arg2 = this.stack.pop(); // this.parser.data.readLEB128();
      this.stack.push(arg1 + arg2);
      console.log("Pushed add result to stack");
    }.bind(this)
  }

  tick = function() {
    var opcode = this.parser.data.readByte();
    this.getFn(opcode)();
    return opcode;
  }
}