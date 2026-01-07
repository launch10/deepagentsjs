     │ Email Lead Capture Implementation Plan                                                                                    │
     │                                                                                                                           │
     │ Overview                                                                                                                  │
     │                                                                                                                           │
     │ Public API endpoint for landing pages to submit email signups. Uses JWT tokens embedded at deploy time for authentication.│
     │                                                                                                                           │
     │ ---                                                                                                                       │
     │ Part 1: Rails Backend                                                                                                     │
     │                                                                                                                           │
     │ 1.1 Database Migrations                                                                                                   │
     │                                                                                                                           │
     │ Migration: Add signup_token to projects                                                                                   │
     │ # db/migrate/xxx_add_signup_token_to_projects.rb                                                                          │
     │ add_column :projects, :signup_token, :string                                                                              │
     │ add_index :projects, :signup_token, unique: true                                                                          │
     │                                                                                                                           │
     │ Migration: Create leads table                                                                                             │
     │ # db/migrate/xxx_create_leads.rb                                                                                          │
     │ create_table :leads do |t|                                                                                                │
     │   t.references :project, null: false, foreign_key: true                                                                   │
     │   t.string :email, null: false                                                                                            │
     │   t.string :name                                                                                                          │
     │   t.jsonb :metadata, default: {}                                                                                          │
     │   t.timestamps                                                                                                            │
     │ end                                                                                                                       │
     │                                                                                                                           │
     │ add_index :leads, [:project_id, :email], unique: true                                                                     │
     │                                                                                                                           │
     │ 1.2 Models                                                                                                                │
     │                                                                                                                           │
     │ Lead model (app/models/lead.rb)                                                                                           │
     │ - belongs_to :project                                                                                                     │
     │ - Validates email presence and format                                                                                     │
     │ - Unique constraint: [:project_id, :email]                                                                                │
     │                                                                                                                           │
     │ Project model updates (app/models/project.rb)                                                                             │
     │ - has_many :leads                                                                                                         │
     │ - Add generate_signup_token! method                                                                                       │
     │ - Add signup_token_payload for JWT claims                                                                                 │
     │ - Generate token on create (callback)                                                                                     │
     │                                                                                                                           │
     │ 1.3 JWT Token Structure                                                                                                   │
     │                                                                                                                           │
     │ # Signup token payload (long-lived, project-scoped)                                                                       │
     │ {                                                                                                                         │
     │   type: "project_signup",                                                                                                 │
     │   project_id: project.id,                                                                                                 │
     │   account_id: project.account_id,                                                                                         │
     │   iat: Time.current.to_i,                                                                                                 │
     │   # No exp - tokens are valid until revoked/regenerated                                                                   │
     │ }                                                                                                                         │
     │                                                                                                                           │
     │ Why no expiry? Deployed pages may live indefinitely. Revocation = regenerate token.                                       │
     │                                                                                                                           │
     │ 1.4 Public API Endpoint                                                                                                   │
     │                                                                                                                           │
     │ Controller (app/controllers/api/v1/leads_controller.rb)                                                                   │
     │ class API::V1::LeadsController < API::BaseController                                                                      │
     │   skip_before_action :require_api_authentication, only: [:create]                                                         │
     │                                                                                                                           │
     │   def create                                                                                                              │
     │     project = verify_signup_token!(params[:token])                                                                        │
     │                                                                                                                           │
     │     lead = project.leads.find_or_initialize_by(email: lead_params[:email])                                                │
     │     lead.assign_attributes(lead_params.except(:email))                                                                    │
     │                                                                                                                           │
     │     if lead.save                                                                                                          │
     │       status = lead.previously_new_record? ? :created : :ok                                                               │
     │       render json: { success: true }, status: status                                                                      │
     │     else                                                                                                                  │
     │       render json: { errors: lead.errors }, status: :unprocessable_entity                                                 │
     │     end                                                                                                                   │
     │   end                                                                                                                     │
     │                                                                                                                           │
     │   private                                                                                                                 │
     │                                                                                                                           │
     │   def verify_signup_token!(token)                                                                                         │
     │     payload = JWT.decode(token, jwt_secret, true, algorithm: "HS256").first                                               │
     │     raise JWT::InvalidPayload unless payload["type"] == "project_signup"                                                  │
     │     Project.find(payload["project_id"])                                                                                   │
     │   rescue JWT::DecodeError, ActiveRecord::RecordNotFound                                                                   │
     │     render json: { error: "Invalid token" }, status: :unauthorized                                                        │
     │     nil                                                                                                                   │
     │   end                                                                                                                     │
     │                                                                                                                           │
     │   def lead_params                                                                                                         │
     │     params.permit(:email, :name)                                                                                          │
     │   end                                                                                                                     │
     │ end                                                                                                                       │
     │                                                                                                                           │
     │ Route (config/routes/api.rb)                                                                                              │
     │ resources :leads, only: [:create]  # POST /api/v1/leads                                                                   │
     │                                                                                                                           │
     │ 1.5 CORS Configuration                                                                                                    │
     │                                                                                                                           │
     │ Update config/initializers/cors.rb to allow public access to /api/v1/leads:                                               │
     │ - Allow all origins for this specific endpoint                                                                            │
     │ - Restrict methods to POST only                                                                                           │
     │                                                                                                                           │
     │ 1.6 Files to Modify/Create                                                                                                │
     │                                                                                                                           │
     │ ┌────────────────────────────────────────────────┬────────────────────────────────────────────────┐                       │
     │ │                      File                      │                     Action                     │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ db/migrate/xxx_add_signup_token_to_projects.rb │ Create                                         │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ db/migrate/xxx_create_leads.rb                 │ Create                                         │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ app/models/lead.rb                             │ Create                                         │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ app/models/project.rb                          │ Modify (add token generation, has_many :leads) │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ app/controllers/api/v1/leads_controller.rb     │ Create                                         │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ config/routes/api.rb                           │ Modify (add leads route)                       │                       │
     │ ├────────────────────────────────────────────────┼────────────────────────────────────────────────┤                       │
     │ │ config/initializers/cors.rb                    │ Modify (allow /api/v1/leads)                   │                       │
     │ └────────────────────────────────────────────────┴────────────────────────────────────────────────┘                       │
     │ ---                                                                                                                       │
     │ Part 2: Langgraph Agent Updates                                                                                           │
     │                                                                                                                           │
     │ 2.1 Token Injection Strategy                                                                                              │
     │                                                                                                                           │
     │ The signup token needs to be available to the React components. Options:                                                  │
     │                                                                                                                           │
     │ Recommended: Build-time injection via environment variable                                                                │
     │ 1. When coding agent starts, fetch project's signup_token from Rails                                                      │
     │ 2. Inject as VITE_SIGNUP_TOKEN in the project's .env file                                                                 │
     │ 3. Components access via import.meta.env.VITE_SIGNUP_TOKEN                                                                │
     │                                                                                                                           │
     │ Implementation:                                                                                                           │
     │ - Update buildContext.ts to fetch and include signup_token                                                                │
     │ - Write .env file with token before agent runs                                                                            │
     │ - Template includes API base URL: VITE_API_BASE_URL                                                                       │
     │                                                                                                                           │
     │ 2.2 Email Capture Component                                                                                               │
     │                                                                                                                           │
     │ Create a reusable WaitingListModal component in templates:                                                                │
     │                                                                                                                           │
     │ // Template component: WaitingListModal.tsx                                                                               │
     │ export function WaitingListModal({ isOpen, onClose, tierName }) {                                                         │
     │   const [email, setEmail] = useState('')                                                                                  │
     │   const [name, setName] = useState('')                                                                                    │
     │   const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')                                  │
     │                                                                                                                           │
     │   const handleSubmit = async (e) => {                                                                                     │
     │     e.preventDefault()                                                                                                    │
     │     setStatus('loading')                                                                                                  │
     │                                                                                                                           │
     │     const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/leads`, {                                        │
     │       method: 'POST',                                                                                                     │
     │       headers: { 'Content-Type': 'application/json' },                                                                    │
     │       body: JSON.stringify({                                                                                              │
     │         token: import.meta.env.VITE_SIGNUP_TOKEN,                                                                         │
     │         email,                                                                                                            │
     │         name,                                                                                                             │
     │       }),                                                                                                                 │
     │     })                                                                                                                    │
     │                                                                                                                           │
     │     setStatus(res.ok ? 'success' : 'error')                                                                               │
     │     if (res.ok) posthog.capture('waitlist_signup', { tier: tierName })                                                    │
     │   }                                                                                                                       │
     │                                                                                                                           │
     │   // ... modal UI with form                                                                                               │
     │ }                                                                                                                         │
     │                                                                                                                           │
     │ 2.3 Agent Guidance Updates                                                                                                │
     │                                                                                                                           │
     │ Update coder subagent system prompt to include:                                                                           │
     │                                                                                                                           │
     │ 1. When to add email capture: Pricing cards, hero CTAs, footer                                                            │
     │ 2. How to implement: Use WaitingListModal component                                                                       │
     │ 3. PostHog tracking: waitlist_signup event with context                                                                   │
     │                                                                                                                           │
     │ 2.4 Files to Modify/Create                                                                                                │
     │ ┌───────────────────────────────────────────────────────────────────┬──────────────────────────────────┐                  │
     │ │                               File                                │              Action              │                  │
     │ ├───────────────────────────────────────────────────────────────────┼──────────────────────────────────┤                  │
     │ │ langgraph_app/app/nodes/codingAgent/utils/buildContext.ts         │ Modify (fetch signup_token)      │                  │
     │ ├───────────────────────────────────────────────────────────────────┼──────────────────────────────────┤                  │
     │ │ langgraph_app/app/templates/*/src/components/WaitingListModal.tsx │ Create                           │                  │
     │ ├───────────────────────────────────────────────────────────────────┼──────────────────────────────────┤                  │
     │ │ langgraph_app/app/nodes/codingAgent/subagents/coder.ts            │ Modify (add email form guidance) │                  │
     │ ├───────────────────────────────────────────────────────────────────┼──────────────────────────────────┤                  │
     │ │ langgraph_app/app/services/core/railsApi/projectsAPIService.ts    │ Modify (expose signup_token)     │                  │
     │ └───────────────────────────────────────────────────────────────────┴──────────────────────────────────┘                  │
     │ ---                                                                                                                       │
     │ Part 3: Deploy Flow Integration                                                                                           │
     │                                                                                                                           │
     │ 3.1 Token Availability                                                                                                    │
     │                                                                                                                           │
     │ Token is generated on project creation, so it's always available before deploy. No deploy-time changes needed.            │
     │                                                                                                                           │
     │ 3.2 Environment Variables in Build                                                                                        │
     │                                                                                                                           │
     │ The .env file with VITE_SIGNUP_TOKEN is written by the agent during page generation. Vite inlines these at build time, so │
     │ the token is baked into the deployed JS bundle.                                                                           │
     │                                                                                                                           │
     │ ---                                                                                                                       │
     │ Implementation Order                                                                                                      │
     │                                                                                                                           │
     │ 1. Rails: Database & Models (migrations, Lead model, Project updates)                                                     │
     │ 2. Rails: API Endpoint (leads controller, route, CORS)                                                                    │
     │ 3. Langgraph: Token Injection (buildContext, env file)                                                                    │
     │ 4. Langgraph: Component (WaitingListModal template)                                                                       │
     │ 5. Langgraph: Agent Guidance (coder subagent prompt)                                                                      │
     │ 6. Testing (manual test, then specs)                                                                                      │
     │                                                                                                                           │
     │ ---                                                                                                                       │
     │ Verification Plan                                                                                                         │
     │                                                                                                                           │
     │ 1. Unit tests: Lead model validations, token generation                                                                   │
     │ 2. Request spec: POST /api/v1/leads with valid/invalid tokens                                                             │
     │ 3. Integration test:                                                                                                      │
     │   - Create project → generate page → deploy → submit form → verify lead created                                           │
     │ 4. Manual test:                                                                                                           │
     │   - Generate a landing page with pricing tiers                                                                            │
     │   - Click "Join Waitlist" on a tier                                                                                       │
     │   - Submit email in modal                                                                                                 │
     │   - Verify lead appears in Rails console                                                                                  │
     │                                                                                                                           │
     │ ---                                                                                                                       │
     │ Security Considerations                                                                                                   │
     │                                                                                                                           │
     │ - Tokens are long-lived but can be regenerated (revokes old token)                                                        │
     │ - Rate limiting handled at Cloudflare layer                                                                               │
     │ - Email validation prevents injection                                                                                     │
     │ - CORS allows all origins but only POST to /api/v1/leads                                                                  │
     │ - No PII beyond email/name stored                                                                                         │
     │                                                                                                                           │
