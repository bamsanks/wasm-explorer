class Viewer {

  // TODO: UPPER_CASE
  static ROW_SIZE = 14.667;
  static COL_SIZE = 21.2;

  constructor(data, container) {
    if (!dataset instanceof DataSet) {
      throw("A viewer object must be initialised with a DataSet object");
    }
    this.data = data;
    this._container = container;
    this._lineOffset = 0;
    this._highlightedCells = [];
    this.initialise();
    this.resize();
    this._selectionLocked = false;
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

    var createRow = function(data) {
      var i = 0;
      return data.map(x => {
        var el = document.createElement("div");
        el.innerHTML = x;
        el.setAttribute("data-col", i++);
        return el;
      });
    }

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
      lineNum.classList.add(i % 2 == 0 ? "even" : "odd");
      hexLine.classList.add(i % 2 == 0 ? "even" : "odd");
      txtLine.classList.add(i % 2 == 0 ? "even" : "odd");

      lineNums.appendChild(lineNum);
      hexChunk.appendChild(hexLine);
      txtChunk.appendChild(txtLine);

      this._subViews.lineNums.push(lineNum);
      this._subViews.hexLines.push(hexLine);
      this._subViews.txtLines.push(txtLine);

      // TODO: Move
      this.hexCells = [];
      for (let l of this._subViews.hexLines) {
        let r = l.getElementsByTagName("div");
        for (let c of r) {
          this.hexCells.push(c);
        }
      }

    }
    
    this._container.appendChild(lineNums);
    this._container.appendChild(hexChunk);
    this._container.appendChild(txtChunk);

    this._createScroller();

    this._attachMouseEvents();
    this._attachKeyEvents();
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
    var numDataLines = Math.ceil(this.data.bytes.length / 16);
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
        let cellVal = this.data.bytes[lineStartByte + c];
        hexLine.getElementsByTagName("div")[c].innerHTML = decToHex(cellVal);
        txtLine.getElementsByTagName("div")[c].innerHTML = convertToChar(cellVal);
      }
      lineStartByte += 16;
    }
  }

  createSectionChars = function(parent) {
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
    parent.prepend(secStart);
    parent.prepend(secEnd);

    return [startChar, endChar];
  }

  highlightSection = function (startByte, endByte, focByte, depth) {

    var r, c;
    var firstVisibleByte = this._lineOffset * 16;
    var lastVisibleByte = (this._lineOffset + this._numLines) * 16 - 1;
    var startByteLim = Math.max(startByte, firstVisibleByte);
    var endByteLim = Math.min(endByte, lastVisibleByte);
    for (let i = startByteLim; i <= endByteLim; i++) {
      [r, c] = this._getCoords(i);
      r -= this._lineOffset;
      let el = this._subViews.hexLines[r].getElementsByTagName("div")[c];
      if (i != focByte) {
        let lum = decToHex(Math.floor(255 * (10-depth)/10), 2);
        let lum1 = decToHex(Math.floor(220 * (10-depth)/10), 2);
        el.style.backgroundColor = "#" + lum + lum1 + lum1;
        el.style.color = (depth > 5) ? "#FFF" : "#000";
        el.classList.add("section");
      } else {
        // TODO: This shouldn't be required if section selection is tidier
        el.style.color = "#000";
      }
    }
    
    var startRow, startCol, endRow, endCol;
    [startRow, startCol] = this._getCoords(startByte);
    [endRow, endCol] = this._getCoords(endByte);
    startRow -= this._lineOffset;
    endRow -= this._lineOffset;

    var startChar, endChar;

    [startChar, endChar] = this.createSectionChars(hexChunk);
    startChar.style.top = (startRow * Viewer.ROW_SIZE - 3.5) + "px";
    startChar.style.left = (startCol * Viewer.COL_SIZE - 3) + "px";
    endChar.style.top = (endRow * Viewer.ROW_SIZE - 3.5) + "px";
    endChar.style.left = ((endCol + 1) * Viewer.COL_SIZE - 6.3) + "px";
    
    [startChar, endChar] = this.createSectionChars(txtChunk);
    var cs = 14.6;
    startChar.style.top = (startRow * Viewer.ROW_SIZE - 3.5) + "px";
    startChar.style.left = (startCol * cs - 3) + "px";
    endChar.style.top = (endRow * Viewer.ROW_SIZE - 3.5) + "px";
    endChar.style.left = ((endCol + 1) * cs - 5.5) + "px";

  }

  _attachMouseEvents = function() {
    this._container.onmousedown = function(e) {
      if (e.button === 0) this._selectionLocked = !this._selectionLocked;
      var row = this.lastSelectedEl?.[0];
      var col = this.lastSelectedEl?.[1];
      if (row == null || col == null) return;
      let byte = Number(row) * 16 + Number(col);
      highlightSections(byte, this._selectionLocked);
    }.bind(this);
    this._container.onmousemove = function(e) {
      if (this._selectionLocked && e) return;
      var row, col;
      if (e == null) {
        row = this.lastSelectedEl?.[0];
        col = this.lastSelectedEl?.[1];
      } else {
        var els = document.elementsFromPoint(e.clientX, e.clientY);
        for (var el of els) {
          if (el.hasAttribute("data-col")) {
            row = Number(el.parentElement.attributes["data-row"].value) + this._lineOffset;
            col = Number(el.attributes["data-col"].value);
            if (row === this.lastSelectedEl?.[0] && 
                col === this.lastSelectedEl?.[1]) return;
            this.lastSelectedEl = [row, col];
            break;
          }
        }
      }
      if (row != null && col != null) {
        let byte = Number(row) * 16 + Number(col);
        unhighlightAllSections();
        highlightSections(byte);
        this.unhighlightAllCells();
        this.highlightCell(this.getHexCell(row, col));
        this.highlightCell(this.getTxtCell(row, col));
      }
    }.bind(this);

    this._container.onmouseleave = function(e) {
      //this.unhighlightAllCells();
    }.bind(this);
  
    this._container.onmousewheel = function(e) {
      var scaleFactor = (e.deltaY % 150 == 0) ? 12 : 12; // Option to change factor for mouse vs trackpad
      this._scroller.scrollTo(null, this._scroller.scrollTop + e.deltaY * 40 / scaleFactor);
    }.bind(this);
  }

  _attachKeyEvents = function() {
    document.body.onkeydown = function(e) {
      if (e.keyCode == 35) {
        this.jumpTo(this.data.length-1);
      }
      if (e.keyCode == 36) {
        this.jumpTo(0);
      }
    }.bind(this);

    // this._container.onmouseleave = function(e) {
    //   //this.unhighlightAllCells();
    // }.bind(this);
  
    // this._container.onmousewheel = function(e) {
    //   var scaleFactor = (e.deltaY % 150 == 0) ? 12 : 12; // Option to change factor for mouse vs trackpad
    //   this._scroller.scrollTo(null, this._scroller.scrollTop + e.deltaY * 40 / scaleFactor);
    //   setTimeout(() => this._container.onmousemove(e), 0);
    // }.bind(this);
  }
  
  _attachScrollEvents = function() {
    this._scroller.onscroll = function() {
      var scrollMax = this._scroller.scrollHeight - this._scroller.clientHeight;
      var scrollPerc = scrollMax == 0 ? 0 : this._scroller.scrollTop / scrollMax;
      // TODO: Fix this... +2 is a hack
      var numLines = Math.ceil(this.data.bytes.length / 16) + 2;
      this._lineOffset = Math.floor((numLines - this._numLines) * scrollPerc);
      if (this._lineOffset % 2 == 0) {
        this._container.classList.remove("offset");
      } else {
        this._container.classList.add("offset");
      }
      this.print();
      setTimeout(() => this._container.onmousemove(), 0);
    }.bind(this);
  }

  jumpTo = function(byte) {
    var row, col;
    [row, col] = this._getCoords(byte);
    var targetLine = row - Math.floor(this._numLines / 2);
    var perc = targetLine / Math.ceil(this.data.bytes.length / 16 - this._numLines);
    perc = Math.min(Math.max(perc, 0), 1);
    var scrollMax = this._scroller.scrollHeight - this._scroller.clientHeight;
    this._scroller.scrollTo(null, perc * scrollMax);
    this._scroller.onscroll();

    setTimeout(() => {
      this.print();
      var cell = this.getHexCell(row, col);

      cell.style.transition = "1s";
      cell.classList.add("temphighlighted");
      setTimeout(() => cell.classList.remove("temphighlighted"), 0);
      
      // var tempHighlight = function(element, iters, maxIter) {
      //   if (maxIter == null) maxIter = iters;
      //   element.style.backgroundColor = "#008cc8" + decToHex(Math.floor(255 * iters / maxIter));
      //   // TODO: Not global
      //   if (iters > 0) globals.jumpTimeout = setTimeout(tempHighlight, 20, element, iters-1, maxIter);
      // }
      // // TODO: Also reset style of any temp highlights!
      // if (globals.jumpTimeout) clearTimeout(globals.jumpTimeout);
      // tempHighlight(cell, 25);

    }, 0);
  }

  getHexCell = function(row, col) {
    var rowEl = this._subViews.hexLines[row - this._lineOffset];
    return rowEl?.getElementsByTagName("div")[col];
  }

  getTxtCell = function(row, col) {
    var rowEl = this._subViews.txtLines[row - this._lineOffset];
    return rowEl?.getElementsByTagName("div")[col];
  }

  unhighlightAllCells = function() {
    var cell;
    while (cell = this._highlightedCells?.pop()) {
      cell.classList.remove("highlighted");
    }
  }

  highlightCell = function(cell) {
    if (!cell) return;
    cell.classList.add("highlighted");
    this._highlightedCells.push(cell);
  }

  _getCoords = function(bytePos) {
    var col = bytePos % 16;
    var row = (bytePos - col) / 16;
    return [row, col];
  }

}