const canvas = document.querySelector('canvas')
    , gl = canvas.getContext('webgl2')

let frameID

function createShader(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader))
  }
  return shader
}

function createVertexShader(gl, source) {
  return createShader(gl, gl.VERTEX_SHADER, source)
}

function createFragmentShader(gl, source) {
  return createShader(gl, gl.FRAGMENT_SHADER, source)
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program))
  }
  return program
}

function createProgramFromSource(gl, vertexShaderSource, fragmentShaderSource) {
  return createProgram(
    gl,
    createVertexShader(gl, vertexShaderSource),
    createFragmentShader(gl, fragmentShaderSource),
  )
}

function createBuffer(gl, data, target = gl.ARRAY_BUFFER, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer()
  gl.bindBuffer(target, buffer)
  gl.bufferData(target, data, usage)
  return buffer
}

function getProgramAttributes(gl, program) {
  const count = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES)
  const attributes = new Map()
  for (let index = 0; index < count; index++) {
    const { name, size, type } = gl.getActiveAttrib(program, index)
    const location = gl.getAttribLocation(program, name)
    attributes.set(name, { index, name, size, type, location })
  }
  return attributes
}

function getProgramUniforms(gl, program) {
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS)
  const uniforms = new Map()
  for (let index = 0; index < count; index++) {
    const { name, size, type } = gl.getActiveUniform(program, index)
    const location = gl.getUniformLocation(program, name)
    uniforms.set(name, { index, name, size, type, location })
  }
  return uniforms
}

function getProgramLocations(gl, program) {
  return {
    uniforms: getProgramUniforms(gl, program),
    attributes: getProgramAttributes(gl, program)
  }
}

function createLineGrid(width, height) {
  const halfWidth = width * 0.5
      , halfHeight = height * 0.5
  const lines = []
  for (let y = -halfHeight; y < halfHeight; ++y) {
    const vertices = []
    for (let x = -halfWidth; x < halfWidth; ++x) {
      vertices.push(x, 0, y)
    }
    lines.push(vertices)
  }
  return lines
}

function createGrid(width, height) {
  const halfWidth = width * 0.5
      , halfHeight = height * 0.5
  const vertices = []
  for (let y = -halfHeight; y < halfHeight; ++y) {
    for (let x = -halfWidth; x < halfWidth; ++x) {
      vertices.push(x, 0, y)
    }
  }
  return vertices
}

const program = createProgramFromSource(
gl,
`
precision highp float;

attribute vec3 a_position;
varying vec3 v_position;
uniform mat4 u_modelViewProjection;
uniform float u_time;
uniform float u_stretch;

float rand(float n) {
  return fract(sin(n) * 43758.5453123);
}

float rand(vec2 n) { 
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float noise(float p) {
	float fl = floor(p);
  float fc = fract(p);
	return mix(
    rand(fl), 
    rand(fl + 1.0), 
    fc
  );
}
	
float noise(vec2 n) {
	const vec2 d = vec2(0.0, 1.0);
  vec2 b = floor(n)
     , f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
	return mix(
    mix(
      rand(b),
      rand(b + d.yx), 
      f.x
    ), 
    mix(
      rand(b + d.xy), 
      rand(b + d.yy), 
      f.x
    ), 
    f.y
  );
}

void main(void) {
  vec4 v_pos = vec4(
    a_position.x * 0.25, 
    noise(
      vec2(
        a_position.x * 0.05,
        a_position.z * 0.25 - floor(u_time * 0.25)
      )
    )
    *
    4.0 * abs(a_position.x * a_position.x) / 4096.0,
    a_position.z,
    1.0
  );
  gl_Position = u_modelViewProjection * v_pos;
  v_position = v_pos.xyz;
}
`,
`
precision highp float;

varying vec3 v_position;

void main() {
  float channel = (v_position.z + 64.0) / 32.0;
  gl_FragColor = vec4(channel * 0.4, channel * 0.3, channel, 1.0);
}
`
)

const locations = getProgramLocations(gl, program)
console.log(locations)

const lineGrid = createLineGrid(512, 128)
const buffers = lineGrid.map((line) => createBuffer(gl, new Float32Array(line)))
//const buffer = createBuffer(gl, new Float32Array(createGrid(128, 128)))

const model = mat4.create()
    , view = mat4.create()
    , inverseView = mat4.create()
    , modelView = mat4.create()
    , viewProjection = mat4.create()
    , modelViewProjection = mat4.create()
    , perspective = mat4.create()
    , orthogonal = mat4.create()
    , translation = vec3.fromValues(0,-6,-64)

function frame(frameTime) {
  const nearPlane = 0.1
      , farPlane = 1000.0
      , aspectRatio = gl.canvas.width / gl.canvas.height
  
  mat4.perspective(perspective, Math.PI * 0.25, aspectRatio, nearPlane, farPlane)
  mat4.ortho(orthogonal, gl.canvas.width, 0, gl.canvas.height, 0, nearPlane, farPlane)

  vec3.set(
    translation, 
    Math.sin(frameTime * 0.00125) * 2, 
    -3 - (1.0 + Math.sin(frameTime * 0.001)) * 0.5 * 6, 
    -64
  )
  
  mat4.identity(view);
  mat4.identity(model);
  mat4.translate(model, model, translation)
  
  mat4.multiply(modelView, model, view)
  mat4.multiply(modelViewProjection, perspective, modelView)
  
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)

  gl.clearColor(0.0, 0.0, 0.0, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  
  gl.useProgram(program)
  
  gl.uniform1f(locations.uniforms.get('u_time').location, frameTime * 0.1)
  gl.uniformMatrix4fv(locations.uniforms.get('u_modelViewProjection').location, gl.FALSE, modelViewProjection)
  
  for (const buffer of buffers) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.enableVertexAttribArray(locations.attributes.get('a_position').location)
    gl.vertexAttribPointer(locations.attributes.get('a_position').location, 3, gl.FLOAT, gl.FALSE, 0, 0)

    gl.drawArrays(gl.LINE_STRIP, 0, 512)
  }

  frameID = window.requestAnimationFrame(frame)
}

function resize() {
  gl.canvas.width = gl.canvas.clientWidth
  gl.canvas.height = gl.canvas.clientHeight
}

function start() {
  window.addEventListener('resize', resize)
  window.dispatchEvent(new Event('resize'))
  
  frameID = window.requestAnimationFrame(frame)
}

start()
