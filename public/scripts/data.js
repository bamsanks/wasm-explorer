class DataSet {

  constructor(bytes) {
    this.bytes = bytes;
    this.length = bytes.length;
    this.sections = [];
    this.indexBuffer = [];
  }

  startMarking = function(start, description, type) {
    this.indexBuffer.push(this.sections.length);
    this.sections.push({
      start: start,
      end: null,
      length: null,
      description: description,
      type: type
    })
  }

  stopMarking = function(end, description = null, type = null) {
    var index = this.indexBuffer.pop();
    var section = this.sections[index];
    section.end = end - 1;
    section.length = section.end - section.start + 1;
    if (description !== null) section.description = description;
    if (type !== null) section.type = type;  
    section.toString = () => {
      return (section.type + ":").padEnd(12, " ") + " " + section.description;
    };
  }

  markSection = function(start, length, description, type) {
    var end = start + length;
    this.startMarking(start, description, type);
    this.stopMarking(end);
    // this.sections.push({
    //   start: start,
    //   end: start + length - 1,
    //   length: length,
    //   description: description,
    //   type: type,
    //   toString: function() { return type + ": " + description }
    // });
  }

  getSections = function(byte) {
    return this.sections.filter(section =>
      byte >= section.start && byte <= section.end);
  }
  
  removeAllSections = function() {
    this.sections = [];
  }

}