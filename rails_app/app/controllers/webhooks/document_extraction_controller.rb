module Webhooks
  class DocumentExtractionController < ActionController::API
    before_action :verify_signature

    def create
      job_run = JobRun.find(params[:job_run_id])
      document = Document.find(params[:document_id])

      case params[:status]
      when 'success'
        handle_success(job_run, document, params[:result])
      when 'failure'
        handle_failure(job_run, document, params[:result])
      else
        render json: { error: "Unknown status: #{params[:status]}" }, status: :bad_request
        return
      end

      head :ok
    rescue ActiveRecord::RecordNotFound => e
      Rails.logger.error("[DocumentExtractionWebhook] Record not found: #{e.message}")
      render json: { error: e.message }, status: :not_found
    rescue => e
      Rails.logger.error("[DocumentExtractionWebhook] Error: #{e.message}")
      render json: { error: e.message }, status: :unprocessable_entity
    end

    private

    def handle_success(job_run, document, result)
      pairs = (result['pairs'] || []).map do |pair|
        {
          question: pair['question'],
          answer: pair['answer'],
          section: pair['section']
        }
      end

      document.sync_chunks(pairs)
      job_run.complete!

      Rails.logger.info("[DocumentExtractionWebhook] Successfully processed document #{document.id} with #{pairs.count} Q&A pairs")
    end

    def handle_failure(job_run, document, result)
      error_message = result&.dig('error') || 'Unknown error'
      job_run.fail!(error_message)

      Rails.logger.error("[DocumentExtractionWebhook] Failed to process document #{document.id}: #{error_message}")
    end

    def verify_signature
      payload = request.raw_post
      signature = request.headers['X-Signature']

      unless signature.present?
        render json: { error: 'Missing signature' }, status: :unauthorized
        return
      end

      expected_signature = OpenSSL::HMAC.hexdigest(
        'SHA256',
        Rails.application.credentials.devise_jwt_secret_key!,
        payload
      )

      unless ActiveSupport::SecurityUtils.secure_compare(signature, expected_signature)
        render json: { error: 'Invalid signature' }, status: :unauthorized
      end
    end
  end
end
