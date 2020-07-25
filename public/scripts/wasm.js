class Index {
  
  constructor() {
    this.sections = [];
  }

  markSection = function(start, length, description, type) {
    this.sections.push({
      start: start,
      end: start + length - 1,
      length: length,
      description: description,
      type: type,
      toString: function() { return type + ": " + description }
    });
  }

  getSections = function(byte) {
    return this.sections.filter(section =>
      byte >= section.start && byte <= section.end);
  }
};

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

  constructor(bytes) {
    this._bytes = bytes;
    this._fileLength = bytes.length;
    this._pos = 0;
    this._version = null;
    this._sections = [];
    this.index = new Index();
  }

  get EOF() {
    return this._pos >= this._fileLength;
  }

  readByte = function() {
    if (this.EOF) throw("Attempted to read byte past end of stream.");
    return this._bytes[this._pos++];
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
  
  readMagicNumber = function() {
    this.index.markSection(this._pos, 4, "Magic Number", "UInt32");
    if (this.readByte() != 0   ||
        this.readByte() != 97  ||
        this.readByte() != 115 ||
        this.readByte() != 109) throw("Invalid magic number!");
  }
  
  readVersion = function() {
    this.index.markSection(this._pos, 4, "Version number", "UInt32");
    this._version = this.readUInt32();
  }
  
  readSection = function() {
    var section = {};
    var headerStart = this._pos;
    section.typeId = this.readByte();
    section.type = Parser.SECTION_CODES[section.typeId];
    section.length = this.readULEB128();
    var description = section.type + " section";
    var headerLength = this._pos - headerStart;
    this.index.markSection(this._pos - headerLength, section.length + headerLength, description, "Section");
    switch (section.typeId) {
      case Parser.SECTION_ENUMS.TYPE:
        section = this.readSectionType(section);
        break;
      case Parser.SECTION_ENUMS.IMPORT:
        section = this.readSectionImport(section);
        break;
      case Parser.SECTION_ENUMS.FUNCTION:
        section = this.readSectionFunction(section);
        break;
      case Parser.SECTION_ENUMS.EXPORT:
        section = this.readSectionExports(section);
        break;
      case Parser.SECTION_ENUMS.CODE:
        section = this.readSectionCode(section);
        break;
      default:
        console.log("Skipped " + section.typeId + " section");
        this._pos += section.length;
    }
    this._sections.push(section);
  }

  readSectionType = function(template) {
    var count = this.readByte();
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
  
  readSectionExports = function(template) {
    var count = this.readULEB128();
    template.exports = [];
    for (let i = 0; i < count; i++) {
      template.exports.push({
        name: this.readString(),
        tag: this.readByte(),
        idx: this.readULEB128()
      });
    }
    return template;
  }
  
  readSectionCode = function(template) {
    var count = this.readULEB128();
    template.codes = [];
    for (let i = 0; i < count; i++) {
      template.codes.push(this.readCode());
    }
    return template;
  }

  readCode = function() {
    var size = this.readULEB128();
    var startRef = this._pos;
    var numLocals = this.readULEB128();
    var locals = [];
    for (let i = 0; i < numLocals; i++) {
      locals.push({
        N: this.readULEB128(),
        valType: this.readValType()
      });
    }
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
  
  parse = function() {
    this.readMagicNumber();
    this.readVersion();
    while (!this.EOF) {
      this.readSection();
    }
  }

}