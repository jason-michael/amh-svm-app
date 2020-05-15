/**
 * Resources
 * 
 * Pan & Zoom canvas:
 * https://stackoverflow.com/questions/33925012/how-to-pan-the-canvas
 * 
 */

 /* GLOBAL VARS */

const workspace = document.getElementById("workspace");
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
const chkShowCursorPosition = document.getElementById("show-cursor-pos");
const importImageBtn = document.getElementById("import-image");
const addPointBtn = document.getElementById("add-point");
const resetPointsBtn = document.getElementById("reset-points");

let baseImage = null;   // Imported image placeholder
let settings = {
    showCursorPosition: chkShowCursorPosition.checked
}
let addingPoint = false;

/* EVENT LISTENERS */

chkShowCursorPosition.addEventListener("change", e => {
    settings.showCursorPosition = e.target.checked;
});

importImageBtn.addEventListener("change", ()=>readUrl(importImageBtn), true);

addPointBtn.addEventListener("click", e => {
    startAddingPoint();
});

resetPointsBtn.addEventListener("click", e => {
    let yes = confirm("Are you sure you want to remove all points?");
    if (yes) {
        points.length = 0;
    }
})

window.addEventListener("click", e => {
})


/* SETUP */

canvas.width = workspace.clientWidth;
canvas.height = workspace.clientHeight;
canvas.style.background = "#fff"
workspace.appendChild(canvas);

const points = [];

class Point {
    constructor(id, x, y, size, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
    }
}


// ---------------------------------------------------------------------

