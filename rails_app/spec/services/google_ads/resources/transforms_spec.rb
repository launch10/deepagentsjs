require "rails_helper"

RSpec.describe GoogleAds::Resources::Transforms do
  describe "Identity transforms" do
    describe "ITSELF" do
      it "returns the value unchanged" do
        expect(described_class::ITSELF.call("hello")).to eq("hello")
        expect(described_class::ITSELF.call(123)).to eq(123)
        expect(described_class::ITSELF.call(nil)).to be_nil
      end
    end

    describe "TO_SYMBOL" do
      it "converts strings to symbols" do
        expect(described_class::TO_SYMBOL.call("enabled")).to eq(:enabled)
        expect(described_class::TO_SYMBOL.call("PAUSED")).to eq(:PAUSED)
      end

      it "handles nil" do
        expect(described_class::TO_SYMBOL.call(nil)).to be_nil
      end
    end

    describe "TO_STRING" do
      it "converts values to strings" do
        expect(described_class::TO_STRING.call(:enabled)).to eq("enabled")
        expect(described_class::TO_STRING.call(123)).to eq("123")
      end

      it "handles nil" do
        expect(described_class::TO_STRING.call(nil)).to be_nil
      end
    end

    describe "UPCASE_SYMBOL" do
      it "converts strings to uppercase symbols" do
        expect(described_class::UPCASE_SYMBOL.call("enabled")).to eq(:ENABLED)
        expect(described_class::UPCASE_SYMBOL.call("paused")).to eq(:PAUSED)
        expect(described_class::UPCASE_SYMBOL.call("SEARCH")).to eq(:SEARCH)
      end

      it "handles symbols" do
        expect(described_class::UPCASE_SYMBOL.call(:enabled)).to eq(:ENABLED)
      end
    end

    describe "DOWNCASE_STRING" do
      it "converts values to lowercase strings" do
        expect(described_class::DOWNCASE_STRING.call(:ENABLED)).to eq("enabled")
        expect(described_class::DOWNCASE_STRING.call("PAUSED")).to eq("paused")
      end
    end
  end

  describe "Money transforms" do
    describe "CENTS_TO_MICROS" do
      it "converts 100 cents to 1,000,000 micros" do
        expect(described_class::CENTS_TO_MICROS.call(100)).to eq(1_000_000)
      end

      it "converts 1 cent to 10,000 micros" do
        expect(described_class::CENTS_TO_MICROS.call(1)).to eq(10_000)
      end

      it "converts 1000 cents ($10) to 10,000,000 micros" do
        expect(described_class::CENTS_TO_MICROS.call(1000)).to eq(10_000_000)
      end
    end

    describe "MICROS_TO_CENTS" do
      it "converts 1,000,000 micros to 100 cents" do
        expect(described_class::MICROS_TO_CENTS.call(1_000_000)).to eq(100)
      end

      it "converts 10,000 micros to 1 cent" do
        expect(described_class::MICROS_TO_CENTS.call(10_000)).to eq(1)
      end

      it "converts 10,000,000 micros to 1000 cents ($10)" do
        expect(described_class::MICROS_TO_CENTS.call(10_000_000)).to eq(1000)
      end
    end

    describe "DOLLARS_TO_MICROS" do
      it "converts 1 dollar to 1,000,000 micros" do
        expect(described_class::DOLLARS_TO_MICROS.call(1)).to eq(1_000_000)
      end

      it "converts 10 dollars to 10,000,000 micros" do
        expect(described_class::DOLLARS_TO_MICROS.call(10)).to eq(10_000_000)
      end
    end

    describe "MICROS_TO_DOLLARS" do
      it "converts 1,000,000 micros to 1.0 dollar" do
        expect(described_class::MICROS_TO_DOLLARS.call(1_000_000)).to eq(1.0)
      end

      it "converts 500,000 micros to 0.5 dollars" do
        expect(described_class::MICROS_TO_DOLLARS.call(500_000)).to eq(0.5)
      end
    end
  end

  describe "Day of week transforms" do
    describe "DAY_OF_WEEK_TO_SYMBOL" do
      it "converts Monday to :MONDAY" do
        expect(described_class::DAY_OF_WEEK_TO_SYMBOL.call("Monday")).to eq(:MONDAY)
      end

      it "converts all days correctly" do
        %w[Monday Tuesday Wednesday Thursday Friday Saturday Sunday].each do |day|
          expect(described_class::DAY_OF_WEEK_TO_SYMBOL.call(day)).to eq(day.upcase.to_sym)
        end
      end

      it "returns nil for unknown days" do
        expect(described_class::DAY_OF_WEEK_TO_SYMBOL.call("InvalidDay")).to be_nil
      end
    end

    describe "SYMBOL_TO_DAY_OF_WEEK" do
      it "converts :MONDAY to Monday" do
        expect(described_class::SYMBOL_TO_DAY_OF_WEEK.call(:MONDAY)).to eq("Monday")
      end

      it "converts all symbols correctly" do
        %i[MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY].each do |sym|
          expect(described_class::SYMBOL_TO_DAY_OF_WEEK.call(sym)).to eq(sym.to_s.capitalize)
        end
      end
    end
  end

  describe "Minute transforms" do
    describe "MINUTE_TO_SYMBOL" do
      it "converts 0 to :ZERO" do
        expect(described_class::MINUTE_TO_SYMBOL.call(0)).to eq(:ZERO)
      end

      it "converts 15 to :FIFTEEN" do
        expect(described_class::MINUTE_TO_SYMBOL.call(15)).to eq(:FIFTEEN)
      end

      it "converts 30 to :THIRTY" do
        expect(described_class::MINUTE_TO_SYMBOL.call(30)).to eq(:THIRTY)
      end

      it "converts 45 to :FORTY_FIVE" do
        expect(described_class::MINUTE_TO_SYMBOL.call(45)).to eq(:FORTY_FIVE)
      end

      it "defaults unknown values to :ZERO" do
        expect(described_class::MINUTE_TO_SYMBOL.call(17)).to eq(:ZERO)
      end
    end

    describe "SYMBOL_TO_MINUTE" do
      it "converts :ZERO to 0" do
        expect(described_class::SYMBOL_TO_MINUTE.call(:ZERO)).to eq(0)
      end

      it "converts :FIFTEEN to 15" do
        expect(described_class::SYMBOL_TO_MINUTE.call(:FIFTEEN)).to eq(15)
      end

      it "converts :THIRTY to 30" do
        expect(described_class::SYMBOL_TO_MINUTE.call(:THIRTY)).to eq(30)
      end

      it "converts :FORTY_FIVE to 45" do
        expect(described_class::SYMBOL_TO_MINUTE.call(:FORTY_FIVE)).to eq(45)
      end

      it "defaults unknown values to 0" do
        expect(described_class::SYMBOL_TO_MINUTE.call(:UNKNOWN)).to eq(0)
      end
    end
  end

  describe "Status transforms" do
    describe "STATUS_TO_GOOGLE" do
      it "converts 'active' to :ENABLED" do
        expect(described_class::STATUS_TO_GOOGLE.call("active")).to eq(:ENABLED)
      end

      it "converts 'paused' to :PAUSED" do
        expect(described_class::STATUS_TO_GOOGLE.call("paused")).to eq(:PAUSED)
      end

      it "converts any non-active status to :PAUSED" do
        expect(described_class::STATUS_TO_GOOGLE.call("draft")).to eq(:PAUSED)
        expect(described_class::STATUS_TO_GOOGLE.call("completed")).to eq(:PAUSED)
      end
    end

    describe "GOOGLE_TO_STATUS" do
      it "converts :ENABLED to 'active'" do
        expect(described_class::GOOGLE_TO_STATUS.call(:ENABLED)).to eq("active")
      end

      it "converts :PAUSED to 'paused'" do
        expect(described_class::GOOGLE_TO_STATUS.call(:PAUSED)).to eq("paused")
      end

      it "converts any non-ENABLED status to 'paused'" do
        expect(described_class::GOOGLE_TO_STATUS.call(:REMOVED)).to eq("paused")
      end
    end
  end

  describe "Match type transforms" do
    describe "MATCH_TYPE_TO_SYMBOL" do
      it "converts 'broad' to :BROAD" do
        expect(described_class::MATCH_TYPE_TO_SYMBOL.call("broad")).to eq(:BROAD)
      end

      it "converts 'phrase' to :PHRASE" do
        expect(described_class::MATCH_TYPE_TO_SYMBOL.call("phrase")).to eq(:PHRASE)
      end

      it "converts 'exact' to :EXACT" do
        expect(described_class::MATCH_TYPE_TO_SYMBOL.call("exact")).to eq(:EXACT)
      end
    end

    describe "SYMBOL_TO_MATCH_TYPE" do
      it "converts :BROAD to 'broad'" do
        expect(described_class::SYMBOL_TO_MATCH_TYPE.call(:BROAD)).to eq("broad")
      end

      it "converts :PHRASE to 'phrase'" do
        expect(described_class::SYMBOL_TO_MATCH_TYPE.call(:PHRASE)).to eq("phrase")
      end

      it "converts :EXACT to 'exact'" do
        expect(described_class::SYMBOL_TO_MATCH_TYPE.call(:EXACT)).to eq("exact")
      end
    end
  end

  describe "EU Political advertising transforms" do
    describe "EU_POLITICAL_TO_SYMBOL" do
      it "converts true to :CONTAINS_EU_POLITICAL_ADVERTISING" do
        expect(described_class::EU_POLITICAL_TO_SYMBOL.call(true)).to eq(:CONTAINS_EU_POLITICAL_ADVERTISING)
      end

      it "converts false to :DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING" do
        expect(described_class::EU_POLITICAL_TO_SYMBOL.call(false)).to eq(:DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)
      end
    end

    describe "SYMBOL_TO_EU_POLITICAL" do
      it "converts :CONTAINS_EU_POLITICAL_ADVERTISING to true" do
        expect(described_class::SYMBOL_TO_EU_POLITICAL.call(:CONTAINS_EU_POLITICAL_ADVERTISING)).to be true
      end

      it "converts other values to false" do
        expect(described_class::SYMBOL_TO_EU_POLITICAL.call(:DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING)).to be false
        expect(described_class::SYMBOL_TO_EU_POLITICAL.call(:UNSPECIFIED)).to be false
      end
    end
  end

  describe "EMPTY_STRING_TO_NIL" do
    it "converts empty string to nil" do
      expect(described_class::EMPTY_STRING_TO_NIL.call("")).to be_nil
    end

    it "keeps non-empty strings unchanged" do
      expect(described_class::EMPTY_STRING_TO_NIL.call("hello")).to eq("hello")
    end

    it "converts nil to nil" do
      expect(described_class::EMPTY_STRING_TO_NIL.call(nil)).to be_nil
    end
  end
end
