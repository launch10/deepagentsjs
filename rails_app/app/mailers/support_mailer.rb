class SupportMailer < ApplicationMailer
  def support_request(support_request)
    @support_request = support_request
    @user = support_request.user

    if support_request.attachments.attached?
      support_request.attachments.each do |file|
        attachments[file.filename.to_s] = {
          mime_type: file.content_type,
          content: file.download
        }
      end
    end

    mail(
      to: Jumpstart.config.support_email,
      subject: "[#{@support_request.category}] #{@support_request.subject}",
      reply_to: @user.email
    )
  end
end
