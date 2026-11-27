import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AlertTriangle,
  Copy,
  DoorOpen,
  Minus,
  Pencil,
  Plus,
  Rotate3d,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type {
  CollisionEdge,
  DimensionsCm,
  ExtraDetails,
  FurnitureSubPart,
  MaterialPricing,
  PartMaterial,
  SubPartKind,
} from '../types.ts';
import {
  BOARD_THICK_MM,
  calculateSingleSubPartPrice,
  clampMoveWithStrictCollision,
  clampResizeWithStrictCollision,
  formatSubPartDimensionsMm,
  getCabinetEnclosureBounds,
  getMinDimsForPart,
  MIN_PART_MM,
} from '../utils/collisionAndParts.ts';
import { formatSom } from '../utils/furnitureCalculator.ts';
import {
  createFallbackRoomEnvironmentAssets,
  loadRoomEnvironmentAssets,
  type Room3DEnvironmentAssets,
} from '../utils/room3dEnvironment.ts';
import { tgHapticImpact, tgHapticSelection } from '../utils/telegram.ts';

interface Cabinet3DConstructorProps {
  roomImage: string;
  subParts: FurnitureSubPart[];
  onSubPartsChange: (parts: FurnitureSubPart[], recordHistory?: boolean) => void;
  onCommitHistorySnapshot?: (prevParts: FurnitureSubPart[]) => void;
  canUndo?: boolean;
  onUndo?: () => void;
  selectedPartId: string | null;
  onSelectPartId: (id: string | null) => void;
  pricing: MaterialPricing;
  totalPrice: number;
  overallDimensions: DimensionsCm;
  catalogNumber?: number;
  extras: ExtraDetails;
  onAddFreeDetail: (kind: SubPartKind) => void;
  onDuplicatePart: (part: FurnitureSubPart) => void;
  onDeletePart: (partId: string) => void;
  onOpenEditDrawer: () => void;
}

type ResizeHandleKey = 'n' | 's' | 'e' | 'w';

interface DimOverlayAnchor {
  id: string;
  label: string;
  worldPos: THREE.Vector3;
  worldAnchorObj?: THREE.Object3D;
  localOffset?: THREE.Vector3;
  kind: 'overall' | 'part' | 'selected';
}

interface AnimatedDoorRef {
  partId: string;
  pivot: THREE.Group;
  targetAngleSign: number; // -1 for left-hinged, +1 for right-hinged
}

interface AnimatedDrawerRef {
  partId: string;
  group: THREE.Group;
  baseZ: number;
}

const BOARD_THICKNESS_M = 0.018;
const DOOR_OPEN_ANGLE_RAD = (95 * Math.PI) / 180;
const DRAWER_SLIDE_M = 0.25;

const WOOD_TONE_HEXES = new Set([
  '#a67b5b',
  '#6e4a30',
  '#8c5e3c',
  '#a68868',
  '#cbb9a4',
  '#9c8266',
  '#7a5234',
  '#4e3321',
  '#b6895e',
  '#8c6239',
  '#9c724e',
  '#5c3a21',
  '#3a2316',
]);

const ADDABLE_3D_DETAILS: Array<{ kind: SubPartKind; label: string }> = [
  { kind: 'shelf', label: 'Polka' },
  { kind: 'divider', label: "To'siq" },
  { kind: 'drawer', label: 'Tortma' },
  { kind: 'door', label: 'Eshik' },
];

const DIMENSION_EDITOR_MATERIALS: Array<{ value: PartMaterial; label: string }> = [
  { value: 'LDSP', label: 'LDSP 18mm' },
  { value: 'MDF', label: 'MDF 18mm' },
  { value: 'Akril', label: 'AGT Akril' },
  { value: 'DVP/HDF', label: 'DVP 4mm' },
  { value: 'Shisha', label: 'Shisha' },
];

// Pre-allocated reusable math helpers outside render loop
const _projVec = new THREE.Vector3();
const _rayMouse = new THREE.Vector2();
const _planeHit = new THREE.Vector3();
const _tmpWorldPos = new THREE.Vector3();
const _dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const _camDir = new THREE.Vector3();

function classifyEdgeHandle(
  localHit: THREE.Vector3,
  part: FurnitureSubPart,
  w: number,
  h: number,
): ResizeHandleKey | null {
  const halfW = w / 2;
  const halfH = h / 2;
  const isThinHoriz = part.kind === 'shelf' || (part.kind === 'board' && part.heightMm <= 60);
  const isThinVert = part.kind === 'side' || part.kind === 'divider';

  const bandX = Math.min(halfW * 0.44, Math.max(0.045, w * 0.22));
  const bandY = Math.min(halfH * 0.44, Math.max(0.045, h * 0.22));

  const dTop = Math.max(0, halfH - localHit.y);
  const dBot = Math.max(0, localHit.y + halfH);
  const dLeft = Math.max(0, localHit.x + halfW);
  const dRight = Math.max(0, halfW - localHit.x);

  if (isThinHoriz) {
    if (dLeft <= bandX || dRight <= bandX) {
      return dLeft <= dRight ? 'w' : 'e';
    }
    return null;
  }

  if (isThinVert) {
    if (dTop <= bandY || dBot <= bandY) {
      return dTop <= dBot ? 'n' : 's';
    }
    return null;
  }

  const candidates: Array<{ key: ResizeHandleKey; dist: number }> = [];
  if (dTop <= bandY) candidates.push({ key: 'n', dist: dTop });
  if (dBot <= bandY) candidates.push({ key: 's', dist: dBot });
  if (dLeft <= bandX) candidates.push({ key: 'w', dist: dLeft });
  if (dRight <= bandX) candidates.push({ key: 'e', dist: dRight });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates[0].key;
}

function detectSoftwareRendererFromGl(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null,
): boolean {
  if (!gl) return true;
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createWoodGrainTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#c99b6d');
    grad.addColorStop(0.5, '#ba8858');
    grad.addColorStop(1, '#a77445');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(72, 40, 18, 0.16)';
    for (let i = 0; i < 90; i++) {
      const x = (i / 90) * 512 + Math.sin(i * 1.7) * 3;
      ctx.lineWidth = 1 + (i % 3) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 6, 170, x - 6, 340, x + 2, 512);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.max(1, maxAniso);
  return tex;
}

function createTintedWoodGrainTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f3f0eb';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(40, 25, 12, 0.18)';
    for (let i = 0; i < 96; i++) {
      const x = (i / 96) * 512 + Math.sin(i * 1.9) * 3;
      ctx.lineWidth = 1 + (i % 3) * 0.55;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + 5, 170, x - 5, 340, x + 2, 512);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.max(1, maxAniso);
  return tex;
}

