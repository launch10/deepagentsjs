# Resolves the system CA bundle path to avoid OpenSSL 3.6 CRL verification issues.
#
# OpenSSL 3.6's set_default_paths triggers CRL checking that fails against
# endpoints using Google Trust Services certs (Cloudflare R2, Atlas, etc.).
# Loading certs via add_file instead of set_default_paths bypasses the problem.
#
# Used by: Cloudflare::R2 (aws-sdk), ApplicationClient (Net::HTTP)
class SslCaBundle
  SEARCH_PATHS = [
    "/opt/homebrew/etc/openssl@3/cert.pem",   # macOS (Homebrew ARM)
    "/usr/local/etc/openssl@3/cert.pem",       # macOS (Homebrew Intel)
    "/etc/ssl/certs/ca-certificates.crt",       # Debian/Ubuntu
    "/etc/pki/tls/certs/ca-bundle.crt"         # RHEL/CentOS
  ].freeze

  def self.path
    @path ||= SEARCH_PATHS.find { |p| File.exist?(p) } || OpenSSL::X509::DEFAULT_CERT_FILE
  end
end
