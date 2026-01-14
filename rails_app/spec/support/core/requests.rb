MockTyphoeusResponse = Struct.new(:body, :timed_out, :code, :headers, :response) do
  def timed_out?
    timed_out
  end

  def run
    if @on_headers.present?
      @on_headers.call(OpenStruct.new(headers.merge!(code: code)))
    end

    if @on_body.present?
      @on_body.call(body)
    end

    if @on_complete.present?
      @on_complete.call
    end

    self
  end

  def success?
    code.to_s.match?(/20\d/)
  end

  def on_headers(&block)
    @on_headers = block
  end

  def on_body(&block)
    @on_body = block
  end

  def on_complete(&block)
    @on_complete = block
  end

  def request_body
    body
  end
end

def mock_typhoeus_response(body: "", timed_out: false, code: 200, headers: {}, response: nil)
  MockTyphoeusResponse.new(body, timed_out, code, headers, response)
end
