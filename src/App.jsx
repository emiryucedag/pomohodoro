import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Maximize, Minimize, Headphones, CheckCircle2, ListOrdered, FastForward, Trash2, Moon, Sun } from 'lucide-react';
import { synth } from './audio';
import TimelinePlanner from './TimelinePlanner';
import './index.css';

function App() {
  // === CONFIG STATE (Standalone Mode) ===
  const [workConfig, setWorkConfig] = useState({ h: 0, m: 25, s: 0 });
  const [breakConfig, setBreakConfig] = useState({ h: 0, m: 5, s: 0 });

  // === PLANNER SEQUENCE STATE ===
  const [showPlanner, setShowPlanner] = useState(false);
  const [sequence, setSequence] = useState(() => {
    return JSON.parse(localStorage.getItem('pomohodoro_sequence')) || [];
  });
  const [seqIndex, setSeqIndex] = useState(() => {
    const saved = parseInt(localStorage.getItem('pomohodoro_seq_index'));
    return isNaN(saved) ? -1 : saved;
  });
  const [globalTargetSeconds, setGlobalTargetSeconds] = useState(() => {
    const saved = parseInt(localStorage.getItem('pomohodoro_global_limit'));
    return isNaN(saved) ? 0 : saved;
  });

  // === BULLETPROOF TIMER STATE ===
  // timeLeft is essentially how many seconds are left in the current phase/block visually.
  const [timeLeft, setTimeLeft] = useState(workConfig.m * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessionType, setSessionTypeState] = useState('work');

  const setSessionType = (type) => {
    sessionTypeRef.current = type;
    setSessionTypeState(type);
  };

  // Precise Tracking Refs
  const currentBlockActualDurationRef = useRef(workConfig.m * 60); // Total intended seconds for this block
  const blockStartTimeRef = useRef(null); // Timestamp when 'Start' or 'Continue' was clicked
  const accumulatedElapsedBeforePauseRef = useRef(0); // If paused, how many seconds were already done?
  const sessionTypeRef = useRef('work'); // Sync ref to avoid closure issues in callbacks

  // === FOCUS MODE ===
  const [focusMode, setFocusMode] = useState(false);
  const [focusBgColor, setFocusBgColor] = useState('#1e293b');
  const focusColors = ['#1e293b', '#0f172a', '#450a0a', '#064e3b', '#1e3a8a', '#3b0764'];

  // === THEME STATE ===
  const [theme, setTheme] = useState(() => localStorage.getItem('pomohodoro_theme') || 'dark');

  // === POPUP & CONFIRM STATE ===

  const [finishPopup, setFinishPopup] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // === AUDIO STATE ===
  const [noiseActive, setNoiseActive] = useState(false);
  const [noiseVolume, setNoiseVolume] = useState(0.5);

  // === PERSISTENT TOTAL ===
  const [totalFocusTime, setTotalFocusTime] = useState(() => {
    const saved = parseInt(localStorage.getItem('pomohodoro_total_time'));
    return isNaN(saved) ? 0 : saved;
  });

  const intervalRef = useRef(null);

  // === EFFECTS ===
  // Theme Effect
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    localStorage.setItem('pomohodoro_theme', theme);
  }, [theme]);

  useEffect(() => {

    if (focusMode) {
      document.body.classList.add('focus-mode');
      document.body.style.backgroundColor = focusBgColor;
    } else {
      document.body.classList.remove('focus-mode');
      document.body.style.backgroundColor = '';
    }
  }, [focusMode, focusBgColor]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' || Notification.permission === 'prompt') {
        Notification.requestPermission();
      }
    }
  }, []);

  // Sync to physical storage
  useEffect(() => localStorage.setItem('pomohodoro_total_time', totalFocusTime), [totalFocusTime]);
  useEffect(() => localStorage.setItem('pomohodoro_sequence', JSON.stringify(sequence)), [sequence]);
  useEffect(() => localStorage.setItem('pomohodoro_seq_index', seqIndex.toString()), [seqIndex]);
  useEffect(() => localStorage.setItem('pomohodoro_global_limit', globalTargetSeconds.toString()), [globalTargetSeconds]);

  // Audio Playback
  useEffect(() => {
    if (noiseActive) {
      synth.play(noiseVolume);
    } else {
      synth.stop();
    }
  }, [noiseActive]);

  useEffect(() => {
    synth.setVolume(noiseVolume);
  }, [noiseVolume]);

  // Handle sequence index changes (loading the block naturally)
  useEffect(() => {
    // If we are actively running, don't auto-override unless deliberate.
    // We also do not want to override if we are currently PAUSED mid-session.
    if (!isActive && accumulatedElapsedBeforePauseRef.current === 0) {
      if (seqIndex >= 0 && seqIndex < sequence.length) {
        const block = sequence[seqIndex];
        const secs = block.durationMinutes * 60;
        setSessionType(block.type);
        setTimeLeft(secs);
        currentBlockActualDurationRef.current = secs;
        accumulatedElapsedBeforePauseRef.current = 0;
      } else {
        // Standalone config load
        if (sessionType === 'work') {
          const secs = (workConfig.h * 3600) + (workConfig.m * 60) + workConfig.s;
          setTimeLeft(secs);
          currentBlockActualDurationRef.current = secs;
        } else {
          const secs = (breakConfig.h * 3600) + (breakConfig.m * 60) + breakConfig.s;
          setTimeLeft(secs);
          currentBlockActualDurationRef.current = secs;
        }
        accumulatedElapsedBeforePauseRef.current = 0;
      }
    }
  }, [seqIndex, sequence, workConfig, breakConfig, sessionType, isActive]);


  // Timer Engine (Timestamp Delta based)
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const physicalElapsedSinceStart = Math.max(0, (now - blockStartTimeRef.current) / 1000);
        const totalElapsedSoFar = accumulatedElapsedBeforePauseRef.current + physicalElapsedSinceStart;

        const remaining = currentBlockActualDurationRef.current - totalElapsedSoFar;

        if (remaining <= 0) {
          // HIT ZERO NATURALLY
          clearInterval(intervalRef.current);
          setTimeLeft(0);

          setFinishPopup({
            title: sessionTypeRef.current === 'work' ? "Focus Completed!" : "Break Over!",
            message: sessionTypeRef.current === 'work'
              ? "Congratulations! You successfully finished the session."
              : "Your break is over. Get ready for the next task.",
            type: sessionTypeRef.current
          });

          finalizeAndAdvanceRef.current(currentBlockActualDurationRef.current); // Use latest ref to avoid closure bugs
        } else {
          setTimeLeft(Math.ceil(remaining)); // Ceil for better visual (doesn't hit 0 until actually 0)
        }
      }, 200); // Faster tick for smoother response
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]); // Only depend on isActive


  // === CORE BUSINESS LOGIC ACTIONS ===

  const startTimer = () => {
    if (!isActive) {
      blockStartTimeRef.current = Date.now();
      setIsActive(true);
    }
  };

  const pauseTimer = () => {
    if (!isActive) return;
    setIsActive(false);
    clearInterval(intervalRef.current);

    // Calculate exact physical seconds since latest start
    const physicalElapsedSinceStart = (Date.now() - blockStartTimeRef.current) / 1000;
    accumulatedElapsedBeforePauseRef.current += physicalElapsedSinceStart;

    // UI reflects the exact current state
    setTimeLeft(Math.ceil(currentBlockActualDurationRef.current - accumulatedElapsedBeforePauseRef.current));
  };

  const resetTotalTime = () => {
    setConfirmDialog({
      message: "Are you sure you want to reset all focus history? This action cannot be undone.",
      onConfirm: () => {
        setTotalFocusTime(0);
        setConfirmDialog(null);
      }
    });
  };

  const finalizeAndAdvance = (exactElapsedTotal) => {
    setIsActive(false);
    accumulatedElapsedBeforePauseRef.current = 0; // Reset for next block

    const currentST = sessionTypeRef.current;

    if (currentST === 'work' && exactElapsedTotal > 0) {
      setTotalFocusTime(prev => {
        const safePrev = parseInt(prev) || 0;
        return safePrev + Math.round(exactElapsedTotal);
      });
    }

    if (seqIndex >= 0) {
      if (seqIndex + 1 < sequence.length) {
        setSeqIndex(seqIndex + 1);
      } else {
        setSeqIndex(-1);
        setFinishPopup({
          title: "Plan Completed!",
          message: "Great job! You have successfully completed the entire plan.",
          type: "complete"
        });
      }
    } else {
      // Standalone toggle
      setSessionType(currentST === 'work' ? 'break' : 'work');
    }
  };

  const finalizeAndAdvanceRef = useRef(finalizeAndAdvance);
  useEffect(() => {
    finalizeAndAdvanceRef.current = finalizeAndAdvance;
  });

  const finishEarly = () => {
    let totalElapsed = accumulatedElapsedBeforePauseRef.current;
    if (isActive) {
      const physicalElapsedSinceStart = (Date.now() - blockStartTimeRef.current) / 1000;
      totalElapsed += physicalElapsedSinceStart;
    }
    // Optimization: avoid going over maximum
    totalElapsed = Math.min(totalElapsed, currentBlockActualDurationRef.current);

    // In many cases, we want to confirm if finishing very early
    if (totalElapsed < 5 && totalElapsed > 0) {
      setConfirmDialog({
        message: "You've just started this session. Are you sure you want to finish it early?",
        onConfirm: () => {
          finalizeAndAdvance(totalElapsed);
          setConfirmDialog(null);
        }
      });
      return;
    }

    finalizeAndAdvance(totalElapsed);
  };


  const switchPhaseStandlone = (type) => {
    if (isActive) return;
    if (accumulatedElapsedBeforePauseRef.current > 0) {
      setConfirmDialog({
        message: "Your current session is paused. Switching will reset your progress. Do you want to continue?",
        onConfirm: () => {
          accumulatedElapsedBeforePauseRef.current = 0;
          setSeqIndex(-1);
          setSessionType(type);
          setConfirmDialog(null);
        }
      });
      return;
    }
    accumulatedElapsedBeforePauseRef.current = 0;
    setSeqIndex(-1);
    setSessionType(type);
  };

  const updateConfig = (type, field, val) => {
    const num = Math.max(0, parseInt(val) || 0);
    if (isActive || accumulatedElapsedBeforePauseRef.current > 0) {
      setConfirmDialog({
        message: "Changing the duration while active will reset your current progress. Are you sure?",
        onConfirm: () => {
          applyConfigChange(type, field, num);
          setConfirmDialog(null);
        }
      });
      return;
    }
    applyConfigChange(type, field, num);
  };

  const applyConfigChange = (type, field, num) => {
    accumulatedElapsedBeforePauseRef.current = 0;
    setSeqIndex(-1);
    if (type === 'work') {
      setWorkConfig(prev => ({ ...prev, [field]: num }));
    } else {
      setBreakConfig(prev => ({ ...prev, [field]: num }));
    }
  };

  const applySequence = (data) => {
    // Clear any active accumulation so the new sequence starts fresh
    accumulatedElapsedBeforePauseRef.current = 0;
    setIsActive(false);

    if (Array.isArray(data)) {
      setSequence(data);
      if (data.length > 0) {
        setSeqIndex(0);
        setGlobalTargetSeconds(data.reduce((acc, b) => acc + b.durationMinutes * 60, 0));
      } else {
        setSeqIndex(-1);
        setGlobalTargetSeconds(0);
      }
    } else if (data && data.blocks) {
      setSequence(data.blocks);
      setGlobalTargetSeconds(data.globalLimitMinutes * 60);
      if (data.blocks.length > 0) {
        setSeqIndex(0);
      } else {
        setSeqIndex(-1);
      }
    } else {
      setSequence([]);
      setSeqIndex(-1);
      setGlobalTargetSeconds(0);
    }
  };

  // === UI HELPER VALUES ===

  // Calc live elapsed progress across the ENTIRE sequence
  let totalSeqSeconds = globalTargetSeconds || 0;
  if (totalSeqSeconds === 0 && sequence.length > 0) {
    totalSeqSeconds = sequence.reduce((acc, b) => acc + (b.durationMinutes * 60), 0);
  }

  let elapsedSeqSeconds = 0;
  if (seqIndex >= 0 && sequence.length > 0) {
    // Add up everything BEFORE the current block
    for (let i = 0; i < seqIndex; i++) {
      elapsedSeqSeconds += (sequence[i].durationMinutes * 60);
    }

    // Add exact live elapsed of current block
    let currentBlockElapsed = accumulatedElapsedBeforePauseRef.current;
    if (isActive) {
      currentBlockElapsed += (Date.now() - blockStartTimeRef.current) / 1000;
    }
    elapsedSeqSeconds += Math.min(currentBlockElapsed, sequence[seqIndex].durationMinutes * 60); // Cap at max
  }

  // === FORMATTING ===
  const formatDisplayTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTotalTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const renderConfigUi = () => {
    if (seqIndex >= 0) {
      const block = sequence[seqIndex];
      return (
        <div className="timer-config" style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ color: 'var(--accent-color)', fontWeight: '600', marginBottom: '8px' }}>
            Planned Sequence Active
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
            {block.title} <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>• Block {seqIndex + 1} of {sequence.length}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="timer-config">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <button
            className={sessionType === 'work' ? 'active-tab' : ''}
            onClick={() => switchPhaseStandlone('work')}
          >Work</button>
          <button
            className={sessionType === 'break' ? 'active-tab-break' : ''}
            onClick={() => switchPhaseStandlone('break')}
          >Break</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
          <div className="config-label-sub" style={{ marginBottom: '8px' }}>Duration:</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input type="number" className="input-field" style={{ width: '70px', textAlign: 'center' }} value={sessionType === 'work' ? workConfig.h : breakConfig.h} onChange={(e) => updateConfig(sessionType, 'h', e.target.value)} />
              <span className="config-label-sub">Hr</span>
            </div>
            <div style={{ fontWeight: 'bold' }}>:</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input type="number" className="input-field" style={{ width: '70px', textAlign: 'center' }} value={sessionType === 'work' ? workConfig.m : breakConfig.m} onChange={(e) => updateConfig(sessionType, 'm', e.target.value)} />
              <span className="config-label-sub">Min</span>
            </div>
            <div style={{ fontWeight: 'bold' }}>:</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <input type="number" className="input-field" style={{ width: '70px', textAlign: 'center' }} value={sessionType === 'work' ? workConfig.s : breakConfig.s} onChange={(e) => updateConfig(sessionType, 's', e.target.value)} />
              <span className="config-label-sub">Sec</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <TimelinePlanner
        isOpen={showPlanner}
        onClose={() => setShowPlanner(false)}
        originalSequence={sequence}
        onSaveSequence={applySequence}
      />

      {/* Global Header */}
      <header className="app-header hide-in-focus">
        {/* Left: Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <img src="./logo.png" alt="Pomohodoro Logo" style={{ height: '50px', objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ fontSize: '2.5rem', fontFamily: '"Outfit", sans-serif', fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: 'var(--text-primary)', lineHeight: 1 }}>
              Pomo<span style={{ color: 'var(--accent-color)' }}>hodor</span>o
            </h1>
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--accent-color)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>Hold the Focus</span>
          </div>
        </div>

        {/* Right: Theme Toggle & Total Focus Box */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{ padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}
            title="Change Theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: 'var(--bg-secondary)', padding: '12px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-subtle)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total Focus</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success-color)' }}>
                {formatTotalTime(totalFocusTime)}
              </span>
            </div>
            <button
              onClick={resetTotalTime}
              style={{ background: 'transparent', border: 'none', color: 'var(--danger-color)', padding: '5px', borderRadius: '50%' }}
              title="Reset"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <div className="app-container">

        {/* Panel 1: Main Timer */}
        <div className="minimal-panel timer-box" style={{ flex: 1 }}>

          <div className="panel-header hide-in-focus">
            <span>{sessionType === 'work' ? 'Focus Session' : 'Break Time'}</span>
            <button onClick={() => setFocusMode(true)} title="Enter Focus Mode" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
              <Maximize size={16} /> Focus Mode
            </button>
          </div>

          {/* Config Area */}
          {(!isActive) && renderConfigUi()}

          {/* Timer Digits */}
          <div className={`timer-display ${sessionType === 'break' ? 'break-text' : ''}`}>
            {formatDisplayTime(timeLeft)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {!isActive ? (
              <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
                <button className="primary" onClick={startTimer} style={{ flex: 1, padding: '16px', fontSize: '1.2rem', fontWeight: 600 }}>
                  <Play size={22} /> {accumulatedElapsedBeforePauseRef.current > 0 ? 'Continue' : 'Start'}
                </button>
                {accumulatedElapsedBeforePauseRef.current > 0 && (
                  <button className="secondary" onClick={finishEarly} style={{ flex: 1, padding: '16px', fontSize: '1rem', fontWeight: 600 }}>
                    <CheckCircle2 size={20} /> Complete
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '15px', width: '100%' }}>
                <button className="secondary" onClick={pauseTimer} style={{ flex: 1, padding: '16px', fontSize: '1.2rem', fontWeight: 600 }}>
                  <Pause size={22} /> Pause
                </button>
                <button className="danger" onClick={finishEarly} style={{ padding: '16px' }} title="Finish Block Early & Add Elapsed Time">
                  <FastForward size={22} />
                </button>
              </div>
            )}

            {/* Focus Mode exit and config */}
            {focusMode && (
              <div style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => setFocusMode(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
                  <Minimize size={16} /> Exit Focus Mode
                </button>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {focusColors.map(color => (
                    <div
                      key={color}
                      style={{
                        width: '30px', height: '30px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
                        border: focusBgColor === color ? '2px solid white' : '2px solid transparent'
                      }}
                      onClick={() => setFocusBgColor(color)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Stats & Plan (Hidden in Focus) */}
        <div className="hide-in-focus right-column" style={{ display: focusMode ? 'none' : 'flex', flexDirection: 'column', gap: '40px', flex: 1 }}>

          <div className="minimal-panel" style={{ flex: 1 }}>
            <h2 className="panel-header" style={{ margin: 0, marginBottom: '20px' }}>Session Plan</h2>

            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.5' }}>
              Plan your exact day dynamically. Build a sequence of blocks, and the timer will seamlessly guide you through them.
            </p>

            <button onClick={() => setShowPlanner(true)} className="primary" style={{ width: '100%', marginBottom: '30px' }}>
              <ListOrdered size={20} /> Plan Your Tasks {sequence.length > 0 ? `(${sequence.length} blocks)` : ''}
            </button>

            {/* Dynamic Sequence Preview inside the panel */}
            {sequence.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Upcoming Plan:</span>
                  {seqIndex >= 0 && <button style={{ padding: '4px 8px', fontSize: '0.8rem' }} className="danger" onClick={() => applySequence([])}>Cancel Plan</button>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                  {sequence.map((block, idx) => (
                    <div key={block.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                      borderLeft: `4px solid ${block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)'}`,
                      opacity: (seqIndex > idx) ? 0.4 : 1, // Dim passed ones faintly
                      border: seqIndex === idx ? '1px solid var(--accent-color)' : '1px solid transparent'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {seqIndex > idx ? <CheckCircle2 size={18} color="var(--success-color)" /> : <span style={{ color: 'var(--text-secondary)' }}>{idx + 1}.</span>}
                        <span style={{ fontWeight: seqIndex === idx ? 600 : 400 }}>{block.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {block.description && <span style={{ fontStyle: 'italic', fontSize: '0.8rem', marginRight: '6px' }}>"{block.description}"</span>}
                        {block.durationMinutes}m
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sweeping Live Timeline at Bottom if sequence exists */}
      {
        !focusMode && sequence.length > 0 && seqIndex >= 0 && (
          <div style={{
            width: '100%', maxWidth: '1200px', margin: '40px auto 0 auto',
            padding: '24px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '0.9rem', fontWeight: 600 }}>
              <span>Session Live Progress</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {formatDisplayTime(elapsedSeqSeconds)} / {formatDisplayTime(totalSeqSeconds)}
              </span>
            </div>
            <div className="timeline-bar-container" style={{ position: 'relative' }}>
              {sequence.map((block, i) => {
                const percWidth = ((block.durationMinutes * 60) / totalSeqSeconds) * 100;
                return (
                  <div
                    key={block.id}
                    style={{
                      width: `${percWidth}%`,
                      height: '100%',
                      background: block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)',
                      borderRight: i === sequence.length - 1 ? 'none' : '2px solid var(--bg-primary)',
                      opacity: 0.2 // Base faded blocks
                    }}
                    title={`${block.title} - ${block.durationMinutes}m`}
                  />
                );
              })}

              {/* Sweeping Active Overlay Bar */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, height: '100%',
                width: `${(elapsedSeqSeconds / totalSeqSeconds) * 100}%`,
                background: 'rgba(255,255,255,0.4)',
                borderRight: '3px solid white',
                mixBlendMode: 'overlay',
                transition: 'width 0.5s linear',
                boxShadow: '0 0 10px rgba(255,255,255,0.5)'
              }}>
              </div>

              {/* Solid Completed + Active Overlay directly rendering over faded */}
              {sequence.map((block, i) => {
                const percWidth = ((block.durationMinutes * 60) / totalSeqSeconds) * 100;

                // calculate left starting percentage
                let leftOffsetPerc = 0;
                for (let j = 0; j < i; j++) leftOffsetPerc += ((sequence[j].durationMinutes * 60) / totalSeqSeconds) * 100;

                let fillWidth = 0;
                if (seqIndex > i) {
                  fillWidth = percWidth; // fully solid
                } else if (seqIndex === i) {
                  let currentBlockElapsed = accumulatedElapsedBeforePauseRef.current;
                  if (isActive) currentBlockElapsed += Math.floor((Date.now() - blockStartTimeRef.current) / 1000);
                  fillWidth = (currentBlockElapsed / totalSeqSeconds) * 100;
                }

                if (fillWidth === 0) return null;

                return (
                  <div
                    key={`fill-${block.id}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: `${leftOffsetPerc}%`,
                      width: `${fillWidth}%`,
                      height: '100%',
                      background: block.type === 'work' ? 'var(--accent-color)' : 'var(--accent-break)',
                      borderRight: i === sequence.length - 1 ? 'none' : '2px solid var(--bg-primary)',
                      borderTopRightRadius: seqIndex === i ? '8px' : '0',
                      borderBottomRightRadius: seqIndex === i ? '8px' : '0',
                      transition: 'width 0.5s linear'
                    }}
                  />
                );
              })}
            </div>
          </div>
        )
      }

      {/* Focus Audio Bottom Bar */}
      <div className={`audio-controls ${focusMode ? 'hide-in-focus' : ''}`} style={{
        position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--bg-secondary)', padding: '12px 24px', borderRadius: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '20px',
        border: '1px solid var(--border-color)', zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: noiseActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          <Headphones size={20} />
          <span style={{ fontWeight: 500 }}>Focus Noise</span>
        </div>

        <button
          className={noiseActive ? 'active-tab' : ''}
          style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }}
          onClick={() => setNoiseActive(!noiseActive)}
        >
          {noiseActive ? 'Enabled' : 'Disabled'}
        </button>

        {noiseActive && (
          <div className="audio-slider-container">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={noiseVolume}
              onChange={(e) => setNoiseVolume(parseFloat(e.target.value))}
            />
          </div>
        )}
      </div>
      {/* FINISH POPUP */}
      {
        finishPopup && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
          }}>
            <div className="minimal-panel" style={{ textAlign: 'center', padding: '50px', maxWidth: '450px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <h2 style={{ fontSize: '2.5rem', marginBottom: '20px', color: finishPopup.type === 'work' || finishPopup.type === 'complete' ? 'var(--success-color)' : 'var(--accent-color)' }}>
                {finishPopup.title}
              </h2>
              <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '40px', lineHeight: '1.6' }}>
                {finishPopup.message}
              </p>
              <button className="primary" onClick={() => setFinishPopup(null)} style={{ width: '100%', padding: '16px', fontSize: '1.2rem', borderRadius: 'var(--radius-md)' }}>
                Got it
              </button>
            </div>
          </div>
        )
      }

      {/* CONFIRM DIALOG POPUP */}
      {
        confirmDialog && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
          }}>
            <div className="minimal-panel" style={{ textAlign: 'center', padding: '40px', maxWidth: '400px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Are you sure?</h2>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '30px', lineHeight: '1.5' }}>
                {confirmDialog.message}
              </p>
              <div style={{ display: 'flex', gap: '15px' }}>
                <button className="secondary" onClick={() => setConfirmDialog(null)} style={{ flex: 1, padding: '14px', fontSize: '1.1rem' }}>
                  Cancel
                </button>
                <button className="danger" onClick={confirmDialog.onConfirm} style={{ flex: 1, padding: '14px', fontSize: '1.1rem' }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
}

export default App;