const mouse = {
    x : 0,
    y : 0,
    w : 0,
    alt : false,
    shift : false,
    ctrl : false,
    buttonLastRaw : 0, // user modified value
    buttonRaw : 0,
    over : false,
    buttons : [1, 2, 4, 6, 5, 3], // masks for setting and clearing button raw bits;
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
        mouse.buttonRaw |= mouse.buttons[event.which-1];
    } else if (event.type === "mouseup") {
        mouse.buttonRaw &= mouse.buttons[event.which + 2];
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
setupMouse(canvas);

// terms.
// Real space, real, r (prefix) refers to the transformed canvas space.
// c (prefix), chase is the value that chases a requiered value
var displayTransform = {
    x:0,
    y:0,
    ox:0,
    oy:0,
    scale:1,
    rotate:0,
    cx:0,  // chase values Hold the actual display
    cy:0,
    cox:0,
    coy:0,
    cscale:1,
    crotate:0,
    dx:0,  // deltat values
    dy:0,
    dox:0,
    doy:0,
    dscale:1,
    drotate:0,
    drag:0.25,  // drag for movements (default: 0.1, firm: 0.25)
    accel:1.2, // acceleration (default: 0.7, snappy: 1.2)
    matrix:[0,0,0,0,0,0], // main matrix
    invMatrix:[0,0,0,0,0,0], // invers matrix;
    mouseX:0,
    mouseY:0,
    ctx:ctx,
    setTransform:function(){
        var m = this.matrix;
        var i = 0;
        this.ctx.setTransform(m[i++],m[i++],m[i++],m[i++],m[i++],m[i++]);
    },
    setHome:function(){
        this.ctx.setTransform(1,0,0,1,0,0);
        
    },
    update:function(){
        // smooth all movement out. drag and accel control how this moves
        // acceleration 
        this.dx += (this.x-this.cx)*this.accel;
        this.dy += (this.y-this.cy)*this.accel;
        this.dox += (this.ox-this.cox)*this.accel;
        this.doy += (this.oy-this.coy)*this.accel;
        this.dscale += (this.scale-this.cscale)*this.accel;
        this.drotate += (this.rotate-this.crotate)*this.accel;
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
        this.matrix[0] = Math.cos(this.crotate)*this.cscale;
        this.matrix[1] = Math.sin(this.crotate)*this.cscale;
        this.matrix[2] =  - this.matrix[1];
        this.matrix[3] = this.matrix[0];

        // set the coords relative to the origin
        this.matrix[4] = -(this.cx * this.matrix[0] + this.cy * this.matrix[2])+this.cox;
        this.matrix[5] = -(this.cx * this.matrix[1] + this.cy * this.matrix[3])+this.coy;        


        // create invers matrix
        var det = (this.matrix[0] * this.matrix[3] - this.matrix[1] * this.matrix[2]);
        this.invMatrix[0] = this.matrix[3] / det;
        this.invMatrix[1] =  - this.matrix[1] / det;
        this.invMatrix[2] =  - this.matrix[2] / det;
        this.invMatrix[3] = this.matrix[0] / det;
        
        // check for mouse. Do controls and get real position of mouse.
        if(mouse !== undefined){  // if there is a mouse get the real cavas coordinates of the mouse
            if(mouse.oldX !== undefined && (mouse.buttonRaw & 1)===1){ // check if panning (middle button)
                var mdx = mouse.x-mouse.oldX; // get the mouse movement
                var mdy = mouse.y-mouse.oldY;
                // get the movement in real space
                var mrx = (mdx * this.invMatrix[0] + mdy * this.invMatrix[2]);
                var mry = (mdx * this.invMatrix[1] + mdy * this.invMatrix[3]);   
                this.x -= mrx;
                this.y -= mry;
            }
            // do the zoom with mouse wheel
            if(mouse.w !== undefined && mouse.w !== 0){
                this.ox = mouse.x;
                this.oy = mouse.y;
                this.x = this.mouseX;
                this.y = this.mouseY;
                /* Special note from answer */
                // comment out the following is you change drag and accel
                // and the zoom does not feel right (lagging and not 
                // zooming around the mouse 
                
                this.cox = mouse.x;
                this.coy = mouse.y;
                this.cx = this.mouseX;
                this.cy = this.mouseY;
                
                if(mouse.w > 0){ // zoom in
                    this.scale *= 1.1;
                    mouse.w -= 20;
                    if(mouse.w < 0){
                        mouse.w = 0;
                    }
                }
                if(mouse.w < 0){ // zoom out
                    this.scale *= 1/1.1;
                    mouse.w += 20;
                    if(mouse.w > 0){
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

// set up font
ctx.font = "14px verdana";
ctx.textAlign = "center";
ctx.textBaseline = "middle";

// timer for stuff
var timer =0;
function update(){
    if (baseImage === null) return;

    timer += 1; // update timere

    // update the transform
    displayTransform.update();

    // set home transform to clear the screem
    displayTransform.setHome();
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // if the image loaded show it
    if (baseImage !== null){
        displayTransform.setTransform();

        ctx.drawImage(baseImage, 0, 0);
    }else{
        // waiting for image to load
        displayTransform.setTransform();
        ctx.fillText("Loading image...",100,100);
        
    }

    // draw points
    points.forEach(point => {
        ctx.fillStyle = point.color;
        ctx.fillRect(point.x, point.y, point.size, point.size);
        if (mouse.rx <= point.x + point.size / 2 + 10 &&
            mouse.rx >= point.x - point.size / 2 + 10 &&
            mouse.ry <= point.y + point.size / 2 + 10 &&
            mouse.ry >= point.y - point.size / 2 + 10) {
            ctx.fillStyle = "orange";
            ctx.fillRect(point.x, point.y, point.size, point.size);
            ctx.fillStyle = "#000";
            ctx.fillText(point.id, point.x - 4, point.y - 4);
    
        }else {
            ctx.fillStyle = point.color;
            ctx.fillRect(point.x, point.y, point.size, point.size);
        }



    })

    if (addingPoint) {
        ctx.fillStyle = "green";
        ctx.fillRect(mouse.rx - 10, mouse.ry-10, 20, 20);

    }

    if (mouse.buttonRaw === 1 && addingPoint) {
        log("test")
        const newPoint = new Point(points.length + 1, mouse.rx-10, mouse.ry-10, 20, "#FF0000");
        points.push(newPoint);
        log(newPoint)
    }

    if (mouse.buttonRaw === 4 && !addingPoint){ // right click to return to homw
         displayTransform.x = 0;
         displayTransform.y = 0;
         displayTransform.scale = 1;
         displayTransform.rotate = 0;
         displayTransform.ox = 0;
         displayTransform.oy = 0;
     } else if (mouse.buttonRaw === 4 && addingPoint) {
         stopAddingPoint();
     }

     if (settings.showCursorPosition) {
        // Cursor position background
        ctx.fillStyle = "#00000079";
        ctx.fillRect(mouse.rx - 50/displayTransform.scale, mouse.ry + 21 / displayTransform.scale, 100 / displayTransform.scale, 16 / displayTransform.scale);
        
        // Cursor position text
        ctx.font = `${14 / displayTransform.scale}px verdana`;
        ctx.fillStyle = "#EEE";
        ctx.fillText(`X:${Math.floor(mouse.rx)}, Y:${Math.floor(mouse.ry)}`, mouse.rx, mouse.ry + 30 / displayTransform.scale);
    }
    // reaquest next frame
    requestAnimationFrame(update);
}

function startAddingPoint() {
    addingPoint = true;
    addPointBtn.style.background = "green";
    addPointBtn.style.color = "#fff";
    resetPointsBtn.disabled = true;

}

function stopAddingPoint() {
    addingPoint = false;
    addPointBtn.style.background = "#eee";
    addPointBtn.style.color = "#666";
    resetPointsBtn.disabled = false;

}


// ---------------------------------------------------------------------


/* UTILS */

/**
 * Shortcut function for console.log.
 * 
 * @param {String} msg The message to log.
 * @param  {...any} args Additional messages to log.
 */
function log(msg, ...args) {
    console.log(msg, ...args);
}


function readUrl(fileTypeInput) {
    const file = fileTypeInput.files[0];
    const reader = new FileReader();

    reader.onloadend = function() {
        baseImage = new Image();
        baseImage.src = reader.result;
        baseImage.onload = function() {
            // enable the toolbar buttons
            addPointBtn.disabled = false;
            resetPointsBtn.disabled = false;

            // Start panning and zooming
            update(); 
        }
    }

    if (file) {
        reader.readAsDataURL(file);
    } else {
        // TODO
    }
}