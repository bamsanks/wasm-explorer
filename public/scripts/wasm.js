// TODO: Split parser into two classes - WasmReader and Wasm?

class Parser {

  static SECTION_CODES = [
    "Custom",   "Type",   "Import",
    "Function", "Table",  "Memory",
    "Global",   "Export", "Start",
    "Element",  "Code",   "Data"];
  static SECTION_ENUMS = {
    CUSTOM:   0, TYPE:   1, IMPORT: 2,
    FUNCTION: 3, TABLE:  4, MEMORY: 5,
    GLOBAL:   6, EXPORT: 7, START:  8,
    ELEMENT:  9, CODE:  10, DATA:  11 };
  static MAGIC_NUMBER = 1836278016;

  constructor(data) {
    this.data = data;
    this._version = null;
    this.sections = [];
    this.machine = new Machine(this);
    this.globals = [];
    this.memory = [];
  }

  getSection = function(s) {
    if (typeof s === "string") {
      return this.sections.find(x => x.section.toUpperCase() == s.toUpperCase());
    } else {
      return this.sections.find(x => x.sectionId == s);
    }
  }

  readExpression = function() {
    // TODO: implement. expressions and blocks end in 0x0B
  }

  readValType = function(desc) {
    var b = this.data.readByte(desc);
    if (b > 123 && b < 128) return b;
    throw("Invalid ValType");
  }

  writeUInt32 = function(n) {
    var out = [];
    for (let i = 0; i < 4; i++) {
      let v = n % 256;
      out.push(v);
      n = (n - v) / 256;
    }
    return out;
  }

  writeByte = function(n) {
    return [n % 256];
  }

  writeByteArray = function(arr) {
    return arr;
  }

  writeULEB128 = function(n) {
    var arr = [];
    if (n == 0) arr = [0];
    while (n > 0) {
      let v = n % 128;
      n = (n - v) / 128;
      if (n > 0) v += 128;
      arr.push(v);
    }
    return arr;
  }

  writeString = function(str) {
    var out = this.writeULEB128(str.length);
    return out.concat(str.split("").map(x => x.charCodeAt(0)));
  }
  
  readMagicNumber = function() {
    this.data.startMarking();
    if (this.data.readUInt32() != Parser.MAGIC_NUMBER) throw("Invalid magic number!");
    this.data.stopMarking("Magic Number = " + Parser.MAGIC_NUMBER, "UInt32");
  }

  writeMagicNumber = function() {
    return this.writeUInt32(Parser.MAGIC_NUMBER);
  }
  
  readVersion = function() {
    this.data.startMarking("Version number", "UInt32");
    this._version = this.data.readUInt32();
    this.data.stopMarking()
  }

  writeVersion = function() {
    return this.writeUInt32(1);
  }
  
  readSection = function() {
    var section = {};
    this.data.startMarking();
    section.sectionId = this.data.readByte("ID byte");
    section.section = Parser.SECTION_CODES[section.sectionId];
    section.length = this.data.readULEB128("Byte count");
    var description = section.section + " section";
    switch (section.sectionId) {
      case Parser.SECTION_ENUMS.TYPE: // ID = 0x01
        section = this.readSectionType(section);
        break;
      case Parser.SECTION_ENUMS.IMPORT: // ID = 0x02
        section = this.readSectionImport(section);
        break;
      case Parser.SECTION_ENUMS.FUNCTION: // ID = 0x03
        section = this.readSectionFunction(section);
        break;
      case Parser.SECTION_ENUMS.MEMORY: // ID = 0x05
        section = this.readSectionMemory(section);
        break;
      case Parser.SECTION_ENUMS.GLOBAL: // ID = 0x06
        section = this.readSectionGlobal(section);
        break;
      case Parser.SECTION_ENUMS.EXPORT: // ID = 0x07
        section = this.readSectionExports(section);
        break;
      case Parser.SECTION_ENUMS.CODE: // ID = 0x0A
        section = this.readSectionCode(section);
        break;
      case Parser.SECTION_ENUMS.DATA: // ID = 0x0B
        section = this.readSectionData(section);
        break;
      default:
        console.log("Skipped " + section.section + " section");
        // this doesn't include the section id and length!
        section.rawdata = this.data.readByteArray(section.length);
    }
    this.data.stopMarking(description, "Section");
    this.sections.push(section);
  }

