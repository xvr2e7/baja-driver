import * as THREE from "three";

export class LightingManager {
  constructor(scene, options = {}) {
    this.scene = scene;

    // Day/night cycle settings
    this.cycleSpeed = options.cycleSpeed || 0.02;
    this.timeOfDay = options.startTime || 0.25; // 0-1, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0/1 = midnight

    // Sky colors for different times
    this.skyColors = {
      midnight: new THREE.Color(0x0a0a1a),
      dawn: new THREE.Color(0x4a3060),
      sunrise: new THREE.Color(0xffaa77),
      morning: new THREE.Color(0x87ceeb),
      noon: new THREE.Color(0x6bb3d9),
      afternoon: new THREE.Color(0x87ceeb),
      sunset: new THREE.Color(0xff6633),
      dusk: new THREE.Color(0x2a2050),
    };

    // Sun colors for different times
    this.sunColors = {
      midnight: new THREE.Color(0x111122),
      dawn: new THREE.Color(0x665577),
      sunrise: new THREE.Color(0xffaa66),
      morning: new THREE.Color(0xffeedd),
      noon: new THREE.Color(0xffffff),
      afternoon: new THREE.Color(0xfff8e8),
      sunset: new THREE.Color(0xff7744),
      dusk: new THREE.Color(0x443366),
    };

    this._setupLights();
    this._setupFog();
  }

  _setupLights() {
    // Ambient light for base illumination
    this.ambient = new THREE.AmbientLight(0x404060, 0.15);
    this.scene.add(this.ambient);

    // Hemisphere light for sky/ground color bleeding
    this.hemi = new THREE.HemisphereLight(0x87ceeb, 0x554433, 0.4);
    this.scene.add(this.hemi);

    // Main directional light (sun/moon)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sun.position.set(60, 80, 30);
    this.sun.castShadow = true;

    // Enhanced shadow settings for softer shadows
    this.sun.shadow.mapSize.set(4096, 4096); // Higher resolution
    this.sun.shadow.radius = 4; // Soft shadow blur radius
    this.sun.shadow.blurSamples = 16; // More samples for smoother blur

    const shadowSize = 150;
    this.sun.shadow.camera.left = -shadowSize;
    this.sun.shadow.camera.right = shadowSize;
    this.sun.shadow.camera.top = shadowSize;
    this.sun.shadow.camera.bottom = -shadowSize;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 400;
    this.sun.shadow.bias = -0.0005; // Reduce shadow acne
    this.sun.shadow.normalBias = 0.02;

    this.scene.add(this.sun);

    // Secondary fill light (opposite side, no shadows)
    this.fill = new THREE.DirectionalLight(0x8888ff, 0.15);
    this.fill.position.set(-40, 30, -50);
    this.scene.add(this.fill);
  }

  _setupFog() {
    this.fog = new THREE.FogExp2(0x87ceeb, 0.003);
    this.scene.fog = this.fog;
  }

  createCarHeadlights(carMesh) {
    this.headlights = [];

    // negative Z is front because car model is rotated 180
    const leftLight = new THREE.SpotLight(
      0xffffee,
      0,
      50,
      Math.PI / 6,
      0.5,
      1.5
    );
    leftLight.position.set(-0.6, 0.2, -1.8); // Front left of car
    leftLight.castShadow = true;
    leftLight.shadow.mapSize.set(512, 512);
    leftLight.shadow.camera.near = 0.5;
    leftLight.shadow.camera.far = 50;

    const leftTarget = new THREE.Object3D();
    leftTarget.position.set(-0.6, -0.5, -15); // Target in front
    carMesh.add(leftTarget);
    leftLight.target = leftTarget;

    carMesh.add(leftLight);
    this.headlights.push(leftLight);

    // Right headlight
    const rightLight = new THREE.SpotLight(
      0xffffee,
      0,
      50,
      Math.PI / 6,
      0.5,
      1.5
    );
    rightLight.position.set(0.6, 0.2, -1.8); // Front right of car
    rightLight.castShadow = true;
    rightLight.shadow.mapSize.set(512, 512);
    rightLight.shadow.camera.near = 0.5;
    rightLight.shadow.camera.far = 50;

    const rightTarget = new THREE.Object3D();
    rightTarget.position.set(0.6, -0.5, -15); // Target in front
    carMesh.add(rightTarget);
    rightLight.target = rightTarget;

    carMesh.add(rightLight);
    this.headlights.push(rightLight);

    this.taillights = [];

    const leftTail = new THREE.PointLight(0xff2200, 0, 8);
    leftTail.position.set(-0.5, 0.3, 1.5); // Back left
    carMesh.add(leftTail);
    this.taillights.push(leftTail);

    const rightTail = new THREE.PointLight(0xff2200, 0, 8);
    rightTail.position.set(0.5, 0.3, 1.5); // Back right
    carMesh.add(rightTail);
    this.taillights.push(rightTail);
  }

