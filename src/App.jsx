import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { startGlass } from "./glass.js";

const QUICK = [5, 10, 15, 20, 25, 30, 35, 40, 45];

// One spring for everything that moves; a slightly bouncier one for things popping in and out.
const SPRING = { type: "spring", visualDuration: 0.4, bounce: 0.15 };
const POP = { type: "spring", visualDuration: 0.3, bounce: 0.35 };

function gcd(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }

function pct(v, total) {
  const p = Math.round((v / total) * 1000) / 10;
  if (p === 0) return "<0.1%";
  if (p === 100) return ">99.9%";
  return String(p % 1 === 0 ? p.toFixed(0) : p.toFixed(1)) + "%";
}

// Each entry: { frac: [n, d] | null, pct: string }
function compute(list) {
  const out = new Array(list.length);
  let tail = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    tail += list[i];
    if (i === list.length - 1) { out[i] = { frac: null, pct: "100%" }; continue; }
    const g = gcd(list[i], tail);
    out[i] = { frac: [list[i] / g, tail / g], pct: pct(list[i], tail) };
  }
  return out;
}

function numSize(len) { return len <= 3 ? 28 : len === 4 ? 24 : len === 5 ? 20 : 17; }
function fracSize(len) { return len <= 3 ? 13 : len === 4 ? 12 : 11; }

// Changes that resize the display (calculate, reset, clear, picking from history) run as a View
// Transition: React commits once, the glass re-renders once at the final layout, and the browser
// animates snapshots on the compositor instead of re-rendering every glass surface each frame.
// Number entry stays on Motion, since it rarely moves anything with glass on it.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let running = null;

function morph(update) {
  if (!document.startViewTransition || reducedMotion.matches) { update(); return; }
  running?.skipTransition();
  const vt = document.startViewTransition(() => flushSync(update));
  running = vt;
  vt.finished.finally(() => { if (running === vt) running = null; });
}

let nextId = 1;
const item = (v) => ({ id: nextId++, v });

// Each number carries a view-transition-name, so it flies from its chip to its result row.
const vtName = (s) => ({ viewTransitionName: "n" + s.id });

