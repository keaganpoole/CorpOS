[
  {
    "table": "appointments",
    "field": "id",
    "type": "uuid",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "client_name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "date",
    "type": "date",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "time",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "duration",
    "type": "integer",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "status",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "assigned_receptionist",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "notes",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "scenario_id",
    "type": "uuid",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "created_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "appointments",
    "field": "user_id",
    "type": "uuid",
    "fk_reference": "users.id"
  },
  {
    "table": "appointments",
    "field": "person_id",
    "type": "bigint",
    "fk_reference": "people.id"
  },
  {
    "table": "appointments",
    "field": "service_id",
    "type": "uuid",
    "fk_reference": "services.id"
  },
  {
    "table": "appointments",
    "field": "business_id",
    "type": "bigint",
    "fk_reference": "businesses.id"
  },
  {
    "table": "businesses",
    "field": "id",
    "type": "bigint",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "phone",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "email",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "address",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "city",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "state",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "zip",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "website",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "about_us",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "policies",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "faq",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "business_hours",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "created_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "updated_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "businesses",
    "field": "user_id",
    "type": "uuid",
    "fk_reference": "users.id"
  },
  {
    "table": "hired_receptionists",
    "field": "id",
    "type": "bigint",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "catalog_id",
    "type": "bigint",
    "fk_reference": "receptionist_catalog.id"
  },
  {
    "table": "hired_receptionists",
    "field": "full_name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "description",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "stereotype",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "avatar",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "traits",
    "type": "jsonb",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "voice",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "age",
    "type": "numeric",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "first_name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "elevenlabs_voice_id",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "call_types",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "phone_number",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "is_active",
    "type": "boolean",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "language_model",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "status",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "current_activity",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "total_calls",
    "type": "integer",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "hired_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "hired_receptionists",
    "field": "user_id",
    "type": "uuid",
    "fk_reference": "users.id"
  },
  {
    "table": "hired_receptionists",
    "field": "business_id",
    "type": "bigint",
    "fk_reference": "businesses.id"
  },
  {
    "table": "payments",
    "field": "id",
    "type": "uuid",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "user_id",
    "type": "uuid",
    "fk_reference": "users.id"
  },
  {
    "table": "payments",
    "field": "person_id",
    "type": "bigint",
    "fk_reference": "people.id"
  },
  {
    "table": "payments",
    "field": "appointment_id",
    "type": "uuid",
    "fk_reference": "appointments.id"
  },
  {
    "table": "payments",
    "field": "scenario_id",
    "type": "uuid",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "stripe_payment_intent_id",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "stripe_session_id",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "amount",
    "type": "bigint",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "currency",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "status",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "payment_method",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "description",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "receipt_url",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "refunded_amount",
    "type": "bigint",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "error_message",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "metadata",
    "type": "jsonb",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "created_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "updated_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "payments",
    "field": "business_id",
    "type": "bigint",
    "fk_reference": "businesses.id"
  },
  {
    "table": "people",
    "field": "id",
    "type": "bigint",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "created_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "first_name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_name",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "phone",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "email",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "street_address",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "city",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "state",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "zip_code",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "preferred_contact_method",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "preferred_language",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "best_time_to_contact",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "consent_sms",
    "type": "boolean",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "consent_call",
    "type": "boolean",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "do_not_call",
    "type": "boolean",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "do_not_text",
    "type": "boolean",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "status",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "source",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "lead_source_detail",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "tags",
    "type": "ARRAY",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "updated_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_inbound_call_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_outbound_call_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_call_status",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_intent",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_outcome",
    "type": "text",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "missed_call_count",
    "type": "integer",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_inbound_sms_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  },
  {
    "table": "people",
    "field": "last_outbound_sms_at",
    "type": "timestamp with time zone",
    "fk_reference": ""
  }
]