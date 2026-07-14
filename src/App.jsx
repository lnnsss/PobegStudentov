import { useCallback, useEffect, useRef, useState } from 'react';
import { gameAudio } from './game/audioManager.js';
import { RunnerEngine } from './game/runnerEngine.js';
import {
  fetchLeaderboard,
  isPlayerNameAvailable,
  readLocalLeaderboard,
  readPlayerName,
  upsertLeaderboardRecord,
  writePlayerName,
} from './services/leaderboardService.js';

const initialHud = {
  distance: 0,
  best: 0,
  stars: 0,
  lives: 3,
  paused: false,
  gameOver: false,
  ready: false,
};

const RESUME_AFTER_ROTATE_MS = 2500;

function formatScore(value, length = 7) {
  return String(Math.max(0, Math.floor(value))).padStart(length, '0');
}

function normalizePlayerName(value) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .slice(0, 16);
}

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const autoPausedByRotateRef = useRef(false);
  const resumeTimerRef = useRef(0);
  const damageTimerRef = useRef(0);
  const previousLivesRef = useRef(initialHud.lives);
  const playerNameRef = useRef('');
  const [hud, setHud] = useState(initialHud);
  const [screen, setScreen] = useState('menu');
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const [damagedHeartIndex, setDamagedHeartIndex] = useState(-1);
  const [playerName, setPlayerName] = useState(() => readPlayerName());
  const [nameInput, setNameInput] = useState(() => readPlayerName());
  const [nameError, setNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [leaderboard, setLeaderboard] = useState(() => readLocalLeaderboard());
  const [soundEnabled, setSoundEnabled] = useState(() => gameAudio.isEnabled());
  const [musicVolume, setMusicVolume] = useState(() => gameAudio.getMusicVolume());
  const [effectsVolume, setEffectsVolume] = useState(() => gameAudio.getEffectsVolume());
  const [trackIndex, setTrackIndex] = useState(() => gameAudio.getTrackIndex());
  const musicTracks = gameAudio.getTracks();

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = new RunnerEngine(
      canvas,
      (nextHud) => {
        setHud((current) => {
          const next = { ...current, ...nextHud };
          if (next.lives < previousLivesRef.current) {
            window.clearTimeout(damageTimerRef.current);
            setDamagedHeartIndex(next.lives);
            damageTimerRef.current = window.setTimeout(() => setDamagedHeartIndex(-1), 520);
          }
          previousLivesRef.current = next.lives;
          return next;
        });
        if (nextHud.gameOver) {
          gameAudio.stopMusic();
          if (playerNameRef.current) {
            upsertLeaderboardRecord(playerNameRef.current, nextHud.distance || 0, nextHud.stars || 0).then(setLeaderboard);
          }
          setScreen('gameOver');
        }
      },
      (event) => {
        gameAudio.play(event.type);
      },
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      window.clearTimeout(resumeTimerRef.current);
      window.clearTimeout(damageTimerRef.current);
      engineRef.current = null;
    };
  }, []);

  const jump = useCallback(() => {
    gameAudio.unlock();
    engineRef.current?.jump();
  }, []);

  const startGame = useCallback(() => {
    if (!playerNameRef.current) return;
    gameAudio.unlock();
    gameAudio.play('button');
    gameAudio.startMusic();
    autoPausedByRotateRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    window.clearTimeout(damageTimerRef.current);
    setResumeCountdown(0);
    setDamagedHeartIndex(-1);
    previousLivesRef.current = initialHud.lives;
    engineRef.current?.restart();
    setScreen('playing');
  }, []);

  const goToMenu = useCallback(() => {
    gameAudio.play('button');
    gameAudio.stopMusic();
    autoPausedByRotateRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    window.clearTimeout(damageTimerRef.current);
    setResumeCountdown(0);
    setDamagedHeartIndex(-1);
    previousLivesRef.current = initialHud.lives;
    engineRef.current?.showMenu();
    setScreen('menu');
  }, []);

  const showRecords = useCallback(() => {
    gameAudio.play('button');
    fetchLeaderboard().then(setLeaderboard);
    setScreen('records');
  }, []);

  const togglePause = useCallback(() => {
    if (screen !== 'playing') return;
    gameAudio.unlock();
    gameAudio.play('button');
    autoPausedByRotateRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    setResumeCountdown(0);
    const nextPaused = !hud.paused;
    engineRef.current?.togglePause();
    if (nextPaused) gameAudio.stopMusic();
    else gameAudio.startMusic();
  }, [hud.paused, screen]);

  const restart = useCallback(() => {
    gameAudio.unlock();
    gameAudio.play('button');
    gameAudio.startMusic();
    autoPausedByRotateRef.current = false;
    window.clearTimeout(resumeTimerRef.current);
    window.clearTimeout(damageTimerRef.current);
    setResumeCountdown(0);
    setDamagedHeartIndex(-1);
    previousLivesRef.current = initialHud.lives;
    engineRef.current?.restart();
    setScreen('playing');
  }, []);

  const toggleSound = useCallback(() => {
    const nextEnabled = !soundEnabled;
    gameAudio.setEnabled(nextEnabled);
    setSoundEnabled(nextEnabled);
    if (nextEnabled) {
      gameAudio.unlock();
      gameAudio.play('button');
      if (screen === 'playing' && !hud.paused && !hud.gameOver) gameAudio.startMusic();
    }
  }, [hud.gameOver, hud.paused, screen, soundEnabled]);

  const showSettings = useCallback(() => {
    gameAudio.play('button');
    setScreen('settings');
  }, []);

  const changeTrack = useCallback(
    (direction) => {
      gameAudio.unlock();
      gameAudio.play('button');
      const nextIndex = (trackIndex + direction + musicTracks.length) % musicTracks.length;
      gameAudio.setTrackIndex(nextIndex);
      setTrackIndex(nextIndex);
    },
    [musicTracks.length, trackIndex],
  );

  const changeMusicVolume = useCallback((event) => {
    const nextVolume = Number(event.target.value) / 100;
    gameAudio.setMusicVolume(nextVolume);
    setMusicVolume(nextVolume);
  }, []);

  const changeEffectsVolume = useCallback((event) => {
    const nextVolume = Number(event.target.value) / 100;
    gameAudio.setEffectsVolume(nextVolume);
    setEffectsVolume(nextVolume);
    gameAudio.play('button');
  }, []);

  const submitName = useCallback(
    async (event) => {
      event.preventDefault();

      const cleanName = normalizePlayerName(nameInput);
      setNameError('');
      if (!cleanName) {
        setNameError('Введите никнейм.');
        return;
      }

      setIsCheckingName(true);
      const available = await isPlayerNameAvailable(cleanName, playerNameRef.current);
      setIsCheckingName(false);

      if (!available) {
        setNameError('Такой ник уже занят. Возьмите другой.');
        setNameInput(cleanName);
        return;
      }

      writePlayerName(cleanName);
      playerNameRef.current = cleanName;
      setPlayerName(cleanName);
      setNameInput(cleanName);
      gameAudio.unlock();
      gameAudio.play('button');
      upsertLeaderboardRecord(cleanName, hud.best, hud.stars).then(setLeaderboard);
    },
    [hud.best, hud.stars, nameInput],
  );

  useEffect(() => {
    const isPortraitPhone = () => window.matchMedia('(orientation: portrait) and (max-width: 900px)').matches;

    const syncOrientationPause = () => {
      window.clearTimeout(resumeTimerRef.current);
      setResumeCountdown(0);

      if (screen !== 'playing' || hud.gameOver) {
        autoPausedByRotateRef.current = false;
        return;
      }

      if (isPortraitPhone()) {
        if (!hud.paused) {
          autoPausedByRotateRef.current = true;
          engineRef.current?.setPaused(true);
          gameAudio.stopMusic();
        }
        return;
      }

      if (!autoPausedByRotateRef.current) return;

      setResumeCountdown(Math.ceil(RESUME_AFTER_ROTATE_MS / 1000));
      resumeTimerRef.current = window.setTimeout(() => {
        autoPausedByRotateRef.current = false;
        setResumeCountdown(0);
        engineRef.current?.setPaused(false);
        gameAudio.startMusic();
      }, RESUME_AFTER_ROTATE_MS);
    };

    const media = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
    syncOrientationPause();
    media.addEventListener('change', syncOrientationPause);
    window.addEventListener('resize', syncOrientationPause);
    window.addEventListener('orientationchange', syncOrientationPause);

    return () => {
      window.clearTimeout(resumeTimerRef.current);
      media.removeEventListener('change', syncOrientationPause);
      window.removeEventListener('resize', syncOrientationPause);
      window.removeEventListener('orientationchange', syncOrientationPause);
    };
  }, [hud.gameOver, hud.paused, screen]);

  useEffect(() => {
    if (!resumeCountdown) return undefined;

    const interval = window.setInterval(() => {
      setResumeCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [resumeCountdown]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.repeat) return;

      if (event.code === 'Escape') {
        event.preventDefault();
        togglePause();
      }

      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        if (screen === 'menu' && playerName) startGame();
        else if (hud.gameOver) restart();
        else jump();
      }

      if (event.code === 'Enter' && hud.gameOver) {
        event.preventDefault();
        restart();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.gameOver, jump, playerName, restart, screen, startGame, togglePause]);

  const handlePointerDown = (event) => {
    if (event.target.closest('button')) return;
    if (event.target.closest('.menu-overlay')) return;
    if (event.target.closest('.center-overlay')) return;
    if (event.target.closest('.rotate-lock')) return;
    jump();
  };

  return (
    <main className="game-shell" onPointerDown={handlePointerDown}>
      <section className="game-frame" aria-label="Пиксельный раннер">
        <canvas ref={canvasRef} className="game-canvas" width="1280" height="720" />

        {screen !== 'menu' && screen !== 'records' && screen !== 'settings' && (
          <div className="hud-stack" aria-live="polite">
            <span className="life-row" aria-label={`Жизни: ${hud.lives}`}>
              {Array.from({ length: 3 }, (_, index) => {
                const active = index < hud.lives;
                const damaged = index === damagedHeartIndex;
                return (
                  <img
                    key={index}
                    className={damaged ? 'heart-sprite damaged' : 'heart-sprite'}
                    src={active ? '/assets/true-heart.png' : '/assets/false-heart.png'}
                    alt=""
                    aria-hidden="true"
                  />
                );
              })}
            </span>

            <span className="star-counter" aria-label={`Звёзды: ${hud.stars}`}>
              <img src="/assets/star-counter.png" alt="" aria-hidden="true" />
              <span>x</span>
              <strong>{formatScore(hud.stars, 2)}</strong>
            </span>

            <span className="score-copy">
              <span className="score-line current-score" aria-label={`Сейчас: ${hud.distance}`}>
                <span>{formatScore(hud.distance)}</span>
              </span>
              <span className="score-line best-score" aria-label={`Рекорд: ${hud.best}`}>
                <span>{formatScore(hud.best)}</span>
              </span>
            </span>
          </div>
        )}

        {screen !== 'menu' && screen !== 'records' && screen !== 'settings' && (
          <button
            type="button"
            className="pause-button"
            onClick={togglePause}
            aria-label={hud.paused ? 'Продолжить' : 'Пауза'}
          >
            {hud.paused ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              </svg>
            )}
          </button>
        )}

        {!hud.ready && (
          <div className="center-overlay">
            <div className="modal-panel compact">Загрузка...</div>
          </div>
        )}

        {screen === 'menu' && hud.ready && (
          <div className="menu-overlay">
            <img className="game-logo" src="/assets/logo.png" alt="Побег студентов" />
            <div className="menu-actions">
              <button type="button" className="game-button primary" onClick={startGame}>
                <span className="button-icon play-mark" />
                Играть
              </button>
              <button type="button" className="game-button" onClick={showSettings}>
                <span className="button-icon gear-mark" />
                Настройки
              </button>
              <button type="button" className="game-button" onClick={showRecords}>
                <span className="button-icon records-mark" />
                Рекорды
              </button>
            </div>
            <p className="menu-credit">
              Design and web-site by{' '}
              <a href="https://lnsnostylist.ru/" target="_blank" rel="noreferrer">
                lnsnostylist
              </a>
            </p>
          </div>
        )}

        {hud.paused && !hud.gameOver && hud.ready && screen === 'playing' && (
          <div className="center-overlay">
            <div className="modal-panel pause-panel">
              <h1>{resumeCountdown ? 'Готовьтесь' : 'Пауза'}</h1>
              {resumeCountdown ? (
                <p>Продолжаем через {resumeCountdown}</p>
              ) : (
                <div className="pause-actions">
                  <button type="button" className={soundEnabled ? 'sound-toggle active' : 'sound-toggle'} onClick={toggleSound}>
                    Звук: {soundEnabled ? 'Вкл' : 'Выкл'}
                  </button>
                  <button type="button" onClick={togglePause}>
                    Продолжить
                  </button>
                  <button type="button" className="secondary" onClick={goToMenu}>
                    Главное меню
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {screen === 'settings' && (
          <div className="center-overlay">
            <div className="modal-panel settings-panel">
              <h1>Настройки</h1>
              <button type="button" className={soundEnabled ? 'sound-toggle active' : 'sound-toggle'} onClick={toggleSound}>
                Звук: {soundEnabled ? 'Вкл' : 'Выкл'}
              </button>
              <div className="track-picker" aria-label="Фоновая музыка">
                <span>Трек {trackIndex + 1}/10</span>
                <strong>{musicTracks[trackIndex]}</strong>
                <div className="track-actions">
                  <button type="button" onClick={() => changeTrack(-1)} aria-label="Предыдущий трек">
                    ‹
                  </button>
                  <button type="button" onClick={() => changeTrack(1)} aria-label="Следующий трек">
                    ›
                  </button>
                </div>
              </div>
              <label className="volume-control">
                <span>
                  Музыка
                  <strong>{Math.round(musicVolume * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(musicVolume * 100)}
                  onChange={changeMusicVolume}
                />
              </label>
              <label className="volume-control">
                <span>
                  Эффекты
                  <strong>{Math.round(effectsVolume * 100)}%</strong>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(effectsVolume * 100)}
                  onChange={changeEffectsVolume}
                />
              </label>
              <button type="button" className="secondary" onClick={goToMenu}>
                В меню
              </button>
            </div>
          </div>
        )}

        {screen === 'gameOver' && (
          <div className="center-overlay game-over-overlay">
            <div className="result-panel">
              <div className="result-star">★</div>
              <h1>Игра окончена</h1>
              <span className="result-divider" />
              <span className="result-label">Счёт</span>
              <div className="result-score">{formatScore(hud.distance)}</div>
              <span className="result-label">Лучший результат</span>
              <strong className="result-best">{formatScore(hud.best, 6)}</strong>
              <div className="result-actions">
                <button type="button" className="game-button primary small" onClick={restart}>
                  <span className="button-icon replay-mark" />
                  Заново
                </button>
                <button type="button" className="game-button small" onClick={goToMenu}>
                  <span className="button-icon home-mark" />
                  В меню
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'records' && (
          <div className="center-overlay">
            <div className="modal-panel records-panel">
              <h1>Рекорды</h1>
              <ol className="records-list">
                {leaderboard.length ? (
                  leaderboard.map((record, index) => (
                    <li key={record.name}>
                      <span>{index + 1}</span>
                      <strong>{record.name}</strong>
                      <em>{formatScore(record.score)}</em>
                    </li>
                  ))
                ) : (
                  <li className="empty-records">Пока пусто</li>
                )}
              </ol>
              <button type="button" onClick={goToMenu}>
                В меню
              </button>
            </div>
          </div>
        )}

        {hud.ready && !playerName && (
          <div className="center-overlay name-overlay">
            <form className="modal-panel name-panel" onSubmit={submitName}>
              <h1>Ваш ник</h1>
              <input
                autoFocus
                maxLength="16"
                placeholder="Никнейм"
                value={nameInput}
                onChange={(event) => {
                  setNameError('');
                  setNameInput(event.target.value);
                }}
                aria-label="Никнейм"
              />
              {nameError && <p className="form-error">{nameError}</p>}
              <button type="submit" disabled={!nameInput.trim() || isCheckingName}>
                {isCheckingName ? 'Проверяем...' : 'Готово'}
              </button>
            </form>
          </div>
        )}

        <div className="rotate-lock" role="alert" aria-live="assertive">
          <div className="rotate-card">
            <div className="result-star">!</div>
            <h1>Переверните телефон</h1>
            <span className="result-divider" />
            <p>Игра работает только в горизонтальном режиме.</p>
            <div className="phone-rotate-art" aria-hidden="true">
              <span className="phone upright">:(</span>
              <span className="arrow">▶</span>
              <span className="phone landscape">:)</span>
            </div>
            <strong>Спасибо!</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
