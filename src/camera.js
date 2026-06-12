import * as THREE from 'three';

export class IsometricCamera {
  constructor(canvas, target) {
    this.canvas = canvas;
    this.target = target;
    this.zoom = 34;
    this.minZoom = 20;
    this.maxZoom = 68;
    this.angle = Math.PI / 4;
    this.elevation = 0.9;

    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.OrthographicCamera(
      -this.zoom * aspect,
      this.zoom * aspect,
      this.zoom,
      -this.zoom,
      0.1,
      200
    );
    this.updatePosition();

    this.isDragging = false;
    this.lastMouse = { x: 0, y: 0 };
    /** Return true to block left-click pan (e.g. fence drag placement). */
    this.shouldBlockPan = null;
    this.bindEvents();
  }

  updatePosition() {
    const dist = 30;
    this.camera.position.set(
      this.target.x + Math.cos(this.angle) * dist * Math.cos(this.elevation),
      dist * Math.sin(this.elevation),
      this.target.z + Math.sin(this.angle) * dist * Math.cos(this.elevation)
    );
    this.camera.lookAt(this.target);
  }

  resize(width, height) {
    const aspect = width / height;
    this.camera.left = -this.zoom * aspect;
    this.camera.right = this.zoom * aspect;
    this.camera.top = this.zoom;
    this.camera.bottom = -this.zoom;
    this.camera.updateProjectionMatrix();
  }

  setZoom(delta) {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta, this.minZoom, this.maxZoom);
    this.resize(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  pan(dx, dy) {
    const panSpeed = this.zoom * 0.002;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    this.camera.getWorldDirection(right);
    right.cross(up).normalize();

    this.target.x -= right.x * dx * panSpeed;
    this.target.z -= right.z * dx * panSpeed;
    this.target.x -= Math.cos(this.angle) * dy * panSpeed;
    this.target.z -= Math.sin(this.angle) * dy * panSpeed;

    const limitX = 24;
    const limitZ = 42;
    this.target.x = THREE.MathUtils.clamp(this.target.x, -limitX, limitX);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -limitZ, limitZ);
    this.updatePosition();
  }

  getNDC(event) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
  }

  bindEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.shouldBlockPan?.(e)) return;
      if (e.button === 0 || e.button === 1) {
        this.isDragging = true;
        this.lastMouse = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      if (e.buttons === 1 && this.shouldBlockPan?.(e)) {
        this.isDragging = false;
        return;
      }
      const dx = e.clientX - this.lastMouse.x;
      const dy = e.clientY - this.lastMouse.y;
      this.pan(dx, dy);
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setZoom(e.deltaY * 0.02);
    }, { passive: false });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
