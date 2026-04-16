# ElevenLabs Tool Configs — Updated with user_id

## identify_caller (updated with response assignments)

The `called_number` is auto-populated from `system__called_number`. Response assignments set `user_id`, `company_name`, and `customer_name` as dynamic variables.

Add these response assignments to the identify_caller tool:
- `user_id` → `response.user_id`
- `company_name` → `response.business.name`
- `customer_name` → `response.customer.first_name`
- `receptionist_name` → `response.receptionist.name`
- `receptionist_personality` → `response.receptionist.personality`

## get_services (updated)

Add `user_id` as a dynamic variable to the request body:

```json
{
  "id": "user_id",
  "type": "string",
  "value_type": "dynamic_variable",
  "description": "Business user context (set automatically from identify_caller)",
  "dynamic_variable": "user_id",
  "constant_value": "",
  "enum": null,
  "is_system_provided": false,
  "required": false
}
```

## get_business_info (updated)

Add `user_id` as a dynamic variable to the request body:

```json
{
  "id": "user_id",
  "type": "string",
  "value_type": "dynamic_variable",
  "description": "Business user context (set automatically from identify_caller)",
  "dynamic_variable": "user_id",
  "constant_value": "",
  "enum": null,
  "is_system_provided": false,
  "required": false
}
```

## check_availability (updated)

Add `user_id` as a dynamic variable to the request body:

```json
{
  "id": "user_id",
  "type": "string",
  "value_type": "dynamic_variable",
  "description": "Business user context (set automatically from identify_caller)",
  "dynamic_variable": "user_id",
  "constant_value": "",
  "enum": null,
  "is_system_provided": false,
  "required": false
}
```

## create_appointment (updated)

Add `user_id` as a dynamic variable to the request body:

```json
{
  "id": "user_id",
  "type": "string",
  "value_type": "dynamic_variable",
  "description": "Business user context (set automatically from identify_caller)",
  "dynamic_variable": "user_id",
  "constant_value": "",
  "enum": null,
  "is_system_provided": false,
  "required": false
}
```

## lookup_customer (updated)

Add `user_id` as a dynamic variable to the request body:

```json
{
  "id": "user_id",
  "type": "string",
  "value_type": "dynamic_variable",
  "description": "Business user context (set automatically from identify_caller)",
  "dynamic_variable": "user_id",
  "constant_value": "",
  "enum": null,
  "is_system_provided": false,
  "required": false
}
```

## update_customer

Update a customer's contact information when the caller wants to change their phone, email, or address.

```json
{
  "type": "webhook",
  "name": "update_customer",
  "description": "Update a customer's contact information. Use when the caller wants to change their phone number, email, address, or other details.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": "typing",
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://nila-pseudoeconomical-sandi.ngrok-free.dev/api/tools/update-customer",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Customer fields to update",
      "properties": [
        {
          "id": "customer_id",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "The customer's ID (from identify_caller or lookup_customer)",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "name",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's full name",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "phone",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's phone number",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "email",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's email address",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "street_address",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's street address",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's city",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "state",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's state",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "zip_code",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer's zip code",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "content_type": "application/json",
    "auth_connection": null
  },
  "assignments": [],
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

## update_appointment

Reschedule or update an existing appointment. Use when a caller wants to change the date, time, or details of their appointment.

```json
{
  "type": "webhook",
  "name": "update_appointment",
  "description": "Reschedule or update an existing appointment. Use when a caller wants to change the date, time, or details of their appointment.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": "typing",
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://nila-pseudoeconomical-sandi.ngrok-free.dev/api/tools/update-appointment",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "Appointment fields to update",
      "properties": [
        {
          "id": "appointment_id",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "The ID of the appointment to update (UUID from create_appointment response)",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "date",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "New appointment date in YYYY-MM-DD format",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "time",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "New appointment time in HH:MM format (e.g. 14:00 for 2 PM)",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "duration",
          "type": "number",
          "value_type": "llm_prompt",
          "description": "New appointment duration in minutes",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "notes",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Updated notes about the appointment",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "content_type": "application/json",
    "auth_connection": null
  },
  "assignments": [],
  "response_timeout_secs": 25,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```

## create_customer

Add a new customer to the system when an unknown caller wants to book an appointment or needs to be in the database.

```json
{
  "type": "webhook",
  "name": "create_customer",
  "description": "Add a new customer to the system when an unknown caller wants to book or needs to be saved. Use after collecting their name, phone, and any other details.",
  "disable_interruptions": false,
  "force_pre_tool_speech": "auto",
  "tool_call_sound": "typing",
  "tool_call_sound_behavior": "auto",
  "tool_error_handling_mode": "auto",
  "execution_mode": "immediate",
  "api_schema": {
    "url": "https://nila-pseudoeconomical-sandi.ngrok-free.dev/api/tools/create-customer",
    "method": "POST",
    "path_params_schema": [],
    "query_params_schema": [],
    "request_body_schema": {
      "id": "body",
      "type": "object",
      "description": "New customer details",
      "properties": [
        {
          "id": "name",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer full name",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "phone",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer phone number",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": true
        },
        {
          "id": "email",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer email address",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "street_address",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer street address",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "city",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer city",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "state",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer state",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        },
        {
          "id": "zip_code",
          "type": "string",
          "value_type": "llm_prompt",
          "description": "Customer zip code",
          "dynamic_variable": "",
          "constant_value": "",
          "enum": null,
          "is_system_provided": false,
          "required": false
        }
      ],
      "required": false,
      "value_type": "llm_prompt"
    },
    "request_headers": [],
    "content_type": "application/json",
    "auth_connection": null
  },
  "assignments": [
    {
      "dynamic_variable": "customer_name",
      "value_path": "response.customer.name"
    },
    {
      "dynamic_variable": "customer_id",
      "value_path": "response.customer.id"
    }
  ],
  "response_timeout_secs": 20,
  "dynamic_variables": {
    "dynamic_variable_placeholders": {}
  },
  "response_mocks": []
}
```
