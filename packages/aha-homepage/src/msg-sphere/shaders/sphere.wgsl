struct Params {
  resolution: vec2f,
  pointer: vec2f,
  time: f32,
  expressionMix: f32,
  blink: f32,
  yaw: f32,
  pitch: f32,
  padding: f32,
}

@group(0) @binding(0) var<uniform> params: Params;

const GROUND_Y: f32 = -0.60;
const FACE_RAISE: f32 = 0.08;
const SPHERE_RADIUS: f32 = 1.0;
const MAX_DISTANCE: f32 = 12.0;
const SURFACE_EPSILON: f32 = 0.0008;

fn saturate(value: f32) -> f32 {
  return clamp(value, 0.0, 1.0);
}

fn hash21(point: vec2f) -> f32 {
  return fract(sin(dot(point, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn contactRadius() -> f32 {
  return sqrt(max(SPHERE_RADIUS * SPHERE_RADIUS - GROUND_Y * GROUND_Y, 0.0001));
}

fn mapScene(point: vec3f) -> vec2f {
  // Keep a hard sphere. Flat stage floor — no carved cavity (that reads as a cut).
  let sphere = length(point) - SPHERE_RADIUS;
  let ground = point.y - GROUND_Y;

  if (sphere < ground) {
    return vec2f(sphere, 1.0);
  }
  return vec2f(ground, 2.0);
}

fn sceneNormal(point: vec3f) -> vec3f {
  let e = 0.0012;
  let x = vec3f(e, 0.0, 0.0);
  let y = vec3f(0.0, e, 0.0);
  let z = vec3f(0.0, 0.0, e);
  return normalize(vec3f(
    mapScene(point + x).x - mapScene(point - x).x,
    mapScene(point + y).x - mapScene(point - y).x,
    mapScene(point + z).x - mapScene(point - z).x,
  ));
}

fn marchScene(origin: vec3f, direction: vec3f) -> vec3f {
  var distanceTravelled = 0.0;
  var material = -1.0;
  var closestApproach = 1e9;

  for (var step = 0; step < 144; step += 1) {
    let samplePoint = origin + direction * distanceTravelled;
    let scene = mapScene(samplePoint);
    closestApproach = min(closestApproach, abs(scene.x));

    if (abs(scene.x) < SURFACE_EPSILON) {
      material = scene.y;
      break;
    }

    distanceTravelled += clamp(scene.x * 0.82, 0.00035, 0.22);
    if (distanceTravelled > MAX_DISTANCE) {
      break;
    }
  }

  // Binary refine for a cleaner contact silhouette.
  if (material > 0.0) {
    var lo = distanceTravelled - 0.025;
    var hi = distanceTravelled + 0.012;
    for (var refine = 0; refine < 8; refine += 1) {
      let mid = 0.5 * (lo + hi);
      if (mapScene(origin + direction * mid).x < 0.0) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    distanceTravelled = hi;
  }

  return vec3f(distanceTravelled, material, closestApproach);
}

fn ellipseMask(point: vec2f, radii: vec2f) -> f32 {
  let distance = length(point / radii) - 1.0;
  // Near-hard edge with ~1px of AA at typical desktop DPR.
  let aa = max(0.0015, 2.4 / max(params.resolution.y, 1.0));
  return 1.0 - smoothstep(-aa, aa, distance);
}

fn segmentMask(point: vec2f, start: vec2f, end: vec2f, width: f32) -> f32 {
  let pointDelta = point - start;
  let segment = end - start;
  let amount = clamp(dot(pointDelta, segment) / dot(segment, segment), 0.0, 1.0);
  let distance = length(pointDelta - segment * amount);
  let aa = max(0.0012, 2.0 / max(params.resolution.y, 1.0));
  return 1.0 - smoothstep(width - aa, width + aa, distance);
}

fn eyebrowMask(
  point: vec2f,
  center: vec2f,
  side: f32,
  expression: f32,
) -> f32 {
  // Always one straight bar. O-mouth raises toward the center (/ \);
  // skeptical levels out. Expression only rotates the bar — no bend morph.
  let surpriseStartY = select(0.255, 0.195, side < 0.0);
  let surpriseEndY = select(0.195, 0.255, side < 0.0);
  let skepticalY = 0.225;

  let start = center + vec2f(-0.15, mix(surpriseStartY, skepticalY, expression));
  let end = center + vec2f(0.15, mix(surpriseEndY, skepticalY, expression));
  return segmentMask(point, start, end, 0.030);
}

fn backgroundColor(screen: vec2f, rayDirection: vec3f) -> vec3f {
  // Cool stage void: deep charcoal with a soft vertical falloff so the
  // warm Sphere reads as a solid volume against colder air.
  let height = rayDirection.y;
  let vignette = smoothstep(1.55, 0.35, length(screen * vec2f(0.72, 1.0)));

  var color = mix(
    vec3f(0.012, 0.014, 0.020),
    vec3f(0.028, 0.034, 0.048),
    saturate(height * 1.1 + 0.55),
  );
  color = mix(color, vec3f(0.004, 0.005, 0.008), 1.0 - vignette);

  // Soft horizon band and floor glow that suggests a stage plane.
  let horizon = exp(-abs(height + 0.08) * 14.0);
  color += vec3f(0.045, 0.055, 0.070) * horizon;
  let floorGlow = exp(-max(height + 0.22, 0.0) * 7.0) * saturate(-height * 4.0 + 0.2);
  color += vec3f(0.08, 0.045, 0.012) * floorGlow * 0.55;

  // Sparse cool dust motes — keep contrast low so they stay atmospheric.
  let dustUv = screen * vec2f(38.0, 24.0) + vec2f(params.time * 0.018, 0.0);
  let cell = floor(dustUv);
  let seed = hash21(cell);
  let twinkle = 0.65 + 0.35 * sin(params.time * (0.8 + seed * 2.2) + seed * 44.0);
  let mote = step(0.975, seed)
    * (1.0 - smoothstep(0.012, 0.06, length(fract(dustUv) - 0.5)));
  color += vec3f(0.34, 0.42, 0.55) * mote * twinkle;

  // Warm key spill from where the Sphere sits — depth cue without city noise.
  let key = exp(-length(screen - vec2f(0.0, -0.08)) * 1.35);
  color += vec3f(0.12, 0.055, 0.01) * key * 0.22;

  return color;
}

fn envColor(reflection: vec3f) -> vec3f {
  // Cheap metallic environment: cool zenith, warm stage floor bounce.
  let sky = mix(
    vec3f(0.08, 0.10, 0.14),
    vec3f(0.35, 0.42, 0.55),
    saturate(reflection.y * 0.5 + 0.5),
  );
  let floorBounce = vec3f(0.55, 0.28, 0.05) * saturate(-reflection.y);
  let streak = pow(saturate(1.0 - abs(reflection.y)), 18.0)
    * vec3f(0.85, 0.9, 1.0);
  return sky + floorBounce + streak * 0.35;
}

fn shadeSphere(
  point: vec3f,
  normal: vec3f,
  camera: vec3f,
) -> vec3f {
  let worldLocal = normalize(point);
  // Orient face features only — silhouette, ground, and background stay put.
  let local = sphereFacingLocal(worldLocal);
  let expression = saturate(params.expressionMix);
  let blink = saturate(params.blink);
  let viewDirection = normalize(camera - point);
  let lightDirection = normalize(vec3f(
    -0.55 + params.pointer.x * 0.28,
    0.85 + params.pointer.y * 0.18,
    1.05,
  ));
  let fillDirection = normalize(vec3f(0.65, 0.15, 0.55));
  let reflection = reflect(-viewDirection, normal);

  let ndotL = saturate(dot(normal, lightDirection));
  let ndotF = saturate(dot(normal, fillDirection));
  let ndotV = saturate(dot(normal, viewDirection));
  let halfVector = normalize(lightDirection + viewDirection);
  let ndotH = saturate(dot(normal, halfVector));

  // Dual-lobe metallic specular + environment reflection.
  let softSpec = pow(ndotH, 28.0);
  let hardSpec = pow(ndotH, 180.0);
  let fresnel = pow(1.0 - ndotV, 3.2);
  let metalEnv = envColor(reflection);

  let baseWarm = vec3f(0.78, 0.32, 0.02);
  let baseLit = vec3f(1.0, 0.78, 0.18);
  var color = mix(baseWarm * 0.35, baseLit, ndotL);
  color += baseWarm * ndotF * 0.18;
  color += metalEnv * (0.12 + fresnel * 0.55);
  color += vec3f(1.0, 0.95, 0.82) * softSpec * 0.55;
  color += vec3f(1.0, 0.98, 0.92) * hardSpec * 1.15;
  color += vec3f(1.0, 0.72, 0.18) * fresnel * 0.28;
  // Brightness-only breath — does not move geometry or the contact well.
  color *= 1.0 + sin(params.time * 0.82) * 0.018;

  // Occlusion toward the buried base sells round volume (world space).
  let bury = smoothstep(-0.15, -0.85, worldLocal.y);
  color *= 1.0 - bury * 0.32;

  let face = vec2f(
    local.x - params.pointer.x * 0.022,
    local.y - FACE_RAISE - params.pointer.y * 0.014,
  );
  let front = smoothstep(0.28, 0.36, local.z);

  // Billboard emoji geometry: round white eyes, solid pupils, flat marks.
  let leftCenter = vec2f(-0.30, 0.16);
  let rightCenter = vec2f(0.30, 0.16);
  let eyeSize = mix(0.185, 0.175, expression) * max(0.12, 1.0 - blink * 0.92);
  let eyeRadii = vec2f(eyeSize, eyeSize);

  let leftEye = ellipseMask(face - leftCenter, eyeRadii) * front;
  let rightEye = ellipseMask(face - rightCenter, eyeRadii) * front;

  let pupilOffset = params.pointer * vec2f(0.050, 0.036);
  let pupilRadii = vec2f(0.072, 0.072);
  let leftPupil = ellipseMask(face - leftCenter - pupilOffset, pupilRadii)
    * leftEye;
  let rightPupil = ellipseMask(face - rightCenter - pupilOffset, pupilRadii)
    * rightEye;

  let brows = max(
    eyebrowMask(face, leftCenter, -1.0, expression),
    eyebrowMask(face, rightCenter, 1.0, expression),
  ) * front;

  let surpriseMouth = ellipseMask(
    face - vec2f(0.0, -0.24),
    vec2f(0.048, 0.048),
  );
  let skepticalMouth = segmentMask(
    face,
    vec2f(-0.08, -0.22),
    vec2f(0.08, -0.20),
    0.018,
  );
  let mouth = mix(surpriseMouth, skepticalMouth, expression) * front;

  let ink = vec3f(0.04, 0.04, 0.04);
  let sclera = vec3f(1.0, 1.0, 0.96);
  color = mix(color, sclera, max(leftEye, rightEye));
  color = mix(color, ink, max(max(leftPupil, rightPupil), max(brows, mouth)));

  return color;
}

fn shadeGround(point: vec3f) -> vec3f {
  let radial = length(point.xz);
  let ring = contactRadius();

  // Visible stage floor — soft shadow pool, not a hollow cut interior.
  let pool = smoothstep(ring + 0.75, ring - 0.08, radial);
  let contact = exp(-abs(radial - ring) * 7.5);
  let plinth = smoothstep(ring + 0.12, ring - 0.2, radial);

  var color = vec3f(0.022, 0.023, 0.027);
  color = mix(color, vec3f(0.016, 0.014, 0.012), plinth * 0.55);
  color += vec3f(0.18, 0.08, 0.015) * pool * 0.45;
  color += vec3f(0.42, 0.22, 0.05) * pow(pool, 2.2) * 0.22;
  color *= 1.0 - pool * 0.32;
  color *= 1.0 - contact * 0.42;

  return color;
}

fn softEmbedColor(
  point: vec3f,
  normal: vec3f,
  camera: vec3f,
  material: f32,
) -> vec3f {
  let radial = length(point.xz);
  let ring = contactRadius();
  let h = point.y - GROUND_Y;

  if (material < 1.5) {
    var color = shadeSphere(point, normal, camera);
    // Soft contact shade on the lower shell so bright gold never meets the floor
    // as a surgical cut — it settles into shadow first.
    let settle = 1.0 - smoothstep(0.02, 0.28, h);
    let rim = exp(-abs(radial - ring) * 10.0);
    color *= 1.0 - settle * 0.72;
    color *= 1.0 - rim * settle * 0.25;
    // Gentle warm bounce from the stage just above the floor line.
    color += vec3f(0.12, 0.05, 0.01) * settle * (1.0 - rim) * 0.2;
    return color;
  }

  var color = shadeGround(point);
  // Soft occlusion under the overhang — floor stays a surface, not a void.
  let under = smoothstep(ring + 0.05, ring - 0.35, radial);
  color *= 1.0 - under * 0.2;
  return color;
}

// Positive → sphere wins; negative → ground. Zero is the contact silhouette.
fn materialEdge(point: vec3f) -> f32 {
  return (point.y - GROUND_Y) - (length(point) - SPHERE_RADIUS);
}

fn shadeContact(
  point: vec3f,
  camera: vec3f,
  depth: f32,
) -> vec3f {
  let edge = materialEdge(point);
  // ~2px world-space blend so the hard sphere/floor material flip AA's out.
  let pixelWorld = depth * 0.84 / max(params.resolution.y, 1.0);
  let aa = max(pixelWorld * 2.15, 0.0012);

  if (abs(edge) > aa * 3.0) {
    let normal = sceneNormal(point);
    let material = select(2.0, 1.0, edge > 0.0);
    return softEmbedColor(point, normal, camera, material);
  }

  // Shade each side from its own surface so the blend stays physically grounded.
  let pSphere = normalize(point) * SPHERE_RADIUS;
  let pGround = vec3f(point.x, GROUND_Y, point.z);
  let cSphere = softEmbedColor(pSphere, normalize(pSphere), camera, 1.0);
  let cGround = softEmbedColor(pGround, vec3f(0.0, 1.0, 0.0), camera, 2.0);
  return mix(cGround, cSphere, smoothstep(-aa, aa, edge));
}

const CAMERA_LOOK_AT: vec3f = vec3f(0.0, 0.32, 0.0);
const CAMERA_POSITION: vec3f = vec3f(0.0, 0.34, 3.55);

fn rotateY(point: vec3f, angle: f32) -> vec3f {
  let s = sin(angle);
  let c = cos(angle);
  return vec3f(
    point.x * c + point.z * s,
    point.y,
    -point.x * s + point.z * c,
  );
}

fn rotateX(point: vec3f, angle: f32) -> vec3f {
  let s = sin(angle);
  let c = cos(angle);
  return vec3f(
    point.x,
    point.y * c - point.z * s,
    point.y * s + point.z * c,
  );
}

// Map a world sphere direction into the facing frame (face painted on +Z).
fn sphereFacingLocal(worldDirection: vec3f) -> vec3f {
  var local = worldDirection;
  local = rotateY(local, -params.yaw);
  local = rotateX(local, -params.pitch);
  return local;
}

fn cameraBasis() -> mat3x3f {
  let forward = normalize(CAMERA_LOOK_AT - CAMERA_POSITION);
  let right = normalize(cross(forward, vec3f(0.0, 1.0, 0.0)));
  let up = cross(right, forward);
  return mat3x3f(right, up, forward);
}

fn renderScreen(screen: vec2f) -> vec4f {
  let camera = CAMERA_POSITION;
  let basis = cameraBasis();
  let rayDirection = normalize(
    basis[2] + basis[0] * screen.x * 0.42 + basis[1] * screen.y * 0.42,
  );

  let background = backgroundColor(screen, rayDirection);
  let hit = marchScene(camera, rayDirection);
  if (hit.y < 0.0 || hit.x > MAX_DISTANCE) {
    return vec4f(background, 0.0);
  }

  let point = camera + rayDirection * hit.x;
  var color = shadeContact(point, camera, hit.x);

  let fog = 1.0 - exp(-hit.x * hit.x * 0.0018);
  color = mix(color, background, saturate(fog) * 0.35);
  color = color * (1.05 - color * 0.08);
  color = pow(max(color, vec3f(0.0)), vec3f(0.96));

  // Alpha packs "near contact OR near silhouette" for adaptive supersampling.
  let ring = contactRadius();
  let radial = length(point.xz);
  let edge = abs(materialEdge(point));
  let pixelWorld = hit.x * 0.84 / max(params.resolution.y, 1.0);
  let nearContact = saturate(
    1.0 - min(edge / (pixelWorld * 5.0), abs(radial - ring) / 0.12),
  );
  // Analytic silhouette AA (hit side): coverage ramps 0→1 across the last
  // ~2 device px inside the silhouette — standard AA width: kills stair-steps
  // without a visible blur halo. (5px read as soft-focus on retina.)
  // the outermost sphere pixels dissolve into background continuously.
  // SPHERE MATERIAL ONLY — ground hits pass through untouched, else the
  // stage floor around the dome gets mixed to background (embedding lost).
  if (hit.y == 1.0) {
    let b = length(cross(camera, rayDirection));
    let edgeFade = smoothstep(0.0, pixelWorld * 2.0, SPHERE_RADIUS - b);
    if (edgeFade < 1.0) {
      color = mix(background, color, edgeFade);
    }
  }
  return vec4f(color, nearContact);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let safeHeight = max(params.resolution.y, 1.0);
  let aspect = params.resolution.x / safeHeight;
  let screen = vec2f(
    (uv.x * 2.0 - 1.0) * aspect,
    (1.0 - uv.y) * 2.0 - 1.0,
  );

  let center = renderScreen(screen);
  var color = center.rgb;

  // 2×2 AA on the sphere silhouette + contact arc. Silhouette pixels carry
  // partial coverage (0 < a < 1) from the march epsilon; a low threshold
  // catches the grazing-angle fringe where stair-steps show.
  if (center.a > 0.02) {
    let dx = (2.0 * aspect) / max(params.resolution.x, 1.0);
    let dy = 2.0 / safeHeight;
    let o = 0.35;
    color = (
      renderScreen(screen + vec2f(-o * dx, -o * dy)).rgb
      + renderScreen(screen + vec2f(o * dx, -o * dy)).rgb
      + renderScreen(screen + vec2f(-o * dx, o * dy)).rgb
      + renderScreen(screen + vec2f(o * dx, o * dy)).rgb
    ) * 0.25;
  }

  return vec4f(color, 1.0);
}
