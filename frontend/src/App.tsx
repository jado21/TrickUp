import { Brand, PixelIcon } from "./components/Brand";
import { CourseCreationPage } from "./courses/CourseCreationPage";
import { loadSelectedCourse, selectCourse, loadCourses } from "./courses/course-storage";
import type { CreatedCourse } from "./courses/types";
import { LearningMapPage } from "./learning-map/LearningMapPage";
import { FirstMissionPage } from "./first-mission/FirstMissionPage";
import { StudentExperienceProvider, useStudentExperience } from "./student/StudentExperience";
import { DashboardPage } from "./student/DashboardPage";
import { PreferencesPage } from "./student/PreferencesPage";
import { recordCourseAccess } from "./student/progress-service";
import { resolveScreen, routeFor, type AppScreen } from "./navigation";
import { useEffect, useMemo, useState } from "react";
import { initialAnswers, goals, motivations, difficulties, gameOptions, timeOptions, toneOptions, careerOptions, stepMeta, type Answers, type Option } from "./onboarding-data";
import { loadSession, saveSession, validStep, createProfile, label } from "./profile-storage";

type Screen = AppScreen;
function PixelScene() {
  return (
    <div className="pixel-scene" aria-hidden="true">
      <div className="moon">
        <span />
      </div>
      <i className="star s1" />
      <i className="star s2" />
      <i className="star s3" />
      <i className="star s4" />
      <i className="star s5" />
      <div className="floating-book">
        <span />
        <span />
      </div>
      <div className="planet">
        <i />
      </div>
      <div className="mountain m1" />
      <div className="mountain m2" />
      <div className="mountain m3" />
      <div className="path-tile p1" />
      <div className="path-tile p2" />
      <div className="path-tile p3" />
      <div className="path-tile p4" />
      <div className="hero-character">
        <i className="head" />
        <i className="body" />
        <i className="pack" />
      </div>
      <div className="ground ground-back" />
      <div className="ground ground-front" />
    </div>
  );
}

function Welcome({ onStart, onAccount }: { onStart: () => void; onAccount: () => void }) {


  return (
    <main className="welcome">
      <PixelScene />
      <nav className="welcome-nav">
        <Brand compact />
        <span className="nav-status">
          <i /> NUEVA PARTIDA
        </span>
      </nav>
      <section className="welcome-content">
        <div className="eyebrow">
          <span>01</span> TU AVENTURA COMIENZA AQUÍ
        </div>
        <Brand />
        <h1>
          Tu aprendizaje.
          <br />
          Tu aventura.
          <br />
          <em>Tu siguiente nivel.</em>
        </h1>
        <p>Convierte cada curso en una misión y avanza a tu ritmo, una victoria a la vez.</p>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={onStart}>
            <span>COMENZAR AVENTURA</span>
            <b>→</b>
          </button>
          <button className="btn btn-ghost" onClick={onAccount}>
            YA TENGO UNA CUENTA
          </button>
        </div>
        <div className="key-hint">
          <kbd>↵</kbd> PRESIONA PARA COMENZAR
        </div>
      </section>
      <div className="corner-label">
        TEMPORADA 01 <span>•</span> 2025
      </div>
    </main>
  );
}

