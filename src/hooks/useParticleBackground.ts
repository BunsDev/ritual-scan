'use client'
import { useEffect } from 'react'

interface UseParticleBackgroundOptions {
  color?: string
  opacity?: number
}

// Global flag to track if particle background is initialized
let particleBackgroundInitialized = false

export function useParticleBackground(options: UseParticleBackgroundOptions = {}) {
  const { color = '#346d22', opacity = 0.25 } = options

  useEffect(() => {
    // Only create particle background ONCE across entire app lifecycle
    if (particleBackgroundInitialized) {
      return
    }
    
    particleBackgroundInitialized = true
    console.log('🎨 Creating particle background (ONE-TIME global setup)')
    
    const canvas = document.createElement('canvas')
    canvas.id = 'particle-bg'
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;opacity:${opacity}`
    document.body.appendChild(canvas)

    const glContext = canvas.getContext('webgl')
    if (!glContext) {
      document.body.removeChild(canvas)
      return
    }
    const gl = glContext

    let program: WebGLProgram, startTime = Date.now()

    const vs = `attribute vec2 a_position; void main(){gl_Position=vec4(a_position,0.,1.);}`
    const fs = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_baseColor;
uniform vec3 u_flowColor;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  
  return mix(mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
                dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
            mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}

vec2 curlNoise(vec2 p) {
  float eps = 0.1;
  float n1 = noise(p + vec2(eps, 0.0));
  float n2 = noise(p - vec2(eps, 0.0));
  float n3 = noise(p + vec2(0.0, eps));
  float n4 = noise(p - vec2(0.0, eps));
  
  float dx = (n1 - n2) / (2.0 * eps);
  float dy = (n3 - n4) / (2.0 * eps);
  
  return vec2(dy, -dx);
}

float particleField(vec2 p, float time) {
  vec2 flow = curlNoise(p * 0.5 + time * 0.1);
  vec2 particlePos = p + flow * 2.0;
  
  float density = 0.0;
  
  for(int i = 0; i < 4; i++) {
    float scale = pow(2.0, float(i));
    vec2 pos = particlePos * scale + time * 0.05 * scale;
    
    float cluster = noise(pos * 0.3);
    float particles = noise(pos) * cluster;
    
    density += particles / scale;
  }
  
  return density;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 8.0;
  
  float time = u_time * 0.3;
  
  float particles = particleField(p, time);
  
  vec2 flow = curlNoise(p * 0.2 + time * 0.1);
  particles += 0.3 * noise(p + flow * 3.0 + time * 0.2);
  
  float levels = 18.0;
  float contourValue = particles * levels;
  float contour = abs(fract(contourValue) - 0.5);
  
  float lineWidth = 0.02 + 0.01 * sin(time + contourValue);
  float line = 1.0 - smoothstep(0.0, lineWidth, contour);
  
  float sparkle = 0.0;
  vec2 sparklePos = p * 20.0 + time * 2.0;
  float sparkleNoise = hash(floor(sparklePos));
  if(sparkleNoise > 0.98) {
    float dist = length(fract(sparklePos) - 0.5);
    sparkle = exp(-dist * 20.0) * 0.5;
  }
  
  float intensity = line + sparkle;
  
  float flowIntensity = length(flow) * 0.5;
  vec3 color = mix(u_baseColor, u_flowColor, flowIntensity);
  
  float glow = exp(-contour * 8.0) * 0.1;
  intensity += glow;
  
  vec2 edge = abs(uv - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.8, 1.0, max(edge.x, edge.y));
  intensity *= edgeFade;
  
  gl_FragColor = vec4(color, intensity * 0.7);
}
`

    function cs(t: number, s: string) {
      const sh = gl.createShader(t)!
      gl.shaderSource(sh, s)
      gl.compileShader(sh)
      
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(sh))
        return null
      }
      return sh
    }

    const vsh = cs(gl.VERTEX_SHADER, vs)
    const fsh = cs(gl.FRAGMENT_SHADER, fs)
    
    if (!vsh || !fsh) {
      console.error('Failed to compile shaders')
      document.body.removeChild(canvas)
      return
    }
    
    program = gl.createProgram()!
    gl.attachShader(program, vsh)
    gl.attachShader(program, fsh)
    gl.linkProgram(program)
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program error:', gl.getProgramInfoLog(program))
      document.body.removeChild(canvas)
      return
    }
    
    gl.useProgram(program)

    const pb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, pb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)
    const pl = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(pl)
    gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 0, 0)

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    let animationFrameId: number
    
    function render() {
      gl.clearColor(0,0,0,1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), (Date.now() - startTime) * 0.001)
      
      // Convert hex color to RGB
      const r = parseInt(color.slice(1, 3), 16) / 255
      const g = parseInt(color.slice(3, 5), 16) / 255
      const b = parseInt(color.slice(5, 7), 16) / 255
      gl.uniform3f(gl.getUniformLocation(program, 'u_baseColor'), r, g, b)
      gl.uniform3f(gl.getUniformLocation(program, 'u_flowColor'), r * 1.5, g * 1.5, b * 1.5)
      
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      
      animationFrameId = requestAnimationFrame(render)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    animationFrameId = requestAnimationFrame(render)

    // No cleanup function - particle background runs for entire session
    // Canvas, WebGL context, and animation loop persist across all navigation
    // Browser automatically cleans up on tab close
  }, [color, opacity])
}
