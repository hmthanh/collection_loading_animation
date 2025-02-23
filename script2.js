class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)
    this.initWebGL()
    this.initShaders()
    this.setupScene()
    this.createParticles()
    this.animate()
  }

  initWebGL() {
    // this.gl = this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl")
    this.gl = this.canvas.getContext("2d")
    if (!this.gl) {
      throw new Error("WebGL not supported")
    }

    // Setup canvas dimensions
    this.resize()
    window.addEventListener("resize", () => this.resize())

    // WebGL settings
    this.gl.enable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE)
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)
  }

  resize() {
    const pixelRatio = window.devicePixelRatio || 1
    this.canvas.width = window.innerWidth * pixelRatio
    this.canvas.height = window.innerHeight * pixelRatio
    this.canvas.style.width = `${window.innerWidth}px`
    this.canvas.style.height = `${window.innerHeight}px`
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  initShaders() {
    // Vertex shader
    const vertexShaderSource = `
        attribute vec3 vertexPosition;
        uniform mat4 modelViewMatrix;
        uniform mat4 perspectiveMatrix;
        
        void main() {
          gl_Position = perspectiveMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
        }
      `

    // Fragment shader
    const fragmentShaderSource = `
        precision mediump float;
        
        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 0.1);
        }
      `

    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER)
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER)

    // Create shader program
    this.program = this.gl.createProgram()
    this.gl.attachShader(this.program, vertexShader)
    this.gl.attachShader(this.program, fragmentShader)
    this.gl.linkProgram(this.program)

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error("Unable to initialize shaders")
    }

    this.gl.useProgram(this.program)
  }

  compileShader(source, type) {
    const shader = this.gl.createShader(type)
    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(`Shader compilation error: ${this.gl.getShaderInfoLog(shader)}`)
    }

    return shader
  }

  setupScene() {
    // Create perspective matrix
    const fieldOfView = 30.0
    const aspectRatio = this.canvas.width / this.canvas.height
    const nearPlane = 1.0
    const farPlane = 10000.0

    this.perspectiveMatrix = this.createPerspectiveMatrix(fieldOfView, aspectRatio, nearPlane, farPlane)

    // Create model view matrix (identity)
    this.modelViewMatrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

    // Set uniforms
    const uModelViewMatrix = this.gl.getUniformLocation(this.program, "modelViewMatrix")
    const uPerspectiveMatrix = this.gl.getUniformLocation(this.program, "perspectiveMatrix")

    this.gl.uniformMatrix4fv(uModelViewMatrix, false, this.modelViewMatrix)
    this.gl.uniformMatrix4fv(uPerspectiveMatrix, false, this.perspectiveMatrix)
  }

  createPerspectiveMatrix(fov, aspect, near, far) {
    const f = Math.tan(Math.PI * 0.5 - (0.5 * fov * Math.PI) / 180)
    const rangeInv = 1.0 / (near - far)

    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (near + far) * rangeInv,
      -1,
      0,
      0,
      near * far * rangeInv * 2,
      0,
    ])
  }

  createParticles() {
    this.numParticles = 80000
    this.particles = []
    this.vertices = new Float32Array(this.numParticles * 6) // 2 points per line, 3 components per point

    // Calculate grid dimensions
    const gridWidth = Math.ceil(Math.sqrt(this.numParticles))
    const cellSize = 2.0 / gridWidth

    for (let i = 0; i < this.numParticles; i++) {
      const x = (i % gridWidth) * cellSize - 1.0
      const y = Math.floor(i / gridWidth) * cellSize - 1.0

      this.particles.push({
        position: { x, y },
        rotation: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        radius: Math.random() * 0.1 + 0.05,
      })
    }

    // Create vertex buffer
    this.vertexBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)

    const vertexPosition = this.gl.getAttribLocation(this.program, "vertexPosition")
    this.gl.enableVertexAttribArray(vertexPosition)
    this.gl.vertexAttribPointer(vertexPosition, 3, this.gl.FLOAT, false, 0, 0)
  }

  updateParticles() {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i]
      particle.rotation += particle.speed

      const idx = i * 6
      const radius = particle.radius
      const cos = Math.cos(particle.rotation) * radius
      const sin = Math.sin(particle.rotation) * radius

      // Line start point
      this.vertices[idx] = particle.position.x + cos
      this.vertices[idx + 1] = particle.position.y + sin
      this.vertices[idx + 2] = 0

      // Line end point
      this.vertices[idx + 3] = particle.position.x - cos
      this.vertices[idx + 4] = particle.position.y - sin
      this.vertices[idx + 5] = 0
    }

    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.DYNAMIC_DRAW)
  }

  draw() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
    this.updateParticles()
    this.gl.drawArrays(this.gl.LINES, 0, this.numParticles * 2)
    this.gl.flush()
  }

  animate = () => {
    this.draw()
    requestAnimationFrame(this.animate)
  }
}

// Usage
window.addEventListener("load", () => {
  const particleSystem = new ParticleSystem("webgl-canvas")
})
