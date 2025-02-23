interface Particle {
  position: {
    x: number;
    y: number;
  };
  rotation: number;
  speed: number;
  radius: number;
}

interface ShaderSettings {
  vertexSource: string;
  fragmentSource: string;
}

interface MatrixSettings {
  fieldOfView: number;
  nearPlane: number;
  farPlane: number;
}

class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private vertexBuffer: WebGLBuffer;
  private particles: Particle[];
  private vertices: Float32Array;
  private numParticles: number;
  private perspectiveMatrix: Float32Array;
  private modelViewMatrix: Float32Array;

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      throw new Error(`Canvas element with id '${canvasId}' not found`);
    }
    this.canvas = canvas;
    this.initWebGL();
    this.initShaders();
    this.setupScene();
    this.createParticles();
    this.animate();
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.gl.enable(this.gl.BLEND);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
  }

  private resize(): void {
    const pixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * pixelRatio;
    this.canvas.height = window.innerHeight * pixelRatio;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private getShaderSources(): ShaderSettings {
    return {
      vertexSource: `
        attribute vec3 vertexPosition;
        uniform mat4 modelViewMatrix;
        uniform mat4 perspectiveMatrix;
        
        void main() {
          gl_Position = perspectiveMatrix * modelViewMatrix * vec4(vertexPosition, 1.0);
        }
      `,
      fragmentSource: `
        precision mediump float;
        
        void main() {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 0.1);
        }
      `
    };
  }

  private compileShader(source: string, type: number): WebGLShader {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation error: ${info}`);
    }

    return shader;
  }

  private initShaders(): void {
    const shaderSources = this.getShaderSources();
    const vertexShader = this.compileShader(shaderSources.vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(shaderSources.fragmentSource, this.gl.FRAGMENT_SHADER);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }
    this.program = program;

    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);

    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize shaders');
    }

    this.gl.useProgram(this.program);
  }

  private createPerspectiveMatrix(settings: MatrixSettings): Float32Array {
    const { fieldOfView, nearPlane, farPlane } = settings;
    const aspect = this.canvas.width / this.canvas.height;
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfView * Math.PI / 180);
    const rangeInv = 1.0 / (nearPlane - farPlane);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (nearPlane + farPlane) * rangeInv, -1,
      0, 0, nearPlane * farPlane * rangeInv * 2, 0
    ]);
  }

  private setupScene(): void {
    const matrixSettings: MatrixSettings = {
      fieldOfView: 30.0,
      nearPlane: 1.0,
      farPlane: 10000.0
    };

    this.perspectiveMatrix = this.createPerspectiveMatrix(matrixSettings);

    this.modelViewMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    const uModelViewMatrix = this.gl.getUniformLocation(this.program, 'modelViewMatrix');
    const uPerspectiveMatrix = this.gl.getUniformLocation(this.program, 'perspectiveMatrix');

    if (!uModelViewMatrix || !uPerspectiveMatrix) {
      throw new Error('Unable to get uniform locations');
    }

    this.gl.uniformMatrix4fv(uModelViewMatrix, false, this.modelViewMatrix);
    this.gl.uniformMatrix4fv(uPerspectiveMatrix, false, this.perspectiveMatrix);
  }

  private createParticles(): void {
    this.numParticles = 80000;
    this.particles = [];
    this.vertices = new Float32Array(this.numParticles * 6);

    const gridWidth = Math.ceil(Math.sqrt(this.numParticles));
    const cellSize = 2.0 / gridWidth;

    for (let i = 0; i < this.numParticles; i++) {
      const x = (i % gridWidth) * cellSize - 1.0;
      const y = Math.floor(i / gridWidth) * cellSize - 1.0;

      this.particles.push({
        position: { x, y },
        rotation: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        radius: Math.random() * 0.1 + 0.05
      });
    }

    const vertexBuffer = this.gl.createBuffer();
    if (!vertexBuffer) {
      throw new Error('Failed to create vertex buffer');
    }
    this.vertexBuffer = vertexBuffer;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

    const vertexPosition = this.gl.getAttribLocation(this.program, 'vertexPosition');
    this.gl.enableVertexAttribArray(vertexPosition);
    this.gl.vertexAttribPointer(vertexPosition, 3, this.gl.FLOAT, false, 0, 0);
  }

  private updateParticles(): void {
    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      particle.rotation += particle.speed;

      const idx = i * 6;
      const radius = particle.radius;
      const cos = Math.cos(particle.rotation) * radius;
      const sin = Math.sin(particle.rotation) * radius;

      // Line start point
      this.vertices[idx] = particle.position.x + cos;
      this.vertices[idx + 1] = particle.position.y + sin;
      this.vertices[idx + 2] = 0;

      // Line end point
      this.vertices[idx + 3] = particle.position.x - cos;
      this.vertices[idx + 4] = particle.position.y - sin;
      this.vertices[idx + 5] = 0;
    }

    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertices, this.gl.DYNAMIC_DRAW);
  }

  private draw(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.updateParticles();
    this.gl.drawArrays(this.gl.LINES, 0, this.numParticles * 2);
    this.gl.flush();
  }

  private animate = (): void => {
    this.draw();
    requestAnimationFrame(this.animate);
  }

  // Public methods for external control
  public setParticleCount(count: number): void {
    this.numParticles = count;
    this.createParticles();
  }

  public cleanup(): void {
    window.removeEventListener('resize', () => this.resize());
    this.gl.deleteProgram(this.program);
    this.gl.deleteBuffer(this.vertexBuffer);
  }
}

// Usage
window.addEventListener('load', () => {
  try {
    const particleSystem = new ParticleSystem('webgl-canvas');
  } catch (error) {
    console.error('Failed to initialize particle system:', error);
  }
});