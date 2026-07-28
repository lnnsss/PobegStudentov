export const LOGICAL_WIDTH = 1280;
export const LOGICAL_HEIGHT = 720;

export const ASSET_URLS = {
  background: '/assets/optimized/bg.webp',
  mobileBackground: '/assets/optimized/bg_mobile.webp',
  road: '/assets/optimized/road.webp',
  runnerFrames: ['/assets/optimized/person/girl_run_1.webp', '/assets/optimized/person/girl_run_2.webp'],
  runnerLose: '/assets/optimized/person/girl_lose.webp',
  obstacles: [
    { src: '/assets/optimized/obstacles/box1.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/box2.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/box3.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/box4.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/box5.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/box6.webp', weight: 2 },
    { src: '/assets/optimized/obstacles/Шины.webp', weight: 12, scale: 0.7 },
    { src: '/assets/optimized/obstacles/Конус.webp', weight: 12, scale: 0.62 },
    { src: '/assets/optimized/obstacles/Чакчак.webp', weight: 4, scale: 0.72 },
    { src: '/assets/optimized/obstacles/Скамейка.webp', weight: 1, scale: 0.82 },
  ],
  star: '/assets/optimized/interface/star.webp',
  projects: [
    {
      id: 'studvesna',
      logo: '/assets/projects/studvesna/logo.png',
      frames: ['/assets/projects/studvesna/1.png', '/assets/projects/studvesna/2.png', '/assets/projects/studvesna/3.png'],
    },
    {
      id: 'slovoZaNami',
      logo: '/assets/projects/slovoZaNami/logo.png',
      frames: ['/assets/projects/slovoZaNami/1.png', '/assets/projects/slovoZaNami/2.png', '/assets/projects/slovoZaNami/3.png'],
    },
    {
      id: 'pervayaLiga',
      logo: '/assets/projects/pervayaLiga/logo.png',
      frames: ['/assets/projects/pervayaLiga/1.png', '/assets/projects/pervayaLiga/2.png', '/assets/projects/pervayaLiga/3.png'],
    },
    {
      id: 'dostizhenieGoda',
      logo: '/assets/projects/dostizhenieGoda/logo.png',
      frames: ['/assets/projects/dostizhenieGoda/1.png', '/assets/projects/dostizhenieGoda/2.png', '/assets/projects/dostizhenieGoda/3.png'],
    },
    {
      id: 'ligaforum',
      logo: '/assets/projects/ligaforum/logo.png',
      frames: ['/assets/projects/ligaforum/1.png', '/assets/projects/ligaforum/2.png', '/assets/projects/ligaforum/3.png'],
    },
    {
      id: 'zhilKonkurs',
      logo: '/assets/projects/zhilKonkurs/logo.png',
      frames: ['/assets/projects/zhilKonkurs/1.png', '/assets/projects/zhilKonkurs/2.png', '/assets/projects/zhilKonkurs/3.png'],
    },
    {
      id: 'studentGoda',
      logo: '/assets/projects/studentGoda/logo.png',
      frames: ['/assets/projects/studentGoda/1.png', '/assets/projects/studentGoda/2.png', '/assets/projects/studentGoda/3.png'],
    },
  ],
  flashlight: '/assets/optimized/building/flashlight.webp',
  buildings: [
    { src: '/assets/optimized/building/univer/иэуп.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/каи.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/кгэу.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/кфу1.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/мед.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/пгуфксит.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/univer/тисби.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/арена.webp', roadOverlap: 6 },
    { src: '/assets/optimized/building/библиотека.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/вб.webp', roadOverlap: 6 },
    { src: '/assets/optimized/building/магнит.webp', roadOverlap: 6 },
    { src: '/assets/optimized/building/пирамила.webp', roadOverlap: 12 },
    { src: '/assets/optimized/building/пятерочка.webp', roadOverlap: 6 },
    { src: '/assets/optimized/building/татмак.webp', roadOverlap: 6 },
    { src: '/assets/optimized/building/lnsbaner.webp', roadOverlap: 0 },
  ],
  teacherSets: [
    {
      idle: ['/assets/optimized/obstacles/first_teacher_1.webp', '/assets/optimized/obstacles/first_teacher_2.webp'],
      fun: ['/assets/optimized/obstacles/first_teacher_fun_1.webp', '/assets/optimized/obstacles/first_teacher_fun_2.webp'],
    },
    {
      idle: ['/assets/optimized/obstacles/second_teacher_1.webp', '/assets/optimized/obstacles/second_teacher_2.webp'],
      fun: ['/assets/optimized/obstacles/second_teacher_fun_1.webp', '/assets/optimized/obstacles/second_teacher_fun_2.webp'],
    },
  ],
};

export const ROAD_TOP = 408;
export const GROUND_Y = 552;
