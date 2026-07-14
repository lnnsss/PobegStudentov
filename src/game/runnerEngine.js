import { loadGameAssets } from './loadAssets.js';
import { GROUND_Y, LOGICAL_HEIGHT, LOGICAL_WIDTH, ROAD_TOP } from './assetConfig.js';

const STORAGE_KEY = 'playlist-studentov-runner-best';
const PLAYER_X = 190;
const PLAYER_WIDTH = 116;
const PLAYER_HEIGHT = 164;
const GRAVITY = 2250;
const JUMP_VELOCITY = -840;
const START_SPEED = 390;
const MAX_SPEED = 710;
const VISUAL_SCROLL_FACTOR = 0.68;
const DAMAGE_INVULNERABLE_TIME = 1.55;
const PLAYER_BLINK_INTERVAL = 0.16;
const STARTING_LIVES = 3;
const MAX_JUMPS = 2;
const MIN_OBJECT_GAP = 245;
const TEACHER_MIN_GAP = 560;
const TEACHER_MIN_BOXES = 9;
const TEACHER_BOX_SPREAD = 5;
const STAR_MIN_BOXES = 2;
const STAR_BOX_SPREAD = 3;
const UNIVERSITY_MIN_BOXES = 14;
const UNIVERSITY_BOX_SPREAD = 8;
const SCENERY_SPEED_FACTOR = 0.78;

