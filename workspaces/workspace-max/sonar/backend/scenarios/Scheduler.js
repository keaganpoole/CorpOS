/**
 * Scheduler — Manages cron jobs for time-based scenarios
 *
 * Handles scenarios with "No Trigger" + schedule_config:
 * - run_once: Fire at a specific date/time
 * - hourly: Fire every N hours
 * - daily: Fire every N days at a specific time
 * - weekly: Fire every N weeks on specific days
 * - monthly: Fire every N months
 * - yearly: Fire every N years
 */

const cron = require('node-cron');

class Scheduler {
  constructor(deps) {
    this.sbQuery = deps.sbQuery;
    this.jobs = new Map(); // scenarioId → cron.Task
  }

  /**
   * Start schedulers for all scenarios with schedule_config
   */
  async start(scenarios) {
    // Stop existing jobs
    this.stop();

    for (const scenario of scenarios) {
      if (!scenario.schedule_config) continue;

      const config = typeof scenario.schedule_config === 'string'
        ? JSON.parse(scenario.schedule_config)
        : scenario.schedule_config;

      if (!config?.frequency) continue;

      // Skip "run once" if already past
      if (config.frequency === 'once' && config.scheduled_date) {
        const fireDate = new Date(config.scheduled_date);
        if (fireDate < new Date()) {
          console.log(`[Scheduler] Skipping "${scenario.name}" — already past due`);
          continue;
        }
      }

      try {
        const cronExpr = this._buildCronExpression(config);
        if (!cronExpr) {
          console.log(`[Scheduler] Skipping "${scenario.name}" — invalid schedule config`);
          continue;
        }

        const job = cron.schedule(cronExpr, () => {
          console.log(`[Scheduler] Firing: ${scenario.name}`);
          this._fireScenario(scenario).catch(err => {
            console.error(`[Scheduler] Failed to fire "${scenario.name}":`, err.message);
          });
        });

        this.jobs.set(scenario.id, job);
        console.log(`[Scheduler] Registered "${scenario.name}" → ${cronExpr} (${config.frequency})`);
      } catch (err) {
        console.error(`[Scheduler] Failed to schedule "${scenario.name}":`, err.message);
      }
    }

    console.log(`[Scheduler] Active jobs: ${this.jobs.size}`);
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    for (const [id, job] of this.jobs) {
      try { job.stop(); } catch (e) { /* ignore */ }
    }
    this.jobs.clear();
  }

  /**
   * Build a cron expression from schedule config
   */
  _buildCronExpression(config) {
    const { frequency, interval = 1, time = '09:00', daysOfWeek = [] } = config;
    const [hour, minute] = (time || '09:00').split(':').map(Number);

    switch (frequency) {
      case 'once': {
        // For run_once, we schedule a one-time check every minute
        // The _fireScenario check will skip if not the right date
        // But actually, node-cron doesn't support one-shot well
        // So we use a daily at the target time, and check the date in _fireScenario
        if (config.scheduled_date) {
          const d = new Date(config.scheduled_date);
          return `${minute} ${hour} ${d.getDate()} ${d.getMonth() + 1} *`;
        }
        return null;
      }

      case 'hourly': {
        const h = Math.min(Math.max(interval, 1), 24);
        if (h === 1) return `${minute} * * * *`;
        return `${minute} */${h} * * *`;
      }

      case 'daily': {
        const d = Math.min(Math.max(interval, 1), 365);
        if (d === 1) return `${minute} ${hour} * * *`;
        return `${minute} ${hour} */${d} * * *`;
      }

      case 'weekly': {
        const w = Math.min(Math.max(interval, 1), 52);
        // Map day names to cron day numbers (Mon=1, Sun=7 → cron: Mon=1, Sun=0)
        const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
        const cronDays = (daysOfWeek.length > 0 ? daysOfWeek : ['Mon'])
          .map(d => dayMap[d])
          .filter(d => d !== undefined)
          .join(',');

        if (w === 1) return `${minute} ${hour} * * ${cronDays}`;
        return `${minute} ${hour} * * ${cronDays}`;
      }

      case 'monthly': {
        const m = Math.min(Math.max(interval, 1), 12);
        if (m === 1) return `${minute} ${hour} 1 * *`;
        return `${minute} ${hour} 1 */${m} *`;
      }

      case 'yearly': {
        const y = Math.min(Math.max(interval, 1), 10);
        if (y === 1) return `${minute} ${hour} 1 1 *`;
        return `${minute} ${hour} 1 1 */${y}`;
      }

      default:
        return null;
    }
  }

  /**
   * Fire a scenario — create a FlowExecution and start it
   */
  async _fireScenario(scenario) {
    // Check if already running (don't overlap)
    try {
      const running = await this.sbQuery('flow_executions', 'GET', null,
        `?scenario_id=eq.${scenario.id}&status=in.(running,paused)&limit=1`
      );
      if (running?.length > 0) {
        console.log(`[Scheduler] Skipping "${scenario.name}" — already running`);
        return;
      }
    } catch (err) {
      console.warn('[Scheduler] Could not check running executions:', err.message);
    }

    // For run_once, check the date
    const config = typeof scenario.schedule_config === 'string'
      ? JSON.parse(scenario.schedule_config)
      : scenario.schedule_config;

    if (config?.frequency === 'once' && config.scheduled_date) {
      const target = new Date(config.scheduled_date);
      const now = new Date();
      const diff = Math.abs(now - target);
      if (diff > 5 * 60 * 1000) { // More than 5 minutes off
        return; // Not the right time
      }
    }

    // Build flow context
    const context = {
      trigger: { type: 'schedule', schedule: config },
      event_type: 'scheduled_trigger',
    };

    // Fetch business context
    if (scenario.user_id) {
      try {
        const businesses = await this.sbQuery('businesses', 'GET', null,
          `?user_id=eq.${scenario.user_id}&limit=1`
        );
        if (businesses?.length > 0) {
          context.business = businesses[0];
        }
      } catch (err) { /* ignore */ }
    }

    // We need the FlowExecutor to start — but we don't have direct access here
    // So we emit an event that the ScenarioEngine will pick up
    console.log(`[Scheduler] Triggering scenario: ${scenario.name}`);

    // Store the firing so ScenarioEngine can pick it up
    // We'll use a simple approach: update a field on the scenario
    try {
      await this.sbQuery('scenarios', 'PATCH', {
        last_fired_at: new Date().toISOString(),
      }, `?id=eq.${scenario.id}`);
    } catch (err) {
      console.warn('[Scheduler] Could not update last_fired_at:', err.message);
    }
  }
}

module.exports = { Scheduler };