  _lerpColor(color1, color2, t) {
    return color1.clone().lerp(color2, t);
  }

  _getTimePhase() {
    // Returns phase info based on time of day
    const t = this.timeOfDay;

    if (t < 0.2) {
      // Night to dawn (0.0 - 0.2)
      return { from: "midnight", to: "dawn", t: t / 0.2 };
    } else if (t < 0.3) {
      // Dawn to sunrise (0.2 - 0.3)
      return { from: "dawn", to: "sunrise", t: (t - 0.2) / 0.1 };
    } else if (t < 0.4) {
      // Sunrise to morning (0.3 - 0.4)
      return { from: "sunrise", to: "morning", t: (t - 0.3) / 0.1 };
    } else if (t < 0.5) {
      // Morning to noon (0.4 - 0.5)
      return { from: "morning", to: "noon", t: (t - 0.4) / 0.1 };
    } else if (t < 0.6) {
      // Noon to afternoon (0.5 - 0.6)
      return { from: "noon", to: "afternoon", t: (t - 0.5) / 0.1 };
    } else if (t < 0.7) {
      // Afternoon to sunset (0.6 - 0.7)
      return { from: "afternoon", to: "sunset", t: (t - 0.6) / 0.1 };
    } else if (t < 0.8) {
      // Sunset to dusk (0.7 - 0.8)
      return { from: "sunset", to: "dusk", t: (t - 0.7) / 0.1 };
    } else {
      // Dusk to midnight (0.8 - 1.0)
      return { from: "dusk", to: "midnight", t: (t - 0.8) / 0.2 };
    }
  }

  _getSunPosition() {
    // Sun orbits around the scene
    const angle = this.timeOfDay * Math.PI * 2 - Math.PI / 2; // Start at sunrise position
    const height = Math.sin(angle);
    const distance = 100;

    return new THREE.Vector3(
      Math.cos(angle) * distance * 0.5,
      height * distance,
      Math.sin(angle * 0.3) * distance * 0.3
    );
  }

  update(dt) {
    // Advance time
    this.timeOfDay += this.cycleSpeed * dt;
    if (this.timeOfDay >= 1) this.timeOfDay -= 1;

    const phase = this._getTimePhase();
    const smoothT = THREE.MathUtils.smoothstep(phase.t, 0, 1);

    // Interpolate sky color
    const skyColor = this._lerpColor(
      this.skyColors[phase.from],
      this.skyColors[phase.to],
      smoothT
    );
    this.scene.background = skyColor;
    this.fog.color = skyColor;

    // Interpolate sun color and intensity
    const sunColor = this._lerpColor(
      this.sunColors[phase.from],
      this.sunColors[phase.to],
      smoothT
    );
    this.sun.color = sunColor;

    // Sun intensity based on height
    const sunPos = this._getSunPosition();
    this.sun.position.copy(sunPos);

    const sunHeight = Math.max(0, sunPos.y / 100);
    this.sun.intensity = THREE.MathUtils.lerp(0.05, 1.2, sunHeight);

    // Hemisphere light adjustments
    this.hemi.color = skyColor;
    this.hemi.intensity = THREE.MathUtils.lerp(0.1, 0.5, sunHeight);

    // Ambient adjustments for night
    const isNight = sunHeight < 0.2;
    this.ambient.intensity = isNight ? 0.08 : 0.15;
    this.ambient.color = isNight
      ? new THREE.Color(0x1a1a3a)
      : new THREE.Color(0x404060);

    // Fog density - denser at night for atmosphere
    this.fog.density = THREE.MathUtils.lerp(0.005, 0.003, sunHeight);

    // Headlights - turn on at dusk/night
    if (this.headlights) {
      const headlightIntensity =
        sunHeight < 0.3 ? THREE.MathUtils.lerp(80, 0, sunHeight / 0.3) : 0;

      this.headlights.forEach((light) => {
        light.intensity = headlightIntensity;
      });
    }

    // Taillights - always slightly on, brighter at night
    if (this.taillights) {
      const tailIntensity =
        sunHeight < 0.3 ? THREE.MathUtils.lerp(2, 0.3, sunHeight / 0.3) : 0.3;

      this.taillights.forEach((light) => {
        light.intensity = tailIntensity;
      });
    }
  }

  // Manual time control
  setTimeOfDay(time) {
    this.timeOfDay = THREE.MathUtils.clamp(time, 0, 1);
  }

  // Get current time as readable string
  getTimeString() {
    const hours = Math.floor(this.timeOfDay * 24);
    const minutes = Math.floor((this.timeOfDay * 24 - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }
}

// Keep the old function for backwards compatibility if needed
export function setupLighting(scene) {
  const manager = new LightingManager(scene);
  return manager;
}
