import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@2.0.0'
import { z } from 'npm:zod@4.3.6'

const API_BASE = (Deno.env.get('NODEMERE_API_BASE') || 'https://nodemere-backend.onrender.com').replace(/\/$/, '')
const json = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }] })
const RESOURCE_METADATA = 'https://grpgmhhtmfiwukncucaq.supabase.co/functions/v1/nodemere-mcp/oauth-protected-resource'

function registerTool(server: McpServer, request: Request, name: string, config: Record<string, unknown>, run: (args: any) => Promise<any>) {
  server.registerTool(name, {
    ...config,
    _meta: {
      ...(config._meta as Record<string, unknown> | undefined),
      securitySchemes: [{ type: 'oauth2', scopes: ['email'] }],
    },
  } as any, async (args: any) => {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return authRequired()
    try {
      return await run(args)
    } catch (error) {
      if ((error as { status?: number })?.status === 401) return authRequired()
      return { content: [{ type: 'text', text: error instanceof Error ? error.message : 'Nodemere request failed' }], isError: true }
    }
  })
}

function authRequired() {
  return {
    content: [{ type: 'text' as const, text: 'Connect your Nodemere account to use this tool.' }],
    isError: true,
    _meta: {
      'mcp/www_authenticate': [
        `Bearer resource_metadata="${RESOURCE_METADATA}", error="invalid_token", error_description="Sign in to Nodemere to access this tool"`,
      ],
    },
  }
}

function makeApi(request: Request) {
  const authorization = request.headers.get('authorization') || ''
  return async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { Authorization: authorization, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : `Nodemere request failed (${response.status})`
      const error = new Error(detail) as Error & { status: number }
      error.status = response.status
      throw error
    }
    return data
  }
}

const uuid = z.string().uuid()
const personFields = {
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.email().max(254).optional(),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().max(4000).optional(),
}
const appointmentFields = {
  person_id: uuid,
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(5).max(480),
  service_id: z.union([uuid, z.number().int().positive()]).optional(),
  staff_id: z.union([uuid, z.number().int().positive()]).optional(),
  notes: z.string().max(2000).optional(),
}

