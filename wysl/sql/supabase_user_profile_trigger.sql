[
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users can read own profile",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users can insert own profile",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = id)"
  },
  {
    "schemaname": "public",
    "tablename": "users",
    "policyname": "users can update own profile",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = id)",
    "with_check": "(auth.uid() = id)"
  }
]



[
  {
    "grantee": "anon",
    "privilege_type": "DELETE"
  },
  {
    "grantee": "anon",
    "privilege_type": "INSERT"
  },
  {
    "grantee": "anon",
    "privilege_type": "REFERENCES"
  },
  {
    "grantee": "anon",
    "privilege_type": "SELECT"
  },
  {
    "grantee": "anon",
    "privilege_type": "TRIGGER"
  },
  {
    "grantee": "anon",
    "privilege_type": "TRUNCATE"
  },
  {
    "grantee": "anon",
    "privilege_type": "UPDATE"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "DELETE"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "INSERT"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "REFERENCES"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "SELECT"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "TRIGGER"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "TRUNCATE"
  },
  {
    "grantee": "authenticated",
    "privilege_type": "UPDATE"
  },
  {
    "grantee": "postgres",
    "privilege_type": "DELETE"
  },
  {
    "grantee": "postgres",
    "privilege_type": "INSERT"
  },
  {
    "grantee": "postgres",
    "privilege_type": "REFERENCES"
  },
  {
    "grantee": "postgres",
    "privilege_type": "SELECT"
  },
  {
    "grantee": "postgres",
    "privilege_type": "TRIGGER"
  },
  {
    "grantee": "postgres",
    "privilege_type": "TRUNCATE"
  },
  {
    "grantee": "postgres",
    "privilege_type": "UPDATE"
  },
  {
    "grantee": "service_role",
    "privilege_type": "DELETE"
  },
  {
    "grantee": "service_role",
    "privilege_type": "INSERT"
  },
  {
    "grantee": "service_role",
    "privilege_type": "REFERENCES"
  },
  {
    "grantee": "service_role",
    "privilege_type": "SELECT"
  },
  {
    "grantee": "service_role",
    "privilege_type": "TRIGGER"
  },
  {
    "grantee": "service_role",
    "privilege_type": "TRUNCATE"
  },
  {
    "grantee": "service_role",
    "privilege_type": "UPDATE"
  }
]