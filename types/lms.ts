export interface LMSClass {
  id: string
  name: string
  semester: string
  invite_code: string
  is_active: boolean
  student_count: number
  created_at: string
}

export interface LMSStudent {
  id: string
  name: string | null
  student_id: string | null
  email: string | null
  enrolled_at: string
}

export interface LMSAssignment {
  id: string
  title: string
  prompt_text: string
  due_date: string | null
  created_at: string
}

export interface LMSGradeEntry {
  student_id: string
  student_name: string | null
  student_number: string | null
  assignment_id: string
  assignment_title: string
  session_id: string | null
  draft_error_count: number | null
  revision_error_count: number | null
  improvement: number | null
  submitted_at: string | null
}

export interface LMSApiKeyRecord {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  last_used_at: string | null
  created_at: string
  is_active: boolean
}

export interface ApiKeyContext {
  professor_id: string
  key_id: string
  scopes: string[]
}