Deno.serve(async (request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    if (request.method === 'GET' && new URL(request.url).pathname.endsWith('/oauth-protected-resource')) {
      return Response.json({
        resource: 'https://grpgmhhtmfiwukncucaq.supabase.co/functions/v1/nodemere-mcp',
        authorization_servers: ['https://grpgmhhtmfiwukncucaq.supabase.co/auth/v1'],
        bearer_methods_supported: ['header'],
      }, { headers: corsHeaders })
    }
    if (request.method !== 'POST' && request.method !== 'GET' && request.method !== 'DELETE') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders })
    }
    const api = makeApi(request)
    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: 'nodemere', version: '0.1.0' })
      registerTool(server, request, 'get_workspace', {
        description: 'Identify the signed-in Nodemere account and business before modifying records.',
        inputSchema: z.object({}), annotations: { readOnlyHint: true },
      }, async () => json({ user: await api('/users/me'), business: await api('/api/sonar/business/profile') }))
      registerTool(server, request, 'list_people', {
        description: 'List People records in the signed-in Nodemere business. Use get_workspace first.',
        inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(25), offset: z.number().int().min(0).default(0) }),
        annotations: { readOnlyHint: true },
      }, async ({ limit, offset }) => json(await api(`/api/sonar/people?limit=${limit}&offset=${offset}`)))
      registerTool(server, request, 'get_person', {
        description: 'Read one Person in the signed-in Nodemere business.', inputSchema: z.object({ person_id: uuid }),
        annotations: { readOnlyHint: true },
      }, async ({ person_id }) => json(await api(`/api/sonar/people/${person_id}`)))
      registerTool(server, request, 'create_person', {
        description: 'Create one Person in the signed-in business. Check the workspace and existing People first to avoid duplicates. Nodemere record-created automations may run.',
        inputSchema: z.object(personFields),
      }, async (fields) => json(await api('/api/sonar/people', 'POST', fields)))
      registerTool(server, request, 'update_person', {
        description: 'Update selected fields on one Person. Existing notes should be read and preserved unless the user explicitly asks to replace them.',
        inputSchema: z.object({ person_id: uuid, first_name: personFields.first_name.optional(), last_name: personFields.last_name.optional(), email: personFields.email, phone: personFields.phone, notes: personFields.notes }),
      }, async ({ person_id, ...fields }) => json(await api(`/api/sonar/people/${person_id}`, 'PUT', fields)))
      registerTool(server, request, 'delete_person', {
        description: 'Permanently delete one Person after checking its name and linked appointments. Requires explicit user request. Delete linked appointments separately first.',
        inputSchema: z.object({ person_id: uuid, expected_name: z.string().trim().min(1), confirm: z.literal(true) }),
        annotations: { destructiveHint: true },
      }, async ({ person_id, expected_name }) => {
        const person = await api(`/api/sonar/people/${person_id}`)
        const actual = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()
        if (actual.toLowerCase() !== expected_name.toLowerCase()) throw new Error('Person name does not match; deletion cancelled')
        const appointments = await api('/api/sonar/appointments?limit=500')
        if (appointments.length === 500) throw new Error('Too many appointments to verify all links; deletion cancelled')
        if (appointments.some((item: { person_id?: string }) => item.person_id === person_id)) throw new Error('This Person has linked appointments; delete or reassign them first')
        return json(await api(`/api/sonar/people/${person_id}`, 'DELETE'))
      })
      registerTool(server, request, 'list_services', {
        description: 'List services for the signed-in business when preparing appointments.', inputSchema: z.object({}),
        annotations: { readOnlyHint: true },
      }, async () => json(await api('/api/sonar/services')))
      registerTool(server, request, 'list_appointments', {
        description: 'List appointments in the signed-in business.',
        inputSchema: z.object({ limit: z.number().int().min(1).max(500).default(100) }),
        annotations: { readOnlyHint: true },
      }, async ({ limit }) => json(await api(`/api/sonar/appointments?limit=${limit}`)))
      registerTool(server, request, 'create_appointment', {
        description: 'Create one appointment for an existing Person. Nodemere validates staff schedule and conflicts. Appointment-created automations may run.',
        inputSchema: z.object(appointmentFields),
      }, async (fields) => json(await api('/api/sonar/appointments', 'POST', fields)))
      registerTool(server, request, 'update_appointment', {
        description: 'Update selected appointment fields in the signed-in business.',
        inputSchema: z.object({ appointment_id: uuid, person_id: appointmentFields.person_id.optional(), date: appointmentFields.date.optional(), time: appointmentFields.time.optional(), duration: appointmentFields.duration.optional(), service_id: appointmentFields.service_id, staff_id: appointmentFields.staff_id, notes: appointmentFields.notes }),
      }, async ({ appointment_id, ...fields }) => json(await api(`/api/sonar/appointments/${appointment_id}`, 'PUT', fields)))
      registerTool(server, request, 'delete_appointment', {
        description: 'Permanently delete one appointment only on explicit user request, after checking its date and time.',
        inputSchema: z.object({ appointment_id: uuid, expected_date: z.iso.date(), expected_time: appointmentFields.time, confirm: z.literal(true) }),
        annotations: { destructiveHint: true },
      }, async ({ appointment_id, expected_date, expected_time }) => {
        const appointments = await api('/api/sonar/appointments?limit=500')
        const appointment = appointments.find((item: { id: string }) => item.id === appointment_id)
        if (!appointment || appointment.date !== expected_date || String(appointment.time).slice(0, 5) !== expected_time) throw new Error('Appointment date or time does not match; deletion cancelled')
        return json(await api(`/api/sonar/appointments/${appointment_id}`, 'DELETE'))
      })
      return server
    })
    const response = await handler.fetch(request)
    const headers = new Headers(response.headers)
    for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
})
