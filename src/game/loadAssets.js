import { ASSET_URLS } from './assetConfig.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = async () => {
      try {
        if (image.decode) await image.decode();
      } catch {
        // Some browsers resolve onload before decode is available; the image is still usable.
      }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    image.src = src;
  });
}

async function loadTeacherSet(set, loadTrackedImage) {
  const [idle, fun] = await Promise.all([
    Promise.all(set.idle.map(loadTrackedImage)),
    Promise.all(set.fun.map(loadTrackedImage)),
  ]);

  return { idle, fun };
}

export async function loadGameAssets(onProgress = () => {}) {
  const totalImages =
    1 +
    1 +
    ASSET_URLS.runnerFrames.length +
    1 +
    ASSET_URLS.obstacles.length +
    1 +
    1 +
    ASSET_URLS.universities.length +
    ASSET_URLS.teacherSets.reduce((total, set) => total + set.idle.length + set.fun.length, 0);
  let loadedImages = 0;

  const loadTrackedImage = async (src) => {
    const image = await loadImage(src);
    loadedImages += 1;
    onProgress(Math.round((loadedImages / totalImages) * 100));
    return image;
  };

  onProgress(0);

  const [background, road, runnerFrames, runnerLose, obstacles, star, flashlight, universities, teacherSets] =
    await Promise.all([
      loadTrackedImage(ASSET_URLS.background),
      loadTrackedImage(ASSET_URLS.road),
      Promise.all(ASSET_URLS.runnerFrames.map(loadTrackedImage)),
      loadTrackedImage(ASSET_URLS.runnerLose),
      Promise.all(ASSET_URLS.obstacles.map(loadTrackedImage)),
      loadTrackedImage(ASSET_URLS.star),
      loadTrackedImage(ASSET_URLS.flashlight),
      Promise.all(ASSET_URLS.universities.map(loadTrackedImage)),
      Promise.all(ASSET_URLS.teacherSets.map((set) => loadTeacherSet(set, loadTrackedImage))),
    ]);

  onProgress(100);

  return {
    background,
    road,
    runnerFrames,
    runnerLose,
    obstacles,
    star,
    flashlight,
    universities,
    teacherSets,
  };
}
