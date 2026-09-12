// Recipients stored on a Category can be a plain email address or a dynamic
// token that only resolves once we know which student — and therefore which
// school — the request came from. This keeps one category ("Academic Support")
// routable to whichever dean actually owns that student.

const DYNAMIC_RECIPIENTS = {
  '@dean': { label: 'Respective Dean', field: 'deanEmail' },
  '@hod': { label: 'Respective HOD', field: 'hodEmail' },
};

const isDynamic = (value) =>
  Object.prototype.hasOwnProperty.call(DYNAMIC_RECIPIENTS, String(value || '').trim());

const labelFor = (value) => {
  const key = String(value || '').trim();
  return DYNAMIC_RECIPIENTS[key] ? DYNAMIC_RECIPIENTS[key].label : key;
};

/**
 * Turn a stored recipient list (emails + @dean/@hod tokens) into real addresses
 * for one school. Tokens the school has no contact for are dropped rather than
 * failing the request — a missing HOD should not block a student.
 * Deduplicated case-insensitively so listing both "@dean" and the dean's literal
 * address doesn't send twice.
 */
const resolveRecipients = (list, school) => {
  const out = [];

  for (const entry of list || []) {
    const raw = String(entry || '').trim();
    if (!raw) continue;

    const dynamic = DYNAMIC_RECIPIENTS[raw];
    const email = dynamic ? school?.[dynamic.field] : raw;
    if (!email) continue;

    const clean = String(email).trim();
    if (!clean) continue;
    if (!out.some((e) => e.toLowerCase() === clean.toLowerCase())) out.push(clean);
  }

  return out;
};

/** Drop one address from a resolved list — used to keep an actor off their own FYI copy. */
const excludeEmail = (list, email) => {
  if (!email) return [...(list || [])];
  const lower = String(email).toLowerCase();
  return (list || []).filter((e) => String(e).toLowerCase() !== lower);
};

/** Loose but practical address check for addresses typed into the forward form. */
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

module.exports = { DYNAMIC_RECIPIENTS, isDynamic, labelFor, resolveRecipients, excludeEmail, isEmail };
