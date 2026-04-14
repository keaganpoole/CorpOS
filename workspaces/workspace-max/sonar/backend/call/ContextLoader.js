/**
 * ContextLoader — Loads all business context for the receptionist
 *
 * Pulls settings, knowledge base, and services from Supabase
 * so the LLM has full business context during calls.
 */

class ContextLoader {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Load everything the receptionist needs to know.
   * Returns { settings, knowledge, services }.
   */
  async loadAll() {
    const [settings, knowledge, services] = await Promise.all([
      this.loadSettings(),
      this.loadKnowledgeBase(),
      this.loadServices(),
    ]);

    return { settings, knowledge, services };
  }

  /**
   * Load account settings (business info, hours, etc.)
   */
  async loadSettings() {
    try {
      const { data, error } = await this.supabase
        .from('account_settings')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || {};
    } catch (err) {
      console.error('[ContextLoader] Settings load failed:', err.message);
      return {};
    }
  }

  /**
   * Load knowledge base documents.
   * Stored as JSON object in account_settings.knowledge_base.
   */
  async loadKnowledgeBase() {
    try {
      const settings = await this.loadSettings();
      return settings.knowledge_base || {};
    } catch (err) {
      console.error('[ContextLoader] Knowledge base load failed:', err.message);
      return {};
    }
  }

  /**
   * Load active services.
   */
  async loadServices() {
    try {
      const { data, error } = await this.supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('[ContextLoader] Services load failed:', err.message);
      return [];
    }
  }
}

module.exports = { ContextLoader };
