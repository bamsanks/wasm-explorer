var globals = {
  cellsToClear: []
}



function decToHex(d, pad = 2) {
  var c;
  var h = "";
  while (d > 0) {
    c = d % 16;
    d = (d - c) / 16;
    if (c > 9) c = String.fromCharCode(c + 87);
    h = c + h;
  }
  return h.padStart(pad, "0");
}


function convertToChar(val) {
  if (val == 32) return "&nbsp;";
  return (val > 32 && val < 127) ? String.fromCharCode(val) : ".";
}

function getViewer() {
  return document.getElementById("hex-viewer");
}

function writeDetails(details, append = true) {
  var el = document.getElementById("details");
  if (!append) el.textContent = "";
  if (details !== null) el.innerHTML += details + "<br>";
}

function createByteLink(pos) {
  var link = document.createElement("a");
  link.setAttribute("onclick", "viewer.jumpTo(" + pos + ");");
  link.href = "#";
  link.textContent = decToHex(pos, 8);
  return link;
}

function highlightSections(byte) {
  var sections = parser.data.getSections(byte);
  writeDetails(null, false);
  for (let section of sections) {
    viewer.highlightSection(section.start, section.end);
    writeDetails(section.toString());
    if (section.type == "Section") {
      writeDetails("Start:       0x" + createByteLink(section.start).outerHTML);
      writeDetails("End:         0x" + createByteLink(section.end).outerHTML);
      writeDetails("Length:      0x" + decToHex(section.length, 8));
    }
  }
}

function unhighlightAllSections() {
  for (let el of globals.cellsToClear) el.removeAttribute("style");
  var st = document.getElementsByClassName("section-start");
  var en = document.getElementsByClassName("section-end");
  for (let i = st.length; i > 0; i--) st[i-1].remove();
  for (let i = en.length; i > 0; i--) en[i-1].remove();
}

var parser;
var viewer;
var dataset;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
var wasm_path;
var importObject;

if (urlParams.get("file") == "small") {
  wasm_path = './wasm/simple.wasm';
  importObject = { imports: { imported_func: arg => alert(arg) } };
} else if (urlParams.get("file") == "edited") {
  wasm_path = './wasm/edited.wasm';
  importObject = { imports: { imported_func: arg => alert(arg) } };
} else {
  wasm_path = './wasm/basic_wasm_mod.wasm';
  importObject = { imports: { __wbg_alert_e162fa999d6c31a8: (arg1, arg2) => alert(arg1 + ", " + arg2) } };
}

var wasmMod;

window.onload = function() {

  fetch(wasm_path)
  .then(data => {
    data.body.getReader().read().then(res => {
      wasmData = new DataSet(res.value);
      viewer = new Viewer(wasmData, getViewer());
      parser = new Parser(wasmData);
      viewer.print();
      parser.parse();
    });
  });

  // WebAssembly.compileStreaming(fetch(wasm_path))
  // .then(function(mod) {
  //   var imports = WebAssembly.Module.imports(mod);
  //   console.log(imports[0]);
  // });

  WebAssembly.instantiateStreaming(fetch(wasm_path), importObject)
  .then(function(mod) {
    wasmMod = mod.instance.exports;
    //mod.instance.exports.exported_func();
  });
}