interface Target {
    x: number;
    y: number;
    rotate: number;
    radius: number;
    bold_rate: number;
    rotate_speed: number;
    friction: number;
    speed: number;
    step: number;
    freq: number;
    update(): void;
}

class TargetImpl implements Target {
    x: number = 0;
    y: number = 0;
    rotate: number = 0;
    radius: number = 0;
    bold_rate: number;
    rotate_speed: number = 0;
    friction: number = 0;
    speed: number = 0;
    step: number = 0;
    freq: number = 0;

    constructor(rad: number) {
        this.bold_rate = rad;
        this.update();
    }

    update(): void {
        this.rotate_speed = Math.random() * 0.02 + 0.02;
        this.friction = Math.random() * 0.8 + 0.1;
        this.speed = Math.random() * 0.2 + 0.03;
        this.step = Math.random() * 0.2 + 0.1;
        this.freq = Math.random() * 0.2 + 0.5;
    }
}

let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let ratio: number;
let vertices: Float32Array;
let velocities: Float32Array;
let freqArr: number[];
let cw: number;
let ch: number;
let colorLoc: WebGLUniformLocation | null;
let thetaArr: number[];
let velThetaArr: number[];
let velRadArr: number[];
let boldRateArr: number[];
let drawType: number;
let numLines: number = 80000;
let targetArr: Target[] = [];
let randomTargetXArr: number[] = [];
let randomTargetYArr: number[] = [];
drawType = 2;

function backingScale(context: CanvasRenderingContext2D): number {
    if ("devicePixelRatio" in window) {
        if (window.devicePixelRatio > 1) {
            return window.devicePixelRatio;
        }
    }
    return 1;
}

const tempCanvas = document.createElement("canvas");
const tempCtx = tempCanvas.getContext("2d");
const scaleFactor = tempCtx ? backingScale(tempCtx) : 1;

function loadScene(): void {
    canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
    gl = canvas.getContext("experimental-webgl") as WebGLRenderingContext;
    if (!gl) {
        alert("There's no WebGL context available.");
        return;
    }
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const vertexShaderScript = document.getElementById("shader-vs") as HTMLScriptElement;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER) as WebGLShader;
    gl.shaderSource(vertexShader, vertexShaderScript.text);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        alert("Couldn't compile the vertex shader");
        gl.deleteShader(vertexShader);
        return;
    }

    const fragmentShaderScript = document.getElementById("shader-fs") as HTMLScriptElement;
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER) as WebGLShader;
    gl.shaderSource(fragmentShader, fragmentShaderScript.text);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        alert("Couldn't compile the fragment shader");
        gl.deleteShader(fragmentShader);
        return;
    }

    gl.program = gl.createProgram() as WebGLProgram;
    gl.attachShader(gl.program, vertexShader);
    gl.attachShader(gl.program, fragmentShader);
    gl.linkProgram(gl.program);
    if (!gl.getProgramParameter(gl.program, gl.LINK_STATUS)) {
        alert("Unable to initialise shaders");
        gl.deleteProgram(gl.program);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        return;
    }

    gl.useProgram(gl.program);
    const vertexPosition = gl.getAttribLocation(gl.program, "vertexPosition");
    gl.enableVertexAttribArray(vertexPosition);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);

    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    setup();

    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = 30.0;
    const aspectRatio = canvas.width / canvas.height;
    const nearPlane = 1.0;
    const farPlane = 10000.0;
    const top = nearPlane * Math.tan((fieldOfView * Math.PI) / 360.0);
    const bottom = -top;
    const right = top * aspectRatio;
    const left = -right;

    const a = (right + left) / (right - left);
    const b = (top + bottom) / (top - bottom);
    const c = (farPlane + nearPlane) / (farPlane - nearPlane);
    const d = (2 * farPlane * nearPlane) / (farPlane - nearPlane);
    const x = (2 * nearPlane) / (right - left);
    const y = (2 * nearPlane) / (top - bottom);
    const perspectiveMatrix = [x, 0, a, 0, 0, y, b, 0, 0, 0, c, d, 0, 0, -1, 0];

    const modelViewMatrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    const vertexPosAttribLocation = gl.getAttribLocation(gl.program, "vertexPosition");
    gl.vertexAttribPointer(vertexPosAttribLocation, 3.0, gl.FLOAT, false, 0, 0);

    const uModelViewMatrix = gl.getUniformLocation(gl.program, "modelViewMatrix");
    const uPerspectiveMatrix = gl.getUniformLocation(gl.program, "perspectiveMatrix");
    gl.uniformMatrix4fv(uModelViewMatrix, false, new Float32Array(perspectiveMatrix));
    gl.uniformMatrix4fv(uPerspectiveMatrix, false, new Float32Array(modelViewMatrix));

    animate();
    setTimeout(timer, 1500);
}

let count = 0;
let cn = 0;

function animate(): void {
    requestAnimationFrame(animate);
    drawScene();
}

function drawScene(): void {
    draw();
    gl.lineWidth(2);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.LINES, 0, numLines);
    gl.flush();
}

function setup(): void {
    setup00();
}

function draw(): void {
    draw00();
}

function setup00(): void {
    vertices = [];
    velThetaArr = [];
    velRadArr = [];
    ratio = cw / ch;
    velocities = [];
    thetaArr = [];
    freqArr = [];
    boldRateArr = [];

    const widthScale = window.innerWidth / window.innerHeight;
    const height = 110 * scaleFactor;
    const X_MAX_NUM = Math.floor(window.innerWidth / height);
    const Y_MAX_NUM = Math.floor(window.innerHeight / height);

    const targetRad = (2 / (Y_MAX_NUM * 2 - 1)) * 0.35;
    for (let xx = -X_MAX_NUM + 1; xx < X_MAX_NUM; xx++) {
        for (let yy = -Y_MAX_NUM + 1; yy < Y_MAX_NUM; yy++) {
            const target = new TargetImpl(targetRad);
            target.x = (xx / X_MAX_NUM) * widthScale;
            target.y = yy / Y_MAX_NUM;
            targetArr.push(target);
        }
    }

    for (let ii = 0; ii < numLines; ii++) {
        vertices.push(0, 0, 1.83);
        vertices.push(0, 0, 1.83);
    }

    vertices = new Float32Array(vertices);
    velocities = new Float32Array(velocities);
}

function draw00(): void {
    for (let ii = 0; ii < targetArr.length; ii++) {
        targetArr[ii].rotate += targetArr[ii].rotate_speed;
    }

    let tRad: number, tX: number, tY: number;
    let bp: number, px: number, py: number;
    let target: Target;
    for (let ii = 0; ii < numLines * 2; ii += 2) {
        bp = ii * 3;

        target = targetArr[ii % targetArr.length];
        tRad = Math.cos(target.rotate * 2.321 + target.freq * ii) * target.bold_rate;
        tX = target.x + Math.cos(target.rotate + target.step * ii) * tRad;
        tY = target.y + Math.sin(target.rotate + target.step * ii) * tRad;

        px = vertices[bp + 3];
        py = vertices[bp + 4];

        px += (tX - px) * 0.1;
        py += (tY - py) * 0.1;

        vertices[bp + 3] = px;
        vertices[bp + 4] = py;

        vertices[bp] = px - 0.001;
        vertices[bp + 1] = py - 0.001;
    }
}

function timer(): void {
    for (let ii = 0; ii < targetArr.length; ii++) {
        targetArr[ii].update();
    }
    setTimeout(timer, 1500);
}

window.onload = loadScene;