function createMdfTexture(maxAniso: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f5f4f2';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(130, 124, 116, 0.045)';
    for (let i = 0; i < 360; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.max(1, maxAniso);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 126);
    grad.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
    grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.16)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const Cabinet3DConstructor: React.FC<Cabinet3DConstructorProps> = ({
  roomImage,
  subParts,
  onSubPartsChange,
  onCommitHistorySnapshot,
  canUndo = false,
  onUndo,
  selectedPartId,
  onSelectPartId,
  pricing,
  totalPrice,
  overallDimensions,
  catalogNumber,
  extras,
  onAddFreeDetail,
  onDuplicatePart,
  onDeletePart,
  onOpenEditDrawer,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const collisionTimerRef = useRef<number | null>(null);

  const [openPartIds, setOpenPartIds] = useState<string[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showPartEditSheet, setShowPartEditSheet] = useState(false);
  const [draftWidthMm, setDraftWidthMm] = useState<string>('');
  const [draftHeightMm, setDraftHeightMm] = useState<string>('');
  const [draftDepthMm, setDraftDepthMm] = useState<string>('');
  const [draftMaterial, setDraftMaterial] = useState<PartMaterial>('LDSP');
  const [webglError, setWebglError] = useState<string | null>(null);
  const [collisionAlert, setCollisionAlert] = useState<{
    partId: string;
    edges: CollisionEdge[];
  } | null>(null);

  const selectedPart = useMemo(
    () => subParts.find((p) => p.id === selectedPartId) ?? null,
    [subParts, selectedPartId],
  );

  useEffect(() => {
    if (!selectedPart) {
      setShowPartEditSheet(false);
      return;
    }
    setDraftWidthMm(String(selectedPart.widthMm));
    setDraftHeightMm(String(selectedPart.heightMm));
    setDraftDepthMm(String(selectedPart.depthMm));
    setDraftMaterial(selectedPart.material);
  }, [selectedPart]);

  const openDimensionEditor = () => {
    if (!selectedPart) return;
    tgHapticImpact('light');
    setDraftWidthMm(String(selectedPart.widthMm));
    setDraftHeightMm(String(selectedPart.heightMm));
    setDraftDepthMm(String(selectedPart.depthMm));
    setDraftMaterial(selectedPart.material);
    setShowPartEditSheet(true);
  };

  const doorDrawerIds = useMemo(
    () => subParts.filter((p) => p.kind === 'door' || p.kind === 'drawer').map((p) => p.id),
    [subParts],
  );

  const toggleSinglePartOpen = (partId: string) => {
    tgHapticImpact('light');
    setOpenPartIds((prev) =>
      prev.includes(partId) ? prev.filter((id) => id !== partId) : [...prev, partId],
    );
  };

  const stateRef = useRef({
    subParts,
    selectedPartId,
    openPartIds,
    extras,
    collisionAlert,
    onSubPartsChange,
    onCommitHistorySnapshot,
    onSelectPartId,
    toggleSinglePartOpen,
  });
  stateRef.current = {
    subParts,
    selectedPartId,
    openPartIds,
    extras,
    collisionAlert,
    onSubPartsChange,
    onCommitHistorySnapshot,
    onSelectPartId,
    toggleSinglePartOpen,
  };

  const sceneApiRef = useRef<{
    rebuildCabinet: () => void;
    syncOpenTargets: () => void;
    updateRoomEnvironment: (url: string) => () => void;
  } | null>(null);

  // Clean up collision timer on unmount & prune deleted openPartIds
  useEffect(() => {
    const validSet = new Set(doorDrawerIds);
    setOpenPartIds((prev) => {
      const next = prev.filter((id) => validSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [doorDrawerIds]);

  useEffect(() => {
    return () => {
      if (collisionTimerRef.current !== null) {
        window.clearTimeout(collisionTimerRef.current);
        collisionTimerRef.current = null;
      }
    };
  }, []);

  const flashCollision = (partId: string, edges: CollisionEdge[], autoClearMs = 0) => {
    if (edges.length === 0) return;
    tgHapticImpact('light', 180);
    setCollisionAlert({ partId, edges });
    if (collisionTimerRef.current !== null) {
      window.clearTimeout(collisionTimerRef.current);
      collisionTimerRef.current = null;
    }
    if (autoClearMs > 0) {
      collisionTimerRef.current = window.setTimeout(() => {
        setCollisionAlert(null);
        collisionTimerRef.current = null;
      }, autoClearMs);
    }
  };

  // Selected-part-only floating dimension + price badge (all part badges hidden by default)
  const selectedPartAnchor = useMemo(() => {
    if (!selectedPart) return null;
    return {
      id: `part-${selectedPart.id}`,
      dimsLabel: formatSubPartDimensionsMm(selectedPart),
      priceLabel: formatSom(calculateSingleSubPartPrice(selectedPart, pricing)),
    };
  }, [selectedPart, pricing]);

  useEffect(() => {
    sceneApiRef.current?.rebuildCabinet();
  }, [subParts, selectedPartId, extras.ledLighting, collisionAlert]);

  useEffect(() => {
    sceneApiRef.current?.syncOpenTargets();
  }, [openPartIds]);

  useEffect(() => {
    if (!sceneApiRef.current) return;
    return sceneApiRef.current.updateRoomEnvironment(roomImage);
  }, [roomImage]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    let envTexture: THREE.Texture | null = null;
    try {
      const initW = Math.max(300, container.clientWidth);
      const initH = Math.max(240, container.clientHeight);
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(initW, initH);
    } catch {
      setWebglError("3D ko'rinish ushbu brauzerda vaqtincha mavjud emas.");
      return;
    }

    const glCtx = renderer.getContext();
    const isSoftwareGl = detectSoftwareRendererFromGl(glCtx);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;

    const initW = Math.max(300, container.clientWidth);
    const initH = Math.max(240, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 40);
    camera.position.set(2.3, 2.05, 3.85);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    let activeRoomAssets: Room3DEnvironmentAssets =
      createFallbackRoomEnvironmentAssets(maxAniso);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    try {
      pmremGenerator.compileEquirectangularShader();
    } catch {
      // Ignore on constrained drivers
    }

    try {
      envTexture = pmremGenerator.fromEquirectangular(activeRoomAssets.panoEnvTex).texture;
      scene.environment = envTexture;
      scene.background = activeRoomAssets.panoEnvTex;
      scene.backgroundBlurriness = 0.08;
    } catch {
      try {
        const roomEnv = new RoomEnvironment();
        envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
        scene.environment = envTexture;
        roomEnv.dispose();
      } catch {
        // Fallback lighting without PMREM environment map
      }
    }

    // 3-Point Room-Adaptive Lighting Rig (matched dynamically to uploaded room photo)
    const hemiLight = new THREE.HemisphereLight(0xfffdf9, 0xd6cfc7, 1.08);
    hemiLight.position.set(0, 5.2, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffaf0, 1.75);
    keyLight.position.set(3.2, 4.9, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 15;
    keyLight.shadow.camera.left = -3.6;
    keyLight.shadow.camera.right = 3.6;
    keyLight.shadow.camera.top = 3.8;
    keyLight.shadow.camera.bottom = -1;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xeef2f6, 0.72);
    rimLight.position.set(-3.6, 2.8, -2.5);
    scene.add(rimLight);

    // 3D / 7D Immersive Room Environment Enclosure (Floor, Back Wall, Side Walls, Front Wall, Ceiling)
    // Uses FrontSide inward normals so orbiting 360° behind a wall cleanly cuts away only that wall
    const ROOM_W = 13.0;
    const ROOM_H = 5.2;
    const ROOM_D = 13.0;

    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    const floorMat = new THREE.MeshStandardMaterial({
      map: activeRoomAssets.floorTex,
      emissiveMap: activeRoomAssets.floorTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.16,
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.45,
      side: THREE.FrontSide,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, 0, ROOM_D / 2 - 0.35);
    floorMesh.receiveShadow = true;
    roomGroup.add(floorMesh);

    const backWallGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_H);
    const backWallMat = new THREE.MeshStandardMaterial({
      map: activeRoomAssets.backWallTex,
      emissiveMap: activeRoomAssets.backWallTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.24,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.32,
      side: THREE.FrontSide,
    });
    const backWallMesh = new THREE.Mesh(backWallGeo, backWallMat);
    backWallMesh.position.set(0, ROOM_H / 2, -0.35);
    backWallMesh.receiveShadow = true;
    roomGroup.add(backWallMesh);

    const sideWallGeo = new THREE.PlaneGeometry(ROOM_D, ROOM_H);
    const sideWallMat = new THREE.MeshStandardMaterial({
      map: activeRoomAssets.sideWallTex,
      emissiveMap: activeRoomAssets.sideWallTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.2,
      roughness: 0.93,
      metalness: 0.0,
      envMapIntensity: 0.3,
      side: THREE.FrontSide,
    });

    const leftWallMesh = new THREE.Mesh(sideWallGeo, sideWallMat);
    leftWallMesh.rotation.y = Math.PI / 2;
    leftWallMesh.position.set(-ROOM_W / 2, ROOM_H / 2, ROOM_D / 2 - 0.35);
    leftWallMesh.receiveShadow = true;
    roomGroup.add(leftWallMesh);

    const rightWallMesh = new THREE.Mesh(sideWallGeo, sideWallMat);
    rightWallMesh.rotation.y = -Math.PI / 2;
    rightWallMesh.position.set(ROOM_W / 2, ROOM_H / 2, ROOM_D / 2 - 0.35);
    rightWallMesh.receiveShadow = true;
    roomGroup.add(rightWallMesh);

    const frontWallMesh = new THREE.Mesh(backWallGeo, sideWallMat);
    frontWallMesh.rotation.y = Math.PI;
    frontWallMesh.position.set(0, ROOM_H / 2, ROOM_D - 0.35);
    roomGroup.add(frontWallMesh);

    const ceilingGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: activeRoomAssets.ceilingTex,
      emissiveMap: activeRoomAssets.ceilingTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.25,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
    const ceilingMesh = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceilingMesh.rotation.x = Math.PI / 2;
    ceilingMesh.position.set(0, ROOM_H, ROOM_D / 2 - 0.35);
    roomGroup.add(ceilingMesh);

    const shadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(1, 1);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.rotation.x = -Math.PI / 2;
    contactShadowMesh.position.y = 0.005;
    scene.add(contactShadowMesh);

    const disposeRoomAssets = (assets: Room3DEnvironmentAssets) => {
      assets.backWallTex.dispose();
      assets.sideWallTex.dispose();
      assets.floorTex.dispose();
      assets.ceilingTex.dispose();
      assets.panoEnvTex.dispose();
    };
    const woodTex = createWoodGrainTexture(maxAniso);
    const tintedWoodTex = createTintedWoodGrainTexture(maxAniso);
    const mdfTex = createMdfTexture(maxAniso);

    const materials: Record<PartMaterial, THREE.Material> & {
      drawerBox: THREE.MeshStandardMaterial;
      countertop: THREE.MeshStandardMaterial;
      metalHandle: THREE.MeshStandardMaterial;
      tvScreen: THREE.MeshPhysicalMaterial;
      tvBezel: THREE.MeshStandardMaterial;
      walnutRib: THREE.MeshStandardMaterial;
      ledStrip: THREE.MeshBasicMaterial;
      handleGrip: THREE.MeshBasicMaterial;
      collisionEdge: THREE.MeshBasicMaterial;
    } = {
      LDSP: new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.72,
        metalness: 0.04,
      }),
      MDF: new THREE.MeshStandardMaterial({
        map: mdfTex,
        color: 0xf4efe6,
        roughness: 0.62,
        metalness: 0.05,
      }),
      Akril: new THREE.MeshPhysicalMaterial({
        color: 0xf8fafc,
        roughness: 0.16,
        metalness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      }),
      Shisha: new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        roughness: 0.12,
        metalness: 0.1,
        transparent: true,
        opacity: isSoftwareGl ? 0.36 : 0.44,
        depthWrite: false,
      }),
      'DVP/HDF': new THREE.MeshStandardMaterial({
        color: 0xd6cfc4,
        roughness: 0.85,
        metalness: 0.02,
      }),
      drawerBox: new THREE.MeshStandardMaterial({
        color: 0xdfd7cc,
        roughness: 0.78,
        metalness: 0.02,
      }),
      countertop: new THREE.MeshStandardMaterial({
        color: 0xf4f6f8,
        roughness: 0.28,
        metalness: 0.04,
      }),
      metalHandle: new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.24,
        metalness: 0.88,
      }),
      tvScreen: new THREE.MeshPhysicalMaterial({
        color: 0x0b111a,
        roughness: 0.08,
        metalness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
      }),
      tvBezel: new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.5,
      }),
      walnutRib: new THREE.MeshStandardMaterial({
        map: tintedWoodTex,
        color: 0x553722,
        roughness: 0.68,
        metalness: 0.03,
      }),
      ledStrip: new THREE.MeshBasicMaterial({
        color: 0xfcd34d,
      }),
      handleGrip: new THREE.MeshBasicMaterial({
        color: 0xd4af37,
      }),
      collisionEdge: new THREE.MeshBasicMaterial({
        color: 0xef4444,
      }),
    };

    const customColorMaterials = new Map<string, THREE.Material>();

    const getCachedPartMaterial = (part: FurnitureSubPart): THREE.Material => {
      if (part.id === 'part-countertop') {
        if (!part.colorHex) return materials.countertop;
        const key = `countertop:${part.colorHex}`;
        const existing = customColorMaterials.get(key);
        if (existing) return existing;
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(part.colorHex),
          roughness: 0.28,
          metalness: 0.04,
        });
        customColorMaterials.set(key, mat);
        return mat;
      }

      if (!part.colorHex) {
        return materials[part.material] ?? materials.LDSP;
      }

      const normHex = part.colorHex.toLowerCase();
      const key = `${part.material}:${normHex}`;
      const existing = customColorMaterials.get(key);
      if (existing) return existing;

      let mat: THREE.Material;
      if (part.material === 'Shisha') {
        mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(part.colorHex),
          roughness: 0.1,
          metalness: 0.12,
          transparent: true,
          opacity: isSoftwareGl ? 0.38 : 0.44,
          depthWrite: false,
        });
      } else if (part.material === 'Akril') {
        mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(part.colorHex),
          roughness: 0.18,
          metalness: 0.05,
          clearcoat: 0.9,
          clearcoatRoughness: 0.1,
        });
      } else if (WOOD_TONE_HEXES.has(normHex)) {
        mat = new THREE.MeshStandardMaterial({
          map: tintedWoodTex,
          color: new THREE.Color(part.colorHex),
          roughness: 0.68,
          metalness: 0.03,
        });
      } else {
        mat = new THREE.MeshStandardMaterial({
          map: mdfTex,
          color: new THREE.Color(part.colorHex),
          roughness: 0.58,
          metalness: 0.04,
        });
      }

      customColorMaterials.set(key, mat);
      return mat;
    };

    const getCachedMetalMaterial = (hex: string): THREE.Material => {
      const norm = hex.toLowerCase();
      const key = `metal:${norm}`;
      const existing = customColorMaterials.get(key);
      if (existing) return existing;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        roughness: 0.28,
        metalness: 0.82,
      });
      customColorMaterials.set(key, mat);
      return mat;
    };

    const cabinetGroup = new THREE.Group();
    scene.add(cabinetGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.4;
    controls.maxDistance = 6.2;
    controls.minPolarAngle = 0.16;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 1.15, 0);
    controls.update();

    let partMeshes: THREE.Mesh[] = [];
    let selectedHitProxies: THREE.Mesh[] = [];
    let dimAnchors: DimOverlayAnchor[] = [];
    let animatedDoors: AnimatedDoorRef[] = [];
    let animatedDrawers: AnimatedDrawerRef[] = [];

    const partOpenProgressMap = new Map<string, number>();
    let lastAnimMs = performance.now();

    let layoutMeta = {
      centerXMm: 2200,
      maxYMm: 2600,
      frontPlaneZ: 0.3,
    };

    let disposableGeos: THREE.BufferGeometry[] = [];
    let disposableMats: THREE.Material[] = [];

    const clearCabinet = () => {
      while (cabinetGroup.children.length > 0) {
        cabinetGroup.remove(cabinetGroup.children[0]);
      }
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableGeos = [];
      disposableMats = [];
      partMeshes = [];
      selectedHitProxies = [];
      dimAnchors = [];
      animatedDoors = [];
      animatedDrawers = [];
    };

    const updateDimensionProjections = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      for (const anchor of dimAnchors) {
        const el = overlayRefs.current.get(anchor.id);
        if (!el) continue;

        if (anchor.worldAnchorObj && anchor.localOffset) {
          _projVec.copy(anchor.localOffset);
          anchor.worldAnchorObj.localToWorld(_projVec);
        } else {
          _projVec.copy(anchor.worldPos);
        }
        _projVec.project(camera);

        if (_projVec.z > 1 || _projVec.z < -1) {
          el.style.opacity = '0';
          continue;
        }
        const sx = ((_projVec.x + 1) / 2) * w;
        const sy = ((-_projVec.y + 1) / 2) * h;

        if (sx < -60 || sx > w + 60 || sy < -50 || sy > h + 50) {
          el.style.opacity = '0';
        } else {
          const padX = Math.min(88, w * 0.25);
          const clampedX = Math.max(padX, Math.min(w - padX, sx));
          const clampedY = Math.max(48, Math.min(h - 82, sy));
          el.style.opacity = '1';
          el.style.transform = `translate3d(${Math.round(clampedX)}px, ${Math.round(clampedY)}px, 0) translate(-50%, -50%)`;
        }
      }
    };

    let rafId = 0;
    let timeoutId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      const sync = gl && gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!gl || !sync) {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      rafId = requestAnimationFrame(() => {
        if (disposed) {
          renderBusy = false;
          return;
        }
        renderDirty = false;

        let animatingParts = false;
        let stillMoving = false;
        try {
          const now = performance.now();
          const delta = Math.min(0.05, Math.max(0.001, (now - lastAnimMs) / 1000));
          lastAnimMs = now;

          const openTargets = new Set(stateRef.current.openPartIds);

          for (const d of animatedDoors) {
            const target = openTargets.has(d.partId) ? 1 : 0;
            const prev = partOpenProgressMap.get(d.partId) ?? 0;
            if (Math.abs(prev - target) > 0.002) {
              animatingParts = true;
              let next = THREE.MathUtils.damp(prev, target, 8, delta);
              if (Math.abs(next - target) <= 0.002) next = target;
              partOpenProgressMap.set(d.partId, next);
              d.pivot.rotation.y = d.targetAngleSign * DOOR_OPEN_ANGLE_RAD * next;
            }
          }

          for (const dr of animatedDrawers) {
            const target = openTargets.has(dr.partId) ? 1 : 0;
            const prev = partOpenProgressMap.get(dr.partId) ?? 0;
            if (Math.abs(prev - target) > 0.002) {
              animatingParts = true;
              let next = THREE.MathUtils.damp(prev, target, 8, delta);
              if (Math.abs(next - target) <= 0.002) next = target;
              partOpenProgressMap.set(dr.partId, next);
              dr.group.position.z = dr.baseZ + DRAWER_SLIDE_M * next;
            }
          }

          stillMoving = controls.update();
          renderer.render(scene, camera);
          updateDimensionProjections();
        } finally {
          const done = () => {
            renderBusy = false;
            if (
              !disposed &&
              (renderDirty || animatingParts || (stillMoving && controls.enableDamping))
            ) {
              requestRender();
            }
          };
          if (isSoftwareGl) afterDraw(done);
          else done();
        }
      });
    }

    const rebuildCabinet = () => {
      clearCabinet();
      const {
        subParts: parts,
        selectedPartId: selId,
        extras: curExtras,
        collisionAlert: colAlert,
        openPartIds: curOpenIds,
      } = stateRef.current;

      if (parts.length === 0) {
        requestRender();
        return;
      }

      const openTargetSet = new Set(curOpenIds);

      const minX = Math.min(...parts.map((p) => p.xMm));
      const maxX = Math.max(...parts.map((p) => p.xMm + p.widthMm));
      const minY = Math.min(...parts.map((p) => p.yMm));
      const maxY = Math.max(...parts.map((p) => p.yMm + p.heightMm));

      const mainCarcassParts = parts.filter(
        (p) =>
          !p.id.startsWith('part-upper-') &&
          !p.id.startsWith('part-oak-niche-') &&
          p.id !== 'part-countertop' &&
          p.id !== 'part-backsplash' &&
          p.id !== 'part-vanity-back-wall' &&
          p.id !== 'part-tv-panel' &&
          p.kind !== 'back' &&
          p.kind !== 'door' &&
          p.kind !== 'drawer',
      );
      const upperCarcassParts = parts.filter(
        (p) =>
          (p.id.startsWith('part-upper-') || p.id.startsWith('part-oak-niche-')) &&
          p.kind !== 'back' &&
          p.kind !== 'door' &&
          p.kind !== 'drawer',
      );

      const maxMainDepthMm = Math.max(
        350,
        ...(mainCarcassParts.length > 0 ? mainCarcassParts : parts).map((p) => p.depthMm),
      );
      const maxUpperDepthMm = Math.max(
        260,
        ...(upperCarcassParts.length > 0 ? upperCarcassParts : [{ depthMm: 360 }]).map(
          (p) => p.depthMm,
        ),
      );

      const centerXMm = (minX + maxX) / 2;
      const totalW = (maxX - minX) / 1000;
      const totalH = (maxY - minY) / 1000;
      const totalD = maxMainDepthMm / 1000;
      const upperD = maxUpperDepthMm / 1000;

      layoutMeta = {
        centerXMm,
        maxYMm: maxY,
        frontPlaneZ: totalD / 2 + 0.02,
      };

      // Anchor 3D room enclosure flush behind the furniture's back plane
      const backWallZ = -totalD / 2 - 0.035;
      backWallMesh.position.z = backWallZ;
      leftWallMesh.position.z = ROOM_D / 2 + backWallZ;
      rightWallMesh.position.z = ROOM_D / 2 + backWallZ;
      frontWallMesh.position.z = ROOM_D + backWallZ;
      floorMesh.position.z = ROOM_D / 2 + backWallZ;
      ceilingMesh.position.z = ROOM_D / 2 + backWallZ;

      contactShadowMesh.scale.set(totalW * 1.38, totalD * 2.05, 1);
      contactShadowMesh.position.set(0, 0.005, 0.04);

      let doorCounter = 0;

      parts.forEach((part) => {
        const isSelected = part.id === selId;
        const isColliding = colAlert?.partId === part.id;

        const w = Math.max(0.016, part.widthMm / 1000);
        const h = Math.max(0.016, part.heightMm / 1000);

        const isDoor = part.kind === 'door';
        const isDrawer = part.kind === 'drawer';
        const isBack = part.kind === 'back';
        const isInterior = part.kind === 'shelf' || part.kind === 'divider';
        const isVerticalWallBoard = part.kind === 'board' && part.heightMm > 60;
        const isKitchenUpper =
          part.id.startsWith('part-upper-') || part.id.startsWith('part-oak-niche-');
        const effectiveCarcassDepth = isKitchenUpper ? upperD : totalD;

        let d = Math.max(0.12, part.depthMm / 1000);
        if (isVerticalWallBoard) {
          d = Math.max(0.016, Math.min(0.06, part.depthMm / 1000));
        } else if (isDoor || isDrawer) {
          d = Math.max(0.004, Math.min(0.12, part.depthMm / 1000));
        } else if (isBack) {
          d = Math.max(0.004, part.depthMm / 1000);
        } else if (isInterior) {
          d = Math.max(
            0.12,
            Math.min(effectiveCarcassDepth - BOARD_THICKNESS_M, part.depthMm / 1000),
          );
        } else if (part.id === 'part-countertop') {
          d = Math.max(0.3, part.depthMm / 1000);
        } else {
          d = Math.max(0.18, Math.min(effectiveCarcassDepth, part.depthMm / 1000));
        }

        const px = (part.xMm + part.widthMm / 2 - centerXMm) / 1000;
        const py = (maxY - (part.yMm + part.heightMm / 2)) / 1000;

        const wallBackZ = -totalD / 2;
        const carcassCenterZ = wallBackZ + effectiveCarcassDepth / 2;

        let baseZ = carcassCenterZ;
        if (isDoor || isDrawer) {
          baseZ = wallBackZ + effectiveCarcassDepth + d / 2 + 0.001;
        } else if (isBack) {
          baseZ = wallBackZ - d / 2;
        } else if (isVerticalWallBoard) {
          baseZ = wallBackZ + d / 2 + 0.002;
        } else if (part.id === 'part-countertop') {
          baseZ = wallBackZ + d / 2;
        } else if (isInterior) {
          baseZ = wallBackZ + d / 2 + 0.004;
        }

        const partGeo = new THREE.BoxGeometry(
          Math.max(0.012, w - 0.0015),
          Math.max(0.012, h - 0.0015),
          d,
        );
        disposableGeos.push(partGeo);

        // Keep original wood/MDF/acrylic/glass texture 100% visible even when selected
        const baseMat = getCachedPartMaterial(part);
        const mesh = new THREE.Mesh(partGeo, baseMat);
        mesh.castShadow = part.material !== 'Shisha';
        mesh.receiveShadow = true;
        mesh.userData = { partId: part.id };
        partMeshes.push(mesh);

        // Translucent champagne-gold glass silhouette tint or colliding red tint
        if (isSelected || isColliding) {
          const tintGeo = new THREE.BoxGeometry(w + 0.003, h + 0.003, d + 0.003);
          const tintMat = new THREE.MeshBasicMaterial({
            color: isColliding ? 0xef4444 : 0xc5a059,
            transparent: true,
            opacity: isColliding ? 0.24 : 0.16,
            depthWrite: false,
          });
          disposableGeos.push(tintGeo);
          disposableMats.push(tintMat);
          const tintMesh = new THREE.Mesh(tintGeo, tintMat);
          tintMesh.raycast = () => {};
          mesh.add(tintMesh);
        }

        // Invisible padded edge-grab hit proxy on selected part ONLY (zero visible handles or lines)
        if (isSelected) {
          const proxyGeo = new THREE.BoxGeometry(w + 0.048, h + 0.048, d + 0.028);
          const proxyMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          disposableGeos.push(proxyGeo);
          disposableMats.push(proxyMat);
          const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
          proxyMesh.userData = { partId: part.id, dims: { w, h } };
          mesh.add(proxyMesh);
          selectedHitProxies.push(proxyMesh);
        }

        // Crisp 1px champagne-gold edge outline (or bright red when colliding)
        const edgeGeo = new THREE.EdgesGeometry(partGeo);
        disposableGeos.push(edgeGeo);
        const edgeMat = new THREE.LineBasicMaterial({
          color: isColliding ? 0xef4444 : isSelected ? 0xc5a059 : 0x64748b,
          transparent: true,
          opacity: isColliding ? 1 : isSelected ? 1 : 0.22,
        });
        disposableMats.push(edgeMat);
        mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

        // Photorealistic Architectural Details matching the Catalog Photos
        if (part.id === 'part-tv-panel') {
          // 1. Vertical 3D Walnut Slats across the wall panel
          const slatCount = Math.max(12, Math.min(28, Math.round(w / 0.065)));
          const slatGeo = new THREE.BoxGeometry(0.018, Math.max(0.1, h - 0.02), 0.014);
          disposableGeos.push(slatGeo);
          for (let s = 0; s < slatCount; s++) {
            const sx = -w / 2 + 0.03 + (s / Math.max(1, slatCount - 1)) * (w - 0.06);
            const slat = new THREE.Mesh(slatGeo, materials.walnutRib);
            slat.position.set(sx, 0, d / 2 + 0.007);
            mesh.add(slat);
          }

          // 2. Centered Flat-Screen OLED TV + Warm Backlight Halo
          const tvW = Math.min(w * 0.62, 1.38);
          const tvH = Math.min(h * 0.62, tvW * 0.56);
          const tvHaloGeo = new THREE.BoxGeometry(tvW + 0.04, tvH + 0.04, 0.006);
          const tvBezelGeo = new THREE.BoxGeometry(tvW + 0.02, tvH + 0.02, 0.022);
          const tvScreenGeo = new THREE.BoxGeometry(tvW, tvH, 0.006);
          disposableGeos.push(tvHaloGeo, tvBezelGeo, tvScreenGeo);

          const haloMesh = new THREE.Mesh(tvHaloGeo, materials.ledStrip);
          haloMesh.position.set(0, h * 0.04, d / 2 + 0.018);
          const bezelMesh = new THREE.Mesh(tvBezelGeo, materials.tvBezel);
          bezelMesh.position.set(0, h * 0.04, d / 2 + 0.032);
          const screenMesh = new THREE.Mesh(tvScreenGeo, materials.tvScreen);
          screenMesh.position.set(0, h * 0.04, d / 2 + 0.044);
          mesh.add(haloMesh, bezelMesh, screenMesh);
        }

        if (part.id === 'part-tv-vitrine-top') {
          // Warm interior vertical LED strip inside the vitrine tower matching the photo
          const vitLedGeo = new THREE.BoxGeometry(0.014, 0.9, 0.014);
          disposableGeos.push(vitLedGeo);
          const vitLed = new THREE.Mesh(vitLedGeo, materials.ledStrip);
          vitLed.position.set(w / 2 - 0.016, -0.5, -d / 2 + 0.03);
          mesh.add(vitLed);
        }

        const initialOpenProgress =
          partOpenProgressMap.get(part.id) ?? (openTargetSet.has(part.id) ? 1 : 0);
        partOpenProgressMap.set(part.id, initialOpenProgress);

        if (isDoor) {
          const isVitrineDoor = part.id === 'part-tv-vitrine';
          const leftHinged = isVitrineDoor ? false : doorCounter % 2 === 0;
          if (!isVitrineDoor) {
            doorCounter++;
          }

          const hingePivot = new THREE.Group();
          hingePivot.position.set(leftHinged ? px - w / 2 : px + w / 2, py, baseZ);
          mesh.position.set(leftHinged ? w / 2 : -w / 2, 0, 0);
          hingePivot.add(mesh);

          // Crisp Aluminum Perimeter Frame around Glass or Shkaf-Kupe Doors
          if (part.frameColorHex) {
            const frameMat = getCachedMetalMaterial(part.frameColorHex);
            const railThick = 0.022;
            const railDepth = d + 0.004;
            const vRailGeo = new THREE.BoxGeometry(railThick, h, railDepth);
            const hRailGeo = new THREE.BoxGeometry(w, railThick, railDepth);
            disposableGeos.push(vRailGeo, hRailGeo);

            const leftRail = new THREE.Mesh(vRailGeo, frameMat);
            leftRail.position.set(-w / 2 + railThick / 2, 0, 0);
            const rightRail = new THREE.Mesh(vRailGeo, frameMat);
            rightRail.position.set(w / 2 - railThick / 2, 0, 0);
            const topRail = new THREE.Mesh(hRailGeo, frameMat);
            topRail.position.set(0, h / 2 - railThick / 2, 0);
            const botRail = new THREE.Mesh(hRailGeo, frameMat);
            botRail.position.set(0, -h / 2 + railThick / 2, 0);
            mesh.add(leftRail, rightRail, topRail, botRail);
          }

          // Door Handle (Color & Position matched to style)
          const handleMat = getCachedMetalMaterial(part.handleColorHex ?? '#334155');
          const isKitchenUpperDoor = part.id.startsWith('part-upper-door-');
          const isTallDoor = h > 1.2;
          const handleH = isKitchenUpperDoor
            ? Math.min(0.14, h * 0.24)
            : isTallDoor
              ? Math.min(0.42, h * 0.22)
              : Math.min(0.22, h * 0.28);
          const handleGeo = new THREE.BoxGeometry(0.012, handleH, 0.02);
          disposableGeos.push(handleGeo);
          const handleMesh = new THREE.Mesh(handleGeo, handleMat);
          const handleX = leftHinged ? w / 2 - 0.036 : -w / 2 + 0.036;
          const handleY = isKitchenUpperDoor ? -h / 2 + handleH / 2 + 0.03 : 0;
          handleMesh.position.set(handleX, handleY, d / 2 + 0.01);
          mesh.add(handleMesh);

          const angleSign = leftHinged ? -1 : 1;
          hingePivot.rotation.y = angleSign * DOOR_OPEN_ANGLE_RAD * initialOpenProgress;
          cabinetGroup.add(hingePivot);
          animatedDoors.push({
            partId: part.id,
            pivot: hingePivot,
            targetAngleSign: angleSign,
          });
        } else if (isDrawer) {
          const drawerGroup = new THREE.Group();
          drawerGroup.position.set(px, py, baseZ + DRAWER_SLIDE_M * initialOpenProgress);
          mesh.position.set(0, 0, 0);
          drawerGroup.add(mesh);

          const handleMat = getCachedMetalMaterial(part.handleColorHex ?? '#334155');
          const handleW = Math.min(0.26, w * 0.36);
          const handleGeo = new THREE.BoxGeometry(handleW, 0.012, 0.02);
          disposableGeos.push(handleGeo);
          const handleMesh = new THREE.Mesh(handleGeo, handleMat);
          handleMesh.position.set(0, h * 0.26, d / 2 + 0.01);
          mesh.add(handleMesh);

          // Inner 3D Drawer Box visible when opened 250 mm
          const boxD = 0.28;
          const boxW = Math.max(0.12, w - 0.04);
          const boxH = Math.max(0.08, h * 0.68);
          const wallT = BOARD_THICKNESS_M;
          const drawerZ = -d / 2 - boxD / 2;

          const sideGeo = new THREE.BoxGeometry(wallT, boxH, boxD);
          const bottomGeo = new THREE.BoxGeometry(boxW, wallT, boxD);
          const backDrawerGeo = new THREE.BoxGeometry(boxW, boxH, wallT);
          disposableGeos.push(sideGeo, bottomGeo, backDrawerGeo);

          const leftSide = new THREE.Mesh(sideGeo, materials.drawerBox);
          leftSide.position.set(-boxW / 2 + wallT / 2, -h * 0.08, drawerZ);
          const rightSide = new THREE.Mesh(sideGeo, materials.drawerBox);
          rightSide.position.set(boxW / 2 - wallT / 2, -h * 0.08, drawerZ);
          const bottomPanel = new THREE.Mesh(bottomGeo, materials.drawerBox);
          bottomPanel.position.set(0, -h * 0.08 - boxH / 2 + wallT / 2, drawerZ);
          const backDrawer = new THREE.Mesh(backDrawerGeo, materials.drawerBox);
          backDrawer.position.set(0, -h * 0.08, -d / 2 - boxD + wallT / 2);

          drawerGroup.add(leftSide, rightSide, bottomPanel, backDrawer);
          cabinetGroup.add(drawerGroup);
          animatedDrawers.push({ partId: part.id, group: drawerGroup, baseZ });
        } else {
          mesh.position.set(px, py, baseZ);
          cabinetGroup.add(mesh);
        }

        if (curExtras.ledLighting && (part.kind === 'shelf' || part.id === 'part-upper-bottom')) {
          const ledGeo = new THREE.BoxGeometry(w * 0.9, 0.008, 0.016);
          disposableGeos.push(ledGeo);
          const ledMesh = new THREE.Mesh(ledGeo, materials.ledStrip);
          ledMesh.position.set(0, -h / 2 - 0.004, 0);
          mesh.add(ledMesh);
        }

        // Dimension projection anchor ONLY for the currently tapped/selected part
        if (isSelected) {
          if (isDoor || isDrawer) {
            const offset = new THREE.Vector3(0, Math.min(0.28, h * 0.34), d / 2 + 0.045);
            dimAnchors.push({
              id: `part-${part.id}`,
              label: formatSubPartDimensionsMm(part),
              worldPos: new THREE.Vector3(px, py + offset.y, baseZ + offset.z),
              worldAnchorObj: mesh,
              localOffset: offset,
              kind: 'selected',
            });
          } else {
            const anchorPos =
              part.kind === 'back'
                ? new THREE.Vector3(px, py + Math.min(0.25, h * 0.2), baseZ - d / 2 - 0.045)
                : part.kind === 'side'
                  ? new THREE.Vector3(
                      px + (px < 0 ? -w / 2 - 0.09 : w / 2 + 0.09),
                      py,
                      baseZ + d * 0.25,
                    )
                  : new THREE.Vector3(
                      px,
                      py + Math.min(0.14, h / 2 + 0.075),
                      baseZ + d / 2 + 0.045,
                    );

            dimAnchors.push({
              id: `part-${part.id}`,
              label: formatSubPartDimensionsMm(part),
              worldPos: anchorPos,
              kind: 'selected',
            });
          }
        }

        // Strict 0 mm collision bright-red (#EF4444) edge highlight in 3D space
        if (isColliding && colAlert) {
          for (const edge of colAlert.edges) {
            if (edge === 'front' || edge === 'back') {
              const barGeo = new THREE.BoxGeometry(w + 0.012, h + 0.012, 0.018);
              disposableGeos.push(barGeo);
              const barMesh = new THREE.Mesh(barGeo, materials.collisionEdge);
              barMesh.position.set(0, 0, edge === 'front' ? d / 2 : -d / 2);
              mesh.add(barMesh);
            } else {
              const isHoriz = edge === 'top' || edge === 'bottom';
              const barGeo = new THREE.BoxGeometry(
                isHoriz ? w + 0.012 : 0.018,
                isHoriz ? 0.018 : h + 0.012,
                d + 0.016,
              );
              disposableGeos.push(barGeo);
              const barMesh = new THREE.Mesh(barGeo, materials.collisionEdge);
              barMesh.position.set(
                edge === 'left' ? -w / 2 : edge === 'right' ? w / 2 : 0,
                edge === 'top' ? h / 2 : edge === 'bottom' ? -h / 2 : 0,
                0,
              );
              mesh.add(barMesh);
            }
          }
        }
      });

      if (!isSoftwareGl) {
        controls.target.set(0, totalH * 0.48, 0);
      }
      requestRender();
    };

    const syncOpenTargets = () => {
      lastAnimMs = performance.now();
      requestRender();
    };

    const updateRoomEnvironment = (url: string) => {
      return loadRoomEnvironmentAssets(url, maxAniso, (nextAssets) => {
        if (disposed) {
          disposeRoomAssets(nextAssets);
          return;
        }
        const prevAssets = activeRoomAssets;
        activeRoomAssets = nextAssets;

        floorMat.map = nextAssets.floorTex;
        floorMat.emissiveMap = nextAssets.floorTex;
        floorMat.needsUpdate = true;

        backWallMat.map = nextAssets.backWallTex;
        backWallMat.emissiveMap = nextAssets.backWallTex;
        backWallMat.needsUpdate = true;

        sideWallMat.map = nextAssets.sideWallTex;
        sideWallMat.emissiveMap = nextAssets.sideWallTex;
        sideWallMat.needsUpdate = true;

        ceilingMat.map = nextAssets.ceilingTex;
        ceilingMat.emissiveMap = nextAssets.ceilingTex;
        ceilingMat.needsUpdate = true;

        scene.background = nextAssets.panoEnvTex;
        scene.backgroundBlurriness = 0.08;

        try {
          const nextEnv = pmremGenerator.fromEquirectangular(nextAssets.panoEnvTex).texture;
          const oldEnv = envTexture;
          envTexture = nextEnv;
          scene.environment = nextEnv;
          oldEnv?.dispose();
        } catch {
          // Keep existing environment map on constrained drivers
        }

        // Adapt scene lights & shadows smoothly to the uploaded room photo's ambient tones
        const { topColor, midColor, floorColor, avgLuminance } = nextAssets.lighting;
        hemiLight.color.setHex(0xffffff).lerp(topColor, 0.45);
        hemiLight.groundColor.setHex(0xd6cfc7).lerp(floorColor, 0.65);
        hemiLight.intensity = 0.95 + (1 - avgLuminance) * 0.25;

        keyLight.color.setHex(0xfffaf0).lerp(topColor, 0.22);
        keyLight.intensity = 1.55 + avgLuminance * 0.42;

        rimLight.color.setHex(0xffffff).lerp(midColor, 0.55);
        rimLight.intensity = 0.62 + avgLuminance * 0.25;

        contactShadowMat.opacity = 0.58 + avgLuminance * 0.2;

        disposeRoomAssets(prevAssets);
        requestRender();
      });
    };

    // Raycasted 3D Direct Edge-Drag Resizing, Center Dragging & Direct Door/Drawer Tap
    const raycaster = new THREE.Raycaster();
    let activeInteraction:
      | {
          mode: 'move-part';
          partId: string;
          startWorld: THREE.Vector3;
          initialPart: FurnitureSubPart;
          initialParts: FurnitureSubPart[];
          changed: boolean;
        }
      | {
          mode: 'resize-part';
          partId: string;
          handle: ResizeHandleKey;
          startWorld: THREE.Vector3;
          initialPart: FurnitureSubPart;
          initialParts: FurnitureSubPart[];
          changed: boolean;
        }
      | null = null;
    let pointerDownClient = { x: 0, y: 0, moved: false };
    let lastTapInfo: { partId: string; timeMs: number } | null = null;

    const getCanvasNdcFromCoords = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      _rayMouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _rayMouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const setCameraAwareDragPlane = (worldPoint: THREE.Vector3) => {
      camera.getWorldDirection(_camDir);
      const nx = Math.abs(_camDir.x) > Math.abs(_camDir.z) ? Math.sign(_camDir.x) : 0;
      const nz = nx === 0 ? Math.sign(_camDir.z) || 1 : 0;
      _dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(nx, 0, nz), worldPoint);
    };

    const applyMoveOrResizeStep = (clientX: number, clientY: number) => {
      if (!activeInteraction) return;
      getCanvasNdcFromCoords(clientX, clientY);
      raycaster.setFromCamera(_rayMouse, camera);
      if (!raycaster.ray.intersectPlane(_dragPlane, _planeHit)) return;

      const dxMm = Math.round((_planeHit.x - activeInteraction.startWorld.x) * 1000);
      const dyMm = Math.round((activeInteraction.startWorld.y - _planeHit.y) * 1000);

      const curParts = stateRef.current.subParts;
      const current = curParts.find((p) => p.id === activeInteraction?.partId);
      if (!current) return;

      if (activeInteraction.mode === 'move-part') {
        const targetX = activeInteraction.initialPart.xMm + dxMm;
        const targetY = activeInteraction.initialPart.yMm + dyMm;

        const clamped = clampMoveWithStrictCollision(current, targetX, targetY, curParts);

        if (clamped.hitEdges.length > 0) {
          tgHapticImpact('light', 180);
        }

        setCollisionAlert(
          clamped.hitEdges.length > 0
            ? { partId: current.id, edges: clamped.hitEdges }
            : null,
        );

        if (clamped.xMm !== current.xMm || clamped.yMm !== current.yMm) {
          activeInteraction.changed = true;
          stateRef.current.onSubPartsChange(
            curParts.map((p) =>
              p.id === current.id ? { ...p, xMm: clamped.xMm, yMm: clamped.yMm } : p,
            ),
            false,
          );
        }
        return;
      }

      if (activeInteraction.mode === 'resize-part') {
        const init = activeInteraction.initialPart;
        const hKey = activeInteraction.handle;

        let nextX = init.xMm;
        let nextY = init.yMm;
        let nextW = init.widthMm;
        let nextH = init.heightMm;

        if (hKey === 'e') {
          nextW = Math.max(MIN_PART_MM, init.widthMm + dxMm);
        } else if (hKey === 'w') {
          const cDx = Math.min(dxMm, init.widthMm - MIN_PART_MM);
          nextX = init.xMm + cDx;
          nextW = init.widthMm - cDx;
        } else if (hKey === 's') {
          nextH = Math.max(MIN_PART_MM, init.heightMm + dyMm);
        } else if (hKey === 'n') {
          const cDy = Math.min(dyMm, init.heightMm - MIN_PART_MM);
          nextY = init.yMm + cDy;
          nextH = init.heightMm - cDy;
        }

        const clamped = clampResizeWithStrictCollision(
          current,
          { xMm: nextX, yMm: nextY, widthMm: nextW, heightMm: nextH },
          curParts,
        );

        if (clamped.hitEdges.length > 0) {
          tgHapticImpact('light', 180);
        }

        setCollisionAlert(
          clamped.hitEdges.length > 0
            ? { partId: current.id, edges: clamped.hitEdges }
            : null,
        );

        if (
          clamped.xMm !== current.xMm ||
          clamped.yMm !== current.yMm ||
          clamped.widthMm !== current.widthMm ||
          clamped.heightMm !== current.heightMm
        ) {
          activeInteraction.changed = true;
          stateRef.current.onSubPartsChange(
            curParts.map((p) =>
              p.id === current.id
                ? {
                    ...p,
                    xMm: clamped.xMm,
                    yMm: clamped.yMm,
                    widthMm: clamped.widthMm,
                    heightMm: clamped.heightMm,
                  }
                : p,
            ),
            false,
          );
        }
      }
    };

    const finishActiveInteraction = () => {
      if (!activeInteraction) return;
      if (activeInteraction.changed) {
        stateRef.current.onCommitHistorySnapshot?.(activeInteraction.initialParts);
      }
      activeInteraction = null;
      controls.enabled = true;
      setCollisionAlert(null);
    };

    sceneApiRef.current = {
      rebuildCabinet,
      syncOpenTargets,
      updateRoomEnvironment,
    };
    const cancelInitialRoomLoad = updateRoomEnvironment(roomImage);
    rebuildCabinet();
    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Ignore shader pre-compile hiccups on constrained drivers
      }
    }

    const beginSelectedMeshInteraction = (
      part: FurnitureSubPart,
      hitMesh: THREE.Object3D,
      hitPoint: THREE.Vector3,
      e: PointerEvent,
    ) => {
      const localHit = hitMesh.worldToLocal(hitPoint.clone());
      const w = Math.max(0.016, part.widthMm / 1000);
      const h = Math.max(0.016, part.heightMm / 1000);
      const edgeHandle = classifyEdgeHandle(localHit, part, w, h);

      hitMesh.getWorldPosition(_tmpWorldPos);
      setCameraAwareDragPlane(_tmpWorldPos);
      if (!raycaster.ray.intersectPlane(_dragPlane, _planeHit)) return false;

      controls.enabled = false;
      e.stopImmediatePropagation();

      if (edgeHandle) {
        activeInteraction = {
          mode: 'resize-part',
          partId: part.id,
          handle: edgeHandle,
          startWorld: _planeHit.clone(),
          initialPart: { ...part },
          initialParts: stateRef.current.subParts.map((p) => ({ ...p })),
          changed: false,
        };
      } else {
        activeInteraction = {
          mode: 'move-part',
          partId: part.id,
          startWorld: _planeHit.clone(),
          initialPart: { ...part },
          initialParts: stateRef.current.subParts.map((p) => ({ ...p })),
          changed: false,
        };
      }

      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return true;
    };

    // CAPTURE-PHASE pointerdown runs BEFORE OrbitControls so camera orbit locks immediately when touching a selected part or its edges
    const onPointerDown = (e: PointerEvent) => {
      pointerDownClient = { x: e.clientX, y: e.clientY, moved: false };
      getCanvasNdcFromCoords(e.clientX, e.clientY);
      raycaster.setFromCamera(_rayMouse, camera);

      const partHits = raycaster.intersectObjects(partMeshes, false);
      if (partHits.length > 0) {
        const hitMesh = partHits[0].object;
        const partId = hitMesh.userData.partId as string;
        if (partId === stateRef.current.selectedPartId) {
          const part = stateRef.current.subParts.find((p) => p.id === partId);
          if (part && beginSelectedMeshInteraction(part, hitMesh, partHits[0].point, e)) {
            return;
          }
        }
        return;
      }

      // Catch outer-edge finger drags right along the 1px gold border via invisible padded hit proxy
      if (selectedHitProxies.length > 0) {
        const proxyHits = raycaster.intersectObjects(selectedHitProxies, false);
        if (proxyHits.length > 0) {
          const proxyMesh = proxyHits[0].object;
          const partId = proxyMesh.userData.partId as string;
          const part = stateRef.current.subParts.find((p) => p.id === partId);
          if (part && beginSelectedMeshInteraction(part, proxyMesh, proxyHits[0].point, e)) {
            return;
          }
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - pointerDownClient.x, e.clientY - pointerDownClient.y) > 5) {
        pointerDownClient.moved = true;
      }

      if (activeInteraction) {
        applyMoveOrResizeStep(e.clientX, e.clientY);
        return;
      }

      if (e.pointerType === 'mouse' && stateRef.current.selectedPartId) {
        getCanvasNdcFromCoords(e.clientX, e.clientY);
        raycaster.setFromCamera(_rayMouse, camera);
        const hits = raycaster.intersectObjects(partMeshes, false);
        if (hits.length > 0 && hits[0].object.userData.partId === stateRef.current.selectedPartId) {
          const part = stateRef.current.subParts.find(
            (p) => p.id === stateRef.current.selectedPartId,
          );
          if (part) {
            const localHit = hits[0].object.worldToLocal(hits[0].point.clone());
            const edge = classifyEdgeHandle(
              localHit,
              part,
              Math.max(0.016, part.widthMm / 1000),
              Math.max(0.016, part.heightMm / 1000),
            );
            renderer.domElement.style.cursor =
              edge === 'n' || edge === 's'
                ? 'ns-resize'
                : edge === 'e' || edge === 'w'
                  ? 'ew-resize'
                  : 'grab';
            return;
          }
        }
        renderer.domElement.style.cursor = 'default';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (activeInteraction) {
        const didMove = pointerDownClient.moved;
        const interactedPartId = activeInteraction.partId;
        finishActiveInteraction();

        // Direct tap on an already-selected door/drawer smoothly opens or closes it
        if (!didMove) {
          const hitPart = stateRef.current.subParts.find((p) => p.id === interactedPartId);
          if (hitPart && (hitPart.kind === 'door' || hitPart.kind === 'drawer')) {
            stateRef.current.toggleSinglePartOpen(interactedPartId);
            lastTapInfo = null;
          }
        }
        return;
      }

      controls.enabled = true;

      if (!pointerDownClient.moved) {
        getCanvasNdcFromCoords(e.clientX, e.clientY);
        raycaster.setFromCamera(_rayMouse, camera);
        const hits = raycaster.intersectObjects(partMeshes, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.partId as string;
          const nowMs = performance.now();
          const hitPart = stateRef.current.subParts.find((p) => p.id === hitId);

          if (
            hitPart &&
            (hitPart.kind === 'door' || hitPart.kind === 'drawer') &&
            lastTapInfo &&
            lastTapInfo.partId === hitId &&
            nowMs - lastTapInfo.timeMs < 450
          ) {
            stateRef.current.toggleSinglePartOpen(hitId);
            lastTapInfo = null;
          } else {
            tgHapticSelection();
            lastTapInfo = { partId: hitId, timeMs: nowMs };
          }

          stateRef.current.onSelectPartId(hitId);
        } else {
          lastTapInfo = null;
          stateRef.current.onSelectPartId(null);
        }
      }
    };

    const onWindowPointerRelease = () => {
      if (activeInteraction) {
        finishActiveInteraction();
      } else {
        controls.enabled = true;
      }
    };

    const onContextLost = (e: Event) => {
      e.preventDefault();
    };

    controls.addEventListener('change', requestRender);
    renderer.domElement.addEventListener('pointerdown', onPointerDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('pointerup', onWindowPointerRelease);
    window.addEventListener('pointercancel', onWindowPointerRelease);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const resizeObserver = new ResizeObserver(() => {
      const rw = Math.max(200, container.clientWidth);
      const rh = Math.max(200, container.clientHeight);
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
      requestRender();
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      cancelInitialRoomLoad();
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      resizeObserver.disconnect();
      controls.removeEventListener('change', requestRender);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown, { capture: true });
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('pointerup', onWindowPointerRelease);
      window.removeEventListener('pointercancel', onWindowPointerRelease);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      clearCabinet();
      floorGeo.dispose();
      floorMat.dispose();
      backWallGeo.dispose();
      backWallMat.dispose();
      sideWallGeo.dispose();
      sideWallMat.dispose();
      ceilingGeo.dispose();
      ceilingMat.dispose();
      contactShadowGeo.dispose();
      contactShadowMat.dispose();
      shadowTex.dispose();
      disposeRoomAssets(activeRoomAssets);
      pmremGenerator.dispose();
      woodTex.dispose();
      tintedWoodTex.dispose();
      mdfTex.dispose();
      Object.values(materials).forEach((m) => m.dispose());
      customColorMaterials.forEach((m) => m.dispose());
      customColorMaterials.clear();
      envTexture?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const stepDraftInput = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    fallback: number,
    delta: number,
    minVal = 4,
  ) => {
    tgHapticImpact('light');
    setter((prev) => {
      const parsed = Number(prev);
      const base = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
      return String(Math.max(minVal, Math.round(base + delta)));
    });
  };

  const handleApplyDimensionEditor = () => {
    if (!selectedPart) return;
    tgHapticImpact('light');

    const { minW, minH } = getMinDimsForPart(selectedPart);
    const parsedW = Number(draftWidthMm);
    const parsedH = Number(draftHeightMm);
    const parsedD = Number(draftDepthMm);

    const targetW = Math.max(
      minW,
      Number.isFinite(parsedW) && parsedW > 0 ? Math.round(parsedW) : selectedPart.widthMm,
    );
    const targetH = Math.max(
      minH,
      Number.isFinite(parsedH) && parsedH > 0 ? Math.round(parsedH) : selectedPart.heightMm,
    );

    let nextD = Number.isFinite(parsedD) && parsedD > 0 ? Math.round(parsedD) : selectedPart.depthMm;
    if (selectedPart.kind === 'back') {
      nextD = Math.max(3, Math.min(24, nextD));
    } else if (
      selectedPart.kind === 'door' ||
      selectedPart.kind === 'drawer' ||
      (selectedPart.kind === 'board' && selectedPart.heightMm > 60)
    ) {
      nextD = Math.max(4, Math.min(80, nextD));
    } else if (selectedPart.kind === 'shelf' || selectedPart.kind === 'divider') {
      const enclosure = getCabinetEnclosureBounds(subParts, selectedPart);
      const maxAllowedD = Math.max(180, enclosure.maxDepthMm - BOARD_THICK_MM);
      if (nextD > maxAllowedD || nextD < 150) {
        flashCollision(selectedPart.id, [nextD > maxAllowedD ? 'front' : 'back'], 550);
      }
      nextD = Math.max(150, Math.min(maxAllowedD, nextD));
    } else {
      nextD = Math.max(18, Math.min(1000, nextD));
    }

    const clamped = clampResizeWithStrictCollision(
      selectedPart,
      {
        xMm: selectedPart.xMm,
        yMm: selectedPart.yMm,
        widthMm: targetW,
        heightMm: targetH,
      },
      subParts,
    );

    if (clamped.hitEdges.length > 0) {
      flashCollision(selectedPart.id, clamped.hitEdges, 650);
    }

    const materialChanged = draftMaterial !== selectedPart.material;

    onSubPartsChange(
      subParts.map((p) =>
        p.id === selectedPart.id
          ? {
              ...p,
              xMm: clamped.xMm,
              yMm: clamped.yMm,
              widthMm: clamped.widthMm,
              heightMm: clamped.heightMm,
              depthMm: nextD,
              material: draftMaterial,
              ...(materialChanged ? { colorHex: undefined } : {}),
            }
          : p,
      ),
      true,
    );

    setDraftWidthMm(String(clamped.widthMm));
    setDraftHeightMm(String(clamped.heightMm));
    setDraftDepthMm(String(nextD));
    setShowPartEditSheet(false);
  };

  const editorPreviewPrice = useMemo(() => {
    if (!selectedPart) return 0;
    const w = Number(draftWidthMm);
    const h = Number(draftHeightMm);
    const d = Number(draftDepthMm);
    return calculateSingleSubPartPrice(
      {
        ...selectedPart,
        widthMm: Number.isFinite(w) && w > 0 ? w : selectedPart.widthMm,
        heightMm: Number.isFinite(h) && h > 0 ? h : selectedPart.heightMm,
        depthMm: Number.isFinite(d) && d > 0 ? d : selectedPart.depthMm,
        material: draftMaterial,
      },
      pricing,
    );
  }, [selectedPart, draftWidthMm, draftHeightMm, draftDepthMm, draftMaterial, pricing]);

  const isSelectedDoorOrDrawer =
    selectedPart !== null && (selectedPart.kind === 'door' || selectedPart.kind === 'drawer');
  const isSelectedOpen = selectedPart ? openPartIds.includes(selectedPart.id) : false;

  return (
    <div className="relative w-full h-full min-h-[410px] bg-gradient-to-b from-[#FAF8F5] via-[#F6F2EA] to-[#EFEAE0] select-none overflow-hidden">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" style={{ touchAction: 'none' }} />

      {webglError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#FAF8F5] p-6 text-center">
          <p className="text-xs font-semibold text-[#1A2421]">{webglError}</p>
        </div>
      )}

      {/* Projected 3D Millimeter Dimension & Price Badge ONLY for Selected Part (Tap badge to edit mm) */}
      {selectedPartAnchor && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          <div
            key={selectedPartAnchor.id}
            ref={(el) => {
              if (el) overlayRefs.current.set(selectedPartAnchor.id, el);
              else overlayRefs.current.delete(selectedPartAnchor.id);
            }}
            style={{ opacity: 0, left: 0, top: 0 }}
            className="absolute"
          >
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                openDimensionEditor();
              }}
              title="Aniq mm o'lchamini tahrirlash"
              className="pointer-events-auto cursor-pointer font-mono-num leading-tight whitespace-nowrap rounded-xl px-2.5 py-1.5 bg-[#FFFCF5]/95 hover:bg-white text-[#1A2421] shadow-lg border border-[#C5A059] transition-transform duration-75 active:scale-95 flex flex-col items-center gap-0.5"
            >
              <span className="text-[11px] font-bold text-[#0E3A2F] flex items-center gap-1">
                <span>{selectedPartAnchor.dimsLabel}</span>
                <Pencil className="w-2.5 h-2.5 text-[#C5A059]" />
              </span>
              <span className="text-[10px] font-semibold text-[#6B7A74]">
                {selectedPartAnchor.priceLabel}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Top-Center Collision Warning Pill ("To'qnashuv! Chegara") */}
      {collisionAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-[#EF4444]/95 border border-[#FCA5A5] text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap pointer-events-none">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>To&apos;qnashuv! Chegara</span>
        </div>
      )}

      {/* Top Overall Dimension & Price Pill + Real "Bekor qilish" (Undo) Button */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between gap-1.5">
        <div className="px-2 py-1 rounded-full bg-white/95 border border-[#C5A059]/60 shadow-sm text-[11px] font-mono-num font-bold text-[#1A2421] flex items-center gap-1.5 min-w-0">
          {catalogNumber && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#0E3A2F] text-[#C5A059] border border-[#C5A059] text-[10px] font-bold leading-none shrink-0">
              №{catalogNumber}
            </span>
          )}
          <span className="truncate">
            {overallDimensions.widthCm * 10} × {overallDimensions.heightCm * 10} ×{' '}
            {overallDimensions.depthCm * 10} mm ·{' '}
            <span className="text-[#0E3A2F]">{formatSom(totalPrice)}</span>
          </span>
        </div>

        <button
          type="button"
          disabled={!canUndo}
          onClick={() => {
            onUndo?.();
          }}
          title="Oxirgi harakatni bekor qilish"
          aria-label="Bekor qilish"
          className="h-8 px-2.5 rounded-full bg-white/95 hover:bg-[#FAF8F5] disabled:opacity-45 disabled:cursor-not-allowed border border-[#C5A059]/60 shadow-sm flex items-center gap-1 text-[11px] font-semibold text-[#0E3A2F] transition-colors shrink-0"
        >
          <Undo2 className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
          <span>Bekor qilish</span>
        </button>
      </div>

      {/* Left Vertical Floating Warm-Ivory CAD Action Buttons */}
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        <button
          type="button"
          title="Tahrirlash / Aniq mm o'lcham"
          onClick={() => {
            if (selectedPart) {
              if (showPartEditSheet) {
                setShowPartEditSheet(false);
              } else {
                openDimensionEditor();
              }
            } else {
              onOpenEditDrawer();
            }
          }}
          className={`w-10 h-10 rounded-xl border shadow-sm flex items-center justify-center transition-colors ${
            showPartEditSheet
              ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
              : 'bg-white/95 hover:bg-[#FAF8F5] text-[#0E3A2F] border-[#C5A059]/55'
          }`}
        >
          <Pencil className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="Nusxa olish"
          disabled={!selectedPart || selectedPart.kind === 'side' || selectedPart.kind === 'back'}
          onClick={() => selectedPart && onDuplicatePart(selectedPart)}
          className="w-10 h-10 rounded-xl bg-white/95 hover:bg-[#FAF8F5] disabled:opacity-40 border border-[#C5A059]/55 shadow-sm flex items-center justify-center text-[#0E3A2F]"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          type="button"
          title="O'chirish"
          disabled={
            !selectedPart ||
            subParts.length <= 1 ||
            selectedPart.kind === 'side' ||
            selectedPart.kind === 'back'
          }
          onClick={() => selectedPart && onDeletePart(selectedPart.id)}
          className="w-10 h-10 rounded-xl bg-white/95 hover:bg-rose-50 disabled:opacity-40 border border-[#C5A059]/55 shadow-sm flex items-center justify-center text-rose-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Right '+' Button & Free-Add Detail Menu */}
      <div className="absolute right-2.5 bottom-3 z-20 flex flex-col items-end gap-2">
        {showAddMenu && (
          <div className="bg-white/95 border border-[#C5A059]/60 rounded-2xl shadow-xl p-2 flex flex-col gap-1 min-w-[152px]">
            <div className="flex items-center justify-between px-2 py-1 border-b border-[#C5A059]/25">
              <span className="text-[11px] font-bold text-[#0E3A2F]">Detal qo&apos;shish</span>
              <button
                type="button"
                onClick={() => setShowAddMenu(false)}
                className="text-[#6B7A74] hover:text-[#1A2421]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {ADDABLE_3D_DETAILS.map((item) => (
              <button
                key={item.kind}
                type="button"
                onClick={() => {
                  tgHapticImpact('light');
                  onAddFreeDetail(item.kind);
                  setShowAddMenu(false);
                }}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl hover:bg-[#FAF8F5] text-left text-xs font-semibold text-[#1A2421] flex items-center justify-between"
              >
                <span>{item.label}</span>
                <Plus className="w-3.5 h-3.5 text-[#C5A059]" />
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          aria-label="Yangi detal qo'shish"
          onClick={() => {
            tgHapticImpact('light');
            setShowAddMenu((v) => !v);
          }}
          className="w-11 h-11 rounded-2xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white shadow-lg border border-[#C5A059] flex items-center justify-center transition-transform active:scale-95"
        >
          <Plus className={`w-5 h-5 text-[#C5A059] transition-transform ${showAddMenu ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* Exact Millimeter Dimension Editor Ivory-and-Gold Popover Card above Bottom Panel */}
      {selectedPart && showPartEditSheet && (
        <div
          onPointerDownCapture={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-[74px] left-1/2 -translate-x-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[392px] max-h-[calc(100%-92px)] overflow-y-auto bg-[#FFFCF5] text-[#0F172A] rounded-2xl border border-[#C5A059] shadow-2xl p-3.5 select-text"
        >
          <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#E7DEC8]">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-[#0E3A2F]">
                Detal o&apos;lchamini o&apos;zgartirish
              </h4>
              <p className="text-[11px] text-slate-600 truncate">{selectedPart.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowPartEditSheet(false)}
              aria-label="Yopish"
              className="w-7 h-7 rounded-lg hover:bg-[#F3ECE0] flex items-center justify-center text-slate-500 hover:text-[#0F172A] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 3 Exact Millimeter Inputs with -/+ 10mm Steppers */}
          <div className="mt-2.5 space-y-2">
            {(
              [
                {
                  key: 'width',
                  label: 'Eni (Width, mm)',
                  value: draftWidthMm,
                  setter: setDraftWidthMm,
                  fallback: selectedPart.widthMm,
                  minVal: getMinDimsForPart(selectedPart).minW,
                },
                {
                  key: 'height',
                  label: "Bo'yi (Height, mm)",
                  value: draftHeightMm,
                  setter: setDraftHeightMm,
                  fallback: selectedPart.heightMm,
                  minVal: getMinDimsForPart(selectedPart).minH,
                },
                {
                  key: 'depth',
                  label: 'Qalinligi / Chuqurligi (mm)',
                  value: draftDepthMm,
                  setter: setDraftDepthMm,
                  fallback: selectedPart.depthMm,
                  minVal: selectedPart.kind === 'back' ? 3 : 4,
                },
              ] as const
            ).map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-xl bg-white border border-[#E7DEC8] px-2.5 py-1.5"
              >
                <span className="text-[11px] font-semibold text-[#0F172A] truncate">
                  {row.label}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label={`${row.label} -10mm`}
                    onClick={() => stepDraftInput(row.setter, row.fallback, -10, row.minVal)}
                    className="w-8 h-8 rounded-lg bg-[#F8F4EA] hover:bg-[#EFE7D6] border border-[#E7DEC8] flex items-center justify-center text-[#0E3A2F] active:scale-95"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    inputMode="numeric"
                    value={row.value}
                    onChange={(e) => row.setter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyDimensionEditor();
                      }
                    }}
                    className="w-16 h-8 rounded-lg border border-[#E2E8F0] bg-[#FFFCF5] text-center text-xs font-bold font-mono-num text-[#0F172A] focus:outline-none focus:border-[#C5A059]"
                  />

                  <button
                    type="button"
                    aria-label={`${row.label} +10mm`}
                    onClick={() => stepDraftInput(row.setter, row.fallback, 10, row.minVal)}
                    className="w-8 h-8 rounded-lg bg-[#F8F4EA] hover:bg-[#EFE7D6] border border-[#E7DEC8] flex items-center justify-center text-[#0E3A2F] active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Material Selector */}
          <div className="mt-2.5">
            <p className="text-[10px] font-semibold text-slate-600 mb-1.5">Material</p>
            <div className="flex flex-wrap gap-1.5">
              {DIMENSION_EDITOR_MATERIALS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    tgHapticImpact('light');
                    setDraftMaterial(opt.value);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap border ${
                    draftMaterial === opt.value
                      ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                      : 'bg-white text-[#0F172A] border-[#E7DEC8] hover:bg-[#F8F4EA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Price & Apply CTA */}
          <div className="mt-3 pt-2.5 border-t border-[#E7DEC8] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500">Detal narxi</p>
              <p className="text-xs font-bold font-mono-num text-[#0E3A2F]">
                {formatSom(editorPreviewPrice)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyDimensionEditor}
              className="h-9 px-3.5 rounded-xl bg-[#0E3A2F] hover:bg-[#144D3E] text-white border border-[#C5A059] text-xs font-bold shadow-sm transition-colors active:scale-[0.98]"
            >
              Saqlash / Qo&apos;llash
            </button>
          </div>
        </div>
      )}

      {/* Bottom 360° Rotation Indicator OR Compact CAD Inspector Dock */}
      {selectedPart ? (
        <div className="absolute left-14 right-16 bottom-3 z-20 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white/95 text-[#1A2421] rounded-2xl border border-[#C5A059]/65 shadow-lg px-3 py-2 max-w-full flex flex-wrap items-center gap-2 text-xs">
            <div className="min-w-0">
              <p className="font-bold truncate text-[#0E3A2F]">{selectedPart.name}</p>
              <p className="text-[11px] font-mono-num text-[#6B7A74]">
                {formatSubPartDimensionsMm(selectedPart)} ·{' '}
                {formatSom(calculateSingleSubPartPrice(selectedPart, pricing))}
              </p>
            </div>

            {isSelectedDoorOrDrawer && (
              <button
                type="button"
                onClick={() => toggleSinglePartOpen(selectedPart.id)}
                className={`min-h-[30px] px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap border ${
                  isSelectedOpen
                    ? 'bg-[#0E3A2F] text-white border-[#C5A059]'
                    : 'bg-[#FAF8F5] hover:bg-[#F3EDE2] text-[#0E3A2F] border-[#C5A059]/45'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span>{isSelectedOpen ? 'Yopish' : 'Ochish'}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-3.5 py-1.5 rounded-full bg-[#0E3A2F]/90 text-white border border-[#C5A059]/80 shadow-md flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap">
            <Rotate3d className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>360° ko&apos;rinish</span>
          </div>
        </div>
      )}
    </div>
  );
};
