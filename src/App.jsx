import { useCallback, useEffect, useRef, useState } from 'react';
import { gameAudio } from './game/audioManager.js';
import { RunnerEngine } from './game/runnerEngine.js';
import {
  fetchProfile,
  getCurrentSession,
  isNicknameAvailable,
  onAuthStateChange,
  saveProfile,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from './services/authService.js';
import {
  fetchLeaderboard,
  readLocalLeaderboard,
  upsertLeaderboardRecord,
} from './services/leaderboardService.js';

const initialHud = {
  distance: 0,
  best: 0,
  stars: 0,
  lives: 3,
  paused: false,
  gameOver: false,
  ready: false,
  loadingProgress: 0,
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

function normalizeTelegram(value) {
  return value.trim().replace(/^@+/, '').replace(/[^\w]/g, '').slice(0, 32);
}

export default function App() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const autoPausedByRotateRef = useRef(false);
  const resumeTimerRef = useRef(0);
  const damageTimerRef = useRef(0);
  const previousLivesRef = useRef(initialHud.lives);
  const playerNameRef = useRef('');
  const authSessionRef = useRef(null);
  const hasSyncedStoredRecordRef = useRef(false);
  const [hud, setHud] = useState(initialHud);
  const [screen, setScreen] = useState('menu');
  const [resumeCountdown, setResumeCountdown] = useState(0);
  const [damagedHeartIndex, setDamagedHeartIndex] = useState(-1);
  const [authReady, setAuthReady] = useState(false);
  const [authSession, setAuthSession] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileInput, setProfileInput] = useState({ nickname: '', telegram: '' });
  const playerName = profile?.nickname || '';
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
    let active = true;

    const applySession = (session) => {
      authSessionRef.current = session;
      setAuthSession(session);
      setAuthReady(true);
    };

    getCurrentSession().then((session) => {
      if (!active) return;
      if (session || !authSessionRef.current) {
        applySession(session);
        return;
      }
      setAuthReady(true);
    });

    const unsubscribe = onAuthStateChange((session, event) => {
      if (!active) return;

      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        applySession(null);
        setProfile(null);
        setProfileInput({ nickname: '', telegram: '' });
        setScreen('menu');
        engineRef.current?.showMenu();
        return;
      }

      if (session) {
        applySession(session);
        return;
      }

      if (!authSessionRef.current) {
        applySession(null);
        return;
      }

      setAuthReady(true);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;

    let active = true;
    fetchProfile().then((nextProfile) => {
      if (!active) return;
      setProfile(nextProfile);
      setProfileInput({
        nickname: nextProfile?.nickname || '',
        telegram: nextProfile?.telegram || '',
      });
    });

    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    engineRef.current?.setBestOwner(authSession?.user?.id || 'guest');
  }, [authSession?.user?.id]);

  useEffect(() => {
    if (!hud.ready || !playerName || hasSyncedStoredRecordRef.current) return;

    hasSyncedStoredRecordRef.current = true;
    if (hud.best > 0) {
      upsertLeaderboardRecord(playerName, hud.best, hud.stars).then(setLeaderboard);
    } else {
      fetchLeaderboard().then(setLeaderboard);
    }
  }, [hud.best, hud.ready, hud.stars, playerName]);

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

  const selectTrack = useCallback((event) => {
    gameAudio.unlock();
    const nextIndex = Number(event.target.value);
    gameAudio.setTrackIndex(nextIndex);
    setTrackIndex(nextIndex);
    gameAudio.play('button');
  }, []);

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

  const submitAuth = useCallback(
    async (event) => {
      event.preventDefault();
      setAuthError('');
      setIsAuthLoading(true);

      try {
        if (authMode === 'signup') {
          const session = await signUpWithEmail(authEmail.trim(), authPassword);
          if (!session) {
            setAuthError('Проверьте почту и подтвердите регистрацию.');
          }
        } else {
          await signInWithEmail(authEmail.trim(), authPassword);
        }
      } catch (error) {
        setAuthError(error.message || 'Не получилось войти.');
      } finally {
        setIsAuthLoading(false);
      }
    },
    [authEmail, authMode, authPassword],
  );

  const handleGoogleSignIn = useCallback(async () => {
    setAuthError('');
    setIsAuthLoading(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error.message || 'Не получилось открыть Google-вход.');
      setIsAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    gameAudio.play('button');
    gameAudio.stopMusic();
    try {
      await signOut();
    } catch (error) {
      setAuthError(error.message || 'Не получилось выйти.');
    }
  }, []);

  const submitName = useCallback(
    async (event) => {
      event.preventDefault();

      const cleanName = normalizePlayerName(profileInput.nickname);
      const cleanTelegram = normalizeTelegram(profileInput.telegram);
      setNameError('');
      if (!cleanName) {
        setNameError('Введите никнейм.');
        return;
      }

      setIsCheckingName(true);
      const available = await isNicknameAvailable(cleanName, profile?.nickname || '');
      setIsCheckingName(false);

      if (!available) {
        setNameError('Такой ник уже занят. Возьмите другой.');
        setProfileInput((current) => ({ ...current, nickname: cleanName }));
        return;
      }

      try {
        const nextProfile = await saveProfile({ nickname: cleanName, telegram: cleanTelegram });
        playerNameRef.current = nextProfile.nickname;
        setProfile(nextProfile);
        setProfileInput({ nickname: nextProfile.nickname, telegram: nextProfile.telegram });
        gameAudio.unlock();
        gameAudio.play('button');
        upsertLeaderboardRecord(nextProfile.nickname, hud.best, hud.stars).then(setLeaderboard);
      } catch (error) {
        const message = String(error.message || '');
        setNameError(message.includes('duplicate') || message.includes('unique') ? 'Такой ник уже занят. Возьмите другой.' : 'Не получилось сохранить профиль.');
      }
    },
    [hud.best, hud.stars, profile?.nickname, profileInput.nickname, profileInput.telegram],
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
          <div className="center-overlay loading-overlay">
            <div className="modal-panel loading-panel">
              <h1>Загрузка</h1>
              <div className="loading-bar" aria-label={`Загрузка ${hud.loadingProgress}%`}>
                <span style={{ width: `${hud.loadingProgress}%` }} />
              </div>
              <strong>{hud.loadingProgress}%</strong>
            </div>
          </div>
        )}

        {screen === 'menu' && hud.ready && (
          <div className="menu-overlay">
            <img className="game-logo" src="/assets/optimized/logo.webp" alt="Побег студентов" />
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
              {profile && (
                <button type="button" className="game-button small" onClick={handleSignOut}>
                  Выйти
                </button>
              )}
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
                  <button type="button" onClick={togglePause}>
                    Продолжить
                  </button>
                  <button type="button" className={soundEnabled ? 'sound-toggle active' : 'sound-toggle'} onClick={toggleSound}>
                    Звук: {soundEnabled ? 'Вкл' : 'Выкл'}
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
              <div className="settings-stack">
                <button type="button" className={soundEnabled ? 'sound-toggle active' : 'sound-toggle'} onClick={toggleSound}>
                  Звук: {soundEnabled ? 'Вкл' : 'Выкл'}
                </button>
                <label className="volume-control track-control">
                  <span>
                    Трек {trackIndex + 1}/10
                    <strong>{musicTracks[trackIndex]}</strong>
                  </span>
                  <input
                    type="range"
                    list="music-track-marks"
                    min="0"
                    max={musicTracks.length - 1}
                    step="1"
                    value={trackIndex}
                    onChange={selectTrack}
                    aria-label="Фоновая музыка"
                  />
                  <datalist id="music-track-marks">
                    {musicTracks.map((track, index) => (
                      <option key={track} value={index} />
                    ))}
                  </datalist>
                </label>
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
          </div>
        )}

        {screen === 'gameOver' && (
          <div className="center-overlay game-over-overlay">
            <div className="result-panel">
              <h1>Игра окончена</h1>
              <span className="result-divider" />
              <span className="result-label">Счёт</span>
              <div className="result-score">{formatScore(hud.distance)}</div>
              <span className="result-label">Лучший результат</span>
              <strong className="result-best">{formatScore(hud.best, 6)}</strong>
              <div className="result-actions">
                <button type="button" className="game-button primary small" onClick={restart}>
                  Заново
                </button>
                <button type="button" className="game-button small" onClick={goToMenu}>
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

        {hud.ready && authReady && !authSession && (
          <div className="center-overlay name-overlay">
            <form className="modal-panel name-panel auth-panel" onSubmit={submitAuth}>
              <h1>{authMode === 'signup' ? 'Регистрация' : 'Вход'}</h1>
              <input
                autoComplete="email"
                placeholder="Email"
                type="email"
                value={authEmail}
                onChange={(event) => {
                  setAuthError('');
                  setAuthEmail(event.target.value);
                }}
                aria-label="Email"
              />
              <input
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                minLength="6"
                placeholder="Пароль"
                type="password"
                value={authPassword}
                onChange={(event) => {
                  setAuthError('');
                  setAuthPassword(event.target.value);
                }}
                aria-label="Пароль"
              />
              {authError && <p className="form-error">{authError}</p>}
              <button type="submit" disabled={!authEmail.trim() || authPassword.length < 6 || isAuthLoading}>
                {isAuthLoading ? 'Подождите...' : authMode === 'signup' ? 'Создать аккаунт' : 'Войти'}
              </button>
              <button type="button" className="google-button" onClick={handleGoogleSignIn} disabled={isAuthLoading}>
                Войти через Google
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setAuthError('');
                  setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                }}
              >
                {authMode === 'signup' ? 'Уже есть аккаунт' : 'Создать аккаунт'}
              </button>
            </form>
          </div>
        )}

        {hud.ready && authReady && authSession && !playerName && (
          <div className="center-overlay name-overlay">
            <form className="modal-panel name-panel profile-panel" onSubmit={submitName}>
              <h1>Профиль</h1>
              <input
                autoFocus
                maxLength="16"
                placeholder="Никнейм"
                value={profileInput.nickname}
                onChange={(event) => {
                  setNameError('');
                  setProfileInput((current) => ({ ...current, nickname: event.target.value }));
                }}
                aria-label="Никнейм"
              />
              <input
                autoComplete="username"
                maxLength="32"
                placeholder="Telegram без @"
                value={profileInput.telegram}
                onChange={(event) => {
                  setNameError('');
                  setProfileInput((current) => ({ ...current, telegram: event.target.value }));
                }}
                aria-label="Telegram"
              />
              {nameError && <p className="form-error">{nameError}</p>}
              <button type="submit" disabled={!profileInput.nickname.trim() || isCheckingName}>
                {isCheckingName ? 'Проверяем...' : 'Готово'}
              </button>
              <button type="button" className="link-button" onClick={handleSignOut}>
                Выйти
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
