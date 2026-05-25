/**
 * CallerService — People table operations for call handling
 */

class CallerService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Find a caller by phone number.
   * Tries exact match first, then strips formatting and retries.
   */
  async findByPhone(phone) {
    if (!phone) return null;

    // Normalize: strip +1, dashes, parens, spaces
    const normalized = phone.replace(/[\s\-\(\)\+]/g, '');
    // Try last 10 digits match
    const last10 = normalized.slice(-10);

    const { data, error } = await this.supabase
      .from('people')
      .select('*')
      .or(`phone.ilike.%${last10}%,phone.ilike.%${normalized}%`)
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[CallerService] Lookup failed:', error.message);
      return null;
    }

    return data;
  }

  /**
   * Update a caller's record after a call.
   */
  async updateAfterCall(leadId, updates) {
    const { error } = await this.supabase
      .from('people')
      .update(updates)
      .eq('id', leadId);

    if (error) {
      console.error('[CallerService] Post-call update failed:', error.message);
    }
  }

  /**
   * Append a note to a caller's existing notes.
   */
  async appendNote(leadId, note) {
    // Fetch current notes
    const { data, error: fetchError } = await this.supabase
      .from('people')
      .select('notes')
      .eq('id', leadId)
      .single();

    if (fetchError) {
      console.error('[CallerService] Note fetch failed:', fetchError.message);
      return;
    }

    const existing = data?.notes || '';
    const updated = existing ? `${existing}\n${note}` : note;

    const { error } = await this.supabase
      .from('people')
      .update({ notes: updated })
      .eq('id', leadId);

    if (error) {
      console.error('[CallerService] Note append failed:', error.message);
    }
  }
}

module.exports = { CallerService };
