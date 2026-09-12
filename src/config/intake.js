// Every student request lands on one desk first. That person triages it and
// forwards it on to whoever should actually handle it, rather than the category
// deciding the route up front.
const INTAKE_EMAIL = (process.env.DSW_EMAIL || 'onestopsolution@mru.edu.in').trim().toLowerCase();

// Shown to students and in email copy, so the desk reads as a role rather than
// a raw mailbox.
const INTAKE_LABEL = process.env.DSW_LABEL || 'Dean of Student Welfare';

module.exports = { INTAKE_EMAIL, INTAKE_LABEL };