  readSectionType = function(template) {
    this.data.startMarking();
    var count = this.data.readULEB128();
    this.data.stopMarking(count, "Num entries");
    template.types = [];
    for (var i = 0; i < count; i++) {
      this.data.startMarking();
      template.types.push(this.readType());
      this.data.stopMarking(i, "Type entry");
    }
    return template;
  }

  readSectionImport = function(template) {
    var count = this.data.readULEB128("Num entries");
    template.imports = [];
    for (let i = 0; i < count; i++) {
      this.data.startMarking(i, "Import idx");
      template.imports.push({
        module: this.data.readString("Module"),
        name: this.data.readString("Name"),
        tag: this.data.readByte("Tag"),
        index: this.data.readULEB128("Index")
      });
      this.data.stopMarking();
    }
    return template;
  }

  readSectionFunction = function(template) {
    var count = this.data.readULEB128("Num funcs");
    template.types = [];
    for (let i = 0; i < count; i++) {
      this.data.startMarking(i, "Definition");
      template.types.push(this.data.readULEB128());
      this.data.stopMarking();
    }
    return template;
  }

  readSectionMemory = function(template) {
    var count = this.data.readULEB128();
    template.memories = [];
    for (let i = 0; i < count; i++) {
      let hasMax = (this.data.readByte() == 1);
      template.memories.push({
        min: this.data.readULEB128(),
        max: hasMax ? this.data.readULEB128() : null
      });
    }
    return template;
  }

  readSectionGlobal = function(template) {
    var count = this.data.readULEB128();
    template.globals = [];
    var pos = this.data.pos;
    for (let i = 0; i < count; i++) {
      var g = {
        type: this.readValType(),
        mutable: this.data.readByte() == 1,
        value: this.machine.executeBlock(true) // THIS IS NOT ALWAYS GOING TO BE 6!
      };
      template.globals.push(g);
      this.machine.globals.push(g.value);
    }

    return template;
  }
  
  readSectionExports = function(template) {
    var count = this.data.readULEB128();
    template.exports = [];
    for (let i = 0; i < count; i++) {
      this.data.startMarking(i, "Export idx");
      let item = {
        name: this.data.readString("Name"),
        tag: this.data.readByte("Tag"),
        index: this.data.readULEB128("Index")
      };
      this.data.stopMarking();
      item.getFunction = function() {
        return this.getInternalFunction(item.index);
      }.bind(this);
      template.exports.push(item);
    }
    return template;
  }
  
  readSectionCode = function(template) {
    //this.data.markSection(1, "Number of codes", "Detail");
    var count = this.data.readULEB128("Num entries");
    template.codes = [];
    //template.codepos = [];
    for (let i = 0; i < count; i++) {
      this.data.startMarking("Code entry " + i, "Detail");
      //template.codepos.push(this.data.pos);
      template.codes.push(this.readCode());
      this.data.stopMarking();
    }
    return template;
  }

  readSectionData = function(template) {
    var count = this.data.readULEB128();
    template.datas = [];
    for (let i = 0; i < count; i++) {
      var t = {
        memIdx: this.data.readULEB128(),
        offset: this.machine.executeBlock(true),
        init: this.data.readByteArray()
      };
      template.datas.push(t);
      let datalen = t.init.length;
      for (let j = 0; j < datalen; j++) {
        this.memory[t.offset + j] = t.init[j];
      }
    }
    return template;
  }

