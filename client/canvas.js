import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/+esm';

export function setupCanvas() {
  const base = document.getElementById('base');
  const overlay = document.getElementById('overlay');
  const ghosts = document.getElementById('ghosts');
  const wrap = document.getElementById('canvas-wrap');

  const baseCtx = base.getContext('2d');
  const overlayCtx = overlay.getContext('2d');
  const ghostCtx = ghosts.getContext('2d');
  

  let ops = [];                    // committed operations from server
  const remoteLive = new Map();    // userId -> in-progress stroke
  resize();
  window.addEventListener('resize', resize);


  const api = {
    onLocalStroke: () => {},
    getTool: () => 'brush',
    getColor: () => '#222',
    getWidth: () => 6,

    resetAndReplay,
    applyOperation,
    removeOperation,

    drawCursor,
    remoteBegin,
    remotePoint,
    remoteEnd
  };

  // Local stroke tracking
  let drawing = false;
  let current = null;


  /* ------------------------------------------
     Pointer Events (Local User)
  ------------------------------------------- */

  overlay.addEventListener('pointerdown', e => {
    overlay.setPointerCapture(e.pointerId);
    drawing = true;

    const pt = getPos(e);

    current = {
      id: uuidv4(),
      tool: api.getTool(),
      color: api.getColor(),
      width: api.getWidth(),
      points: [pt]
    };

    api.onLocalStroke({
      type: 'stroke:begin',
      payload: {
        id: current.id,
        tool: current.tool,
        color: current.color,
        width: current.width,
        point: pt
      }
    });
  });

  overlay.addEventListener('pointermove', e => {
    const pt = getPos(e);

    // Cursor broadcast
    api.onLocalStroke({
      type: 'cursor:move',
      payload: { x: pt.x, y: pt.y }
    });

    if (!drawing || !current) return;

    const last = current.points[current.points.length - 1];
    if (dist(last, pt) < 0.5) return; // small noise filter

    current.points.push(pt);

    drawSegment(overlayCtx, current.tool, current.color, current.width, last, pt);

    api.onLocalStroke({
      type: 'stroke:point',
      payload: { id: current.id, point: pt }
    });
  });

  overlay.addEventListener('pointerup', endStroke);
  overlay.addEventListener('pointercancel', endStroke);


  function endStroke(e) {
    if (!drawing || !current) return;

    drawing = false;

    api.onLocalStroke({
      type: 'stroke:end',
      payload: current
    });

    // Clear the temporary overlay preview
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);

    current = null;
  }


  /* ------------------------------------------
     Remote Live Strokes (Preview)
  ------------------------------------------- */

  function remoteBegin({ userId, id, tool, color, width, point }) {
    remoteLive.set(userId, {
      id, tool, color, width, last: point
    });
  }

  function remotePoint({ userId, point }) {
    const r = remoteLive.get(userId);
    if (!r) return;

    drawSegment(overlayCtx, r.tool, r.color, r.width, r.last, point);
    r.last = point;
  }

  function remoteEnd({ userId }) {
    remoteLive.delete(userId);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  }


  /* ------------------------------------------
     Undo / Redo / Full Replay
  ------------------------------------------- */

  function applyOperation(op) {
    ops.push(op);
    replay();
  }

  function removeOperation(id) {
    ops = ops.filter(o => o.id !== id);
    replay();
  }

  function resetAndReplay(initialOps) {
    ops = initialOps.slice();
    replay();
  }

  function replay() {
    baseCtx.clearRect(0, 0, base.width, base.height);

    for (const op of ops) {
      drawStroke(baseCtx, op.tool, op.color, op.width, op.points);
    }
  }


  /* ------------------------------------------
     Cursor Ghost Layer
  ------------------------------------------- */

  function drawCursor({ userId, x, y }) {
    // Ghost cursor layer redraw
    ghostCtx.clearRect(0, 0, ghosts.width, ghosts.height);

    ghostCtx.beginPath();
    ghostCtx.arc(x, y, 4, 0, Math.PI * 2);
    ghostCtx.fillStyle = '#00000088';
    ghostCtx.fill();
  }


  /* ------------------------------------------
     Drawing Helper Functions
  ------------------------------------------- */

  function drawStroke(ctx, tool, color, width, points) {
    if (!points || points.length === 0) return;

    ctx.save();

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
    ctx.restore();
  }

  function drawSegment(ctx, tool, color, width, a, b) {
    drawStroke(ctx, tool, color, width, [a, b]);
  }


  /* ------------------------------------------
     Utility Helpers
  ------------------------------------------- */

  function getPos(e) {
    const rect = wrap.getBoundingClientRect();
    const scaleX = base.width / rect.width;
    const scaleY = base.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;

    const w = Math.max(800, wrap.clientWidth);
    const h = Math.max(500, wrap.clientHeight);

    [base, overlay, ghosts].forEach(c => {
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + 'px';
      c.style.height = h + 'px';

      const ctx = c.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    // After resize, redraw everything
    replay();
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }


  return api;
}
