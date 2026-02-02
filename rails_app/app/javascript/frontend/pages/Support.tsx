import { useState, useRef } from "react";
import { useForm, usePage, router, Link } from "@inertiajs/react";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import {
  CheckCircleIcon,
  PaperClipIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];

interface SupportPageProps {
  categories: string[];
  errors: Record<string, string[]>;
  current_user: { email: string } | null;
}

export default function Support() {
  const { errors, current_user, categories } = usePage<SupportPageProps>().props;

  const [submitted, setSubmitted] = useState(false);
  const [ticketInfo, setTicketInfo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flat bracket-notation keys (instead of nested objects) are used here because
  // file uploads require manual FormData construction, which needs these key names.
  const { data, setData, processing, reset } = useForm({
    "support_request[category]": "",
    "support_request[subject]": "",
    "support_request[description]": "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFileError(null);

    const formData = new FormData();
    formData.append(
      "support_request[category]",
      data["support_request[category]"]
    );
    formData.append(
      "support_request[subject]",
      data["support_request[subject]"]
    );
    formData.append(
      "support_request[description]",
      data["support_request[description]"]
    );
    formData.append(
      "support_request[submitted_from_url]",
      window.location.href
    );
    formData.append("support_request[browser_info]", navigator.userAgent);

    files.forEach((file) => {
      formData.append("support_request[attachments][]", file);
    });

    router.post("/support", formData, {
      forceFormData: true,
      onSuccess: (page) => {
        const flash = (page.props as Record<string, unknown>).flash as
          | Array<{ type: string; title?: string; description?: string }>
          | undefined;
        const successFlash = flash?.find((f) =>
          f.title?.includes("Request submitted")
        );
        if (successFlash) {
          setTicketInfo(successFlash.description || "");
        }
        setSubmitted(true);
      },
    });
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = e.target.files;
    if (!newFiles) return;

    setFileError(null);

    const validFiles: File[] = [];
    for (const file of Array.from(newFiles)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError("Only images (PNG, JPEG, GIF, WebP) and PDFs are allowed");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError("Files must be under 10MB each");
        continue;
      }
      validFiles.push(file);
    }

    const combined = [...files, ...validFiles].slice(0, MAX_FILES);
    setFiles(combined);

    if (files.length + validFiles.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed`);
    }

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setFileError(null);
  };

  const handleReset = () => {
    reset();
    setFiles([]);
    setFileError(null);
    setSubmitted(false);
    setTicketInfo("");
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-[#FAFAF9]">
        <div className="px-4 py-6 lg:px-12 lg:py-10">
          <div className="w-full lg:w-[640px]">
            <Card>
              <CardContent className="flex flex-col items-center text-center py-12">
                <CheckCircleIcon className="w-16 h-16 text-[#2E9E72] mb-4" />
                <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-semibold text-[#2E3238] mb-2">
                  Request submitted
                </h2>
                <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#6B7280] mb-6 max-w-md">
                  {ticketInfo ||
                    `Thanks for reaching out. We'll get back to you within 24 hours at ${current_user?.email}.`}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset}>
                    Submit another request
                  </Button>
                  <Button asChild>
                    <Link href="/dashboard">Back to Dashboard</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238] mb-2">
          Get Help
        </h1>
        <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#6B7280] mb-6">
          We typically respond within 24 hours.
        </p>

        <div className="w-full lg:w-[640px]">
          <Card>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Category */}
                <div>
                  <label className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238] block mb-1.5">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={data["support_request[category]"]}
                    onChange={(e) =>
                      setData("support_request[category]", e.target.value)
                    }
                    required
                    className="border-input h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base text-[#2E3238] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors?.["category"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["category"][0]}
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238] block mb-1.5">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={data["support_request[subject]"]}
                    onChange={(e) =>
                      setData("support_request[subject]", e.target.value)
                    }
                    required
                    maxLength={200}
                    placeholder="Brief summary of your issue"
                    className="text-[#2E3238]"
                  />
                  {errors?.["subject"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["subject"][0]}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238] block mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <Textarea
                    value={data["support_request[description]"]}
                    onChange={(e) =>
                      setData("support_request[description]", e.target.value)
                    }
                    required
                    maxLength={5000}
                    rows={6}
                    placeholder="Please describe your issue in detail..."
                    className="text-[#2E3238]"
                  />
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    {data["support_request[description]"].length}/5000
                  </p>
                  {errors?.["description"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["description"][0]}
                    </p>
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <label className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238] block mb-1.5">
                    Attachments{" "}
                    <span className="font-normal text-[#9CA3AF]">
                      (optional, max 3 files)
                    </span>
                  </label>

                  {files.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {files.map((file, i) => (
                        <div
                          key={`${file.name}-${i}`}
                          className="flex items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
                        >
                          <PaperClipIcon className="w-4 h-4 text-[#9CA3AF] shrink-0" />
                          <span className="truncate flex-1 text-[#2E3238]">
                            {file.name}
                          </span>
                          <span className="text-[#9CA3AF] shrink-0">
                            {(file.size / 1024 / 1024).toFixed(1)}MB
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="text-[#9CA3AF] hover:text-red-500 transition-colors"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {files.length < MAX_FILES && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileAdd}
                        accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                        multiple
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <PaperClipIcon className="w-4 h-4" />
                        Add file
                      </Button>
                    </>
                  )}

                  {fileError && (
                    <p className="text-xs text-red-500 mt-1">{fileError}</p>
                  )}
                  {errors?.["attachments"] && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors["attachments"][0]}
                    </p>
                  )}
                  <p className="text-xs text-[#9CA3AF] mt-1">
                    Images (PNG, JPEG, GIF, WebP) and PDFs up to 10MB each
                  </p>
                </div>

                {/* Submit */}
                <div className="pt-2">
                  <Button type="submit" disabled={processing}>
                    {processing ? "Submitting..." : "Submit Request"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#6B7280] mt-4">
            You can also email us directly at{" "}
            <a
              href="mailto:support@launch10.ai"
              className="text-base-500 underline"
            >
              support@launch10.ai
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
