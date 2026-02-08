import { describe, it, expect } from "vitest";
import { needsInstrumentation } from "@nodes";

describe("needsInstrumentation", () => {
  /**
   * =============================================================================
   * POSITIVE DETECTION — should return true (needs instrumentation)
   * =============================================================================
   */
  describe("detects email capture patterns", () => {
    it('detects type="email" input', () => {
      const content = `export function Hero() {
  return <input type="email" placeholder="Enter email" />;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects type={'email'} JSX expression", () => {
      const content = `export function Hero() {
  return <input type={'email'} placeholder="Enter email" />;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects setEmail state setter", () => {
      const content = `export function Hero() {
  const [email, setEmail] = useState("");
  return <input value={email} onChange={(e) => setEmail(e.target.value)} />;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects <form element", () => {
      const content = `export function ContactForm() {
  return <form action="/submit"><input name="email" /><button>Submit</button></form>;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects onSubmit handler", () => {
      const content = `export function SignupForm() {
  const handleSubmit = (e) => { e.preventDefault(); };
  return <div onSubmit={handleSubmit}><input name="email" /><button>Submit</button></div>;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects handleSubmit function", () => {
      const content = `export function Newsletter() {
  function handleSubmit(data) { fetch('/api/subscribe', { body: data }); }
  return <button onClick={() => handleSubmit({ email })}>Subscribe</button>;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });

    it("detects useForm() hook (react-hook-form)", () => {
      const content = `import { useForm } from 'react-hook-form';
export function SignupForm() {
  const { register, handleSubmit } = useForm();
  return <form onSubmit={handleSubmit(onSubmit)}><input {...register('email')} /></form>;
}`;
      expect(needsInstrumentation(content)).toBe(true);
    });
  });

  /**
   * =============================================================================
   * NEGATIVE — should return false (already instrumented or no capture)
   * =============================================================================
   */
  describe("skips files that don't need instrumentation", () => {
    it("returns false when L10.createLead already present", () => {
      const content = `import { L10 } from '@/lib/tracking';
export function Hero() {
  const handleSubmit = () => L10.createLead(email);
  return <input type="email" />;
}`;
      expect(needsInstrumentation(content)).toBe(false);
    });

    it("returns false for files with no email capture patterns", () => {
      const content = `export function Features() {
  return <div><h2>Our Features</h2><p>Feature list here</p></div>;
}`;
      expect(needsInstrumentation(content)).toBe(false);
    });
  });
});