  readCode = function() {
    var size = this.data.readULEB128("Entry size");
    this.data.startMarking("Locals", "Subsection");
    var startRef = this.data.pos;
    var numLocals = this.data.readULEB128("Num locals");
    var locals = [];
    for (let i = 0; i < numLocals; i++) {
      locals.push({
        N: this.data.readULEB128("Count"),
        valType: this.readValType("Data type")
      });
    }
    this.data.stopMarking();
    var byteCode = [];
    var bytePos = this.data.pos;
    var remainder = size - (this.data.pos - startRef);
    // TODO: Implement readExpression rather than "reading the rest"
    this.data.startMarking("Code", "Subsection")
    for (let i = 0; i < remainder; i++) {
      byteCode.push(this.data.readByte());
    }
    this.data.stopMarking()
    return {
      locals: locals,
      byteCode: byteCode,
      bytePos: bytePos,
      printHex: () => this.data.printHex(bytePos, byteCode.length),
      loadToMachine: () => this.machine.loadFunction(locals, bytePos)
    }
  }

  readType = function() {
    // Types start with the function tag 0x60 = 96
    if (this.data.readByte() != 96) throw("Invalid type - unexpected value in tag byte");
    var params = [], returns = [];
    var numParams = this.data.readULEB128("Num params");
    for (let i = 0; i < numParams; i++) params.push(this.readValType("Parameter"));
    var numReturns = this.data.readULEB128("Num returns");
    for (let i = 0; i < numReturns; i++) returns.push(this.readValType("Return"));
    return { params: params, returns: returns };
  }
  
  writeSection = function(section) {
    var out = [];
    switch(section.sectionId) {
      case Parser.SECTION_ENUMS.TYPE: // ID = 0x01
        out = out.concat(this.writeSectionType(section));
        break;
      case Parser.SECTION_ENUMS.IMPORT: // ID = 0x02
        out = out.concat(this.writeSectionImport(section));
        break;
      case Parser.SECTION_ENUMS.FUNCTION: // ID = 0x03
        out = out.concat(this.writeSectionFunction(section));
        break;
      case Parser.SECTION_ENUMS.MEMORY: // ID = 0x05
        out = out.concat(this.writeSectionMemory(section));
        break;
      case Parser.SECTION_ENUMS.GLOBAL: // ID = 0x06
        out = out.concat(this.writeSectionGlobal(section));
        break;
      case Parser.SECTION_ENUMS.EXPORT: // ID = 0x07
        out = out.concat(this.writeSectionExport(section));
        break;
      case Parser.SECTION_ENUMS.CODE: // ID = 0x0A
        out = out.concat(this.writeSectionCode(section));
        break;
      case Parser.SECTION_ENUMS.DATA: // ID = 0x0A
        out = out.concat(this.writeSectionData(section));
        break;
      default:
        out = out.concat(section.rawdata) // Unhandled, so just write what we read in
    }
    out = this.writeULEB128(out.length).concat(out);
    out = this.writeByte(section.sectionId).concat(out);
    return out;
  }

  writeSectionType = function(section) {
    var out = [];
    out = out.concat(section.types.length);
    for (let i = 0; i < section.types.length; i++) {
      out = out.concat(this.writeType(section.types[i]));
    }
    return out;
  }

