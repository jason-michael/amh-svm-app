/* 
Notes

Pan & Zoom canvas:
https://stackoverflow.com/questions/33925012/how-to-pan-the-canvas

*/
//-----------------------------------------------------------------------------
class Editor {
    localStorageName = "editor";
    pointId = 0;

    constructor() {
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.mounted = false;
        this.parentEl = null;
        this.image = new Image();
        this.imageReady = false;
        this.points = [];
    }

    appendTo = (element) => {
        element.appendChild(this.canvas);
        this.parentEl = element;
        this.mounted = true;
        this.fillParent();
    }

    isMounted = () => {
        return this.mounted;
    }

    setBackgroundColor = color => {
        this.canvas.style.background = color;
    }

    setImageSrc = imgSrc => {
        this.image.src = imgSrc;
        this.imageReady = true;
        this.onReady();
    }

    fillParent = () => {
        this.canvas.width = this.parentEl.clientWidth;
        this.canvas.height = this.parentEl.clientHeight;
    }

    update = () => {
        // Draw image
        if (this.imageReady) {
            this.ctx.drawImage(this.image, 0, 0);
        }

        // Draw points
        for (let i = 0; i < this.points.length; i++) {
            const p = this.points[i]; // Current point
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
    }

    saveToLocalStorage = store => {
        store.setItem(this.localStorageName, JSON.stringify(this));
    }

    retrieveFromLocalStorage = store => {
        return store.getItem(this.localStorageName);
    }

    onReady = () => {
        // Placeholder, this gets overridden
    }

    addPoint = (x, y, size, color) => {
        this.points.push({ id: this.pointId, x, y, size, color });
        this.pointId++;
    }
}
//-----------------------------------------------------------------------------
const lib = {
    readUrl: function (inputElement, callback) {
        const file = inputElement.files[0];
        const reader = new FileReader();

        reader.onloadend = function () {
            callback(reader.result);
        }

        if (file) {
            reader.readAsDataURL(file);
        }
    },
    log: function (msg, ...args) {
        console.log(msg, ...args);
    }
}
//-----------------------------------------------------------------------------
const EDITOR_MODE = Object.freeze({
    "IDLE": 0,
    "ADDING_POINTS": 1,
    "REMOVING_POINTS": 2
});

//-----------------------------------------------------------------------------
/* Mouse */
const mouse = {
    x: 0,
    y: 0,
    w: 0,
    alt: false,
    shift: false,
    ctrl: false,
    buttonLastRaw: 0, // user modified value
    buttonRaw: 0,
    over: false,
    buttons: [1, 2, 4, 6, 5, 3], // masks for setting and clearing button raw bits;
};

function mouseMove(event) {
    mouse.x = event.offsetX;
    mouse.y = event.offsetY;
    if (mouse.x === undefined) {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
    }
    mouse.alt = event.altKey;
    mouse.shift = event.shiftKey;
    mouse.ctrl = event.ctrlKey;
    if (event.type === "mousedown") {
        event.preventDefault()
        mouse.buttonRaw |= mouse.buttons[event.which - 1];
    } else if (event.type === "mouseup") {
        mouse.buttonRaw &= mouse.buttons[event.which + 2];
        mouseBtnHandled = false;
    } else if (event.type === "mouseout") {
        mouse.buttonRaw = 0;
        mouse.over = false;
    } else if (event.type === "mouseover") {
        mouse.over = true;
    } else if (event.type === "mousewheel") {
        event.preventDefault()
        mouse.w = event.wheelDelta;
    } else if (event.type === "DOMMouseScroll") { // FF you pedantic doffus
        mouse.w = -event.detail;
    }
}

function setupMouse(e) {
    e.addEventListener('mousemove', mouseMove);
    e.addEventListener('mousedown', mouseMove);
    e.addEventListener('mouseup', mouseMove);
    e.addEventListener('mouseout', mouseMove);
    e.addEventListener('mouseover', mouseMove);
    e.addEventListener('mousewheel', mouseMove);
    e.addEventListener('DOMMouseScroll', mouseMove); // fire fox

    e.addEventListener("contextmenu", function (e) {
        e.preventDefault();
    }, false);
}

// terms.
// Real space, real, r (prefix) refers to the transformed canvas space.
// c (prefix), chase is the value that chases a requiered value
const displayTransform = {
    x: 0,
    y: 0,
    ox: 0,
    oy: 0,
    scale: 1,
    rotate: 0,
    cx: 0,  // chase values Hold the actual display
    cy: 0,
    cox: 0,
    coy: 0,
    cscale: 1,
    crotate: 0,
    dx: 0,  // deltat values
    dy: 0,
    dox: 0,
    doy: 0,
    dscale: 1,
    drotate: 0,
    drag: 0.25,  // drag for movements (default: 0.1, firm: 0.25)
    accel: 1.2, // acceleration (default: 0.7, snappy: 1.2)
    matrix: [0, 0, 0, 0, 0, 0], // main matrix
    invMatrix: [0, 0, 0, 0, 0, 0], // invers matrix;
    mouseX: 0,
    mouseY: 0,
    setTransform: function (canvasCtx) {
        var m = this.matrix;
        var i = 0;
        canvasCtx.setTransform(m[i++], m[i++], m[i++], m[i++], m[i++], m[i++]);
    },
    setHome: function (canvasCtx) {
        canvasCtx.setTransform(1, 0, 0, 1, 0, 0);

    },
    update: function () {
        // smooth all movement out. drag and accel control how this moves
        // acceleration 
        this.dx += (this.x - this.cx) * this.accel;
        this.dy += (this.y - this.cy) * this.accel;
        this.dox += (this.ox - this.cox) * this.accel;
        this.doy += (this.oy - this.coy) * this.accel;
        this.dscale += (this.scale - this.cscale) * this.accel;
        this.drotate += (this.rotate - this.crotate) * this.accel;
        // drag
        this.dx *= this.drag;
        this.dy *= this.drag;
        this.dox *= this.drag;
        this.doy *= this.drag;
        this.dscale *= this.drag;
        this.drotate *= this.drag;
        // set the chase values. Chase chases the requiered values
        this.cx += this.dx;
        this.cy += this.dy;
        this.cox += this.dox;
        this.coy += this.doy;
        this.cscale += this.dscale;
        this.crotate += this.drotate;

        // create the display matrix
        this.matrix[0] = Math.cos(this.crotate) * this.cscale;
        this.matrix[1] = Math.sin(this.crotate) * this.cscale;
        this.matrix[2] = - this.matrix[1];
        this.matrix[3] = this.matrix[0];

        // set the coords relative to the origin
        this.matrix[4] = -(this.cx * this.matrix[0] + this.cy * this.matrix[2]) + this.cox;
        this.matrix[5] = -(this.cx * this.matrix[1] + this.cy * this.matrix[3]) + this.coy;


        // create invers matrix
        var det = (this.matrix[0] * this.matrix[3] - this.matrix[1] * this.matrix[2]);
        this.invMatrix[0] = this.matrix[3] / det;
        this.invMatrix[1] = - this.matrix[1] / det;
        this.invMatrix[2] = - this.matrix[2] / det;
        this.invMatrix[3] = this.matrix[0] / det;

        // check for mouse. Do controls and get real position of mouse.
        if (mouse !== undefined) {  // if there is a mouse get the real cavas coordinates of the mouse
            if (mouse.oldX !== undefined && (mouse.buttonRaw & 1) === 1) { // check if panning (middle button)
                var mdx = mouse.x - mouse.oldX; // get the mouse movement
                var mdy = mouse.y - mouse.oldY;
                // get the movement in real space
                var mrx = (mdx * this.invMatrix[0] + mdy * this.invMatrix[2]);
                var mry = (mdx * this.invMatrix[1] + mdy * this.invMatrix[3]);
                this.x -= mrx;
                this.y -= mry;
            }
            // do the zoom with mouse wheel
            if (mouse.w !== undefined && mouse.w !== 0) {
                this.ox = mouse.x;
                this.oy = mouse.y;
                this.x = this.mouseX;
                this.y = this.mouseY;
                /* Special note from answer */
                // comment out the following if you change drag and accel
                // and the zoom does not feel right (lagging and not 
                // zooming around the mouse 
                this.cox = mouse.x;
                this.coy = mouse.y;
                this.cx = this.mouseX;
                this.cy = this.mouseY;

                if (mouse.w > 0) { // zoom in
                    this.scale *= 1.1;
                    mouse.w -= 20;
                    if (mouse.w < 0) {
                        mouse.w = 0;
                    }
                }
                if (mouse.w < 0) { // zoom out
                    this.scale *= 1 / 1.1;
                    mouse.w += 20;
                    if (mouse.w > 0) {
                        mouse.w = 0;
                    }
                }

            }
            // get the real mouse position 
            var screenX = (mouse.x - this.cox);
            var screenY = (mouse.y - this.coy);
            this.mouseX = this.cx + (screenX * this.invMatrix[0] + screenY * this.invMatrix[2]);
            this.mouseY = this.cy + (screenX * this.invMatrix[1] + screenY * this.invMatrix[3]);
            mouse.rx = this.mouseX;  // add the coordinates to the mouse. r is for real
            mouse.ry = this.mouseY;
            // save old mouse position
            mouse.oldX = mouse.x;
            mouse.oldY = mouse.y;
        }

    }
}
//-----------------------------------------------------------------------------
/* Global */
const store = window.localStorage;
const pointSize = 20;
const DEV = true;

let editor;
let timertick = 0;
let mouseBtnHandled = false;
let editorMode = EDITOR_MODE.IDLE;

//-----------------------------------------------------------------------------
/* Editor toolbar setup */
const mToolbar = {
    btns: {
        uploadImage: document.getElementById("import-image"),
        addPoints: document.getElementById("add-points"),
        removePoints: document.getElementById("remove-points"),
        resetPoints: document.getElementById("reset-points")
    }
}

mToolbar.btns.uploadImage.addEventListener("change", () => {
    lib.readUrl(mToolbar.btns.uploadImage, editor.setImageSrc)
}, true);

mToolbar.btns.addPoints.addEventListener("click", () => {
    if (editorMode === EDITOR_MODE.ADDING_POINTS) {
        stopAddingPoints();
    } else {
        startAddingPoints();
    }
});

mToolbar.btns.removePoints.addEventListener("click", () => {
    if (editorMode === EDITOR_MODE.REMOVING_POINTS) {
        stopRemovingPoints();
    } else {
        startRemovingPoints();
    }
});

mToolbar.btns.resetPoints.addEventListener("click", () => {
    let warning = "Are you sure you want to remove all points from the editor?";
    if (confirm(warning)) editor.points.length = 0;
}, true);

function stopAddingPoints() {
    editorMode = EDITOR_MODE.IDLE;
    mToolbar.btns.addPoints.style.background = "#eee";
    mToolbar.btns.addPoints.style.color = "#333";
    document.body.style.cursor = "auto";
}

function startAddingPoints() {
    editorMode = EDITOR_MODE.ADDING_POINTS;
    mToolbar.btns.addPoints.style.background = "green";
    mToolbar.btns.addPoints.style.color = "#FFF";
    document.body.style.cursor = "crosshair";
}

function stopRemovingPoints() {
    editorMode = EDITOR_MODE.IDLE;
    mToolbar.btns.removePoints.style.background = "#eee";
    mToolbar.btns.removePoints.style.color = "#333";
    document.body.style.cursor = "auto";
}

function startRemovingPoints() {
    editorMode = EDITOR_MODE.REMOVING_POINTS;
    mToolbar.btns.removePoints.style.background = "red";
    mToolbar.btns.removePoints.style.color = "#FFF";
    document.body.style.cursor = "crosshair";
}

//-----------------------------------------------------------------------------
/* Sidebar setup */
const sidebar = {
    selection: {
        labelID: document.getElementById("label-id"),
        inputName: document.getElementById("input-name"),
        inputHardwareID: document.getElementById("input-hardware-id"),
        input: {
            x: document.getElementById("input-x"),
            y: document.getElementById("input-y"),
            z: document.getElementById("input-z")
        },
        inputColor: document.getElementById("input-color"),
        btnColorPicker: document.getElementById("btn-color-picker")
    }
}

//-----------------------------------------------------------------------------
function update() {
    // Reset displayTransform and the editor context
    displayTransform.update();
    displayTransform.setHome(editor.ctx);
    editor.ctx.clearRect(0, 0, editor.canvas.width, editor.canvas.height);

    // Enable panning and zooming
    displayTransform.setTransform(editor.ctx);

    // Mouse button events
    if (!mouseBtnHandled) {

        // LMB
        if (mouse.buttonRaw === 1) {
            switch (editorMode) {
                case EDITOR_MODE.ADDING_POINTS:
                    let x = Math.floor(mouse.rx - pointSize / 2);
                    let y = Math.floor(mouse.ry - pointSize / 2);
                    editor.addPoint(x, y, pointSize, "#666");
                    break;
                case EDITOR_MODE.REMOVING_POINTS:
                    editor.points.forEach(point => {

                        if (isMouseOnPoint(point)) {
                            const pointToRemove = editor.points.filter(p => p.id === point.id)[0];
                            editor.points.splice(editor.points.indexOf(pointToRemove), 1);
                        }

                        if (editor.points.length === 0) {
                            stopRemovingPoints();
                        }

                    });
                    break;
                case EDITOR_MODE.IDLE:
                    editor.points.forEach(point => {

                        if (isMouseOnPoint(point)) {
                            const pointToSelect = editor.points.filter(p => p.id === point.id)[0];
                            const p = pointToSelect;
                            sidebar.selection.labelID.textContent = p.id;

                            // Highlight point
                            editor.ctx.fillStyle = "gold";
                            editor.ctx.fillRect(p.x, p.y, p.size, p.size);
                        } else {
                            // Clear sidebar selection
                            sidebar.selection.labelID.textContent = "";
                        }

                    })
                    break;
                default:
            }

            mouseBtnHandled = true;
        }

        // RMB
        if (mouse.buttonRaw === 4) {

            switch (editorMode) {
                case EDITOR_MODE.ADDING_POINTS:
                    stopAddingPoints();
                    break;
                case EDITOR_MODE.REMOVING_POINTS:
                    stopRemovingPoints();
                    break;
                case EDITOR_MODE.IDLE:
                    homeView();
                    break;
                default:


            }
            mouseBtnHandled = true;
        }
    }

    // Update the editor
    // KEEP DRAW ORDER IN MIND
    editor.update();
    editor.saveToLocalStorage(store);

    switch (editorMode) {
        case EDITOR_MODE.ADDING_POINTS:
            editor.ctx.strokeStyle = "green";
            editor.ctx.strokeRect(mouse.rx - pointSize / 2, mouse.ry - pointSize / 2, pointSize, pointSize);
            mToolbar.btns.removePoints.disabled = true;
            mToolbar.btns.resetPoints.disabled = true;
            break;
        case EDITOR_MODE.REMOVING_POINTS:
            mToolbar.btns.addPoints.disabled = true;
            mToolbar.btns.resetPoints.disabled = true;
            editor.points.forEach(point => {
                // Check to see if mouse is inside point
                if (isMouseOnPoint(point)) {
                    highlightPoint(point, "red");
                }
            });
            break;
        case EDITOR_MODE.IDLE:
            const pointsEmpty = editor.points.length === 0;
            mToolbar.btns.resetPoints.disabled = pointsEmpty;
            mToolbar.btns.removePoints.disabled = pointsEmpty;
            if (editor.imageReady) {
                mToolbar.btns.addPoints.disabled = false;
            }

            editor.points.forEach(point => {
                // Check to see if mouse is inside point
                if (isMouseOnPoint(point)) {
                    highlightPoint(point, "orange");

                    // Draw the point id above it
                    editor.ctx.fillStyle = "#000";
                    editor.ctx.fillText(`${point.id}: ${Math.floor(point.x)}, ${Math.floor(point.y)}`, point.x - 4, point.y - 4);
                }
            });

            break;
        default:
    }

    // Request next frame
    requestAnimationFrame(update);

    function homeView() {
        displayTransform.x = 0;
        displayTransform.y = 0;
        displayTransform.scale = 0.33;
        displayTransform.rotate = 0;
        displayTransform.ox = 0;
        displayTransform.oy = 0;
    }
}

function isMouseOnPoint(point) {
    return (
        mouse.rx <= point.x + point.size / 2 + point.size / 2 &&
        mouse.rx >= point.x - point.size / 2 + point.size / 2 &&
        mouse.ry <= point.y + point.size / 2 + point.size / 2 &&
        mouse.ry >= point.y - point.size / 2 + point.size / 2
    );
}

function highlightPoint(point, color) {
    // Highlight the point
    editor.ctx.fillStyle = color;
    editor.ctx.fillRect(point.x, point.y, point.size, point.size);
}

//-----------------------------------------------------------------------------
function main() {
    const workspace = document.getElementById("workspace");

    editor = new Editor();
    editor.setBackgroundColor("#ddd");
    editor.appendTo(workspace);
    editor.onReady = function () {
        mToolbar.btns.addPoints.disabled = false;
    }

    setupMouse(editor.canvas);

    update();
}

//-----------------------------------------------------------------------------
/* Run */
main();
