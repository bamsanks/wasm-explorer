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

function hexToDec(h) {
  var ex = 1;
  var res = 0;
  h = h.toUpperCase();
  for (let i = h.length - 1; i >= 0; i--) {
    let v = h.charCodeAt(i);
    v = (v > 64) ? v - 55 : v - 48;
    if (v < 0 || v > 15) throw("Bad hex");
    res += v * ex;
    ex *= 16;
  }
  return res;
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

function highlightSections(byte, hideAllElse = false) {
  var sections = parser.data.getSections(byte).sort((x, y) => x.length < y.length);
  parser.data.getSections(50)
  writeDetails(null, false);
  var numSingles = sections.filter(x => x.length == 1).length;
  var n = sections.length - 1 - numSingles;
  var c = 0;
  for (var cell of viewer.hexCells) {
    cell.style.color = hideAllElse ? "#0004" : "#000";
  }
  for (let i in sections) {
    let section = sections[i];
    if (section.length == 1) c++;
    viewer.highlightSection(section.start, section.end, byte, n - i + c);
    writeDetails(section.toString());
    if (section.name == "Section") {
      writeDetails("Start:       0x" + createByteLink(section.start).outerHTML);
      writeDetails("End:         0x" + createByteLink(section.end).outerHTML);
      writeDetails("Length:      0x" + decToHex(section.length, 2) + " = " + section.length);
    }
  }
}

function unhighlightAllSections() {
  for (let el of globals.cellsToClear) el.removeAttribute("style");
  var st = document.getElementsByClassName("section-start");
  var en = document.getElementsByClassName("section-end");
  for (let i = st.length; i > 0; i--) st[i-1].remove();
  for (let i = en.length; i > 0; i--) en[i-1].remove();
  for (let hex of this.viewer._subViews.hexLines) {
    let cols = hex.getElementsByTagName("div");
    for (let c of cols) {
      c.removeAttribute("style");
      c.classList.remove("section");
    }
  }
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
} else if (urlParams.get("file") == "two") {
  wasm_path = './wasm/two_imports.wasm';
  importObject = {
    "./basic_wasm_bg.js": {
      __wbg_alert_e162fa999d6c31a8: (arg1, arg2) => alert(arg1 + ", " + arg2),
      __wbg_btoa_0e1970a4f9e88993: (arg1, arg2) => alert("btoa: " + arg1 + " " + arg2)
    }
  };
  //importObject = { imports: { imported_func: arg => alert(arg) } };
} else {
  wasm_path = './wasm/basic_wasm_mod.wasm';
  importObject = { imports: { __wbg_alert_e162fa999d6c31a8: (arg1, arg2) => alert(arg1 + ", " + arg2) } };
}

function download() {
  var filename = "modified.wasm";
  var data = new Uint8Array(parser.write());
  var blob = new Blob([data], {type: "application/octet-stream"});
  var element = document.createElement('a');
  element.setAttribute('href', URL.createObjectURL(blob));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
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
      viewer.jumpTo(0x34f0);
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