function SelectCard({
  option,
  selected,
  disabled,
  onClick,
  index,
}: {
  option: Option;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      className={`option-card ${selected ? "selected" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="option-number">0{index + 1}</span>
      <span className="icon-box">
        <PixelIcon name={option.icon} />
      </span>
      <span className="option-copy">
        <strong>{option.title}</strong>
        {option.description && <small>{option.description}</small>}
      </span>
      <span className="select-mark">{selected ? "✓" : ""}</span>
    </button>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <footer className="progress-wrap">
      <div className="progress-meta">
        <span>PROGRESO DE MISIÓN</span>
        <b>Paso {step + 1} de 8</b>
      </div>
      <div className="segments" aria-label={`Paso ${step + 1} de 8`}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={i < step ? "done" : i === step ? "current" : ""}>
            <i />
          </span>
        ))}
      </div>
    </footer>
  );
}

function Onboarding({
  answers,
  setAnswers,
  onFinish,
  onExit,
}: {
  answers: Answers;
  setAnswers: React.Dispatch<React.SetStateAction<Answers>>;
  onFinish: () => void;
  onExit: () => void;
}) {
  const [step, setStep] = useState(() => loadSession().step);
  useEffect(() => { saveSession({ ...loadSession(), answers, step, screen: "onboarding" }); }, [answers, step]);
  const [direction, setDirection] = useState<"next" | "back">("next");
  const [error, setError] = useState(false);

  const valid = useMemo(() => validStep(answers, step), [answers, step]);

  const update = <K extends keyof Answers>(key: K, value: Answers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setError(false);
  };

  const next = () => {
    if (!valid) {
      setError(true);
      return;
    }
    if (step === 7) return onFinish();
    setDirection("next");
    setStep((s) => s + 1);
    setError(false);
  };

  const back = () => {
    if (step === 0) return onExit();
    setDirection("back");
    setStep((s) => s - 1);
    setError(false);
  };

  const singleCards = (
    items: Option[],
    key: "goal" | "motivation" | "difficulty" | "time" | "tone",
  ) => (
    <div className={`options-grid ${items.length === 5 ? "options-grid--five" : ""}`}>
      {items.map((option, i) => (
        <SelectCard
          key={option.id}
          option={option}
          index={i}
          selected={answers[key] === option.id}
          onClick={() => update(key, option.id)}
        />
      ))}
    </div>
  );

  return (
    <main className="onboarding-shell">
      <header className="topbar">
        <button className="logo-button" onClick={onExit} aria-label="Volver al inicio">
          <Brand compact />
        </button>
        <div className="session-tag">
          <span /> CONFIGURANDO PERFIL
        </div>
      </header>
      <section key={step} className={`question-panel animate-${direction}`}>
        <div className="step-label">
          <span>{String(step + 1).padStart(2, "0")}</span> / 08 — {stepMeta[step][0]}
        </div>
        <h1>{stepMeta[step][1]}</h1>
        <p className="question-help">{stepMeta[step][2]}</p>

        <div className="answer-area">
          {step === 0 && (
            <div className="identity-card">
              <label htmlFor="name">TU NOMBRE O APODO</label>
              <div className="input-wrap">
                <span className="input-icon">Aa</span>
                <input
                  id="name"
                  autoFocus
                  maxLength={28}
                  value={answers.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Ej. Alex"
                  onKeyDown={(e) => e.key === "Enter" && next()}
                />
                <span className="char-count">{answers.name.length}/28</span>
              </div>
              <p>Así te llamaremos durante tus misiones.</p>
            </div>
          )}
          {step === 1 && (
            <div className="academic-card">
              <div>
                <label htmlFor="career">CARRERA UNIVERSITARIA</label>
                <div className="select-wrap">
                  <select
                    id="career"
                    value={answers.career}
                    onChange={(e) => update("career", e.target.value)}
                  >
                    <option value="">Selecciona tu carrera</option>
                    {careerOptions.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <span>⌄</span>
                </div>
                {answers.career === "Otra" && <input aria-label="Tu carrera" maxLength={100} placeholder="Escribe tu carrera" value={answers.otherCareer} onChange={e => update("otherCareer", e.target.value)} />}
              </div>
              <div>
                <label htmlFor="cycle">CICLO ACADÉMICO</label>
                <div className="cycle-grid" id="cycle">
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).concat("Otro").map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      aria-pressed={answers.cycle === cycle}
                      className={answers.cycle === cycle ? "selected" : ""}
                      onClick={() => update("cycle", cycle)}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
                {answers.cycle === "Otro" && <input aria-label="Tu ciclo académico" maxLength={50} placeholder="Ej. semestre 12" value={answers.otherCycle} onChange={e => update("otherCycle", e.target.value)} />}
              </div>
            </div>
          )}
          {step === 2 && singleCards(goals, "goal")}
          {step === 3 && singleCards(motivations, "motivation")}
          {step === 4 && singleCards(difficulties, "difficulty")}
          {step === 5 && (
            <>
              <div className="selection-counter">
                <span>{answers.games.length}</span> / 2 SELECCIONADOS
              </div>
              <div className="options-grid options-grid--five">
                {gameOptions.map((option, i) => {
                  const selected = answers.games.includes(option.id);
                  return (
                    <SelectCard
                      key={option.id}
                      option={option}
                      index={i}
                      selected={selected}
                      disabled={!selected && answers.games.length >= 2}
                      onClick={() =>
                        update(
                          "games",
                          selected
                            ? answers.games.filter((x) => x !== option.id)
                            : [...answers.games, option.id],
                        )
                      }
                    />
                  );
                })}
              </div>
            </>
          )}
          {step === 6 && singleCards(timeOptions, "time")}
          {step === 7 && (
            <>
              {singleCards(toneOptions, "tone")}
              <div role="status" className={`message-preview ${answers.tone ? "visible" : ""}`}>
                <div className="avatar-mini">
                  <span>T</span>
                </div>
                <div>
                  <small>VISTA PREVIA DE TRIKUP</small>
                  <p>
                    “
                    {toneOptions.find((x) => x.id === answers.tone)?.preview ||
                      "Selecciona un estilo para escuchar la voz de TriKUp."}
                    ”
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="question-actions">
          <button className="btn-back" onClick={back}>
            ← <span>VOLVER</span>
          </button>
          {error && (
            <span className="validation-message" role="alert">
              Completa esta misión para continuar.
            </span>
          )}
          <button
            className={`btn btn-primary btn-continue ${!valid ? "inactive" : ""}`}
            disabled={!valid}
            onClick={next}
          >
            <span>{step === 7 ? "CREAR MI PERFIL" : "CONTINUAR"}</span>
            <b>→</b>
          </button>
        </div>
      </section>
      <Progress step={step} />
    </main>
  );
}

function Completion({
  answers,
  onEnter,
  onRestart,
}: {
  answers: Answers;
  onEnter: () => void;
  onRestart: () => void;
}) {
  const { snapshot } = useStudentExperience();
  const rows = [
    ["CARRERA", answers.career === "Otra" ? answers.otherCareer : answers.career],
    ["CICLO", `${answers.cycle}.º ciclo`],
    ["MISIÓN PRINCIPAL", answers.goal],
    ["DESAFÍOS FAVORITOS", answers.games.map(id => label(gameOptions, id)).join(" + ")],
    ["RITMO", label(timeOptions, answers.time)],
    ["VOZ DE TRIKUP", label(toneOptions, answers.tone)],
  ];
  return (
    <main className="complete-screen">
      <div className="celebration" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <header>
        <Brand compact />
        <span>PERFIL DE JUGADOR CREADO</span>
      </header>
      <section className="complete-content">
        <div className="complete-badge">
          <PixelIcon name="spark" />
        </div>
        <div className="step-label success-label">MISIÓN COMPLETADA</div>
        <h1>
          ¡TU AVENTURA
          <br />
          <em>ESTÁ LISTA!</em>
        </h1>
        <p>TriKUp ha configurado tu experiencia inicial.</p>
        <article className="player-card">
          <div className="card-top">
            <div className="avatar-large">
              <span>{answers.name.charAt(0).toUpperCase()}</span>
              <i />
            </div>
            <div>
              <small>AVENTURERO/A</small>
              <h2>{answers.name}</h2>
              <div className="level-pill">
                NIVEL {snapshot.level}{" "}
                <span>
                  <i />
                </span>
              </div>
            </div>
            <div className="class-mark">
              <PixelIcon name="compass" />
              <small>EXPLORADOR</small>
            </div>
          </div>
          <div className="stats-grid">
            {rows.map(([label, value], i) => (
              <div key={label} className={i === 3 ? "wide" : ""}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="card-footer">
            <span />
            <b>PERFIL INICIAL</b>
            <span />
          </div>
        </article>
        <button className="btn btn-primary enter-button" onClick={onEnter}>
          <span>ENTRAR A MI AVENTURA</span>
          <b>→</b>
        </button>
        <button className="restart-link" onClick={onRestart}>
          EDITAR PERFIL
        </button>
      </section>
    </main>
  );
}

export default function App() {
  const [saved] = useState(loadSession);
  const [screen, setScreen] = useState<Screen>(() => resolveScreen(window.location.hash, saved.screen === 'adventure' ? 'dashboard' : saved.screen, Array.from({ length: 8 }, (_, i) => validStep(saved.answers, i)).every(Boolean)));
  const [mapCourse, setMapCourse] = useState(loadSelectedCourse);
  const [celebrateUnlock, setCelebrateUnlock] = useState(false);
  const [resumeNodeId, setResumeNodeId] = useState<string>();
  const [coursePreview, setCoursePreview] = useState<CreatedCourse>();
  const [answers, setAnswers] = useState<Answers>(saved.answers);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!saveSession({ ...loadSession(), answers, screen: ['map', 'mission', 'dashboard', 'settings'].includes(screen) ? 'adventure' : screen as 'welcome' | 'onboarding' | 'complete' | 'adventure' })) setNotice("El navegador no permite guardar datos. El avance durará esta sesión.");
  }, [answers, screen]);
  const complete = Array.from({ length: 8 }, (_, i) => validStep(answers, i)).every(Boolean);
  const profile = complete ? createProfile(answers) : undefined;
  const navigate = (next: Screen) => {
    if (window.location.hash !== routeFor(next)) window.history.pushState(null, '', routeFor(next));
    setScreen(next);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const syncRoute = () => {
      const hash = window.location.hash;
      setScreen(resolveScreen(hash, 'welcome', complete));
      if (hash === '#/courses/map' || hash === '#/courses/map/poo') setMapCourse(current => loadSelectedCourse() ?? current);
    };
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => { window.removeEventListener('popstate', syncRoute); window.removeEventListener('hashchange', syncRoute); };
  }, [complete]);
  useEffect(() => { window.history.replaceState(null, '', routeFor(screen)); }, [screen]);
  const restart = () => { setAnswers({ ...initialAnswers, games: [] }); saveSession({ answers: initialAnswers, step: 0, screen: "onboarding" }); navigate("onboarding"); };
  const openMap = (course: CreatedCourse, nodeId?: string) => {
    setMapCourse(course);
    setResumeNodeId(nodeId);
    recordCourseAccess(course.id);
    if (!selectCourse(course.id) || !loadCourses().some(savedCourse => savedCourse.id === course.id)) setNotice('Este curso no se pudo guardar. El mapa está disponible durante esta sesión.');
    navigate('map');
  };
  const openCourse = (course: CreatedCourse, nodeId?: string) => {
    if (course.catalogId === 'demo-programming-1') { openMap(course, nodeId); return; }
    selectCourse(course.id); recordCourseAccess(course.id); setCoursePreview(course); navigate('adventure');
  };
  const navigation = {
    onDashboard: () => navigate('dashboard'), onSettings: () => navigate('settings'),
    onCourses: () => { setCoursePreview(undefined); navigate('adventure'); }, onCourse: openCourse,
    onSaveProfile: (next: Answers) => { setAnswers(next); return saveSession({ ...loadSession(), answers: next, profile: createProfile(next), screen: 'adventure' }); },
  };
  return <StudentExperienceProvider profile={profile} screen={screen} navigation={navigation}>
    {screen === "welcome" && <Welcome onStart={() => navigate("onboarding")} onAccount={() => {
      if (loadSession().profile) { setAnswers(loadSession().profile!.answers); navigate("complete"); }
      else setNotice("No hay un perfil completo guardado en este navegador. Comienza tu aventura; no se utiliza una cuenta real.");
    }} />}
    {screen === "onboarding" && <Onboarding answers={answers} setAnswers={setAnswers} onFinish={() => { saveSession({ ...loadSession(), answers, screen: "complete", profile: createProfile(answers) }); navigate("complete"); }} onExit={() => navigate("welcome")} />}
    {screen === "complete" && <Completion answers={answers} onEnter={() => { saveSession({ ...loadSession(), profile: createProfile(answers), screen: "adventure" }); navigate("dashboard"); }} onRestart={() => { saveSession({ ...loadSession(), step: 0 }); navigate("onboarding"); }} />}
    {screen === "dashboard" && profile && <DashboardPage />}
    {screen === "settings" && profile && <PreferencesPage />}
    {screen === "adventure" && profile && <CourseCreationPage profile={profile} initialCourse={coursePreview} onProfile={() => navigate('complete')} onOpenMap={openMap} />}
    {screen === "map" && profile && <LearningMapPage profile={profile} course={mapCourse} resumeNodeId={resumeNodeId} celebrateUnlock={celebrateUnlock} onPlayFirstMission={() => { setCelebrateUnlock(false); navigate('mission'); }} onCourses={() => { setCoursePreview(undefined); navigate('adventure'); }} />}
    {screen === "mission" && profile && <FirstMissionPage profile={profile} course={mapCourse} onMap={completed => { setCelebrateUnlock(completed); navigate('map'); }} />}
    {(screen === "onboarding" || screen === "complete") && <button className="reset-control" onClick={restart}>REINICIAR ONBOARDING</button>}
    {notice && <div className="toast show" role="status">{notice}<button onClick={() => setNotice("")} aria-label="Cerrar aviso">×</button></div>}
  </StudentExperienceProvider>;
}



