import * as React from "react"
import { Input } from "@/components/ui/input"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { L10 } from "@/lib/tracking"

type FieldName = "name" | "email" | "phone"

interface LeadFormContextValue {
  values: Record<FieldName, string>
  setValue: (name: FieldName, value: string) => void
  errors: Partial<Record<FieldName, string>>
  status: "idle" | "loading" | "success" | "error"
  formError: string | null
  registerField: (name: FieldName, required: boolean) => void
  unregisterField: (name: FieldName) => void
}

const LeadFormContext = React.createContext<LeadFormContextValue | null>(null)

function useLeadForm() {
  const ctx = React.useContext(LeadFormContext)
  if (!ctx) throw new Error("LeadForm compound components must be used within <LeadForm>")
  return ctx
}

// --- Validation ---

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[+]?[\d\s\-(). ]{7,20}$/

function validateField(name: FieldName, value: string, required: boolean): string | null {
  if (name === "email") {
    if (!value.trim()) return "Email is required"
    if (!EMAIL_RE.test(value.trim())) return "Please enter a valid email"
    return null
  }
  if (name === "phone") {
    if (required && !value.trim()) return "Phone is required"
    if (value.trim() && !PHONE_RE.test(value.trim())) return "Please enter a valid phone number"
    return null
  }
  if (name === "name") {
    if (required && !value.trim()) return "Name is required"
    if (value.trim() && value.trim().length > 100) return "Name is too long"
    return null
  }
  return null
}

// --- Root ---

interface LeadFormRootProps {
  value?: number
  currency?: string
  onSuccess?: () => void
  children: React.ReactNode
  className?: string
}

function LeadFormRoot({ value, currency, onSuccess, children, className }: LeadFormRootProps) {
  const [values, setValues] = React.useState<Record<FieldName, string>>({
    name: "",
    email: "",
    phone: "",
  })
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({})
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
  const [formError, setFormError] = React.useState<string | null>(null)
  const registeredFields = React.useRef<Map<FieldName, boolean>>(new Map())

  const setValue = React.useCallback((name: FieldName, val: string) => {
    setValues((prev) => ({ ...prev, [name]: val }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }, [])

  const registerField = React.useCallback((name: FieldName, required: boolean) => {
    registeredFields.current.set(name, required)
  }, [])

  const unregisterField = React.useCallback((name: FieldName) => {
    registeredFields.current.delete(name)
  }, [])

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (status === "loading") return

      // Validate registered fields
      const newErrors: Partial<Record<FieldName, string>> = {}
      registeredFields.current.forEach((required, name) => {
        const error = validateField(name, values[name], required)
        if (error) newErrors[name] = error
      })

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }

      setStatus("loading")
      setFormError(null)

      try {
        const options: { name?: string; phone?: string; value?: number; currency?: string } = {}
        if (registeredFields.current.has("name") && values.name.trim()) {
          options.name = values.name.trim()
        }
        if (registeredFields.current.has("phone") && values.phone.trim()) {
          options.phone = values.phone.trim()
        }
        if (value !== undefined) options.value = value
        if (currency) options.currency = currency

        await L10.createLead(values.email.trim(), options)
        setStatus("success")
        onSuccess?.()
      } catch (err) {
        setStatus("error")
        setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
      }
    },
    [status, values, value, currency, onSuccess]
  )

  const ctx = React.useMemo<LeadFormContextValue>(
    () => ({ values, setValue, errors, status, formError, registerField, unregisterField }),
    [values, setValue, errors, status, formError, registerField, unregisterField]
  )

  return (
    <LeadFormContext.Provider value={ctx}>
      <form onSubmit={handleSubmit} noValidate className={className}>
        {children}
      </form>
    </LeadFormContext.Provider>
  )
}

// --- Field sub-components ---

type FieldProps = Omit<React.ComponentProps<"input">, "name" | "type" | "value" | "onChange"> & {
  required?: boolean
}

function Email({ required = true, className, ...props }: FieldProps) {
  const { values, setValue, errors, status, registerField, unregisterField } = useLeadForm()

  React.useEffect(() => {
    registerField("email", required)
    return () => unregisterField("email")
  }, [required, registerField, unregisterField])

  if (status === "success") return null

  const hasError = !!errors.email
  return (
    <div>
      <Input
        type="email"
        value={values.email}
        onChange={(e) => setValue("email", e.target.value)}
        className={cn(className, hasError && "border-red-500 focus-visible:ring-red-500")}
        {...props}
      />
      {hasError && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
    </div>
  )
}

function Name({ required = false, className, ...props }: FieldProps) {
  const { values, setValue, errors, status, registerField, unregisterField } = useLeadForm()

  React.useEffect(() => {
    registerField("name", required)
    return () => unregisterField("name")
  }, [required, registerField, unregisterField])

  if (status === "success") return null

  const hasError = !!errors.name
  return (
    <div>
      <Input
        type="text"
        value={values.name}
        onChange={(e) => setValue("name", e.target.value)}
        className={cn(className, hasError && "border-red-500 focus-visible:ring-red-500")}
        {...props}
      />
      {hasError && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
    </div>
  )
}

function Phone({ required = false, className, ...props }: FieldProps) {
  const { values, setValue, errors, status, registerField, unregisterField } = useLeadForm()

  React.useEffect(() => {
    registerField("phone", required)
    return () => unregisterField("phone")
  }, [required, registerField, unregisterField])

  if (status === "success") return null

  const hasError = !!errors.phone
  return (
    <div>
      <Input
        type="tel"
        value={values.phone}
        onChange={(e) => setValue("phone", e.target.value)}
        className={cn(className, hasError && "border-red-500 focus-visible:ring-red-500")}
        {...props}
      />
      {hasError && <p className="text-sm text-red-500 mt-1">{errors.phone}</p>}
    </div>
  )
}

// --- Submit ---

interface SubmitProps extends Omit<ButtonProps, "type"> {
  loadingText?: string
}

function Submit({ loadingText = "Submitting...", children, disabled, ...props }: SubmitProps) {
  const { status } = useLeadForm()

  if (status === "success") return null

  const isLoading = status === "loading"
  return (
    <Button type="submit" disabled={disabled || isLoading} {...props}>
      {isLoading ? loadingText : children}
    </Button>
  )
}

// --- Success ---

function Success({ children }: { children: React.ReactNode }) {
  const { status } = useLeadForm()
  if (status !== "success") return null
  return <>{children}</>
}

// --- Error ---

function FormError({ className }: { className?: string }) {
  const { formError } = useLeadForm()
  if (!formError) return null
  return <p className={cn("text-sm text-red-500", className)}>{formError}</p>
}

// --- Compound export ---

const LeadForm = Object.assign(LeadFormRoot, {
  Email,
  Name,
  Phone,
  Submit,
  Success,
  Error: FormError,
})

export { LeadForm }
