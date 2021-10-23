async function test() {
  parser.sections[4].codes[0].byteCode[3] = 1;
  // parser.sections[1].imports.pop();

  // Add new import
  parser.sections[1].imports.push({
    module: "imports",
    name: "imported_func_2",
    descTag: 0,
    descInfo: 1
  });
  // Add new type
  parser.sections[0].types[1].params = [127];
  parser.sections[0].types[2] = { params:[], returns:[] };
  // Update export to point to last type
  parser.sections[2].types[0] = 2;
  parser.sections[3].exports[0].idx = 2;
  // Re-write binary data, re-parse for sections and print
  parser.write();
  parser.parse();
  viewer.print();

  importObject = {
    imports: {
      imported_func:   arg => alert("1: " + arg),
      imported_func_2: arg => console.log("2: " + arg)
    }
  };

  await parser.instantiateSelf(importObject);
  parser.instance.exports.exported_func();

}

function addDataSection() {
  var nb = 25;
  var dataSection = []
  dataSection[0] = 11;
  dataSection[1] = nb - 2;
  dataSection = dataSection.concat([
    // 1,  0,  65, 128, 128, 192,  0, 11,
    // 14, 72, 101, 108, 108, 111, 44, 20,
    // 87, 111,  114, 108, 100, 33, 11]);
    0x01, 0x00, 0x41, 0x80, 0x80, 0xC0, 0x00, 0x0B,
    0x0E, 0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x2C, 0x14,
    0x57, 0x6F, 0x72, 0x6C, 0x64, 0x21, 0x0B]);
  parser.data.inject(dataSection, 49);

  //parser.parse();
  viewer.print();
}

function addArgToExport() {
  parser.getSection("code").codes[0].byteCode[0] = 32;
  parser.getSection("code").codes[0].byteCode[1] = 0;
  parser.getSection("type").types[1].params = [127];
  parser.write();
  parser.parse();
  viewer.print();
  parser.instantiateSelf();
}