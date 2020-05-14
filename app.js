/**
 * Notes
 * ~~~
 * Pan & Zoom canvas:
 * https://stackoverflow.com/questions/33925012/how-to-pan-the-canvas
 * ~~~
 * 
 */

// Get the workspace element
const workspace = document.getElementById("workspace");

// Create the main canvas element
// ~
// We create the canvas element here instead of in the html
// so the VS Code's Intellisense works with canvas and context.
// ~
const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
let baseImage = null;

// Add the canvas to the workspace
workspace.appendChild(canvas);

// Canvas setup
canvas.width = workspace.clientWidth;
canvas.height = workspace.clientHeight;
canvas.style.background = "#fff"

// canvas scrolling
let offsetX, offsetY;
function reOffset() {
    canvas.width = workspace.clientWidth;
    canvas.height = workspace.clientHeight;    
    const bb = canvas.getBoundingClientRect();
    offsetX = bb.left;
    offsetY = bb.top;
    // for (let x = 0; x < 100; x++) { ctx.fillText(x,x*20, canvas.height/2); }
    // for (let y = -50; y < 50; y++) { ctx.fillText(y,canvas.width/2, y*20); }
    if (baseImage !== null) {
        ctx.drawImage(baseImage, 0, 0);
    }
}
reOffset();
window.onscroll = e => reOffset();
window.onresize = e => reOffset();

let isDown = false;
let startX, startY;
let netPanningX = 0;
let netPanningY = 0;

canvas.addEventListener("mousedown", handleMouseDown);
canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseup", handleMouseUp);
canvas.addEventListener("mouseout", handleMouseOut);

function handleMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();

    startX = parseInt(e.clientX - offsetX);
    startY = parseInt(e.clientY - offsetY);

    isDown = true;
}

function handleMouseUp(e){
    // tell the browser we're handling this event
    e.preventDefault();
    e.stopPropagation();
  
    // clear the isDragging flag
    isDown=false;
  }
  
  function handleMouseOut(e){
    // tell the browser we're handling this event
    e.preventDefault();
    e.stopPropagation();
  
    // clear the isDragging flag
    isDown=false;
  }
  
  function handleMouseMove(e){
  
    // only do this code if the mouse is being dragged
    if(!isDown){return;}
    
    // tell the browser we're handling this event
    e.preventDefault();
    e.stopPropagation();
  
    // get the current mouse position
    mouseX=parseInt(e.clientX-offsetX);
    mouseY=parseInt(e.clientY-offsetY);
  
    // dx & dy are the distance the mouse has moved since
    // the last mousemove event
    var dx=mouseX-startX;
    var dy=mouseY-startY;
  
    // reset the vars for next mousemove
    startX=mouseX;
    startY=mouseY;
  
    // accumulate the net panning done
    netPanningX+=dx;
    netPanningY+=dy;
    //$results.text('Net change in panning: x:'+netPanningX+'px, y:'+netPanningY+'px'); 
    log(`panX: ${netPanningX}, panY: ${netPanningY}`);
  
    // display the horizontal & vertical reference lines
    // The horizontal line is offset leftward or rightward by netPanningX
    // The vertical line is offset upward or downward by netPanningY
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (baseImage !== null) {
        ctx.drawImage(baseImage, netPanningX, netPanningY)
    }
    // for(var x=-50;x<50;x++){ ctx.fillText(x,x*20+netPanningX,canvas.height/2); }
    // for(var y=-50;y<50;y++){ ctx.fillText(y,canvas.width/2,y*20+netPanningY); }
  }

// Workspace Toolbar setup
const importImageBtn = document.getElementById("import-image");
importImageBtn.addEventListener("change", readUrl, true);
function readUrl() {
    const file = importImageBtn.files[0];
    const reader = new FileReader();
    reader.onloadend = function() {
        // canvas.style.backgroundImage = "url(" + reader.result + ")";
        baseImage = new Image();
        baseImage.src = reader.result;
        baseImage.onload = function() {
            ctx.drawImage(baseImage, 0, 0);
        }
    }
    if (file) {
        reader.readAsDataURL(file);
    } else {
        // TODO
    }
}

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