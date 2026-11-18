// Solmar Bay 3D — keyboard and mouse input. Held keys are read every frame;
// one-shot presses (pause, enter/exit car, reload) are queued and taken once,
// so a press between two frames is never lost and never counted twice.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    mouseDX: 0,
    mouseDY: 0,
    clicked: false, // left mouse button, taken once per frame
    dragging: false,
    orbitDX: 0, // accumulated drag for the third-person camera
  };

  const down = (e) => {
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  };
  const up = (e) => {
    input.keys.delete(e.code);
  };
  const mouseMove = (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    if (input.dragging) {
      input.orbitDX += e.movementX || 0;
      input.mouseDX += e.movementX || 0;
      input.mouseDY += e.movementY || 0;
    }
  };
  const mouseDown = (e) => {
    if (e.button === 0) input.clicked = true;
    if (e.button === 2) input.dragging = true;
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
  };
  const mouseUp = (e) => {
    if (e.button === 2) input.dragging = false;
  };
  const contextMenu = (e) => e.preventDefault();
  const blur = () => {
    input.keys.clear();
    input.dragging = false;
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  window.addEventListener('mouseup', mouseUp);
  canvas.addEventListener('contextmenu', contextMenu);
  return input;
}

/** True while the key is held. */
export function held(input, code) {
  return input.keys.has(code);
}

/** True once, on the frame the key went down (consumed by the caller). */
export function takePressed(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

/** True once, on the frame the mouse was clicked (consumed by the caller). */
export function takeClick(input) {
  if (input.clicked) {
    input.clicked = false;
    return true;
  }
  return false;
}

/** Clear the one-shot queues at the end of a frame. */
export function endFrame(input) {
  input.pressed.clear();
  input.clicked = false;
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.orbitDX = 0;
}

// Driving / walking controls, read from the held keys.
export function driveInput(input) {
  return {
    up: held(input, 'KeyW') || held(input, 'ArrowUp'),
    down: held(input, 'KeyS') || held(input, 'ArrowDown'),
    left: held(input, 'KeyA') || held(input, 'ArrowLeft'),
    right: held(input, 'KeyD') || held(input, 'ArrowRight'),
    brake: held(input, 'Space'),
    sprint: held(input, 'ShiftLeft') || held(input, 'ShiftRight'),
  };
}
