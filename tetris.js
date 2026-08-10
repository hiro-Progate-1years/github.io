(function () {
  "use strict";

  var COLS = 10;
  var ROWS = 20;
  var CELL = 30;

  var COLORS = {
    I: "#4dd0e1",
    J: "#5c7cfa",
    L: "#ff9f43",
    O: "#ffd43b",
    S: "#69db7c",
    T: "#cc5de8",
    Z: "#ff6b6b"
  };

  var SHAPES = {
    I: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ],
    O: [
      [1, 1],
      [1, 1]
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  };

  var boardCanvas = document.getElementById("board");
  var ctx = boardCanvas.getContext("2d");
  var nextCanvas = document.getElementById("next");
  var nextCtx = nextCanvas.getContext("2d");

  var scoreEl = document.getElementById("score");
  var levelEl = document.getElementById("level");
  var linesEl = document.getElementById("lines");
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var overlayMessage = document.getElementById("overlay-message");
  var startBtn = document.getElementById("start-btn");

  boardCanvas.width = COLS * CELL;
  boardCanvas.height = ROWS * CELL;

  var grid, current, bag, nextPiece, score, level, lines, dropCounter, dropInterval, lastTime, running, paused, gameOver;

  function newGrid() {
    var g = [];
    for (var r = 0; r < ROWS; r++) {
      g.push(new Array(COLS).fill(null));
    }
    return g;
  }

  function randomBag() {
    var keys = Object.keys(SHAPES);
    for (var i = keys.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = keys[i];
      keys[i] = keys[j];
      keys[j] = tmp;
    }
    return keys;
  }

  function makePiece(type) {
    var shape = SHAPES[type].map(function (row) { return row.slice(); });
    return {
      type: type,
      shape: shape,
      color: COLORS[type],
      row: 0,
      col: Math.floor((COLS - shape[0].length) / 2)
    };
  }

  function nextFromBag() {
    if (!bag || bag.length === 0) {
      bag = randomBag();
    }
    return bag.pop();
  }

  function spawnPiece() {
    var type = nextPiece ? nextPiece : nextFromBag();
    current = makePiece(type);
    nextPiece = nextFromBag();
    current.row = current.type === "I" ? -1 : 0;
    if (collides(current, 0, 0)) {
      endGame();
    }
    drawNext();
  }

  function collides(piece, rowOffset, colOffset, shapeOverride) {
    var shape = shapeOverride || piece.shape;
    for (var r = 0; r < shape.length; r++) {
      for (var c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        var newRow = piece.row + r + rowOffset;
        var newCol = piece.col + c + colOffset;
        if (newCol < 0 || newCol >= COLS || newRow >= ROWS) return true;
        if (newRow >= 0 && grid[newRow][newCol]) return true;
      }
    }
    return false;
  }

  function rotateShape(shape) {
    var n = shape.length;
    var result = [];
    for (var i = 0; i < n; i++) {
      result.push(new Array(n).fill(0));
    }
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        result[c][n - 1 - r] = shape[r][c];
      }
    }
    return result;
  }

  function tryRotate() {
    if (current.type === "O") return;
    var rotated = rotateShape(current.shape);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      if (!collides(current, 0, kicks[i], rotated)) {
        current.shape = rotated;
        current.col += kicks[i];
        return;
      }
    }
  }

  function lockPiece() {
    for (var r = 0; r < current.shape.length; r++) {
      for (var c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          var row = current.row + r;
          var col = current.col + c;
          if (row >= 0) grid[row][col] = current.color;
        }
      }
    }
    clearLines();
    spawnPiece();
  }

  function clearLines() {
    var cleared = 0;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (grid[r].every(function (cell) { return cell; })) {
        grid.splice(r, 1);
        grid.unshift(new Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      var points = [0, 100, 300, 500, 800][cleared] * level;
      score += points;
      lines += cleared;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 80);
      updateStats();
    }
  }

  function updateStats() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function move(colOffset) {
    if (!collides(current, 0, colOffset)) {
      current.col += colOffset;
    }
  }

  function softDrop() {
    if (!collides(current, 1, 0)) {
      current.row++;
      score += 1;
      updateStats();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    var dist = 0;
    while (!collides(current, 1, 0)) {
      current.row++;
      dist++;
    }
    score += dist * 2;
    updateStats();
    lockPiece();
    dropCounter = 0;
  }

  function drawCell(context, x, y, color, size) {
    context.fillStyle = color;
    context.fillRect(x, y, size, size);
    context.strokeStyle = "rgba(0,0,0,0.35)";
    context.lineWidth = 1;
    context.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    context.fillStyle = "rgba(255,255,255,0.15)";
    context.fillRect(x, y, size, 4);
  }

  function draw() {
    ctx.fillStyle = "#10121a";
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (grid[r][c]) {
          drawCell(ctx, c * CELL, r * CELL, grid[r][c], CELL);
        }
      }
    }

    if (current) {
      for (var r2 = 0; r2 < current.shape.length; r2++) {
        for (var c2 = 0; c2 < current.shape[r2].length; c2++) {
          if (current.shape[r2][c2]) {
            var row = current.row + r2;
            var col = current.col + c2;
            if (row >= 0) {
              drawCell(ctx, col * CELL, row * CELL, current.color, CELL);
            }
          }
        }
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    for (var gx = 0; gx <= COLS; gx++) {
      ctx.beginPath();
      ctx.moveTo(gx * CELL, 0);
      ctx.lineTo(gx * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (var gy = 0; gy <= ROWS; gy++) {
      ctx.beginPath();
      ctx.moveTo(0, gy * CELL);
      ctx.lineTo(COLS * CELL, gy * CELL);
      ctx.stroke();
    }
  }

  function drawNext() {
    nextCtx.fillStyle = "#10121a";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    var shape = SHAPES[nextPiece];
    var size = 20;
    var offsetX = (nextCanvas.width - shape[0].length * size) / 2;
    var offsetY = (nextCanvas.height - shape.length * size) / 2;
    for (var r = 0; r < shape.length; r++) {
      for (var c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          drawCell(nextCtx, offsetX + c * size, offsetY + r * size, COLORS[nextPiece], size);
        }
      }
    }
  }

  function update(time) {
    if (!running || paused) return;
    var delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      softDrop();
      dropCounter = 0;
    }
    draw();
    requestAnimationFrame(update);
  }

  function endGame() {
    running = false;
    gameOver = true;
    overlayTitle.textContent = "GAME OVER";
    overlayMessage.textContent = "Score: " + score;
    startBtn.textContent = "もう一度プレイ";
    overlay.classList.add("show");
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) {
      overlayTitle.textContent = "PAUSE";
      overlayMessage.textContent = "Pキーで再開";
      overlay.classList.add("show");
    } else {
      overlay.classList.remove("show");
      lastTime = performance.now();
      requestAnimationFrame(update);
    }
  }

  function startGame() {
    grid = newGrid();
    bag = null;
    nextPiece = nextFromBag();
    score = 0;
    level = 1;
    lines = 0;
    dropCounter = 0;
    dropInterval = 1000;
    running = true;
    paused = false;
    gameOver = false;
    updateStats();
    spawnPiece();
    overlay.classList.remove("show");
    lastTime = performance.now();
    requestAnimationFrame(update);
  }

  document.addEventListener("keydown", function (e) {
    if (!running) return;
    switch (e.code) {
      case "ArrowLeft":
        e.preventDefault();
        if (!paused) move(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (!paused) move(1);
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!paused) softDrop();
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!paused) tryRotate();
        break;
      case "Space":
        e.preventDefault();
        if (!paused) hardDrop();
        break;
      case "KeyP":
        e.preventDefault();
        togglePause();
        break;
    }
    draw();
  });

  startBtn.addEventListener("click", startGame);

  grid = newGrid();
  draw();
})();
