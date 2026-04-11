/**
 * Seed Data — Bootstrap essentials only
 * No fake tasks, agents, events, or logs.
 * Real data enters through OpenClaw runtime bridge + user actions.
 */

function seedData(db, events) {
  // Nothing to seed — all operational data comes from real runtime actions.
  // control_state is already created by schema.js init.
  console.log('[SONAR] DB ready. No seed data — awaiting real events.');
}

module.exports = { seedData };
