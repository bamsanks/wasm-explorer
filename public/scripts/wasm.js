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
  static MAGIC_NUMBER = [0, 97, 115, 109];

  constructor(data) {
    this.data = data;
    this._bytes = data.bytes;
    this._fileLength = data.bytes.length;
    this._pos = 0;
    this._version = null;
    this.sections = [];
  }

  get EOF() {
    return this._pos >= this._fileLength;
  }

  readByte = function() {
    if (this.EOF) throw("Attempted to read byte past end of stream.");
    return this._bytes[this._pos++];
  }

  readByteArray = function(n) {
    if (this._pos + n > this._fileLength) throw("Attempted to read byte past end of stream.");
    var arr = this._bytes.slice(this._pos, this._pos + n);
    this._pos += n;
    return Array.from(arr);
  }

  readExpression = function() {
    // TODO: implement. expressions end in 0x0B
  }

  readString = function(length = null) {
    var str = "";
    if (length === null) length = this.readByte();
    for (let i = 0; i < length; i++) {
      str += String.fromCharCode(this.readByte());
    }
    return str;
  }

  readValType = function() {
    var b = this.readByte();
    if (b > 123 && b < 128) return b;
    throw("Invalid ValType");
  }
  
  readUInt32 = function() {
    var x = 0;
    for (let i = 0; i < 4; i++) {
      x += this.readByte() * Math.pow(2, 8*i);
    }
    return x;
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

  writeByte = function(n) {
    return [n % 256];
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
    this.data.markSection(this._pos, Parser.MAGIC_NUMBER.length, "Magic Number", "UInt32");
    for (var b of Parser.MAGIC_NUMBER) {
      if (this.readByte() != b) throw("Invalid magic number!");
    }
  }

  writeMagicNumber = function() {
    return Parser.MAGIC_NUMBER;
  }
  
  readVersion = function() {
    this.data.markSection(this._pos, 4, "Version number", "UInt32");
    this._version = this.readUInt32();
  }

  writeVersion = function() {
    return this.writeUInt32(1);
  }
  
  readSection = function() {
    var section = {};
    var headerStart = this._pos;
    this.data.startMarking(this._pos);
    section.typeId = this.readByte();
    section.type = Parser.SECTION_CODES[section.typeId];
    this.data.startMarking(this._pos, "Section length", "Detail");
    section.length = this.readULEB128();
    this.data.stopMarking(this._pos);
    var description = section.type + " section";
    var headerLength = this._pos - headerStart;
    this.data.stopMarking(this._pos + section.length, description, "Section");
    switch (section.typeId) {
      case Parser.SECTION_ENUMS.TYPE: // ID = 0x01
        section = this.readSectionType(section);
        break;
      case Parser.SECTION_ENUMS.IMPORT: // ID = 0x02
        section = this.readSectionImport(section);
        break;
      case Parser.SECTION_ENUMS.FUNCTION: // ID = 0x03
        section = this.readSectionFunction(section);
        break;
      case Parser.SECTION_ENUMS.MEMORY: // ID = 0x04
        section = this.readSectionMemory(section);
        break;
      case Parser.SECTION_ENUMS.GLOBAL: // ID = 0x05
        section = this.readSectionGlobal(section);
        break;
      case Parser.SECTION_ENUMS.EXPORT: // ID = 0x07
        section = this.readSectionExports(section);
        break;
      case Parser.SECTION_ENUMS.CODE: // ID = 0x0A
        section = this.readSectionCode(section);
        break;
      // case Parser.SECTION_ENUMS.DATA: // ID = 0x0B
      //   section = this.readSectionData(section);
      //   break;
      default:
        console.log("Skipped " + section.typeId + " section");
        //this._pos += section.length;
        section.rawdata = [section.typeId]
          .concat(this.writeULEB128(section.length))
          .concat(this.readByteArray(section.length));
    }
    this.sections.push(section);
  }

  readSectionType = function(template) {
    var count = this.readULEB128();
    template.types = [];
    for (var i = 0; i < count; i++) {
      template.types.push(this.readType());
    }
    return template;
  }

  readSectionImport = function(template) {
    var count = this.readULEB128();
    template.imports = [];
    for (let i = 0; i < count; i++) {
      template.imports.push({
        module: this.readString(),
        name: this.readString(),
        desc: this.readString(),
        descTag: this.readByte()
      });
    }
    return template;
  }

  readSectionFunction = function(template) {
    var count = this.readULEB128();
    template.types = [];
    for (let i = 0; i < count; i++) {
      template.types.push(this.readULEB128());
    }
    return template;
  }

  readSectionMemory = function(template) {
    var count = this.readULEB128();
    template.memories = [];
    for (let i = 0; i < count; i++) {
      let hasMax = (this.readByte() == 1);
      template.memories.push({
        min: this.readULEB128(),
        max: hasMax ? this.readULEB128() : null
      });
    }
    return template;
  }

  readSectionGlobal = function(template) {
    var count = this.readULEB128();
    template.globals = [];
    for (let i = 0; i < count; i++) {
      template.globals.push({
        type: this.readValType(),
        mutable: this.readByte() == 1,
        expr: this.readByteArray(6) // THIS IS NOT NECESSARILY 6!
      });
    }
    return template;
  }
  
  readSectionExports = function(template) {
    var count = this.readULEB128();
    template.exports = [];
    for (let i = 0; i < count; i++) {
      let item = {
        name: this.readString(),
        tag: this.readByte(),
        idx: this.readULEB128()
      };
      item.getByteCode = () => this.getByteCode(item.name);
      template.exports.push(item);
    }
    return template;
  }
  
  readSectionCode = function(template) {
    this.data.markSection(this._pos, 1, "Number of codes", "Detail");
    var count = this.readULEB128();
    template.codes = [];
    for (let i = 0; i < count; i++) {
      this.data.startMarking(this._pos, "Code entry " + i, "Detail");
      template.codes.push(this.readCode());
      this.data.stopMarking(this._pos);
    }
    return template;
  }

  // TODO: Implement
  // readSectionData = function(template) {
  //   var count = this.readULEB128();
  //   template.datas = [];
  //   for (let i = 0; i < count; i++) {
  //     template.datas.push({
  //       memIdx: this.readULEB128(),
  //       offset: ,
  //       init: 
  //     }
  //   }
  //   return template;
  // }

  readCode = function() {
    this.data.startMarking(this._pos, "Entry size", "Detail");
    var size = this.readULEB128();
    this.data.stopMarking(this._pos);
    this.data.startMarking(this._pos, "Locals", "Subsection");
    var startRef = this._pos;
    var numLocals = this.readULEB128();
    var locals = [];
    for (let i = 0; i < numLocals; i++) {
      locals.push({
        N: this.readULEB128(),
        valType: this.readValType()
      });
    }
    this.data.stopMarking(this._pos);
    var byteCode = [];
    var remainder = size - (this._pos - startRef);
    for (let i = 0; i < remainder; i++) {
      byteCode.push(this.readByte());
    }
    return { locals: locals, byteCode: byteCode }
  }

  readType = function() {
    if (this.readByte() != 96) throw("Invalid type - unexpected value in tag byte");
    var params = [], returns = [];
    var numParams = this.readULEB128();
    for (let i = 0; i < numParams; i++) params.push(this.readValType());
    var numReturns = this.readULEB128();
    for (let i = 0; i < numReturns; i++) returns.push(this.readValType());
    return { params: params, returns: returns };
  }
  
  writeSection = function(section) {
    var out = [];
    out = out.concat(section.typeId) // Maybe enforce less than 256? writeByte function?
    out = out.concat(this.writeULEB128(section.length));
    switch(section.typeId) {
      case Parser.SECTION_ENUMS.TYPE: // ID = 0x01
        out = out.concat(this.writeSectionType(section));
        break;
      case Parser.SECTION_ENUMS.IMPORT: // ID = 0x02
        out = out.concat(this.writeSectionImport(section));
        break;
      // case Parser.SECTION_ENUMS.FUNCTION: // ID = 0x03
      //   out = out.concat(this.writeSectionFunction(section));
      //   break;
      // case Parser.SECTION_ENUMS.MEMORY: // ID = 0x04
      //   out = out.concat(this.writeSectionMemory(section));
      //   break;
      // case Parser.SECTION_ENUMS.GLOBAL: // ID = 0x05
      //   out = out.concat(this.writeSectionGlobal(section));
      //   break;
      // case Parser.SECTION_ENUMS.EXPORT: // ID = 0x07
      //   out = out.concat(this.writeSectionExport(section));
      //   break;
      // case Parser.SECTION_ENUMS.CODE: // ID = 0x0A
      //   out = out.concat(this.writeSectionCode(section));
      //   break;
      default:
        out = out.concat(section.rawdata) // Unhandled, so just write what we read in
    }
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
      out = out.concat(this.writeString(section.imports[i].desc));
      out = out.concat(this.writeByte(section.imports[i].descTag));
    }
    return out;
  }

  writeType = function(type) {
    var out = [];
    out = out.concat(96);
    out = out.concat(this.writeULEB128(type.params.length));
    for (let i = 0; i < type.params.length; i++) out = out.concat(type.params[i]);
    out = out.concat(this.writeULEB128(type.returns.length));
    for (let i = 0; i < type.returns.length; i++) out = out.concat(type.returns[i]);
    return out;
  }

  getByteCode = function(functionName) {
    var exports = parser.sections[Parser.SECTION_ENUMS.EXPORT].exports;
    var codes = parser.sections[Parser.SECTION_ENUMS.CODE].codes;
    for (let i in exports) {
      if (exports[i].name == functionName) {
        return codes[i].byteCode;
      }
    }
  }
  
  parse = function() {
    this.readMagicNumber();
    this.readVersion();
    while (!this.EOF) {
      this.readSection();
    }
  }

  write = function() {
    var out = [];
    out = out.concat(this.writeMagicNumber())
    out = out.concat(this.writeVersion())
    for (var section of this.sections) {
      if (section) out = out.concat(this.writeSection(section));
    }
    return out;
  }

}