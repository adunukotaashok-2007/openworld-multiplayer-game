// ============================================================
//  WORLD BUILDER — Procedural realistic 3D open world
//  Terrain, buildings, roads, trees, water, sky, lighting
//  Uses PBR materials, shadows, LOD for mobile performance
// ============================================================

import * as THREE from 'three';
import { AssetLoader } from '../engine/AssetLoader';

export class WorldBuilder {
  private scene: THREE.Scene;
  private assets: AssetLoader;
  private worldSize = 500;
  private terrainMesh!: THREE.Mesh;
  private waterMesh!: THREE.Mesh;
  private buildings: THREE.Group = new THREE.Group();
  private trunks: THREE.InstancedMesh | null = null;
  private foliage: THREE.InstancedMesh | null = null;
  private sun!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, assets: AssetLoader) {
    this.scene = scene;
    this.assets = assets;
  }

  async build(): Promise<void> {
    this.createLighting();
    this.createSky();
    this.createTerrain();
    this.createWater();
    this.createRoads();
    this.createBuildings();
    this.createTrees();
    this.createProps();
  }

  // ── LIGHTING ──
  private createLighting(): void {
    // Sun (directional with shadows)
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
    this.sun.position.set(80, 100, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -80;
    this.sun.shadow.camera.right = 80;
    this.sun.shadow.camera.top = 80;
    this.sun.shadow.camera.bottom = -80;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 300;
    this.sun.shadow.bias = -0.001;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);

    // Ambient (sky bounce)
    const ambient = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
    this.scene.add(ambient);

    // Fill light
    const fill = new THREE.DirectionalLight(0x8ec8f0, 0.4);
    fill.position.set(-40, 30, -50);
    this.scene.add(fill);
  }

  // ── SKY ──
  private createSky(): void {
    const skyGeo = new THREE.SphereGeometry(450, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0055aa) },
        bottomColor: { value: new THREE.Color(0x88bbdd) },
        offset: { value: 20 },
        exponent: { value: 0.5 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
  }

  // ── TERRAIN ──
  private createTerrain(): void {
    const segments = 128;
    const geo = new THREE.PlaneGeometry(
      this.worldSize, this.worldSize, segments, segments
    );
    geo.rotateX(-Math.PI / 2);

    // Procedural heightmap using layered sine waves (simplex noise in production)
    const vertices = geo.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const z = vertices.getZ(i);
      const height =
        Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4 +
        Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04) * 2 +
        Math.sin(x * 0.1) * Math.sin(z * 0.1) * 0.8;

      // Flatten center area for the city
      const distFromCenter = Math.sqrt(x * x + z * z);
      const flattenFactor = Math.max(0, 1 - distFromCenter / 60);
      vertices.setY(i, height * (1 - flattenFactor));
    }
    geo.computeVertexNormals();

    // PBR terrain material with vertex colors for grass/dirt
    const colors = new Float32Array(vertices.count * 3);
    for (let i = 0; i < vertices.count; i++) {
      const y = vertices.getY(i);
      const grass = new THREE.Color(0x3a7d3a);
      const dirt = new THREE.Color(0x6b5b3a);
      const rock = new THREE.Color(0x7a7a7a);
      const color = y > 3 ? rock : y > 1 ? dirt.lerp(grass, 0.5) : grass;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.scene.add(this.terrainMesh);
  }

  // ── WATER ──
  private createWater(): void {
    const waterGeo = new THREE.PlaneGeometry(this.worldSize, this.worldSize, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a6b8a,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.6,
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.position.y = -1.5;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);
  }

  // ── ROADS ──
  private createRoads(): void {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x333333, roughness: 0.85, metalness: 0.0
    });
    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xcccc44, roughness: 0.7
    });

    // Main roads (grid pattern in city center)
    const roadWidth = 8;
    const roadLength = 120;
    const roadPositions = [-40, -20, 0, 20, 40];

    roadPositions.forEach(pos => {
      // Horizontal road
      const hRoad = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLength, roadWidth), roadMat
      );
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.02, pos);
      hRoad.receiveShadow = true;
      this.scene.add(hRoad);

      // Center line
      const hLine = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLength, 0.2), lineMat
      );
      hLine.rotation.x = -Math.PI / 2;
      hLine.position.set(0, 0.03, pos);
      this.scene.add(hLine);

      // Vertical road
      const vRoad = new THREE.Mesh(
        new THREE.PlaneGeometry(roadWidth, roadLength), roadMat
      );
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(pos, 0.02, 0);
      vRoad.receiveShadow = true;
      this.scene.add(vRoad);
    });

    // Sidewalks
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x999999, roughness: 0.8
    });
    roadPositions.forEach(pos => {
      [-1, 1].forEach(side => {
        const sw = new THREE.Mesh(
          new THREE.BoxGeometry(roadLength, 0.15, 1.5), sidewalkMat
        );
        sw.position.set(0, 0.08, pos + side * (roadWidth / 2 + 0.75));
        sw.receiveShadow = true;
        this.scene.add(sw);
      });
    });
  }

  // ── BUILDINGS ──
  private createBuildings(): void {
    const buildingConfigs = [
      { w: 10, h: 25, d: 10, color: 0x8899aa, x: -30, z: -30 },
      { w: 8, h: 18, d: 12, color: 0x778899, x: -30, z: -10 },
      { w: 12, h: 35, d: 10, color: 0x667788, x: -30, z: 10 },
      { w: 10, h: 15, d: 8, color: 0x99aabb, x: -10, z: -30 },
      { w: 14, h: 40, d: 14, color: 0x556677, x: 10, z: -30 },
      { w: 8, h: 12, d: 10, color: 0xaabbcc, x: 10, z: 10 },
      { w: 10, h: 22, d: 8, color: 0x7788aa, x: 30, z: -10 },
      { w: 12, h: 30, d: 12, color: 0x6688aa, x: 30, z: 10 },
      { w: 6, h: 8, d: 6, color: 0xbbccdd, x: -10, z: 30 },
      { w: 10, h: 20, d: 10, color: 0x8899bb, x: 10, z: 30 },
    ];

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff, emissive: 0x334455,
      emissiveIntensity: 0.3, roughness: 0.1, metalness: 0.8
    });

    buildingConfigs.forEach(cfg => {
      const group = new THREE.Group();

      // Main structure
      const bodyMat = new THREE.MeshStandardMaterial({
        color: cfg.color, roughness: 0.7, metalness: 0.1
      });
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w, cfg.h, cfg.d), bodyMat
      );
      body.position.y = cfg.h / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // Windows (grid pattern on each face)
      const windowRows = Math.floor(cfg.h / 3);
      const windowCols = Math.floor(cfg.w / 2.5);
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const win = new THREE.Mesh(
            new THREE.PlaneGeometry(1.2, 1.6), windowMat
          );
          win.position.set(
            -cfg.w / 2 + 1.5 + col * 2.5,
            2 + row * 3,
            cfg.d / 2 + 0.01
          );
          group.add(win);

          // Back face
          const winBack = win.clone();
          winBack.position.z = -cfg.d / 2 - 0.01;
          winBack.rotation.y = Math.PI;
          group.add(winBack);
        }
      }

      // Roof detail
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.w + 0.5, 0.5, cfg.d + 0.5),
        new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9 })
      );
      roof.position.y = cfg.h + 0.25;
      roof.castShadow = true;
      group.add(roof);

      group.position.set(cfg.x, 0, cfg.z);
      this.buildings.add(group);
    });

    this.scene.add(this.buildings);
  }

  // ── TREES (Instanced for performance) ──
  private createTrees(): void {
    const treeCount = 200;
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 3, 6);
    const foliageGeo = new THREE.SphereGeometry(1.5, 8, 6);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a1e, roughness: 0.9
    });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x2d6b2d, roughness: 0.8
    });

    this.trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    this.foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
    
    this.trunks.castShadow = true;
    this.foliage.castShadow = true;
    this.foliage.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; i < treeCount * 3 && placed < treeCount; i++) {
      const x = (Math.random() - 0.5) * this.worldSize * 0.8;
      const z = (Math.random() - 0.5) * this.worldSize * 0.8;

      // Avoid placing trees inside the downtown city center grid (under 60 radius)
      const distFromCenter = Math.sqrt(x * x + z * z);
      if (distFromCenter < 60) continue;

      // Sample heightmap math to place on terrain surface
      const height =
        Math.sin(x * 0.02) * Math.cos(z * 0.02) * 4 +
        Math.sin(x * 0.05 + 1.3) * Math.cos(z * 0.04) * 2 +
        Math.sin(x * 0.1) * Math.sin(z * 0.1) * 0.8;

      const flattenFactor = Math.max(0, 1 - distFromCenter / 60);
      const y = height * (1 - flattenFactor);

      // Do not plant trees in deep water
      if (y < -0.5) continue;

      const scale = 0.8 + Math.random() * 0.4;

      // Set trunk matrix
      dummy.position.set(x, y + 1.5 * scale, z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      this.trunks.setMatrixAt(placed, dummy.matrix);

      // Set foliage matrix directly above the trunk
      dummy.position.set(x, y + 3.0 * scale, z);
      dummy.updateMatrix();
      this.foliage.setMatrixAt(placed, dummy.matrix);

      placed++;
    }

    this.trunks.instanceMatrix.needsUpdate = true;
    this.foliage.instanceMatrix.needsUpdate = true;

    this.scene.add(this.trunks);
    this.scene.add(this.foliage);
  }

  // ── PROPS ──
  private createProps(): void {
    // Generate realistic detailed props (streetlights, utility boxes, benches)
    const lampPositions = [
      { x: -21, z: -21 }, { x: -21, z: 21 },
      { x: 21, z: -21 }, { x: 21, z: 21 },
      { x: -41, z: -41 }, { x: -41, z: 41 },
      { x: 41, z: -41 }, { x: 41, z: 41 }
    ];

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8);
    const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
    const bulbGeo = new THREE.SphereGeometry(0.18, 8, 8);

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2d3748, metalness: 0.8, roughness: 0.2
    });
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfffaa0
    });

    lampPositions.forEach(pos => {
      const group = new THREE.Group();

      // Pole structure
      const pole = new THREE.Mesh(poleGeo, metalMat);
      pole.position.y = 2.25;
      pole.castShadow = true;
      group.add(pole);

      // Arm outreach
      const arm = new THREE.Mesh(armGeo, metalMat);
      arm.position.set(0.5, 4.4, 0);
      group.add(arm);

      // Glow light bulb
      const bulb = new THREE.Mesh(bulbGeo, glowMat);
      bulb.position.set(1.0, 4.3, 0);
      group.add(bulb);

      // Dynamic streetlight point illumination sources
      const light = new THREE.PointLight(0xfff7c2, 1.5, 15, 1.2);
      light.position.set(1.0, 4.1, 0);
      light.castShadow = true;
      group.add(light);

      group.position.set(pos.x, 0.05, pos.z);
      this.scene.add(group);
    });
  }

  update(delta: number): void {
    // Allows hooks for active world updates (day/night, water updates, cloud drift)
  }
}
