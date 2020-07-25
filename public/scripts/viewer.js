class Viewer {

  // TODO: UPPER_CASE
  static ROW_SIZE = 14.667;
  static COL_SIZE = 21.3;

  constructor(dataset, container) {
    if (!dataset instanceof DataSet) {
      throw("A viewer object must be initialised with a DataSet object");
    }
    this.dataset = dataset;
    this._bytes = dataset.data;
    this._container = container;
    this._lineOffset = 0;
    this._highlightedCells = [];
    this.initialise();
    this.resize();
  }

  initialise = function () {

    var viewer = this._container;
    this._container.innerHTML = "";

    this._setNumLines();

    var lineNums = document.createElement("code");
    var hexChunk = document.createElement("code");
    var txtChunk = document.createElement("code");
    lineNums.setAttribute("id", "lineNums");
    hexChunk.setAttribute("id", "hexChunk");
    txtChunk.setAttribute("id", "txtChunk");

    this._subViews = {
      lineNums: [],
      hexLines: [],
      txtLines: []
    }

    var blankLine = (new Array(16)).fill(0);

    for (let i = 0; i < this._numLines; i++) {
      let lineNum = document.createElement("div");
      let hexLine = document.createElement("div");
      let txtLine = document.createElement("div");

      lineNum.textContent = decToHex(i * 16, 8);
      for (let el of createRow(blankLine)) hexLine.appendChild(el);
      for (let el of createRow(blankLine)) txtLine.appendChild(el);

      hexLine.classList.add("hex-row");
      txtLine.classList.add("text-row");
      hexLine.setAttribute("data-row", i);
      txtLine.setAttribute("data-row", i);
      hexLine.classList.add(i % 2 == 0 ? "even" : "odd");
      txtLine.classList.add(i % 2 == 0 ? "even" : "odd");

      lineNums.appendChild(lineNum);
      hexChunk.appendChild(hexLine);
      txtChunk.appendChild(txtLine);

      this._subViews.lineNums.push(lineNum);
      this._subViews.hexLines.push(hexLine);
      this._subViews.txtLines.push(txtLine);

    }
    
    this._container.appendChild(lineNums);
    this._container.appendChild(hexChunk);
    this._container.appendChild(txtChunk);

    this._createScroller();

    this._attachMouseEvents();
    this._attachScrollEvents();

  }

  _createScroller = function () {
    var dummyDiv = document.createElement("div");
    this._scroller = document.createElement("code");
    this._scroller.setAttribute("id", "scroller");
    this._scroller.appendChild(dummyDiv);
    this._container.appendChild(this._scroller);
  }

  _setNumLines = function () {
    this._numLines = Math.floor(this._container.clientHeight / Viewer.ROW_SIZE);
  }

  resize = function () {
    var numDataLines = Math.ceil(this._bytes.length) / 16;
    var dummy = this._scroller.getElementsByTagName("div")[0];
    dummy.style.height = numDataLines * 40 + "px";
  }

  print = function () {
    var lineStartByte = this._lineOffset * 16;
    for (let line = 0; line < this._numLines; line++) {
      this._subViews.lineNums[line].innerHTML = decToHex(lineStartByte, 8);
      let hexLine = this._subViews.hexLines[line];
      let txtLine = this._subViews.txtLines[line];
      for (let c = 0; c < 16; c++) {
        let cellVal = this._bytes[lineStartByte + c];
        hexLine.getElementsByTagName("div")[c].innerHTML = decToHex(cellVal);
        txtLine.getElementsByTagName("div")[c].innerHTML = convertToChar(cellVal);
      }
      lineStartByte += 16;
    }
  }

  highlightSection = function (startByte, endByte) {

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

    var startRow, startCol, endRow, endCol;
    [startRow, startCol] = this._getCoords(startByte);
    [endRow, endCol] = this._getCoords(endByte);
    startRow -= this._lineOffset;
    endRow -= this._lineOffset;

    startChar.style.top = (startRow * Viewer.ROW_SIZE - 1) + "px";
    startChar.style.left = (startCol * Viewer.COL_SIZE - 3) + "px";
    endChar.style.top = (endRow * Viewer.ROW_SIZE - 1) + "px";
    endChar.style.left = ((endCol + 1) * Viewer.COL_SIZE - 4) + "px";

  }

  _attachMouseEvents = function() {
    this._container.onmousemove = function(e) {
      var els = document.elementsFromPoint(e.clientX, e.clientY);
      for (let el of els) {
        if (el.hasAttribute("data-col")) {
          let row = Number(el.parentElement.attributes["data-row"].value) + this._lineOffset;
          let col = Number(el.attributes["data-col"].value);
          if (row === this.lastSelectedEl?.[0] && 
              col === this.lastSelectedEl?.[1]) return;
          this.lastSelectedEl = [row, col];
          let byte = Number(row) * 16 + Number(col);
          unhighlightAllSections();
          highlightSections(byte);
          this.unhighlightAllCells();
          this.highlightCell(this.getHexCell(row, col));
          this.highlightCell(this.getTxtCell(row, col));
          break;
        }
      }
    }.bind(this);
  
    this._container.onmousewheel = function(e) {
      var scaleFactor = (e.deltaY % 150 == 0) ? 12 : 12; // Option to change factor for mouse vs trackpad
      this._scroller.scrollTo(null, this._scroller.scrollTop + e.deltaY * 40 / scaleFactor);
      setTimeout(() => this._container.onmousemove(e), 0);
    }.bind(this);
  }
  
  _attachScrollEvents = function() {
    this._scroller.onscroll = function() {
      var scrollPerc = this._scroller.scrollTop / (this._scroller.scrollHeight - this._scroller.clientHeight);
      var numLines = Math.ceil(this._bytes.length / 16);
      this._lineOffset = Math.floor((numLines - this._numLines) * scrollPerc);
      if (this._lineOffset % 2 == 0) {
        this._container.classList.remove("offset");
      } else {
        this._container.classList.add("offset");
      }
      this.print();
    }.bind(this);
  }

  jumpTo = function(byte) {
    var row, col;
    [row, col] = this._getCoords(byte);
    var targetLine = row - Math.floor(this._numLines / 2);
    var perc = targetLine / Math.ceil(this._bytes.length / 16 - this._numLines);
    perc = Math.min(Math.max(perc, 0), 1);
    var scrollMax = this._scroller.scrollHeight - this._scroller.clientHeight;
    this._scroller.scrollTo(null, perc * scrollMax);
    this._scroller.onscroll();

    setTimeout(() => {
      this.print();
      var cell = this.getHexCell(row, col);
      
      var tempHighlight = function(element, iters, maxIter) {
        if (maxIter == null) maxIter = iters;
        element.style.backgroundColor = "#008cc8" + decToHex(Math.floor(255 * iters / maxIter));
        // TODO: Not global
        if (iters > 0) globals.jumpTimeout = setTimeout(tempHighlight, 20, element, iters-1, maxIter);
      }
      // TODO: Also reset style of any temp highlights!
      if (globals.jumpTimeout) clearTimeout(globals.jumpTimeout);
      tempHighlight(cell, 50);

    }, 0);
  }

  getHexCell = function(row, col) {
    var rowEl = this._subViews.hexLines[row - this._lineOffset];
    return rowEl.getElementsByTagName("div")[col];
  }

  getTxtCell = function(row, col) {
    var rowEl = this._subViews.txtLines[row - this._lineOffset];
    return rowEl.getElementsByTagName("div")[col];
  }

  unhighlightAllCells = function() {
    var cell;
    while (cell = this._highlightedCells?.pop()) {
      cell.removeAttribute("style");
    }
  }

  highlightCell = function(cell) {
    cell.style.backgroundColor = "#eee";
    this._highlightedCells.push(cell);
  }

  _getCoords = function(bytePos) {
    var col = bytePos % 16;
    var row = (bytePos - col) / 16;
    return [row, col];
  }

}