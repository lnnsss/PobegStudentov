import { ASSET_URLS } from './assetConfig.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
    image.src = src;
  });
}

async function loadTeacherSet(set) {
  const [idle, fun] = await Promise.all([
    Promise.all(set.idle.map(loadImage)),
    Promise.all(set.fun.map(loadImage)),
  ]);

  return { idle, fun };
}

export async function loadGameAssets() {
  const [background, road, runnerFrames, runnerLose, obstacles, star, flashlight, universities, teacherSets] =
    await Promise.all([
      loadImage(ASSET_URLS.background),
      loadImage(ASSET_URLS.road),
      Promise.all(ASSET_URLS.runnerFrames.map(loadImage)),
      loadImage(ASSET_URLS.runnerLose),
      Promise.all(ASSET_URLS.obstacles.map(loadImage)),
      loadImage(ASSET_URLS.star),
      loadImage(ASSET_URLS.flashlight),
      Promise.all(ASSET_URLS.universities.map(loadImage)),
      Promise.all(ASSET_URLS.teacherSets.map(loadTeacherSet)),
    ]);

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