function Chips({ seq }) {
  return (
    <div className="chips">
      <AnimatePresence mode="popLayout" initial={false}>
        {seq.map((s, i) => (
          <motion.span
            key={s.id}
            className="item"
            layout
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: POP }}
            transition={POP}
          >
            {i > 0 && <span className="sep">›</span>}
            <span className="chip">
              <span style={vtName(s)}>{s.v}</span>
            </span>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

const rowPart = {
  hidden: { opacity: 0, x: 12 },
  show: (i) => ({ opacity: 1, x: 0, transition: { ...SPRING, delay: 0.05 + i * 0.04 } }),
};

function Rows({ seq, result }) {
  return (
    <div className="rows">
      {seq.map((s, i) => {
        const r = result[i];
        const text = String(s.v);
        return (
          <motion.div key={s.id} className="row" initial="hidden" animate="show" custom={i}>
            <div className="num" style={{ fontSize: numSize(text.length) }}><span style={vtName(s)}>{text}</span></div>
            <motion.div className="lead" variants={rowPart} custom={i} />
            <motion.div className="pct" variants={rowPart} custom={i}>{r.pct}</motion.div>
            {r.frac ? (
              <motion.div
                className="frac"
                variants={rowPart}
                custom={i}
                style={{ fontSize: fracSize(Math.max(String(r.frac[0]).length, String(r.frac[1]).length)) }}
              >
                <div>{r.frac[0]}</div>
                <div className="bar" />
                <div>{r.frac[1]}</div>
              </motion.div>
            ) : (
              <motion.div className="all" variants={rowPart} custom={i}>ALL</motion.div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function History({ open, entries, onPick, onClose }) {
  const [shown, setShown] = useState(false);
  const listRef = useRef(null);
  if (open && !shown) setShown(true);

  useLayoutEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open]);

  return (
    <motion.div
      className="history"
      role="dialog"
      aria-modal="true"
      aria-label="기록"
      hidden={!shown}
      data-glass-scene=""
      initial={false}
      animate={{ opacity: open ? 1 : 0 }}
      transition={SPRING}
      onAnimationComplete={() => { if (!open) setShown(false); }}
    >
      <div className="backdrop" data-glass-content="" />
      <div className="history-cap" />
      <div className="history-list" ref={listRef}>
        {!entries.length && <div className="history-empty">아직 기록이 없어요</div>}
        {shown && entries.map((h, i) => (
          <motion.button
            key={h.id}
            type="button"
            className="entry-card"
            data-glass=""
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...POP, delay: Math.max(0, entries.length - 1 - i) * 0.03 }}
            onClick={() => onPick(h)}
          >
            <div className="entry-seq">
              {h.seq.map((v, j) => (
                <Fragment key={j}>
                  {j > 0 && <i>›</i>}
                  <span>{v}</span>
                </Fragment>
              ))}
            </div>
          </motion.button>
        ))}
      </div>
      <div className="history-foot" data-glass-scene="">
        <div className="backdrop" data-glass-content="" />
        <button className="main" data-glass="" type="button" onClick={onClose}>닫기</button>
      </div>
    </motion.div>
  );
}

function Screen({ children }) {
  return (
    <section className="screen" aria-live="polite">
      <div className="screen-inner">{children}</div>
    </section>
  );
}

export function App() {
  const [seq, setSeq] = useState([]);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]); // oldest first, memory only
  const [historyOpen, setHistoryOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => { startGlass(); }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setHistoryOpen(false); };
    const noZoom = (e) => e.preventDefault();
    document.addEventListener("keydown", onKey);
    document.addEventListener("gesturestart", noZoom);
    document.addEventListener("gesturechange", noZoom);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("gesturestart", noZoom);
      document.removeEventListener("gesturechange", noZoom);
    };
  }, []);

  function append(n) {
    if (result) morph(() => { setSeq([item(n)]); setResult(null); });
    else setSeq((prev) => [...prev, item(n)]);
  }

  function undo() {
    if (result) morph(() => setResult(null));
    else setSeq((prev) => prev.slice(0, -1));
  }

  function clear() { morph(() => { setSeq([]); setResult(null); }); }

  function main() {
    if (result) { clear(); return; }
    if (!seq.length) return;
    const values = seq.map((s) => s.v);
    const r = compute(values);
    morph(() => {
      setResult(r);
      setHistory((prev) => [...prev, { id: nextId++, seq: values, result: r }]);
    });
  }

  function pick(h) {
    morph(() => {
      setSeq(h.seq.map(item));
      setResult(h.result);
      setHistoryOpen(false);
    });
  }

  const value = parseInt(text, 10) || 0;
  const empty = seq.length === 0;

  function submit(e) {
    e.preventDefault();
    if (!(value > 0)) return;
    append(value);
    setText("");
  }

  return (
    <MotionConfig reducedMotion="user" transition={SPRING}>
      <div className="app" data-glass-scene="">
        <div className="backdrop" data-glass-content="" />
        <Screen>
          {result ? <Rows seq={seq} result={result} /> : !empty && <Chips seq={seq} />}
        </Screen>

        <div className="pad">
          <div className="top-actions">
            <button className="btn" data-glass="" type="button" disabled={empty} onClick={undo}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z" />
                <path d="M11.5 9.5l5 5M16.5 9.5l-5 5" />
              </svg>
              <span>실행 취소</span>
            </button>
            <button className="btn danger" data-glass="" type="button" disabled={empty} onClick={clear}>지우기</button>
            <button className="btn icon" data-glass="circle" type="button" aria-label="기록" onClick={() => setHistoryOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3.5 2" />
              </svg>
            </button>
          </div>
        </div>

        <div className="spacer" />

        <div className="pad">
          <form className="entry" autoComplete="off" onSubmit={submit}>
            <div className="field-wrap" data-glass="">
              <input
                className="field"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                enterKeyHint="done"
                placeholder="직접 입력하기"
                aria-label="직접 입력하기"
                value={text}
                onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            {/* Keep focus (and the on-screen keyboard) in the field when tapping add. */}
            <button className="add" data-glass="" type="submit" disabled={!(value > 0)} onPointerDown={(e) => e.preventDefault()}>추가</button>
          </form>

          <div className="quick">
            {QUICK.map((n) => (
              <button key={n} className="btn" data-glass="" type="button" onClick={() => append(n)}>{n}</button>
            ))}
          </div>

          <button className="main" data-glass="" type="button" disabled={!result && empty} onClick={main}>
            {result ? "초기화" : "계산하기"}
          </button>
        </div>
      </div>

      <History open={historyOpen} entries={history} onPick={pick} onClose={() => setHistoryOpen(false)} />
    </MotionConfig>
  );
}
