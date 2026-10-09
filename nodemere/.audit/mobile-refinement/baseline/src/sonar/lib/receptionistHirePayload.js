export function receptionistHirePayload(receptionist) {
  if (!receptionist || typeof receptionist !== 'object') return { catalog_id: receptionist };
  if (receptionist.created_receptionist_id != null) {
    return { source: 'created_receptionist', created_receptionist_id: receptionist.created_receptionist_id };
  }
  if (receptionist.custom_voice_id != null) {
    return { source: receptionist.source || 'voice_clone', custom_voice_id: receptionist.custom_voice_id };
  }
  const catalogId = receptionist.catalog_id ?? receptionist.catalogId ?? receptionist.receptionist_catalog_id ?? receptionist.id;
  return { catalog_id: catalogId, id: catalogId, source: receptionist.source };
}
