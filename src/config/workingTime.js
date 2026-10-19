// Weekend- and holiday-aware SLA arithmetic.
//
// A concern raised at 4pm on Friday with a 48-hour window used to fall due at
// 4pm on Sunday — before anyone had a single working hour in which to act, so
// it escalated against a desk that was never open. Windows are therefore
// counted in *working* time: a non-working day contributes nothing, so Friday
// plus two days lands on Tuesday.
//
// Only whole days are modelled, not office hours. The university's response
// windows are measured in days for departments and a few hours for the desk,
// and a half-day model would make a 3-hour desk window behave unpredictably
// across a lunch break. Weekends and declared holidays are the thing people
// actually mean by "that shouldn't count".
//
// India observes no daylight saving, so a local day is always exactly 24h and
// midnight arithmetic needs no DST correction.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// A runaway guard: if every day were somehow non-working, the walk below would
// never terminate. 800 days is far past any real window.
const MAX_DAYS_WALKED = 800;

const DEFAULT_WORKING_TIME = {
  enabled: true,
  // JS getDay(): 0 Sun … 6 Sat. Monday–Friday.
  workingDays: [1, 2, 3, 4, 5],
  // Declared holidays as 'YYYY-MM-DD' in the timezone below.
  holidays: [],
  timezone: 'Asia/Kolkata',
};

const formatterCache = new Map();
const partsFormatter = (timezone) => {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(timezone, new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }));
  }
  return formatterCache.get(timezone);
};

/** Local calendar date and clock for an instant, in the configured timezone. */
const localParts = (ms, timezone) => {
  const p = {};
  for (const { type, value } of partsFormatter(timezone).formatToParts(new Date(ms))) {
    if (type !== 'literal') p[type] = value;
  }
  // 'en-CA' renders midnight as 24 rather than 00 in some runtimes.
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    // Date.UTC on the local Y/M/D gives that calendar date's weekday.
    weekday: new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay(),
    msIntoDay: ((hour * 60 + Number(p.minute)) * 60 + Number(p.second)) * 1000 + (ms % 1000),
  };
};

const normalise = (config = {}) => {
  const cfg = { ...DEFAULT_WORKING_TIME, ...config };
  const days = Array.isArray(cfg.workingDays)
    ? cfg.workingDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  return {
    enabled: cfg.enabled !== false,
    // An empty or broken list would mean "no day ever counts"; fall back rather
    // than freeze every clock in the system.
    workingDays: days.length ? [...new Set(days)] : DEFAULT_WORKING_TIME.workingDays,
    holidays: new Set(Array.isArray(cfg.holidays) ? cfg.holidays : []),
    timezone: cfg.timezone || DEFAULT_WORKING_TIME.timezone,
  };
};

/** Does this instant fall on a day the university is working? */
const isWorkingDay = (ms, config) => {
  const cfg = normalise(config);
  if (!cfg.enabled) return true;
  const { date, weekday } = localParts(ms, cfg.timezone);
  return cfg.workingDays.includes(weekday) && !cfg.holidays.has(date);
};

/**
 * `start` advanced by `hours` of working time.
 *
 * Time on a non-working day is not consumed: a window that starts on Friday
 * afternoon resumes on Monday morning with whatever was left of it.
 */
const addWorkingHours = (start, hours, config) => {
  const cfg = normalise(config);
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  let remaining = Number(hours) * HOUR_MS;

  if (!cfg.enabled || !(remaining > 0)) return startMs + Math.max(0, remaining || 0);

  let t = startMs;
  for (let guard = 0; guard < MAX_DAYS_WALKED; guard += 1) {
    const { date, weekday, msIntoDay } = localParts(t, cfg.timezone);
    const nextMidnight = t + (DAY_MS - msIntoDay);

    if (cfg.workingDays.includes(weekday) && !cfg.holidays.has(date)) {
      const availableToday = nextMidnight - t;
      if (availableToday >= remaining) return t + remaining;
      remaining -= availableToday;
    }
    t = nextMidnight;
  }
  // Pathological config (every day a holiday) — degrade to plain wall clock
  // rather than returning a deadline centuries away.
  return startMs + Number(hours) * HOUR_MS;
};

/**
 * Working milliseconds elapsed between two instants — the inverse of
 * `addWorkingHours`, used to judge whether a window was actually met.
 */
const workingMsBetween = (from, to, config) => {
  const cfg = normalise(config);
  const fromMs = from instanceof Date ? from.getTime() : Number(from);
  const toMs = to instanceof Date ? to.getTime() : Number(to);
  if (!(toMs > fromMs)) return 0;
  if (!cfg.enabled) return toMs - fromMs;

  let t = fromMs;
  let total = 0;
  for (let guard = 0; guard < MAX_DAYS_WALKED; guard += 1) {
    const { date, weekday, msIntoDay } = localParts(t, cfg.timezone);
    const nextMidnight = t + (DAY_MS - msIntoDay);
    const segmentEnd = Math.min(nextMidnight, toMs);

    if (cfg.workingDays.includes(weekday) && !cfg.holidays.has(date)) {
      total += segmentEnd - t;
    }
    if (segmentEnd >= toMs) return total;
    t = nextMidnight;
  }
  return total;
};

const workingHoursBetween = (from, to, config) => workingMsBetween(from, to, config) / HOUR_MS;

module.exports = {
  DEFAULT_WORKING_TIME,
  isWorkingDay,
  addWorkingHours,
  workingMsBetween,
  workingHoursBetween,
  HOUR_MS,
};