  writeSectionImport = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.imports.length));
    for (let i = 0; i < section.imports.length; i++) {
      out = out.concat(this.writeString(section.imports[i].module));
      out = out.concat(this.writeString(section.imports[i].name));
      out = out.concat(this.writeByte(section.imports[i].tag));
      out = out.concat(this.writeULEB128(section.imports[i].index));
    }
    return out;
  }

  writeSectionFunction = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.types.length));
    for (let i = 0; i < section.types.length; i++) {
      out = out.concat(this.writeULEB128(section.types[i]));
    }
    return out;
  }

  writeSectionMemory = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.memories.length));
    for (let i = 0; i < section.memories.length; i++) {
      let hasMax = section.memories[i].max !== null;
      out = out.concat(this.writeByte(hasMax));
      out = out.concat(this.writeULEB128(section.memories[i].min));
      if (hasMax) {
        out = out.concat(this.writeULEB128(section.memories[i].max));
      }
    }
    return out;
  }

  writeSectionGlobal = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.globals.length));
    for (let i = 0; i < section.globals.length; i++) {
      out = out.concat(this.writeByte(section.globals[i].type));
      out = out.concat(this.writeByte(section.globals[i].mutable));
      out = out.concat(this.writeByteArray(section.globals[i].expr));
    }
    return out;
  }

  writeSectionExport = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.exports.length));
    for (let i = 0; i < section.exports.length; i++) {
      out = out.concat(this.writeString(section.exports[i].name));
      out = out.concat(this.writeByte(section.exports[i].tag));
      out = out.concat(this.writeULEB128(section.exports[i].index));
    }
    return out;
  }

  writeSectionCode = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.codes.length));
    for (let i = 0; i < section.codes.length; i++) {
      out = out.concat(this.writeCode(section.codes[i]));
    }
    return out;
  }

  writeSectionData = function(section) {
    var out = [];
    out = out.concat(this.writeULEB128(section.datas.length));
    for (let data of section.datas) {
      var expr = [65, 128, 128, 192, 0, 11];
      out = out.concat(this.writeULEB128(data.memIdx));
      out = out.concat(this.writeULEB128(expr.length));
      out = out.concat(this.writeByteArray(expr));
      out = out.concat(this.writeByteArray(data.init));
    }
    return out;
  }

  writeCode = function(code) {
    var out = [];
    out = out.concat(this.writeULEB128(code.locals.length));
    for (let local of code.locals) {
      out = out.concat(this.writeULEB128(local.N));
      out = out.concat(this.writeByte(local.valType));
    }
    out = out.concat(this.writeByteArray(code.byteCode));
    var size = out.length;
    out = this.writeULEB128(size).concat(out);
    return out;
  }

  writeType = function(type) {
    var out = [];
    // Types start with the function tag 0x60 = 96
    out = out.concat(96);
    out = out.concat(this.writeULEB128(type.params.length));
    for (let i = 0; i < type.params.length; i++) out = out.concat(type.params[i]);
    out = out.concat(this.writeULEB128(type.returns.length));
    for (let i = 0; i < type.returns.length; i++) out = out.concat(type.returns[i]);
    return out;
  }

  getInternalFunction = function(funcIdx) {
    //var exports = parser.getSection(Parser.SECTION_ENUMS.EXPORT).exports;
    var functions = this.getSection("function").types;
    var types = this.getSection("type").types;
    var codes = this.getSection("code").codes;
    var numImports = this.getSection("import").imports.length;
    var codeIdx = funcIdx < numImports ? null : funcIdx - numImports;
    var typeIdx = functions[codeIdx];
    
    return {
      types: types[typeIdx],
      code: codes[codeIdx]
    }
  }
  
  parse = function() {
    this.data.pos = 0;
    this.sections = [];
    this.data.removeAllSections();
    this.readMagicNumber();
    this.readVersion();
    while (!this.data.EOF) {
      this.readSection();
    }
    this.createExports();
  }

  createExports = function() {
    var exports = this.getSection("EXPORT").exports;
    var types = this.getSection("TYPE").types;
    exports = exports.filter(x => x.tag == 0);
    for (var item of exports) {
      item.type = types[item.index];
      //delete item.index;
      item.call = () => Machine.run
    }
    this.exports = exports;
  }

  write = function(updateSelf = true) {
    var out = [];
    out = out.concat(this.writeMagicNumber())
    out = out.concat(this.writeVersion())
    for (var section of this.sections) {
      if (section) out = out.concat(this.writeSection(section));
    }
    if (updateSelf) this.data.bytes = out;
    return out;
  }

  instantiateSelf = async function(importObject = null) {
    var buffer = new Uint8Array(this.data.bytes).buffer;
    importObject = importObject ?? { imports: { imported_func: arg => alert(arg) } };
    var module = await WebAssembly.instantiate(buffer, importObject);
    this.instance = module.instance;
    this.module = module;
    return module.instance;
  }

}