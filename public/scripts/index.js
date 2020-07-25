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

function createRow(data) {
  var i = 0;
  return data.map(x => {
    var el = document.createElement("div");
    el.innerHTML = x;
    el.setAttribute("data-col", i++);
    return el;
  });
}



function resizeViewer(numLines) {
  var scroller = document.getElementById("scroller");
  var dummy = scroller.getElementsByTagName("div")[0];
  dummy.style.height = numLines * 40 + "px";
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
  link.textContent = decToHex(pos);
  return link;
}

function highlightSections(byte) {
  var sections = parser.index.getSections(byte);
  writeDetails(null, false);
  for (let section of sections) {
    viewer.highlightSection(section.start, section.end);
    writeDetails(section.toString());
    writeDetails("Start:   0x" + createByteLink(section.start).outerHTML);
    writeDetails("End:     0x" + createByteLink(section.end).outerHTML);
    writeDetails("Length:  0x" + decToHex(section.length));
  }
}

function unhighlightAllSections() {
  for (let el of globals.cellsToClear) el.removeAttribute("style");
  var st = document.getElementsByClassName("section-start");
  var en = document.getElementsByClassName("section-end")
  for (let el of st) el.remove();
  for (let el of en) el.remove();
}

function getRowEl(parent, row) {
  for (let el of parent.getElementsByTagName("div")) {
    if (el.attributes["data-row"]?.value == row) return el;
  }
}

function getColEl(parent, col) {
  for (let el of parent.getElementsByTagName("div")) {
    if (el.attributes["data-col"]?.value == col) return el;
  }
}




var parser;
var viewer;
var dataset;
const wasm_path = './wasm/basic_wasm_bg.wasm';

window.onload = function() {

  fetch(wasm_path)
  .then(data => {
    data.body.getReader().read().then(res => {
      dataset = new DataSet(res.value);
      viewer = new Viewer(dataset, getViewer());
      parser = new Parser(dataset.data);
      viewer.print();
      parser.parse();
    });
  });

  WebAssembly.compileStreaming(fetch(wasm_path))
  .then(function(mod) {
    var imports = WebAssembly.Module.imports(mod);
    console.log(imports[0]);
  });
}