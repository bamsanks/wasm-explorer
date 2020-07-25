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

function printHex(bytes) {

  var hex = bytes.map(x => decToHex(x, 2));
  var txt = bytes.map(convertToChar);
  var viewer = getViewer();
  var numLines = Math.floor((bytes.length - 1) / 16) + 1;

  viewer.innerHTML = "";

  var lineNums = document.createElement("code");
  var hexChunk = document.createElement("code");
  var txtChunk = document.createElement("code");
  hexChunk.setAttribute("id", "hexChunk");
  txtChunk.setAttribute("id", "txtChunk");

  for (let i = 0; i < numLines; i++) {
    let lineNum = document.createElement("div");
    let hexLine = document.createElement("div");
    let txtLine = document.createElement("div");

    lineNum.textContent = decToHex(i*16, 8);
    for (let el of createRow(hex.slice(16*i, 16*i+16))) hexLine.appendChild(el);
    for (let el of createRow(txt.slice(16*i, 16*i+16))) txtLine.appendChild(el);

    hexLine.setAttribute("data-row", i);
    txtLine.setAttribute("data-row", i);

    lineNums.appendChild(lineNum);
    hexChunk.appendChild(hexLine);
    txtChunk.appendChild(txtLine);

    viewer.appendChild(lineNums);
    viewer.appendChild(hexChunk);
    viewer.appendChild(txtChunk);

  }

  txtChunk.onmousemove = hexChunk.onmousemove = function(e) {
    var els = document.elementsFromPoint(e.clientX, e.clientY);
    for (let el of els) {
      if (el.hasAttribute("data-col")) {
        if (el === globals.lastEl) return;
        globals.lastEl = el;
        row = el.parentElement.attributes["data-row"].value;
        col = el.attributes["data-col"].value;
        byte = Number(row) * 16 + Number(col);
        unhighlightAllSections();
        highlightSections(byte);
        highlightByteItem(row, col);
        break;
      }
    }
  }
  hexChunk.onmouseleave = function() {
    //unhighlightAllSections();
  }
  
}

function highlightSection(start, end) {

  var secStart = document.createElement("div");
  var secEnd = document.createElement("div");
  secStart.setAttribute("class", "section-start");
  secEnd.setAttribute("class", "section-end");
  var startChar = document.createElement("p");
  var endChar = document.createElement("p");
  startChar.textContent = "[";
  endChar.textContent = "]";
  secStart.appendChild(startChar);
  secEnd.appendChild(endChar);
  hexChunk.prepend(secStart);
  hexChunk.prepend(secEnd);

  var startRow = Math.floor(start / 16);
  var startCol = start % 16;
  var endRow = Math.floor(end / 16);
  var endCol = end % 16;

  const rowSize = 14.667, rowStart = -1;
  const colSize = 21.3, colStart = -3;

  startChar.style.top = (startRow * rowSize + rowStart) + "px";
  startChar.style.left = (startCol * colSize + colStart) + "px";
  endChar.style.top = (endRow * rowSize + rowStart) + "px";
  endChar.style.left = ((endCol+1) * colSize + colStart - 1) + "px";

}

function writeDetails(details, append = true) {
  var el = document.getElementById("details");
  if (!append) el.textContent = "";
  if (details !== null) el.innerHTML += details + "<br>";
}

function jumpTo(pos) {
  var chunk = document.getElementById("hexChunk");
  var col = pos % 16;
  var row = (pos - col) / 16;
  var rowEl = getRowEl(chunk, row);
  var colEl = getColEl(rowEl, col);
  var viewer = chunk.parentElement;
  viewer.scrollTo(null, colEl.offsetTop - viewer.clientHeight / 2);
  
  var tempHighlight = function(element, iters, maxIter) {
    if (maxIter == null) maxIter = iters;
    element.style.backgroundColor = "#008cc8" + decToHex(Math.floor(255 * iters / maxIter));
    if (iters > 0) globals.jumpTimeout = setTimeout(tempHighlight, 20, element, iters-1, maxIter);
  }
  if (globals.jumpTimeout) clearTimeout(globals.jumpTimeout);
  tempHighlight(colEl, 50);
}

function createByteLink(pos) {
  var link = document.createElement("a");
  link.setAttribute("onclick", "jumpTo(" + pos + ");");
  link.href = "#";
  link.textContent = decToHex(pos);
  return link;
}

function highlightSections(byte) {
  var sections = parser.index.getSections(byte);
  writeDetails(null, false);
  for (let section of sections) {
    highlightSection(section.start, section.end);
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

function highlightByteItem(row, col) {
  for (let container of ["txtChunk", "hexChunk"]) {
    var chunk = document.getElementById(container);
    var rowEl = getRowEl(chunk, row);
    var colEl = getColEl(rowEl, col);
    colEl.style.backgroundColor = "#eee";
    globals.cellsToClear.push(colEl);
  }
}




var parser;
const wasm_path = './wasm/basic_wasm_bg.wasm';

fetch(wasm_path)
.then(data => {
  data.body.getReader().read().then(res => {
    var bytes = res.value;
    parser = new Parser(bytes);
    printHex(Array.from(bytes));
    parser.parse();
  });
});

WebAssembly.compileStreaming(fetch(wasm_path))
.then(function(mod) {
  var imports = WebAssembly.Module.imports(mod);
  console.log(imports[0]);
});