function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getBestRecord() {
  const value = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function setBestRecord(value) {
  localStorage.setItem(STORAGE_KEY, String(value));
}

function nextTeacherTarget() {
  return TEACHER_MIN_BOXES + Math.floor(Math.random() * TEACHER_BOX_SPREAD);
}

function nextStarTarget() {
  return STAR_MIN_BOXES + Math.floor(Math.random() * STAR_BOX_SPREAD);
}

function nextUniversityTarget() {
  return UNIVERSITY_MIN_BOXES + Math.floor(Math.random() * UNIVERSITY_BOX_SPREAD);
}

function coverRect(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

export class RunnerEngine {
  constructor(canvas, onHudChange) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onHudChange = onHudChange;
    this.animationFrame = 0;
    this.lastTime = 0;
    this.assets = null;
    this.destroyed = false;
    this.roadOffset = 0;
    this.best = getBestRecord();
    this.running = false;

    this.resetState();
  }

  async start() {
    this.assets = await loadGameAssets();
    if (this.destroyed) return;
    this.seedScenery();
    this.publishHud({ ready: true });
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
  }

  resetState() {
    this.player = {
      x: PLAYER_X,
      y: GROUND_Y - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      velocityY: 0,
      grounded: true,
      jumpsRemaining: MAX_JUMPS,
    };

    this.distance = 0;
    this.stars = 0;
    this.lives = STARTING_LIVES;
    this.speed = START_SPEED;
    this.spawnTimer = 0.85;
    this.lampTimer = 1.2;
    this.boxesSinceTeacher = 0;
    this.nextTeacherAt = nextTeacherTarget();
    this.boxesSinceStar = 0;
    this.nextStarAt = nextStarTarget();
    this.boxesSinceUniversity = 0;
    this.nextUniversityAt = nextUniversityTarget();
    this.invulnerableTimer = 0;
    this.objects = [];
    this.sceneryObjects = [];
    this.paused = false;
    this.gameOver = false;
    this.frameTime = 0;
    this.frameIndex = 0;
    this.lastTime = 0;
  }

  restart() {
    this.resetState();
    this.seedScenery();
    this.running = true;
    this.publishHud();
  }

  showMenu() {
    this.resetState();
    this.seedScenery();
    this.running = false;
    this.publishHud();
  }

  jump() {
    if (this.paused || !this.running) return;
    if (this.gameOver) {
      this.restart();
      return;
    }
    if (this.player.jumpsRemaining <= 0) return;

    this.player.velocityY = JUMP_VELOCITY;
    this.player.grounded = false;
    this.player.jumpsRemaining -= 1;
  }

  togglePause() {
    if (this.gameOver || !this.running) return;
    this.setPaused(!this.paused);
  }

  setPaused(paused) {
    if (this.gameOver || !this.running) return;
    if (this.paused === paused) return;
    this.paused = paused;
    this.lastTime = 0;
    this.publishHud();
  }

  tick = (time) => {
    if (this.destroyed) return;

    const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, 0.033) : 0;
    this.lastTime = time;

    if (this.assets && this.running && !this.paused && !this.gameOver) {
      this.update(delta);
    } else if (this.assets && this.gameOver && !this.paused) {
      this.updateAnimation(delta);
    }

    if (this.assets) this.draw();
    this.animationFrame = requestAnimationFrame(this.tick);
  };

  update(delta) {
    this.distance += (this.speed * delta) / 18;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.distance * 1.35);
    this.roadOffset = (this.roadOffset + this.visualSpeed * delta) % LOGICAL_WIDTH;

    this.updatePlayer(delta);
    this.updateAnimation(delta);
    this.updateObjects(delta);
    this.handleCollisions();
    this.publishHud();
  }

  updatePlayer(delta) {
    this.player.velocityY += GRAVITY * delta;
    this.player.y += this.player.velocityY * delta;

    const ground = GROUND_Y - this.player.height;
    if (this.player.y >= ground) {
      this.player.y = ground;
      this.player.velocityY = 0;
      this.player.grounded = true;
      this.player.jumpsRemaining = MAX_JUMPS;
    }
  }

  updateAnimation(delta) {
    this.frameTime += delta;
    if (this.frameTime > 0.12) {
      this.frameTime = 0;
      this.frameIndex = (this.frameIndex + 1) % this.assets.runnerFrames.length;
    }
  }

  updateObjects(delta) {
    this.spawnTimer -= delta;
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);

    if (this.spawnTimer <= 0) {
      const spawned = this.spawnNextObject();
      const speedFactor = Math.max(0.7, 1 - this.distance / 900);
      this.spawnTimer = spawned ? 0.95 + Math.random() * 0.55 * speedFactor : 0.2;
    }

    this.lampTimer -= delta;
    if (this.lampTimer <= 0) {
      this.spawnLamp();
      this.lampTimer = 3.4 + Math.random() * 2.4;
    }

    for (const object of this.objects) {
      object.x -= this.visualSpeed * delta;
    }

    for (const object of this.sceneryObjects) {
      object.x -= this.visualSpeed * SCENERY_SPEED_FACTOR * delta;
    }

    this.objects = this.objects.filter((object) => object.x + object.width > -90 && !object.collected);
    this.sceneryObjects = this.sceneryObjects.filter((object) => object.x + object.width > -160);
  }

  spawnNextObject() {
    if (this.boxesSinceStar >= this.nextStarAt && this.spawnStar()) {
      this.boxesSinceStar = 0;
      this.nextStarAt = nextStarTarget();
      return true;
    }

    let spawned = false;
    if (this.boxesSinceTeacher >= this.nextTeacherAt) {
      spawned = this.spawnTeacher();
      if (spawned) {
        this.boxesSinceTeacher = 0;
        this.nextTeacherAt = nextTeacherTarget();
      }
    }

    if (!spawned) {
      spawned = this.spawnObstacle();
      if (spawned) {
        this.boxesSinceTeacher += 1;
        this.boxesSinceStar += 1;
        this.boxesSinceUniversity += 1;
        if (this.boxesSinceUniversity >= this.nextUniversityAt) {
          this.spawnUniversity();
          this.boxesSinceUniversity = 0;
          this.nextUniversityAt = nextUniversityTarget();
        }
      }
    }

    return spawned;
  }

  spawnObstacle() {
    if (!this.canSpawnAt(LOGICAL_WIDTH + 80, MIN_OBJECT_GAP)) return false;

    const variants = this.assets.obstacles.map((image) => {
      const targetHeight = Math.min(132, Math.max(58, image.naturalHeight * 0.18));
      const targetWidth = (image.naturalWidth / image.naturalHeight) * targetHeight;

      return {
        image,
        width: targetWidth,
        height: targetHeight,
        hitbox: {
          x: targetWidth * 0.14,
          y: targetHeight * 0.12,
          width: targetWidth * 0.72,
          height: targetHeight * 0.78,
        },
      };
    });
    const variant = variants[Math.floor(Math.random() * variants.length)];

    this.objects.push({
      type: 'obstacle',
      x: LOGICAL_WIDTH + 80,
      y: GROUND_Y - variant.height + 6,
      width: variant.width,
      height: variant.height,
      image: variant.image,
      hitbox: variant.hitbox,
    });

    return true;
  }

  spawnTeacher() {
    if (!this.canSpawnAt(LOGICAL_WIDTH + 120, TEACHER_MIN_GAP)) return false;

    const teacherSet = this.assets.teacherSets[Math.floor(Math.random() * this.assets.teacherSets.length)];
    const frame = teacherSet.idle[0];
    const targetHeight = 146;
    const targetWidth = (frame.naturalWidth / frame.naturalHeight) * targetHeight;

    this.objects.push({
      type: 'teacher',
      x: LOGICAL_WIDTH + 120,
      y: GROUND_Y - targetHeight + 6,
      width: targetWidth,
      height: targetHeight,
      idleFrames: teacherSet.idle,
      funFrames: teacherSet.fun,
      hit: false,
      hitbox: {
        x: targetWidth * 0.22,
        y: targetHeight * 0.12,
        width: targetWidth * 0.56,
        height: targetHeight * 0.82,
      },
    });

    return true;
  }

  spawnStar() {
    const x = LOGICAL_WIDTH + 260 + Math.random() * 260;
    if (!this.canSpawnAt(x, MIN_OBJECT_GAP + 90)) return false;

    const arcSlots = [GROUND_Y - 210, GROUND_Y - 260, GROUND_Y - 145];

    this.objects.push({
      type: 'star',
      x,
      y: arcSlots[Math.floor(Math.random() * arcSlots.length)],
      width: 58,
      height: 60,
      image: this.assets.star,
      hitbox: { x: -18, y: -18, width: 94, height: 96 },
      bob: Math.random() * Math.PI * 2,
    });

    return true;
  }

  canSpawnAt(x, minGap) {
    return this.objects.every((object) => Math.abs(object.x - x) >= minGap);
  }

  canSpawnSceneryAt(x, minGap) {
    return this.sceneryObjects.every((object) => Math.abs(object.x - x) >= minGap);
  }

  seedScenery() {
    if (!this.assets) return;
    this.sceneryObjects = [];
    this.addLamp(86);
    this.addLamp(650);
    this.addUniversity(1020);
  }

  spawnLamp() {
    const x = LOGICAL_WIDTH + 140 + Math.random() * 120;
    if (!this.canSpawnSceneryAt(x, 260)) return false;

    this.addLamp(x);
    return true;
  }

  addLamp(x) {
    const image = this.assets.flashlight;
    const height = 168;
    const width = (image.naturalWidth / image.naturalHeight) * height;

    this.sceneryObjects.push({
      type: 'lamp',
      x,
      y: ROAD_TOP - height + 38,
      width,
      height,
      image,
    });
  }

  spawnUniversity() {
    const x = LOGICAL_WIDTH + 220 + Math.random() * 240;
    if (!this.canSpawnSceneryAt(x, 520)) return false;

    this.addUniversity(x);
    return true;
  }

  addUniversity(x) {
    const image = this.assets.universities[Math.floor(Math.random() * this.assets.universities.length)];
    const height = Math.min(285, Math.max(190, image.naturalHeight * 0.46));
    const width = (image.naturalWidth / image.naturalHeight) * height;

    this.sceneryObjects.push({
      type: 'university',
      x,
      y: ROAD_TOP - height + 24,
      width,
      height,
      image,
    });
  }

  handleCollisions() {
    const playerBox = {
      x: this.player.x + 34,
      y: this.player.y + 26,
      width: this.player.width - 56,
      height: this.player.height - 34,
    };

    for (const object of this.objects) {
      const hitbox = {
        x: object.x + object.hitbox.x,
        y: object.y + object.hitbox.y,
        width: object.hitbox.width,
        height: object.hitbox.height,
      };

      if (!rectsIntersect(playerBox, hitbox)) continue;

      if (object.type === 'star') {
        object.collected = true;
        this.stars += 1;
      } else if (object.type === 'teacher') {
        object.hit = true;
        this.endRun();
      } else if (this.invulnerableTimer <= 0) {
        object.collected = true;
        this.lives -= 1;

        if (this.lives <= 0) {
          this.endRun();
        } else {
          this.invulnerableTimer = DAMAGE_INVULNERABLE_TIME;
        }
      }
    }
  }

  endRun() {
    this.gameOver = true;
    this.running = false;
    const finalDistance = Math.floor(this.distance);
    if (finalDistance > this.best) {
      this.best = finalDistance;
      setBestRecord(this.best);
    }
    this.publishHud();
  }

  publishHud(extra = {}) {
    this.onHudChange({
      distance: Math.floor(this.distance),
      best: Math.max(this.best, Math.floor(this.distance)),
      stars: this.stars,
      lives: this.lives,
      paused: this.paused,
      gameOver: this.gameOver,
      ...extra,
    });
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.imageSmoothingEnabled = false;

    this.drawBackground(ctx);
    this.drawScenery(ctx);
    this.drawRoad(ctx);
    this.drawObjects(ctx);
    this.drawPlayer(ctx);
  }

  drawBackground(ctx) {
    const rect = coverRect(this.assets.background.width, this.assets.background.height, LOGICAL_WIDTH, ROAD_TOP + 2);
    ctx.drawImage(this.assets.background, rect.x, rect.y, rect.width, rect.height);
  }

  drawRoad(ctx) {
    const sourceY = 610;
    const sourceHeight = this.assets.road.height - sourceY;
    const roadHeight = LOGICAL_HEIGHT - ROAD_TOP;
    const tileWidth = LOGICAL_WIDTH + 8;

    for (let x = -this.roadOffset - 4; x < LOGICAL_WIDTH + tileWidth; x += LOGICAL_WIDTH) {
      ctx.drawImage(this.assets.road, 0, sourceY, this.assets.road.width, sourceHeight, x, ROAD_TOP, tileWidth, roadHeight);
    }
  }

  drawScenery(ctx) {
    for (const object of this.sceneryObjects) {
      ctx.drawImage(object.image, object.x, object.y, object.width, object.height);
    }
  }

  drawObjects(ctx) {
    for (const object of this.objects) {
      const y = object.type === 'star' ? object.y + Math.sin(performance.now() / 180 + object.bob) * 7 : object.y;
      const teacherFrames =
        object.type === 'teacher' ? (object.hit ? object.funFrames : object.idleFrames) : null;
      const image = teacherFrames ? teacherFrames[this.frameIndex % teacherFrames.length] : object.image;

      ctx.drawImage(image, object.x, y, object.width, object.height);
    }
  }

  drawPlayer(ctx) {
    if (this.gameOver) {
      const width = 220;
      const height = (this.assets.runnerLose.naturalHeight / this.assets.runnerLose.naturalWidth) * width;
      ctx.drawImage(this.assets.runnerLose, this.player.x - 34, GROUND_Y - height + 14, width, height);
      return;
    }

    if (this.invulnerableTimer > 0 && Math.floor(this.invulnerableTimer / PLAYER_BLINK_INTERVAL) % 2 === 0) {
      return;
    }

    const frame = this.assets.runnerFrames[this.frameIndex];
    ctx.drawImage(frame, this.player.x, this.player.y, this.player.width, this.player.height);
  }

  get visualSpeed() {
    return this.speed * VISUAL_SCROLL_FACTOR;
  }
}
