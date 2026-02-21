SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: notify_new_run(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_run() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF NEW.status = 'pending' THEN
          PERFORM pg_notify('new_run', NEW.run_id);
        END IF;
        RETURN NEW;
      END;
      $$;


--
-- Name: update_content_tsv(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_content_tsv() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            -- Use simple configuration for better programming term handling
            -- Also include file path in search
            NEW.content_tsv := to_tsvector('english', 
              COALESCE(NEW.content, '') || ' ' || 
              COALESCE(regexp_replace(NEW.path, '[/.]', ' ', 'g'), '')
            );
            RETURN NEW;
        END;
        $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_invitations (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    invited_by_id bigint,
    token character varying NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: account_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_invitations_id_seq OWNED BY public.account_invitations.id;


--
-- Name: account_request_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
)
PARTITION BY RANGE (month);


--
-- Name: account_request_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_request_counts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_request_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_request_counts_id_seq OWNED BY public.account_request_counts.id;


--
-- Name: account_request_counts_2025_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2025_08 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2025_09 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2025_10 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2025_11 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2025_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2025_12 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_01 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_02 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_03 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_04 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_05 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_06 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_07 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_08 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_09 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_10 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_11 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_request_counts_2026_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_request_counts_2026_12 (
    id bigint DEFAULT nextval('public.account_request_counts_id_seq'::regclass) NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: account_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_users (
    id bigint NOT NULL,
    account_id bigint,
    user_id bigint,
    roles jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: account_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_users_id_seq OWNED BY public.account_users.id;


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id bigint NOT NULL,
    name character varying NOT NULL,
    owner_id bigint,
    personal boolean DEFAULT false,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    extra_billing_info text,
    domain character varying,
    subdomain character varying,
    billing_email character varying,
    account_users_count integer DEFAULT 0,
    time_zone character varying DEFAULT 'America/New_York'::character varying,
    plan_millicredits bigint DEFAULT 0 NOT NULL,
    pack_millicredits bigint DEFAULT 0 NOT NULL,
    total_millicredits bigint DEFAULT 0 NOT NULL,
    signup_attribution jsonb
);


--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: action_text_embeds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_text_embeds (
    id bigint NOT NULL,
    url character varying,
    fields jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: action_text_embeds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_text_embeds_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: action_text_embeds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_text_embeds_id_seq OWNED BY public.action_text_embeds.id;


--
-- Name: action_text_rich_texts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.action_text_rich_texts (
    id bigint NOT NULL,
    name character varying NOT NULL,
    body text,
    record_type character varying NOT NULL,
    record_id bigint NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: action_text_rich_texts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.action_text_rich_texts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: action_text_rich_texts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.action_text_rich_texts_id_seq OWNED BY public.action_text_rich_texts.id;


--
-- Name: active_storage_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_attachments (
    id bigint NOT NULL,
    name character varying NOT NULL,
    record_type character varying NOT NULL,
    record_id bigint NOT NULL,
    blob_id bigint NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: active_storage_attachments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.active_storage_attachments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: active_storage_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.active_storage_attachments_id_seq OWNED BY public.active_storage_attachments.id;


--
-- Name: active_storage_blobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_blobs (
    id bigint NOT NULL,
    key character varying NOT NULL,
    filename character varying NOT NULL,
    content_type character varying,
    metadata text,
    byte_size bigint NOT NULL,
    checksum character varying,
    created_at timestamp without time zone NOT NULL,
    service_name character varying NOT NULL
);


--
-- Name: active_storage_blobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.active_storage_blobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: active_storage_blobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.active_storage_blobs_id_seq OWNED BY public.active_storage_blobs.id;


--
-- Name: active_storage_variant_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_variant_records (
    id bigint NOT NULL,
    blob_id bigint NOT NULL,
    variation_digest character varying NOT NULL
);


--
-- Name: active_storage_variant_records_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.active_storage_variant_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: active_storage_variant_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.active_storage_variant_records_id_seq OWNED BY public.active_storage_variant_records.id;


--
-- Name: ad_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_budgets (
    id bigint NOT NULL,
    campaign_id bigint,
    daily_budget_cents integer,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_budgets_id_seq OWNED BY public.ad_budgets.id;


--
-- Name: ad_callouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_callouts (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    ad_group_id bigint,
    text character varying NOT NULL,
    "position" integer NOT NULL,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_callouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_callouts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_callouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_callouts_id_seq OWNED BY public.ad_callouts.id;


--
-- Name: ad_descriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_descriptions (
    id bigint NOT NULL,
    ad_id bigint NOT NULL,
    text character varying NOT NULL,
    "position" integer NOT NULL,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_descriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_descriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_descriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_descriptions_id_seq OWNED BY public.ad_descriptions.id;


--
-- Name: ad_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_groups (
    id bigint NOT NULL,
    campaign_id bigint,
    name character varying,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_groups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_groups_id_seq OWNED BY public.ad_groups.id;


--
-- Name: ad_headlines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_headlines (
    id bigint NOT NULL,
    ad_id bigint NOT NULL,
    text character varying NOT NULL,
    "position" integer NOT NULL,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_headlines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_headlines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_headlines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_headlines_id_seq OWNED BY public.ad_headlines.id;


--
-- Name: ad_keywords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_keywords (
    id bigint NOT NULL,
    ad_group_id bigint NOT NULL,
    text character varying(120) NOT NULL,
    match_type character varying DEFAULT 'broad'::character varying NOT NULL,
    "position" integer NOT NULL,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_keywords_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_keywords_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_keywords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_keywords_id_seq OWNED BY public.ad_keywords.id;


--
-- Name: ad_languages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_languages (
    id bigint NOT NULL,
    campaign_id bigint,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_languages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_languages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_languages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_languages_id_seq OWNED BY public.ad_languages.id;


--
-- Name: ad_location_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_location_targets (
    id bigint NOT NULL,
    campaign_id bigint,
    target_type character varying NOT NULL,
    targeted boolean DEFAULT true NOT NULL,
    location_identifier character varying,
    location_name character varying,
    location_type character varying,
    latitude numeric(10,6),
    longitude numeric(10,6),
    radius numeric(10,2),
    radius_units character varying,
    address_line_1 character varying,
    city character varying,
    state character varying,
    postal_code character varying,
    country_code character varying,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_location_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_location_targets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_location_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_location_targets_id_seq OWNED BY public.ad_location_targets.id;


--
-- Name: ad_performance_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_performance_daily (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    date date NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    cost_micros bigint DEFAULT 0 NOT NULL,
    conversions numeric(12,2) DEFAULT 0.0 NOT NULL,
    conversion_value_micros bigint DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_performance_daily_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_performance_daily_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_performance_daily_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_performance_daily_id_seq OWNED BY public.ad_performance_daily.id;


--
-- Name: ad_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_schedules (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    day_of_week character varying,
    start_hour integer,
    start_minute integer,
    end_hour integer,
    end_minute integer,
    always_on boolean DEFAULT false,
    bid_modifier numeric(10,2),
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone,
    CONSTRAINT valid_end_hour CHECK (((end_hour >= 0) AND (end_hour <= 24))),
    CONSTRAINT valid_end_minute CHECK ((end_minute = ANY (ARRAY[0, 15, 30, 45]))),
    CONSTRAINT valid_start_hour CHECK (((start_hour >= 0) AND (start_hour <= 23))),
    CONSTRAINT valid_start_minute CHECK ((start_minute = ANY (ARRAY[0, 15, 30, 45])))
);


--
-- Name: ad_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_schedules_id_seq OWNED BY public.ad_schedules.id;


--
-- Name: ad_structured_snippets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_structured_snippets (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    category character varying NOT NULL,
    "values" jsonb DEFAULT '[]'::jsonb NOT NULL,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ad_structured_snippets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ad_structured_snippets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ad_structured_snippets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ad_structured_snippets_id_seq OWNED BY public.ad_structured_snippets.id;


--
-- Name: ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads (
    id bigint NOT NULL,
    ad_group_id bigint,
    status character varying DEFAULT 'draft'::character varying,
    display_path_1 character varying,
    display_path_2 character varying,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ads_account_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads_account_invitations (
    id bigint NOT NULL,
    ads_account_id bigint NOT NULL,
    email_address character varying NOT NULL,
    platform character varying NOT NULL,
    platform_settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: ads_account_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ads_account_invitations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ads_account_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ads_account_invitations_id_seq OWNED BY public.ads_account_invitations.id;


--
-- Name: ads_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads_accounts (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    platform character varying NOT NULL,
    platform_settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: ads_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ads_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ads_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ads_accounts_id_seq OWNED BY public.ads_accounts.id;


--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: agent_context_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_context_events (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    project_id bigint,
    user_id bigint,
    eventable_type character varying,
    eventable_id bigint,
    event_type character varying NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: agent_context_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agent_context_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agent_context_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agent_context_events_id_seq OWNED BY public.agent_context_events.id;


--
-- Name: ahoy_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahoy_events (
    id bigint NOT NULL,
    visit_id bigint,
    name character varying,
    properties jsonb,
    "time" timestamp(6) without time zone
);


--
-- Name: ahoy_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ahoy_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ahoy_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ahoy_events_id_seq OWNED BY public.ahoy_events.id;


--
-- Name: ahoy_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ahoy_visits (
    id bigint NOT NULL,
    visit_token character varying,
    visitor_token character varying,
    website_id bigint,
    gclid character varying,
    ip character varying,
    user_agent text,
    referrer text,
    referring_domain character varying,
    landing_page text,
    browser character varying,
    os character varying,
    device_type character varying,
    country character varying,
    region character varying,
    city character varying,
    latitude double precision,
    longitude double precision,
    utm_source character varying,
    utm_medium character varying,
    utm_term character varying,
    utm_content character varying,
    utm_campaign character varying,
    app_version character varying,
    os_version character varying,
    platform character varying,
    started_at timestamp(6) without time zone,
    fbclid character varying
);


--
-- Name: ahoy_visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ahoy_visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ahoy_visits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ahoy_visits_id_seq OWNED BY public.ahoy_visits.id;


--
-- Name: analytics_daily_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_daily_metrics (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    project_id bigint NOT NULL,
    date date NOT NULL,
    leads_count integer DEFAULT 0 NOT NULL,
    unique_visitors_count bigint DEFAULT 0 NOT NULL,
    impressions bigint DEFAULT 0 NOT NULL,
    clicks bigint DEFAULT 0 NOT NULL,
    cost_micros bigint DEFAULT 0 NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    page_views_count bigint DEFAULT 0 NOT NULL,
    conversion_value_cents bigint DEFAULT 0 NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: analytics_daily_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_daily_metrics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_daily_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_daily_metrics_id_seq OWNED BY public.analytics_daily_metrics.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id bigint NOT NULL,
    kind character varying,
    title character varying,
    published_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: api_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_tokens (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token character varying,
    name character varying,
    metadata jsonb,
    transient boolean DEFAULT false,
    last_used_at timestamp without time zone,
    expires_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: api_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.api_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: api_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.api_tokens_id_seq OWNED BY public.api_tokens.id;


--
-- Name: app_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_events (
    id bigint NOT NULL,
    account_id bigint,
    user_id bigint,
    project_id bigint,
    campaign_id bigint,
    website_id bigint,
    event_name character varying NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: app_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_events_id_seq OWNED BY public.app_events.id;


--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: assistant_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assistant_versions (
    assistant_id text NOT NULL,
    version integer NOT NULL,
    graph_id text NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    context jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assistants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assistants (
    assistant_id text NOT NULL,
    graph_id text NOT NULL,
    name text NOT NULL,
    description text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    context jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: brainstorms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brainstorms (
    id bigint NOT NULL,
    idea character varying,
    audience character varying,
    solution character varying,
    social_proof character varying,
    look_and_feel character varying,
    website_id bigint,
    completed_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: brainstorms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brainstorms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brainstorms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brainstorms_id_seq OWNED BY public.brainstorms.id;


--
-- Name: campaign_deploys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaign_deploys (
    id bigint NOT NULL,
    campaign_id bigint NOT NULL,
    campaign_history_id bigint,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    current_step character varying,
    stacktrace text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone,
    shasum character varying
);


--
-- Name: campaign_deploys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaign_deploys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaign_deploys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaign_deploys_id_seq OWNED BY public.campaign_deploys.id;


--
-- Name: campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campaigns (
    id bigint NOT NULL,
    name character varying,
    status character varying DEFAULT 'draft'::character varying,
    stage character varying DEFAULT 'content'::character varying,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb,
    launched_at timestamp(6) without time zone,
    time_zone character varying DEFAULT 'America/New_York'::character varying,
    start_date date,
    end_date date,
    account_id bigint,
    website_id bigint,
    project_id bigint,
    ads_account_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campaigns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campaigns_id_seq OWNED BY public.campaigns.id;


--
-- Name: chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chats (
    id bigint NOT NULL,
    name character varying,
    chat_type character varying NOT NULL,
    thread_id character varying NOT NULL,
    project_id bigint,
    account_id bigint NOT NULL,
    contextable_type character varying,
    contextable_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: chats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chats_id_seq OWNED BY public.chats.id;


--
-- Name: checkpoint_blobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_blobs (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    channel text NOT NULL,
    version text NOT NULL,
    type text NOT NULL,
    blob bytea
);


--
-- Name: checkpoint_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_migrations (
    v integer NOT NULL
);


--
-- Name: checkpoint_writes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoint_writes (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    task_id text NOT NULL,
    idx integer NOT NULL,
    channel text NOT NULL,
    type text,
    blob bytea NOT NULL
);


--
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkpoints (
    thread_id text NOT NULL,
    checkpoint_ns text DEFAULT ''::text NOT NULL,
    checkpoint_id text NOT NULL,
    parent_checkpoint_id text,
    type text,
    checkpoint jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    run_id text
);


--
-- Name: cloudflare_firewall_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloudflare_firewall_rules (
    id bigint NOT NULL,
    firewall_id bigint NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    status character varying DEFAULT 'inactive'::character varying NOT NULL,
    cloudflare_rule_id character varying NOT NULL,
    blocked_at timestamp(6) without time zone,
    unblocked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: cloudflare_firewall_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cloudflare_firewall_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cloudflare_firewall_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cloudflare_firewall_rules_id_seq OWNED BY public.cloudflare_firewall_rules.id;


--
-- Name: cloudflare_firewalls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloudflare_firewalls (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    status character varying DEFAULT 'inactive'::character varying,
    blocked_at timestamp(6) without time zone,
    unblocked_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: cloudflare_firewalls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cloudflare_firewalls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cloudflare_firewalls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cloudflare_firewalls_id_seq OWNED BY public.cloudflare_firewalls.id;


--
-- Name: template_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_files (
    id bigint NOT NULL,
    template_id bigint,
    path character varying,
    content text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    shasum character varying,
    content_tsv tsvector
);


--
-- Name: website_file_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_file_histories (
    id bigint NOT NULL,
    website_file_id integer NOT NULL,
    website_id integer NOT NULL,
    path character varying NOT NULL,
    content character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    history_started_at timestamp(6) without time zone NOT NULL,
    history_ended_at timestamp(6) without time zone,
    history_user_id integer,
    snapshot_id character varying,
    shasum character varying,
    content_tsv tsvector,
    deleted_at timestamp(6) without time zone
);


--
-- Name: website_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_histories (
    id bigint NOT NULL,
    website_id integer NOT NULL,
    name character varying,
    project_id integer,
    account_id integer,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    history_started_at timestamp(6) without time zone NOT NULL,
    history_ended_at timestamp(6) without time zone,
    history_user_id integer,
    snapshot_id character varying,
    thread_id character varying,
    template_id integer,
    theme_id integer,
    deleted_at timestamp(6) without time zone
);


--
-- Name: websites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.websites (
    id bigint NOT NULL,
    name character varying,
    project_id bigint,
    account_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    template_id bigint,
    theme_id integer,
    deleted_at timestamp(6) without time zone
);


--
-- Name: code_file_histories; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.code_file_histories AS
 WITH merged_files AS (
         SELECT wfh.website_id,
            wfh.snapshot_id,
            wfh.path,
            wfh.content,
            wfh.content_tsv,
            wfh.shasum,
            wfh.created_at,
            wfh.updated_at,
            'WebsiteFile'::text AS source_type,
            wfh.website_file_id AS source_id
           FROM public.website_file_histories wfh
        UNION ALL
         SELECT wh.website_id,
            wh.snapshot_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
           FROM ((public.template_files tf
             JOIN public.websites w ON ((w.template_id = tf.template_id)))
             JOIN public.website_histories wh ON (((wh.website_id = w.id) AND (wh.snapshot_id IS NOT NULL))))
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM public.website_file_histories wfh2
                  WHERE ((wfh2.website_id = wh.website_id) AND ((wfh2.snapshot_id)::text = (wh.snapshot_id)::text) AND ((wfh2.path)::text = (tf.path)::text)))))
        )
 SELECT website_id,
    snapshot_id,
    path,
    content,
    content_tsv,
    shasum,
    source_type,
    source_id,
    created_at,
    updated_at
   FROM merged_files
  ORDER BY website_id, snapshot_id, path;


--
-- Name: website_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_files (
    id bigint NOT NULL,
    website_id bigint NOT NULL,
    path character varying NOT NULL,
    content character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    shasum character varying,
    content_tsv tsvector,
    deleted_at timestamp(6) without time zone
);


--
-- Name: code_files; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.code_files AS
 WITH merged_files AS (
         SELECT wf.website_id,
            wf.path,
            wf.content,
            wf.content_tsv,
            wf.shasum,
            wf.created_at,
            wf.updated_at,
            'WebsiteFile'::text AS source_type,
            wf.id AS source_id
           FROM public.website_files wf
          WHERE (wf.deleted_at IS NULL)
        UNION ALL
         SELECT w.id AS website_id,
            tf.path,
            tf.content,
            tf.content_tsv,
            tf.shasum,
            tf.created_at,
            tf.updated_at,
            'TemplateFile'::text AS source_type,
            tf.id AS source_id
           FROM (public.template_files tf
             JOIN public.websites w ON ((w.template_id = tf.template_id)))
          WHERE ((w.deleted_at IS NULL) AND (NOT (EXISTS ( SELECT 1
                   FROM public.website_files wf2
                  WHERE ((wf2.website_id = w.id) AND ((wf2.path)::text = (tf.path)::text) AND (wf2.deleted_at IS NULL))))))
        )
 SELECT website_id,
    path,
    content,
    content_tsv,
    shasum,
    source_type,
    source_id,
    created_at,
    updated_at
   FROM merged_files
  ORDER BY website_id, path;


--
-- Name: connected_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connected_accounts (
    id bigint NOT NULL,
    owner_id bigint,
    provider character varying,
    uid character varying,
    refresh_token character varying,
    expires_at timestamp without time zone,
    auth jsonb,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    access_token character varying,
    access_token_secret character varying,
    owner_type character varying
);


--
-- Name: connected_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.connected_accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: connected_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.connected_accounts_id_seq OWNED BY public.connected_accounts.id;


--
-- Name: credit_gifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_gifts (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    admin_id bigint NOT NULL,
    amount integer NOT NULL,
    reason character varying NOT NULL,
    notes text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    credits_allocated boolean DEFAULT false NOT NULL
);


--
-- Name: credit_gifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_gifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_gifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_gifts_id_seq OWNED BY public.credit_gifts.id;


--
-- Name: credit_pack_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_pack_purchases (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    credit_pack_id bigint NOT NULL,
    pay_charge_id bigint,
    credits_purchased integer NOT NULL,
    price_cents integer NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    credits_used integer DEFAULT 0 NOT NULL,
    credits_allocated boolean DEFAULT false NOT NULL
);


--
-- Name: credit_pack_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_pack_purchases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_pack_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_pack_purchases_id_seq OWNED BY public.credit_pack_purchases.id;


--
-- Name: credit_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_packs (
    id bigint NOT NULL,
    name character varying NOT NULL,
    credits integer NOT NULL,
    price_cents integer NOT NULL,
    currency character varying DEFAULT 'usd'::character varying,
    stripe_price_id character varying,
    visible boolean DEFAULT true,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: credit_packs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_packs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_packs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_packs_id_seq OWNED BY public.credit_packs.id;


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    transaction_type character varying NOT NULL,
    credit_type character varying NOT NULL,
    reason character varying NOT NULL,
    amount_millicredits bigint NOT NULL,
    balance_after_millicredits bigint NOT NULL,
    plan_balance_after_millicredits bigint NOT NULL,
    pack_balance_after_millicredits bigint NOT NULL,
    reference_type character varying,
    reference_id character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    idempotency_key character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_transactions_id_seq OWNED BY public.credit_transactions.id;


--
-- Name: credit_usage_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_usage_adjustments (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    admin_id bigint NOT NULL,
    amount integer NOT NULL,
    reason character varying NOT NULL,
    notes text,
    credits_adjusted boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: credit_usage_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credit_usage_adjustments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credit_usage_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credit_usage_adjustments_id_seq OWNED BY public.credit_usage_adjustments.id;


--
-- Name: dashboard_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_insights (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    insights jsonb DEFAULT '[]'::jsonb NOT NULL,
    metrics_summary jsonb,
    generated_at timestamp(6) without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: dashboard_insights_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dashboard_insights_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_insights_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dashboard_insights_id_seq OWNED BY public.dashboard_insights.id;


--
-- Name: deploy_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deploy_files (
    id bigint NOT NULL,
    deploy_id bigint,
    website_file_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: deploy_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deploy_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deploy_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deploy_files_id_seq OWNED BY public.deploy_files.id;


--
-- Name: deploys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deploys (
    id bigint NOT NULL,
    project_id bigint NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    current_step character varying,
    is_live boolean DEFAULT false,
    stacktrace text,
    website_deploy_id bigint,
    campaign_deploy_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    user_active_at timestamp(6) without time zone,
    deleted_at timestamp(6) without time zone,
    thread_id character varying NOT NULL,
    active boolean DEFAULT true NOT NULL,
    finished_at timestamp(6) without time zone,
    deploy_type character varying DEFAULT 'website'::character varying NOT NULL
);


--
-- Name: deploys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deploys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deploys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deploys_id_seq OWNED BY public.deploys.id;


--
-- Name: document_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_chunks (
    id bigint NOT NULL,
    document_id bigint NOT NULL,
    question_hash character varying NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    content text,
    section character varying,
    context jsonb DEFAULT '{}'::jsonb,
    "position" integer,
    embedding public.vector(1536),
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: document_chunks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_chunks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_chunks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_chunks_id_seq OWNED BY public.document_chunks.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id bigint NOT NULL,
    slug character varying NOT NULL,
    title character varying,
    content text,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    document_type character varying,
    source_type character varying,
    source_id character varying,
    source_url character varying,
    tags jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    last_synced_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: domain_request_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts (
    id bigint NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
)
PARTITION BY RANGE (hour);


--
-- Name: domain_request_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.domain_request_counts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: domain_request_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.domain_request_counts_id_seq OWNED BY public.domain_request_counts.id;


--
-- Name: domain_request_counts_2025_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_10 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_11 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_12 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_01 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_02 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_03 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_04 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_05 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_06 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_07 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_08 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_09 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_10 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_11 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2026_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2026_12 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domains (
    id bigint NOT NULL,
    domain character varying,
    account_id bigint,
    cloudflare_zone_id character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    is_platform_subdomain boolean DEFAULT false NOT NULL,
    deleted_at timestamp(6) without time zone,
    dns_verification_status character varying,
    dns_last_checked_at timestamp(6) without time zone,
    dns_error_message character varying
);


--
-- Name: domains_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.domains_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: domains_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.domains_id_seq OWNED BY public.domains.id;


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id bigint NOT NULL,
    question character varying NOT NULL,
    answer text NOT NULL,
    category character varying NOT NULL,
    subcategory character varying,
    slug character varying NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    published boolean DEFAULT true NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: faqs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faqs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faqs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faqs_id_seq OWNED BY public.faqs.id;


--
-- Name: geo_target_constants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geo_target_constants (
    id bigint NOT NULL,
    criteria_id bigint NOT NULL,
    name character varying NOT NULL,
    canonical_name character varying NOT NULL,
    parent_id bigint,
    country_code character varying,
    target_type character varying NOT NULL,
    status character varying DEFAULT 'Active'::character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: geo_target_constants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.geo_target_constants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: geo_target_constants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.geo_target_constants_id_seq OWNED BY public.geo_target_constants.id;


--
-- Name: icon_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icon_embeddings (
    id bigint NOT NULL,
    key character varying NOT NULL,
    text text NOT NULL,
    embedding public.vector(1536) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone
);


--
-- Name: icon_embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.icon_embeddings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: icon_embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.icon_embeddings_id_seq OWNED BY public.icon_embeddings.id;


--
-- Name: icon_query_caches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.icon_query_caches (
    id bigint NOT NULL,
    query character varying NOT NULL,
    results jsonb DEFAULT '[]'::jsonb NOT NULL,
    use_count integer DEFAULT 0 NOT NULL,
    ttl_seconds integer DEFAULT 86400 NOT NULL,
    min_similarity double precision DEFAULT 0.7 NOT NULL,
    top_k integer NOT NULL,
    last_used_at timestamp without time zone NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: icon_query_caches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.icon_query_caches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: icon_query_caches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.icon_query_caches_id_seq OWNED BY public.icon_query_caches.id;


--
-- Name: inbound_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_webhooks (
    id bigint NOT NULL,
    status integer DEFAULT 0 NOT NULL,
    body text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: inbound_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inbound_webhooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inbound_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inbound_webhooks_id_seq OWNED BY public.inbound_webhooks.id;


--
-- Name: job_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_runs (
    id bigint NOT NULL,
    job_class character varying NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    job_args jsonb DEFAULT '{}'::jsonb,
    started_at timestamp(6) without time zone,
    completed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    account_id bigint,
    langgraph_thread_id character varying,
    result_data jsonb DEFAULT '{}'::jsonb,
    deploy_id bigint,
    error_type character varying
);


--
-- Name: job_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.job_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: job_runs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.job_runs_id_seq OWNED BY public.job_runs.id;


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    account_id bigint NOT NULL,
    phone character varying(50)
);


--
-- Name: leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leads_id_seq OWNED BY public.leads.id;


--
-- Name: llm_conversation_traces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_conversation_traces (
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    thread_id character varying NOT NULL,
    run_id character varying NOT NULL,
    graph_name character varying,
    messages jsonb NOT NULL,
    system_prompt text,
    usage_summary jsonb,
    llm_calls jsonb,
    created_at timestamp without time zone NOT NULL
)
PARTITION BY RANGE (created_at);


--
-- Name: llm_conversation_traces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.llm_conversation_traces_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: llm_conversation_traces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.llm_conversation_traces_id_seq OWNED BY public.llm_conversation_traces.id;


--
-- Name: llm_conversation_traces_2026_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_conversation_traces_2026_01 (
    id bigint DEFAULT nextval('public.llm_conversation_traces_id_seq'::regclass) NOT NULL,
    chat_id bigint NOT NULL,
    thread_id character varying NOT NULL,
    run_id character varying NOT NULL,
    graph_name character varying,
    messages jsonb NOT NULL,
    system_prompt text,
    usage_summary jsonb,
    llm_calls jsonb,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: llm_conversation_traces_2026_02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_conversation_traces_2026_02 (
    id bigint DEFAULT nextval('public.llm_conversation_traces_id_seq'::regclass) NOT NULL,
    chat_id bigint NOT NULL,
    thread_id character varying NOT NULL,
    run_id character varying NOT NULL,
    graph_name character varying,
    messages jsonb NOT NULL,
    system_prompt text,
    usage_summary jsonb,
    llm_calls jsonb,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: llm_conversation_traces_2026_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_conversation_traces_2026_03 (
    id bigint DEFAULT nextval('public.llm_conversation_traces_id_seq'::regclass) NOT NULL,
    chat_id bigint NOT NULL,
    thread_id character varying NOT NULL,
    run_id character varying NOT NULL,
    graph_name character varying,
    messages jsonb NOT NULL,
    system_prompt text,
    usage_summary jsonb,
    llm_calls jsonb,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: llm_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_usage (
    id bigint NOT NULL,
    chat_id bigint NOT NULL,
    thread_id character varying NOT NULL,
    run_id character varying NOT NULL,
    message_id character varying,
    langchain_run_id character varying,
    parent_langchain_run_id character varying,
    graph_name character varying,
    model_raw character varying NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    reasoning_tokens integer DEFAULT 0,
    cache_creation_tokens integer DEFAULT 0,
    cache_read_tokens integer DEFAULT 0,
    cost_millicredits bigint,
    tags character varying[] DEFAULT '{}'::character varying[],
    metadata jsonb,
    processed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: llm_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.llm_usage_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: llm_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.llm_usage_id_seq OWNED BY public.llm_usage.id;


--
-- Name: model_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_configs (
    id bigint NOT NULL,
    model_key character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    max_usage_percent integer DEFAULT 100,
    cost_in numeric(10,4),
    cost_out numeric(10,4),
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    model_card character varying,
    cache_writes numeric(10,4),
    cache_reads numeric(10,4),
    cost_reasoning numeric(10,4),
    provider character varying
);


--
-- Name: model_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.model_configs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: model_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.model_configs_id_seq OWNED BY public.model_configs.id;


--
-- Name: model_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_preferences (
    id bigint NOT NULL,
    cost_tier character varying NOT NULL,
    speed_tier character varying NOT NULL,
    skill character varying NOT NULL,
    model_keys character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: model_preferences_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.model_preferences_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: model_preferences_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.model_preferences_id_seq OWNED BY public.model_preferences.id;


--
-- Name: noticed_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.noticed_events (
    id bigint NOT NULL,
    account_id bigint,
    type character varying,
    record_type character varying,
    record_id bigint,
    params jsonb,
    notifications_count integer,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: noticed_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.noticed_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: noticed_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.noticed_events_id_seq OWNED BY public.noticed_events.id;


--
-- Name: noticed_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.noticed_notifications (
    id bigint NOT NULL,
    account_id bigint,
    type character varying,
    event_id bigint NOT NULL,
    recipient_type character varying NOT NULL,
    recipient_id bigint NOT NULL,
    read_at timestamp without time zone,
    seen_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: noticed_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.noticed_notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: noticed_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.noticed_notifications_id_seq OWNED BY public.noticed_notifications.id;


--
-- Name: notification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_tokens (
    id bigint NOT NULL,
    user_id bigint,
    token character varying NOT NULL,
    platform character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: notification_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_tokens_id_seq OWNED BY public.notification_tokens.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    recipient_type character varying NOT NULL,
    recipient_id bigint NOT NULL,
    type character varying,
    params jsonb,
    read_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    interacted_at timestamp without time zone
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: pay_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_charges (
    id bigint NOT NULL,
    processor_id character varying NOT NULL,
    amount integer NOT NULL,
    amount_refunded integer,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    data jsonb,
    application_fee_amount integer,
    currency character varying,
    metadata jsonb,
    subscription_id integer,
    customer_id bigint,
    stripe_account character varying,
    type character varying
);


--
-- Name: pay_charges_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_charges_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_charges_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_charges_id_seq OWNED BY public.pay_charges.id;


--
-- Name: pay_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_customers (
    id bigint NOT NULL,
    owner_type character varying,
    owner_id bigint,
    processor character varying,
    processor_id character varying,
    "default" boolean,
    data jsonb,
    deleted_at timestamp without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    stripe_account character varying,
    type character varying
);


--
-- Name: pay_customers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_customers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_customers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_customers_id_seq OWNED BY public.pay_customers.id;


--
-- Name: pay_merchants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_merchants (
    id bigint NOT NULL,
    owner_type character varying,
    owner_id bigint,
    processor character varying,
    processor_id character varying,
    "default" boolean,
    data jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    type character varying
);


--
-- Name: pay_merchants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_merchants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_merchants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_merchants_id_seq OWNED BY public.pay_merchants.id;


--
-- Name: pay_payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_payment_methods (
    id bigint NOT NULL,
    customer_id bigint,
    processor_id character varying,
    "default" boolean,
    payment_method_type character varying,
    data jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    stripe_account character varying,
    type character varying
);


--
-- Name: pay_payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_payment_methods_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_payment_methods_id_seq OWNED BY public.pay_payment_methods.id;


--
-- Name: pay_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_subscriptions (
    id integer NOT NULL,
    name character varying NOT NULL,
    processor_id character varying NOT NULL,
    processor_plan character varying NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    trial_ends_at timestamp without time zone,
    ends_at timestamp without time zone,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    status character varying,
    data jsonb,
    application_fee_percent numeric(8,2),
    metadata jsonb,
    customer_id bigint,
    current_period_start timestamp(6) without time zone,
    current_period_end timestamp(6) without time zone,
    metered boolean,
    pause_behavior character varying,
    pause_starts_at timestamp(6) without time zone,
    pause_resumes_at timestamp(6) without time zone,
    payment_method_id character varying,
    stripe_account character varying,
    type character varying
);


--
-- Name: pay_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_subscriptions_id_seq OWNED BY public.pay_subscriptions.id;


--
-- Name: pay_webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pay_webhooks (
    id bigint NOT NULL,
    processor character varying,
    event_type character varying,
    event jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: pay_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pay_webhooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pay_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pay_webhooks_id_seq OWNED BY public.pay_webhooks.id;


--
-- Name: plan_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_tiers (
    id bigint NOT NULL,
    name character varying NOT NULL,
    description character varying,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: plan_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_tiers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_tiers_id_seq OWNED BY public.plan_tiers.id;


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id bigint NOT NULL,
    name character varying NOT NULL,
    amount integer DEFAULT 0 NOT NULL,
    "interval" character varying NOT NULL,
    details jsonb,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    trial_period_days integer DEFAULT 0,
    hidden boolean,
    currency character varying,
    interval_count integer DEFAULT 1,
    description character varying,
    unit_label character varying,
    charge_per_unit boolean,
    stripe_id character varying,
    braintree_id character varying,
    paddle_billing_id character varying,
    paddle_classic_id character varying,
    lemon_squeezy_id character varying,
    fake_processor_id character varying,
    contact_url character varying,
    plan_tier_id bigint
);


--
-- Name: plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;


--
-- Name: project_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_workflows (
    id bigint NOT NULL,
    project_id bigint NOT NULL,
    workflow_type character varying NOT NULL,
    step character varying NOT NULL,
    substep character varying,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: project_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_workflows_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_workflows_id_seq OWNED BY public.project_workflows.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id bigint NOT NULL,
    name character varying NOT NULL,
    account_id bigint NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp(6) without time zone,
    status character varying DEFAULT 'draft'::character varying NOT NULL
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.runs (
    run_id text NOT NULL,
    thread_id text NOT NULL,
    assistant_id text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    kwargs jsonb DEFAULT '{}'::jsonb NOT NULL,
    multitask_strategy text DEFAULT 'reject'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: social_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_links (
    id bigint NOT NULL,
    project_id bigint NOT NULL,
    platform character varying NOT NULL,
    url character varying NOT NULL,
    handle character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: social_links_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.social_links_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: social_links_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.social_links_id_seq OWNED BY public.social_links.id;


--
-- Name: store; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store (
    namespace_path text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone
);


--
-- Name: store_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.store_migrations (
    v integer NOT NULL
);


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_requests (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    account_id bigint NOT NULL,
    category character varying NOT NULL,
    subject character varying NOT NULL,
    description text NOT NULL,
    subscription_tier character varying,
    credits_remaining integer,
    submitted_from_url character varying,
    browser_info text,
    slack_notified boolean DEFAULT false,
    notion_created boolean DEFAULT false,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    ticket_id character varying NOT NULL,
    supportable_type character varying,
    supportable_id bigint
);


--
-- Name: support_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_requests_id_seq OWNED BY public.support_requests.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id bigint NOT NULL,
    type character varying,
    subtype character varying,
    title character varying,
    instructions character varying,
    status character varying,
    action character varying,
    component_id bigint,
    component_type character varying,
    component_overview_id bigint,
    results jsonb,
    project_id bigint,
    website_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    website_file_id integer,
    path character varying
);


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: template_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.template_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: template_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.template_files_id_seq OWNED BY public.template_files.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.templates (
    id bigint NOT NULL,
    name character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.templates_id_seq OWNED BY public.templates.id;


--
-- Name: theme_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.theme_labels (
    id bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: theme_labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.theme_labels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: theme_labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.theme_labels_id_seq OWNED BY public.theme_labels.id;


--
-- Name: themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes (
    id bigint NOT NULL,
    name character varying NOT NULL,
    colors jsonb DEFAULT '{}'::jsonb,
    theme jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    theme_type character varying NOT NULL,
    author_id bigint,
    pairings jsonb,
    typography_recommendations jsonb
);


--
-- Name: themes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.themes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: themes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.themes_id_seq OWNED BY public.themes.id;


--
-- Name: themes_to_theme_labels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.themes_to_theme_labels (
    id bigint NOT NULL,
    theme_id bigint NOT NULL,
    theme_label_id bigint NOT NULL
);


--
-- Name: themes_to_theme_labels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.themes_to_theme_labels_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: themes_to_theme_labels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.themes_to_theme_labels_id_seq OWNED BY public.themes_to_theme_labels.id;


--
-- Name: threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.threads (
    thread_id text NOT NULL,
    status text DEFAULT 'idle'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "values" jsonb,
    interrupts jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tier_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tier_limits (
    id bigint NOT NULL,
    limit_type character varying,
    "limit" integer,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    tier_id bigint
);


--
-- Name: tier_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tier_limits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tier_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tier_limits_id_seq OWNED BY public.tier_limits.id;


--
-- Name: uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uploads (
    id bigint NOT NULL,
    account_id bigint NOT NULL,
    file character varying NOT NULL,
    media_type character varying NOT NULL,
    uuid uuid DEFAULT gen_random_uuid() NOT NULL,
    is_logo boolean DEFAULT false NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    original_filename character varying,
    platform_settings jsonb DEFAULT '{"meta": {}, "google": {}}'::jsonb
);


--
-- Name: uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.uploads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.uploads_id_seq OWNED BY public.uploads.id;


--
-- Name: user_request_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_request_counts (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
)
PARTITION BY RANGE (month);


--
-- Name: user_request_counts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_request_counts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_request_counts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_request_counts_id_seq OWNED BY public.user_request_counts.id;


--
-- Name: user_request_counts_2025_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_request_counts_2025_08 (
    id bigint DEFAULT nextval('public.user_request_counts_id_seq'::regclass) NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: user_request_counts_2025_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_request_counts_2025_09 (
    id bigint DEFAULT nextval('public.user_request_counts_id_seq'::regclass) NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: user_request_counts_2025_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_request_counts_2025_10 (
    id bigint DEFAULT nextval('public.user_request_counts_id_seq'::regclass) NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: user_request_counts_2025_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_request_counts_2025_11 (
    id bigint DEFAULT nextval('public.user_request_counts_id_seq'::regclass) NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    month timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying DEFAULT ''::character varying NOT NULL,
    encrypted_password character varying DEFAULT ''::character varying NOT NULL,
    reset_password_token character varying,
    reset_password_sent_at timestamp without time zone,
    remember_created_at timestamp without time zone,
    confirmation_token character varying,
    confirmed_at timestamp without time zone,
    confirmation_sent_at timestamp without time zone,
    unconfirmed_email character varying,
    first_name character varying,
    last_name character varying,
    time_zone character varying,
    accepted_terms_at timestamp without time zone,
    accepted_privacy_at timestamp without time zone,
    announcements_read_at timestamp without time zone,
    admin boolean,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    invitation_token character varying,
    invitation_created_at timestamp without time zone,
    invitation_sent_at timestamp without time zone,
    invitation_accepted_at timestamp without time zone,
    invitation_limit integer,
    invited_by_type character varying,
    invited_by_id bigint,
    invitations_count integer DEFAULT 0,
    preferred_language character varying,
    otp_required_for_login boolean,
    otp_secret character varying,
    last_otp_timestep integer,
    otp_backup_codes text,
    preferences jsonb,
    name character varying GENERATED ALWAYS AS ((((first_name)::text || ' '::text) || (COALESCE(last_name, ''::character varying))::text)) STORED,
    jti character varying NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: website_deploys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_deploys (
    id bigint NOT NULL,
    website_id bigint,
    website_history_id bigint,
    status character varying NOT NULL,
    trigger character varying DEFAULT 'manual'::character varying,
    stacktrace text,
    snapshot_id character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    is_live boolean DEFAULT false,
    revertible boolean DEFAULT false,
    version_path character varying,
    environment character varying DEFAULT 'production'::character varying NOT NULL,
    is_preview boolean DEFAULT false NOT NULL,
    shasum character varying,
    deleted_at timestamp(6) without time zone
);


--
-- Name: website_deploys_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_deploys_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_deploys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_deploys_id_seq OWNED BY public.website_deploys.id;


--
-- Name: website_file_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_file_histories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_file_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_file_histories_id_seq OWNED BY public.website_file_histories.id;


--
-- Name: website_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_files_id_seq OWNED BY public.website_files.id;


--
-- Name: website_histories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_histories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_histories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_histories_id_seq OWNED BY public.website_histories.id;


--
-- Name: website_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_leads (
    id bigint NOT NULL,
    lead_id bigint NOT NULL,
    website_id bigint NOT NULL,
    visit_id bigint,
    visitor_token character varying,
    gclid character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    utm_source character varying,
    utm_medium character varying,
    utm_campaign character varying,
    utm_content character varying,
    utm_term character varying,
    deleted_at timestamp(6) without time zone,
    fbclid character varying
);


--
-- Name: website_leads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_leads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_leads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_leads_id_seq OWNED BY public.website_leads.id;


--
-- Name: website_uploads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_uploads (
    id bigint NOT NULL,
    website_id bigint NOT NULL,
    upload_id bigint NOT NULL
);


--
-- Name: website_uploads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_uploads_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_uploads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_uploads_id_seq OWNED BY public.website_uploads.id;


--
-- Name: website_urls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_urls (
    id bigint NOT NULL,
    website_id bigint NOT NULL,
    domain_id bigint NOT NULL,
    account_id bigint NOT NULL,
    path character varying DEFAULT '/'::character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone
);


--
-- Name: website_urls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.website_urls_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: website_urls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.website_urls_id_seq OWNED BY public.website_urls.id;


--
-- Name: websites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.websites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: websites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.websites_id_seq OWNED BY public.websites.id;


--
-- Name: account_request_counts_2025_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2025_08 FOR VALUES FROM ('2025-07-31 20:00:00-04') TO ('2025-08-31 20:00:00-04');


--
-- Name: account_request_counts_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2025_09 FOR VALUES FROM ('2025-08-31 20:00:00-04') TO ('2025-09-30 20:00:00-04');


--
-- Name: account_request_counts_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2025_10 FOR VALUES FROM ('2025-09-30 20:00:00-04') TO ('2025-10-31 20:00:00-04');


--
-- Name: account_request_counts_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2025_11 FOR VALUES FROM ('2025-10-31 20:00:00-04') TO ('2025-11-30 19:00:00-05');


--
-- Name: account_request_counts_2025_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2025_12 FOR VALUES FROM ('2025-11-30 19:00:00-05') TO ('2025-12-31 19:00:00-05');


--
-- Name: account_request_counts_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_01 FOR VALUES FROM ('2025-12-31 19:00:00-05') TO ('2026-01-31 19:00:00-05');


--
-- Name: account_request_counts_2026_02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_02 FOR VALUES FROM ('2026-01-31 19:00:00-05') TO ('2026-02-28 19:00:00-05');


--
-- Name: account_request_counts_2026_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_03 FOR VALUES FROM ('2026-02-28 19:00:00-05') TO ('2026-03-31 20:00:00-04');


--
-- Name: account_request_counts_2026_04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_04 FOR VALUES FROM ('2026-03-31 20:00:00-04') TO ('2026-04-30 20:00:00-04');


--
-- Name: account_request_counts_2026_05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_05 FOR VALUES FROM ('2026-04-30 20:00:00-04') TO ('2026-05-31 20:00:00-04');


--
-- Name: account_request_counts_2026_06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_06 FOR VALUES FROM ('2026-05-31 20:00:00-04') TO ('2026-06-30 20:00:00-04');


--
-- Name: account_request_counts_2026_07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_07 FOR VALUES FROM ('2026-06-30 20:00:00-04') TO ('2026-07-31 20:00:00-04');


--
-- Name: account_request_counts_2026_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_08 FOR VALUES FROM ('2026-07-31 20:00:00-04') TO ('2026-08-31 20:00:00-04');


--
-- Name: account_request_counts_2026_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_09 FOR VALUES FROM ('2026-08-31 20:00:00-04') TO ('2026-09-30 20:00:00-04');


--
-- Name: account_request_counts_2026_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_10 FOR VALUES FROM ('2026-09-30 20:00:00-04') TO ('2026-10-31 20:00:00-04');


--
-- Name: account_request_counts_2026_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_11 FOR VALUES FROM ('2026-10-31 20:00:00-04') TO ('2026-11-30 19:00:00-05');


--
-- Name: account_request_counts_2026_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ATTACH PARTITION public.account_request_counts_2026_12 FOR VALUES FROM ('2026-11-30 19:00:00-05') TO ('2026-12-31 19:00:00-05');


--
-- Name: domain_request_counts_2025_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08 FOR VALUES FROM ('2025-07-31 20:00:00-04') TO ('2025-08-31 20:00:00-04');


--
-- Name: domain_request_counts_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09 FOR VALUES FROM ('2025-08-31 20:00:00-04') TO ('2025-09-30 20:00:00-04');


--
-- Name: domain_request_counts_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_10 FOR VALUES FROM ('2025-09-30 20:00:00-04') TO ('2025-10-31 20:00:00-04');


--
-- Name: domain_request_counts_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_11 FOR VALUES FROM ('2025-10-31 20:00:00-04') TO ('2025-11-30 19:00:00-05');


--
-- Name: domain_request_counts_2025_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_12 FOR VALUES FROM ('2025-11-30 19:00:00-05') TO ('2025-12-31 19:00:00-05');


--
-- Name: domain_request_counts_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_01 FOR VALUES FROM ('2025-12-31 19:00:00-05') TO ('2026-01-31 19:00:00-05');


--
-- Name: domain_request_counts_2026_02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_02 FOR VALUES FROM ('2026-01-31 19:00:00-05') TO ('2026-02-28 19:00:00-05');


--
-- Name: domain_request_counts_2026_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_03 FOR VALUES FROM ('2026-02-28 19:00:00-05') TO ('2026-03-31 20:00:00-04');


--
-- Name: domain_request_counts_2026_04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_04 FOR VALUES FROM ('2026-03-31 20:00:00-04') TO ('2026-04-30 20:00:00-04');


--
-- Name: domain_request_counts_2026_05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_05 FOR VALUES FROM ('2026-04-30 20:00:00-04') TO ('2026-05-31 20:00:00-04');


--
-- Name: domain_request_counts_2026_06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_06 FOR VALUES FROM ('2026-05-31 20:00:00-04') TO ('2026-06-30 20:00:00-04');


--
-- Name: domain_request_counts_2026_07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_07 FOR VALUES FROM ('2026-06-30 20:00:00-04') TO ('2026-07-31 20:00:00-04');


--
-- Name: domain_request_counts_2026_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_08 FOR VALUES FROM ('2026-07-31 20:00:00-04') TO ('2026-08-31 20:00:00-04');


--
-- Name: domain_request_counts_2026_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_09 FOR VALUES FROM ('2026-08-31 20:00:00-04') TO ('2026-09-30 20:00:00-04');


--
-- Name: domain_request_counts_2026_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_10 FOR VALUES FROM ('2026-09-30 20:00:00-04') TO ('2026-10-31 20:00:00-04');


--
-- Name: domain_request_counts_2026_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_11 FOR VALUES FROM ('2026-10-31 20:00:00-04') TO ('2026-11-30 19:00:00-05');


--
-- Name: domain_request_counts_2026_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2026_12 FOR VALUES FROM ('2026-11-30 19:00:00-05') TO ('2026-12-31 19:00:00-05');


--
-- Name: llm_conversation_traces_2026_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces ATTACH PARTITION public.llm_conversation_traces_2026_01 FOR VALUES FROM ('2026-01-01 00:00:00') TO ('2026-02-01 00:00:00');


--
-- Name: llm_conversation_traces_2026_02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces ATTACH PARTITION public.llm_conversation_traces_2026_02 FOR VALUES FROM ('2026-02-01 00:00:00') TO ('2026-03-01 00:00:00');


--
-- Name: llm_conversation_traces_2026_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces ATTACH PARTITION public.llm_conversation_traces_2026_03 FOR VALUES FROM ('2026-03-01 00:00:00') TO ('2026-04-01 00:00:00');


--
-- Name: user_request_counts_2025_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ATTACH PARTITION public.user_request_counts_2025_08 FOR VALUES FROM ('2025-07-31 20:00:00-04') TO ('2025-08-31 20:00:00-04');


--
-- Name: user_request_counts_2025_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ATTACH PARTITION public.user_request_counts_2025_09 FOR VALUES FROM ('2025-08-31 20:00:00-04') TO ('2025-09-30 20:00:00-04');


--
-- Name: user_request_counts_2025_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ATTACH PARTITION public.user_request_counts_2025_10 FOR VALUES FROM ('2025-09-30 20:00:00-04') TO ('2025-10-31 20:00:00-04');


--
-- Name: user_request_counts_2025_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ATTACH PARTITION public.user_request_counts_2025_11 FOR VALUES FROM ('2025-10-31 20:00:00-04') TO ('2025-11-30 19:00:00-05');


--
-- Name: account_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations ALTER COLUMN id SET DEFAULT nextval('public.account_invitations_id_seq'::regclass);


--
-- Name: account_request_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts ALTER COLUMN id SET DEFAULT nextval('public.account_request_counts_id_seq'::regclass);


--
-- Name: account_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_users ALTER COLUMN id SET DEFAULT nextval('public.account_users_id_seq'::regclass);


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: action_text_embeds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_text_embeds ALTER COLUMN id SET DEFAULT nextval('public.action_text_embeds_id_seq'::regclass);


--
-- Name: action_text_rich_texts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_text_rich_texts ALTER COLUMN id SET DEFAULT nextval('public.action_text_rich_texts_id_seq'::regclass);


--
-- Name: active_storage_attachments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_attachments ALTER COLUMN id SET DEFAULT nextval('public.active_storage_attachments_id_seq'::regclass);


--
-- Name: active_storage_blobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_blobs ALTER COLUMN id SET DEFAULT nextval('public.active_storage_blobs_id_seq'::regclass);


--
-- Name: active_storage_variant_records id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records ALTER COLUMN id SET DEFAULT nextval('public.active_storage_variant_records_id_seq'::regclass);


--
-- Name: ad_budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_budgets ALTER COLUMN id SET DEFAULT nextval('public.ad_budgets_id_seq'::regclass);


--
-- Name: ad_callouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_callouts ALTER COLUMN id SET DEFAULT nextval('public.ad_callouts_id_seq'::regclass);


--
-- Name: ad_descriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_descriptions ALTER COLUMN id SET DEFAULT nextval('public.ad_descriptions_id_seq'::regclass);


--
-- Name: ad_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_groups ALTER COLUMN id SET DEFAULT nextval('public.ad_groups_id_seq'::regclass);


--
-- Name: ad_headlines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_headlines ALTER COLUMN id SET DEFAULT nextval('public.ad_headlines_id_seq'::regclass);


--
-- Name: ad_keywords id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_keywords ALTER COLUMN id SET DEFAULT nextval('public.ad_keywords_id_seq'::regclass);


--
-- Name: ad_languages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_languages ALTER COLUMN id SET DEFAULT nextval('public.ad_languages_id_seq'::regclass);


--
-- Name: ad_location_targets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_location_targets ALTER COLUMN id SET DEFAULT nextval('public.ad_location_targets_id_seq'::regclass);


--
-- Name: ad_performance_daily id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily ALTER COLUMN id SET DEFAULT nextval('public.ad_performance_daily_id_seq'::regclass);


--
-- Name: ad_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_schedules ALTER COLUMN id SET DEFAULT nextval('public.ad_schedules_id_seq'::regclass);


--
-- Name: ad_structured_snippets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_structured_snippets ALTER COLUMN id SET DEFAULT nextval('public.ad_structured_snippets_id_seq'::regclass);


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: ads_account_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads_account_invitations ALTER COLUMN id SET DEFAULT nextval('public.ads_account_invitations_id_seq'::regclass);


--
-- Name: ads_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads_accounts ALTER COLUMN id SET DEFAULT nextval('public.ads_accounts_id_seq'::regclass);


--
-- Name: agent_context_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_context_events ALTER COLUMN id SET DEFAULT nextval('public.agent_context_events_id_seq'::regclass);


--
-- Name: ahoy_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahoy_events ALTER COLUMN id SET DEFAULT nextval('public.ahoy_events_id_seq'::regclass);


--
-- Name: ahoy_visits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahoy_visits ALTER COLUMN id SET DEFAULT nextval('public.ahoy_visits_id_seq'::regclass);


--
-- Name: analytics_daily_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_metrics ALTER COLUMN id SET DEFAULT nextval('public.analytics_daily_metrics_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: api_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens ALTER COLUMN id SET DEFAULT nextval('public.api_tokens_id_seq'::regclass);


--
-- Name: app_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_events ALTER COLUMN id SET DEFAULT nextval('public.app_events_id_seq'::regclass);


--
-- Name: brainstorms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brainstorms ALTER COLUMN id SET DEFAULT nextval('public.brainstorms_id_seq'::regclass);


--
-- Name: campaign_deploys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deploys ALTER COLUMN id SET DEFAULT nextval('public.campaign_deploys_id_seq'::regclass);


--
-- Name: campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns ALTER COLUMN id SET DEFAULT nextval('public.campaigns_id_seq'::regclass);


--
-- Name: chats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats ALTER COLUMN id SET DEFAULT nextval('public.chats_id_seq'::regclass);


--
-- Name: cloudflare_firewall_rules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloudflare_firewall_rules ALTER COLUMN id SET DEFAULT nextval('public.cloudflare_firewall_rules_id_seq'::regclass);


--
-- Name: cloudflare_firewalls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloudflare_firewalls ALTER COLUMN id SET DEFAULT nextval('public.cloudflare_firewalls_id_seq'::regclass);


--
-- Name: connected_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts ALTER COLUMN id SET DEFAULT nextval('public.connected_accounts_id_seq'::regclass);


--
-- Name: credit_gifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_gifts ALTER COLUMN id SET DEFAULT nextval('public.credit_gifts_id_seq'::regclass);


--
-- Name: credit_pack_purchases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases ALTER COLUMN id SET DEFAULT nextval('public.credit_pack_purchases_id_seq'::regclass);


--
-- Name: credit_packs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packs ALTER COLUMN id SET DEFAULT nextval('public.credit_packs_id_seq'::regclass);


--
-- Name: credit_transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions ALTER COLUMN id SET DEFAULT nextval('public.credit_transactions_id_seq'::regclass);


--
-- Name: credit_usage_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_usage_adjustments ALTER COLUMN id SET DEFAULT nextval('public.credit_usage_adjustments_id_seq'::regclass);


--
-- Name: dashboard_insights id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_insights ALTER COLUMN id SET DEFAULT nextval('public.dashboard_insights_id_seq'::regclass);


--
-- Name: deploy_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploy_files ALTER COLUMN id SET DEFAULT nextval('public.deploy_files_id_seq'::regclass);


--
-- Name: deploys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys ALTER COLUMN id SET DEFAULT nextval('public.deploys_id_seq'::regclass);


--
-- Name: document_chunks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks ALTER COLUMN id SET DEFAULT nextval('public.document_chunks_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: domain_request_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ALTER COLUMN id SET DEFAULT nextval('public.domain_request_counts_id_seq'::regclass);


--
-- Name: domains id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains ALTER COLUMN id SET DEFAULT nextval('public.domains_id_seq'::regclass);


--
-- Name: faqs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs ALTER COLUMN id SET DEFAULT nextval('public.faqs_id_seq'::regclass);


--
-- Name: geo_target_constants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_target_constants ALTER COLUMN id SET DEFAULT nextval('public.geo_target_constants_id_seq'::regclass);


--
-- Name: icon_embeddings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_embeddings ALTER COLUMN id SET DEFAULT nextval('public.icon_embeddings_id_seq'::regclass);


--
-- Name: icon_query_caches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_query_caches ALTER COLUMN id SET DEFAULT nextval('public.icon_query_caches_id_seq'::regclass);


--
-- Name: inbound_webhooks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhooks ALTER COLUMN id SET DEFAULT nextval('public.inbound_webhooks_id_seq'::regclass);


--
-- Name: job_runs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_runs ALTER COLUMN id SET DEFAULT nextval('public.job_runs_id_seq'::regclass);


--
-- Name: leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads ALTER COLUMN id SET DEFAULT nextval('public.leads_id_seq'::regclass);


--
-- Name: llm_conversation_traces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces ALTER COLUMN id SET DEFAULT nextval('public.llm_conversation_traces_id_seq'::regclass);


--
-- Name: llm_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage ALTER COLUMN id SET DEFAULT nextval('public.llm_usage_id_seq'::regclass);


--
-- Name: model_configs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs ALTER COLUMN id SET DEFAULT nextval('public.model_configs_id_seq'::regclass);


--
-- Name: model_preferences id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_preferences ALTER COLUMN id SET DEFAULT nextval('public.model_preferences_id_seq'::regclass);


--
-- Name: noticed_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticed_events ALTER COLUMN id SET DEFAULT nextval('public.noticed_events_id_seq'::regclass);


--
-- Name: noticed_notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticed_notifications ALTER COLUMN id SET DEFAULT nextval('public.noticed_notifications_id_seq'::regclass);


--
-- Name: notification_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens ALTER COLUMN id SET DEFAULT nextval('public.notification_tokens_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: pay_charges id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_charges ALTER COLUMN id SET DEFAULT nextval('public.pay_charges_id_seq'::regclass);


--
-- Name: pay_customers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_customers ALTER COLUMN id SET DEFAULT nextval('public.pay_customers_id_seq'::regclass);


--
-- Name: pay_merchants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_merchants ALTER COLUMN id SET DEFAULT nextval('public.pay_merchants_id_seq'::regclass);


--
-- Name: pay_payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_payment_methods ALTER COLUMN id SET DEFAULT nextval('public.pay_payment_methods_id_seq'::regclass);


--
-- Name: pay_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.pay_subscriptions_id_seq'::regclass);


--
-- Name: pay_webhooks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_webhooks ALTER COLUMN id SET DEFAULT nextval('public.pay_webhooks_id_seq'::regclass);


--
-- Name: plan_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tiers ALTER COLUMN id SET DEFAULT nextval('public.plan_tiers_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: project_workflows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_workflows ALTER COLUMN id SET DEFAULT nextval('public.project_workflows_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: social_links id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_links ALTER COLUMN id SET DEFAULT nextval('public.social_links_id_seq'::regclass);


--
-- Name: support_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests ALTER COLUMN id SET DEFAULT nextval('public.support_requests_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: template_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_files ALTER COLUMN id SET DEFAULT nextval('public.template_files_id_seq'::regclass);


--
-- Name: templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates ALTER COLUMN id SET DEFAULT nextval('public.templates_id_seq'::regclass);


--
-- Name: theme_labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_labels ALTER COLUMN id SET DEFAULT nextval('public.theme_labels_id_seq'::regclass);


--
-- Name: themes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes ALTER COLUMN id SET DEFAULT nextval('public.themes_id_seq'::regclass);


--
-- Name: themes_to_theme_labels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes_to_theme_labels ALTER COLUMN id SET DEFAULT nextval('public.themes_to_theme_labels_id_seq'::regclass);


--
-- Name: tier_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_limits ALTER COLUMN id SET DEFAULT nextval('public.tier_limits_id_seq'::regclass);


--
-- Name: uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads ALTER COLUMN id SET DEFAULT nextval('public.uploads_id_seq'::regclass);


--
-- Name: user_request_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ALTER COLUMN id SET DEFAULT nextval('public.user_request_counts_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: website_deploys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_deploys ALTER COLUMN id SET DEFAULT nextval('public.website_deploys_id_seq'::regclass);


--
-- Name: website_file_histories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_file_histories ALTER COLUMN id SET DEFAULT nextval('public.website_file_histories_id_seq'::regclass);


--
-- Name: website_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_files ALTER COLUMN id SET DEFAULT nextval('public.website_files_id_seq'::regclass);


--
-- Name: website_histories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_histories ALTER COLUMN id SET DEFAULT nextval('public.website_histories_id_seq'::regclass);


--
-- Name: website_leads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_leads ALTER COLUMN id SET DEFAULT nextval('public.website_leads_id_seq'::regclass);


--
-- Name: website_uploads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_uploads ALTER COLUMN id SET DEFAULT nextval('public.website_uploads_id_seq'::regclass);


--
-- Name: website_urls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_urls ALTER COLUMN id SET DEFAULT nextval('public.website_urls_id_seq'::regclass);


--
-- Name: websites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websites ALTER COLUMN id SET DEFAULT nextval('public.websites_id_seq'::regclass);


--
-- Name: account_invitations account_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations
    ADD CONSTRAINT account_invitations_pkey PRIMARY KEY (id);


--
-- Name: account_request_counts account_request_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts
    ADD CONSTRAINT account_request_counts_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2025_08 account_request_counts_2025_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2025_08
    ADD CONSTRAINT account_request_counts_2025_08_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2025_09 account_request_counts_2025_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2025_09
    ADD CONSTRAINT account_request_counts_2025_09_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2025_10 account_request_counts_2025_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2025_10
    ADD CONSTRAINT account_request_counts_2025_10_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2025_11 account_request_counts_2025_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2025_11
    ADD CONSTRAINT account_request_counts_2025_11_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2025_12 account_request_counts_2025_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2025_12
    ADD CONSTRAINT account_request_counts_2025_12_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_01 account_request_counts_2026_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_01
    ADD CONSTRAINT account_request_counts_2026_01_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_02 account_request_counts_2026_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_02
    ADD CONSTRAINT account_request_counts_2026_02_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_03 account_request_counts_2026_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_03
    ADD CONSTRAINT account_request_counts_2026_03_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_04 account_request_counts_2026_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_04
    ADD CONSTRAINT account_request_counts_2026_04_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_05 account_request_counts_2026_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_05
    ADD CONSTRAINT account_request_counts_2026_05_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_06 account_request_counts_2026_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_06
    ADD CONSTRAINT account_request_counts_2026_06_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_07 account_request_counts_2026_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_07
    ADD CONSTRAINT account_request_counts_2026_07_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_08 account_request_counts_2026_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_08
    ADD CONSTRAINT account_request_counts_2026_08_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_09 account_request_counts_2026_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_09
    ADD CONSTRAINT account_request_counts_2026_09_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_10 account_request_counts_2026_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_10
    ADD CONSTRAINT account_request_counts_2026_10_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_11 account_request_counts_2026_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_11
    ADD CONSTRAINT account_request_counts_2026_11_pkey PRIMARY KEY (id, month);


--
-- Name: account_request_counts_2026_12 account_request_counts_2026_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_request_counts_2026_12
    ADD CONSTRAINT account_request_counts_2026_12_pkey PRIMARY KEY (id, month);


--
-- Name: account_users account_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_users
    ADD CONSTRAINT account_users_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: action_text_embeds action_text_embeds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_text_embeds
    ADD CONSTRAINT action_text_embeds_pkey PRIMARY KEY (id);


--
-- Name: action_text_rich_texts action_text_rich_texts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.action_text_rich_texts
    ADD CONSTRAINT action_text_rich_texts_pkey PRIMARY KEY (id);


--
-- Name: active_storage_attachments active_storage_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_attachments
    ADD CONSTRAINT active_storage_attachments_pkey PRIMARY KEY (id);


--
-- Name: active_storage_blobs active_storage_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_blobs
    ADD CONSTRAINT active_storage_blobs_pkey PRIMARY KEY (id);


--
-- Name: active_storage_variant_records active_storage_variant_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records
    ADD CONSTRAINT active_storage_variant_records_pkey PRIMARY KEY (id);


--
-- Name: ad_budgets ad_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_budgets
    ADD CONSTRAINT ad_budgets_pkey PRIMARY KEY (id);


--
-- Name: ad_callouts ad_callouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_callouts
    ADD CONSTRAINT ad_callouts_pkey PRIMARY KEY (id);


--
-- Name: ad_descriptions ad_descriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_descriptions
    ADD CONSTRAINT ad_descriptions_pkey PRIMARY KEY (id);


--
-- Name: ad_groups ad_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_groups
    ADD CONSTRAINT ad_groups_pkey PRIMARY KEY (id);


--
-- Name: ad_headlines ad_headlines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_headlines
    ADD CONSTRAINT ad_headlines_pkey PRIMARY KEY (id);


--
-- Name: ad_keywords ad_keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_keywords
    ADD CONSTRAINT ad_keywords_pkey PRIMARY KEY (id);


--
-- Name: ad_languages ad_languages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_languages
    ADD CONSTRAINT ad_languages_pkey PRIMARY KEY (id);


--
-- Name: ad_location_targets ad_location_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_location_targets
    ADD CONSTRAINT ad_location_targets_pkey PRIMARY KEY (id);


--
-- Name: ad_performance_daily ad_performance_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily
    ADD CONSTRAINT ad_performance_daily_pkey PRIMARY KEY (id);


--
-- Name: ad_schedules ad_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_schedules
    ADD CONSTRAINT ad_schedules_pkey PRIMARY KEY (id);


--
-- Name: ad_structured_snippets ad_structured_snippets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_structured_snippets
    ADD CONSTRAINT ad_structured_snippets_pkey PRIMARY KEY (id);


--
-- Name: ads_account_invitations ads_account_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads_account_invitations
    ADD CONSTRAINT ads_account_invitations_pkey PRIMARY KEY (id);


--
-- Name: ads_accounts ads_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads_accounts
    ADD CONSTRAINT ads_accounts_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: agent_context_events agent_context_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_context_events
    ADD CONSTRAINT agent_context_events_pkey PRIMARY KEY (id);


--
-- Name: ahoy_events ahoy_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahoy_events
    ADD CONSTRAINT ahoy_events_pkey PRIMARY KEY (id);


--
-- Name: ahoy_visits ahoy_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ahoy_visits
    ADD CONSTRAINT ahoy_visits_pkey PRIMARY KEY (id);


--
-- Name: analytics_daily_metrics analytics_daily_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_metrics
    ADD CONSTRAINT analytics_daily_metrics_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: api_tokens api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT api_tokens_pkey PRIMARY KEY (id);


--
-- Name: app_events app_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_events
    ADD CONSTRAINT app_events_pkey PRIMARY KEY (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: assistant_versions assistant_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assistant_versions
    ADD CONSTRAINT assistant_versions_pkey PRIMARY KEY (assistant_id, version);


--
-- Name: assistants assistants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assistants
    ADD CONSTRAINT assistants_pkey PRIMARY KEY (assistant_id);


--
-- Name: brainstorms brainstorms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brainstorms
    ADD CONSTRAINT brainstorms_pkey PRIMARY KEY (id);


--
-- Name: campaign_deploys campaign_deploys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaign_deploys
    ADD CONSTRAINT campaign_deploys_pkey PRIMARY KEY (id);


--
-- Name: campaigns campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campaigns
    ADD CONSTRAINT campaigns_pkey PRIMARY KEY (id);


--
-- Name: chats chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chats
    ADD CONSTRAINT chats_pkey PRIMARY KEY (id);


--
-- Name: checkpoint_blobs checkpoint_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_blobs
    ADD CONSTRAINT checkpoint_blobs_pkey PRIMARY KEY (thread_id, checkpoint_ns, channel, version);


--
-- Name: checkpoint_migrations checkpoint_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_migrations
    ADD CONSTRAINT checkpoint_migrations_pkey PRIMARY KEY (v);


--
-- Name: checkpoint_writes checkpoint_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoint_writes
    ADD CONSTRAINT checkpoint_writes_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx);


--
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id);


--
-- Name: cloudflare_firewall_rules cloudflare_firewall_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloudflare_firewall_rules
    ADD CONSTRAINT cloudflare_firewall_rules_pkey PRIMARY KEY (id);


--
-- Name: cloudflare_firewalls cloudflare_firewalls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cloudflare_firewalls
    ADD CONSTRAINT cloudflare_firewalls_pkey PRIMARY KEY (id);


--
-- Name: connected_accounts connected_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connected_accounts
    ADD CONSTRAINT connected_accounts_pkey PRIMARY KEY (id);


--
-- Name: credit_gifts credit_gifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_gifts
    ADD CONSTRAINT credit_gifts_pkey PRIMARY KEY (id);


--
-- Name: credit_pack_purchases credit_pack_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases
    ADD CONSTRAINT credit_pack_purchases_pkey PRIMARY KEY (id);


--
-- Name: credit_packs credit_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packs
    ADD CONSTRAINT credit_packs_pkey PRIMARY KEY (id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- Name: credit_usage_adjustments credit_usage_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_usage_adjustments
    ADD CONSTRAINT credit_usage_adjustments_pkey PRIMARY KEY (id);


--
-- Name: dashboard_insights dashboard_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_insights
    ADD CONSTRAINT dashboard_insights_pkey PRIMARY KEY (id);


--
-- Name: deploy_files deploy_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploy_files
    ADD CONSTRAINT deploy_files_pkey PRIMARY KEY (id);


--
-- Name: deploys deploys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys
    ADD CONSTRAINT deploys_pkey PRIMARY KEY (id);


--
-- Name: document_chunks document_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT document_chunks_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: domain_request_counts domain_request_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts
    ADD CONSTRAINT domain_request_counts_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08 domain_request_counts_2025_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08
    ADD CONSTRAINT domain_request_counts_2025_08_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09 domain_request_counts_2025_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09
    ADD CONSTRAINT domain_request_counts_2025_09_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_10 domain_request_counts_2025_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_10
    ADD CONSTRAINT domain_request_counts_2025_10_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_11 domain_request_counts_2025_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_11
    ADD CONSTRAINT domain_request_counts_2025_11_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_12 domain_request_counts_2025_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_12
    ADD CONSTRAINT domain_request_counts_2025_12_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_01 domain_request_counts_2026_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_01
    ADD CONSTRAINT domain_request_counts_2026_01_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_02 domain_request_counts_2026_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_02
    ADD CONSTRAINT domain_request_counts_2026_02_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_03 domain_request_counts_2026_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_03
    ADD CONSTRAINT domain_request_counts_2026_03_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_04 domain_request_counts_2026_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_04
    ADD CONSTRAINT domain_request_counts_2026_04_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_05 domain_request_counts_2026_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_05
    ADD CONSTRAINT domain_request_counts_2026_05_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_06 domain_request_counts_2026_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_06
    ADD CONSTRAINT domain_request_counts_2026_06_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_07 domain_request_counts_2026_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_07
    ADD CONSTRAINT domain_request_counts_2026_07_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_08 domain_request_counts_2026_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_08
    ADD CONSTRAINT domain_request_counts_2026_08_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_09 domain_request_counts_2026_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_09
    ADD CONSTRAINT domain_request_counts_2026_09_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_10 domain_request_counts_2026_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_10
    ADD CONSTRAINT domain_request_counts_2026_10_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_11 domain_request_counts_2026_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_11
    ADD CONSTRAINT domain_request_counts_2026_11_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2026_12 domain_request_counts_2026_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2026_12
    ADD CONSTRAINT domain_request_counts_2026_12_pkey PRIMARY KEY (id, hour);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: geo_target_constants geo_target_constants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geo_target_constants
    ADD CONSTRAINT geo_target_constants_pkey PRIMARY KEY (id);


--
-- Name: icon_embeddings icon_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_embeddings
    ADD CONSTRAINT icon_embeddings_pkey PRIMARY KEY (id);


--
-- Name: icon_query_caches icon_query_caches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_query_caches
    ADD CONSTRAINT icon_query_caches_pkey PRIMARY KEY (id);


--
-- Name: inbound_webhooks inbound_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhooks
    ADD CONSTRAINT inbound_webhooks_pkey PRIMARY KEY (id);


--
-- Name: job_runs job_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_runs
    ADD CONSTRAINT job_runs_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: llm_conversation_traces llm_conversation_traces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces
    ADD CONSTRAINT llm_conversation_traces_pkey PRIMARY KEY (id, created_at);


--
-- Name: llm_conversation_traces_2026_01 llm_conversation_traces_2026_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces_2026_01
    ADD CONSTRAINT llm_conversation_traces_2026_01_pkey PRIMARY KEY (id, created_at);


--
-- Name: llm_conversation_traces_2026_02 llm_conversation_traces_2026_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces_2026_02
    ADD CONSTRAINT llm_conversation_traces_2026_02_pkey PRIMARY KEY (id, created_at);


--
-- Name: llm_conversation_traces_2026_03 llm_conversation_traces_2026_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_conversation_traces_2026_03
    ADD CONSTRAINT llm_conversation_traces_2026_03_pkey PRIMARY KEY (id, created_at);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: model_configs model_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_configs
    ADD CONSTRAINT model_configs_pkey PRIMARY KEY (id);


--
-- Name: model_preferences model_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_preferences
    ADD CONSTRAINT model_preferences_pkey PRIMARY KEY (id);


--
-- Name: noticed_events noticed_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticed_events
    ADD CONSTRAINT noticed_events_pkey PRIMARY KEY (id);


--
-- Name: noticed_notifications noticed_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.noticed_notifications
    ADD CONSTRAINT noticed_notifications_pkey PRIMARY KEY (id);


--
-- Name: notification_tokens notification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: pay_charges pay_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_charges
    ADD CONSTRAINT pay_charges_pkey PRIMARY KEY (id);


--
-- Name: pay_customers pay_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_customers
    ADD CONSTRAINT pay_customers_pkey PRIMARY KEY (id);


--
-- Name: pay_merchants pay_merchants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_merchants
    ADD CONSTRAINT pay_merchants_pkey PRIMARY KEY (id);


--
-- Name: pay_payment_methods pay_payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_payment_methods
    ADD CONSTRAINT pay_payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pay_subscriptions pay_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_subscriptions
    ADD CONSTRAINT pay_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: pay_webhooks pay_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_webhooks
    ADD CONSTRAINT pay_webhooks_pkey PRIMARY KEY (id);


--
-- Name: plan_tiers plan_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_tiers
    ADD CONSTRAINT plan_tiers_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: project_workflows project_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_workflows
    ADD CONSTRAINT project_workflows_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: runs runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.runs
    ADD CONSTRAINT runs_pkey PRIMARY KEY (run_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: social_links social_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_links
    ADD CONSTRAINT social_links_pkey PRIMARY KEY (id);


--
-- Name: store_migrations store_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store_migrations
    ADD CONSTRAINT store_migrations_pkey PRIMARY KEY (v);


--
-- Name: store store_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.store
    ADD CONSTRAINT store_pkey PRIMARY KEY (namespace_path, key);


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: template_files template_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.template_files
    ADD CONSTRAINT template_files_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: theme_labels theme_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.theme_labels
    ADD CONSTRAINT theme_labels_pkey PRIMARY KEY (id);


--
-- Name: themes themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes
    ADD CONSTRAINT themes_pkey PRIMARY KEY (id);


--
-- Name: themes_to_theme_labels themes_to_theme_labels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.themes_to_theme_labels
    ADD CONSTRAINT themes_to_theme_labels_pkey PRIMARY KEY (id);


--
-- Name: threads threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.threads
    ADD CONSTRAINT threads_pkey PRIMARY KEY (thread_id);


--
-- Name: tier_limits tier_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tier_limits
    ADD CONSTRAINT tier_limits_pkey PRIMARY KEY (id);


--
-- Name: uploads uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);


--
-- Name: user_request_counts user_request_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts
    ADD CONSTRAINT user_request_counts_pkey PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_08 user_request_counts_2025_08_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_08
    ADD CONSTRAINT user_request_counts_2025_08_pkey1 PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_09 user_request_counts_2025_09_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_09
    ADD CONSTRAINT user_request_counts_2025_09_pkey1 PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_10 user_request_counts_2025_10_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_10
    ADD CONSTRAINT user_request_counts_2025_10_pkey1 PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_11 user_request_counts_2025_11_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_11
    ADD CONSTRAINT user_request_counts_2025_11_pkey1 PRIMARY KEY (id, month);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: website_deploys website_deploys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_deploys
    ADD CONSTRAINT website_deploys_pkey PRIMARY KEY (id);


--
-- Name: website_file_histories website_file_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_file_histories
    ADD CONSTRAINT website_file_histories_pkey PRIMARY KEY (id);


--
-- Name: website_files website_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_files
    ADD CONSTRAINT website_files_pkey PRIMARY KEY (id);


--
-- Name: website_histories website_histories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_histories
    ADD CONSTRAINT website_histories_pkey PRIMARY KEY (id);


--
-- Name: website_leads website_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_leads
    ADD CONSTRAINT website_leads_pkey PRIMARY KEY (id);


--
-- Name: website_uploads website_uploads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_uploads
    ADD CONSTRAINT website_uploads_pkey PRIMARY KEY (id);


--
-- Name: website_urls website_urls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_urls
    ADD CONSTRAINT website_urls_pkey PRIMARY KEY (id);


--
-- Name: websites websites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT websites_pkey PRIMARY KEY (id);


--
-- Name: index_account_request_counts_on_account_id_and_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_account_request_counts_on_account_id_and_month ON ONLY public.account_request_counts USING btree (account_id, month);


--
-- Name: account_request_counts_2025_08_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2025_08_account_id_month_idx ON public.account_request_counts_2025_08 USING btree (account_id, month);


--
-- Name: account_request_counts_2025_09_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2025_09_account_id_month_idx ON public.account_request_counts_2025_09 USING btree (account_id, month);


--
-- Name: index_account_request_counts_on_account_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_account_request_counts_on_account_month ON ONLY public.account_request_counts USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2025_0_account_id_month_request_cou_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2025_0_account_id_month_request_cou_idx1 ON public.account_request_counts_2025_09 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2025_0_account_id_month_request_coun_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2025_0_account_id_month_request_coun_idx ON public.account_request_counts_2025_08 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2025_10_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2025_10_account_id_month_idx ON public.account_request_counts_2025_10 USING btree (account_id, month);


--
-- Name: account_request_counts_2025_11_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2025_11_account_id_month_idx ON public.account_request_counts_2025_11 USING btree (account_id, month);


--
-- Name: account_request_counts_2025_12_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2025_12_account_id_month_idx ON public.account_request_counts_2025_12 USING btree (account_id, month);


--
-- Name: account_request_counts_2025_1_account_id_month_request_cou_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2025_1_account_id_month_request_cou_idx1 ON public.account_request_counts_2025_11 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2025_1_account_id_month_request_cou_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2025_1_account_id_month_request_cou_idx2 ON public.account_request_counts_2025_12 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2025_1_account_id_month_request_coun_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2025_1_account_id_month_request_coun_idx ON public.account_request_counts_2025_10 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_01_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_01_account_id_month_idx ON public.account_request_counts_2026_01 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_02_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_02_account_id_month_idx ON public.account_request_counts_2026_02 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_03_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_03_account_id_month_idx ON public.account_request_counts_2026_03 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_04_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_04_account_id_month_idx ON public.account_request_counts_2026_04 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_05_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_05_account_id_month_idx ON public.account_request_counts_2026_05 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_06_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_06_account_id_month_idx ON public.account_request_counts_2026_06 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_07_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_07_account_id_month_idx ON public.account_request_counts_2026_07 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_08_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_08_account_id_month_idx ON public.account_request_counts_2026_08 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_09_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_09_account_id_month_idx ON public.account_request_counts_2026_09 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx1 ON public.account_request_counts_2026_02 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx2 ON public.account_request_counts_2026_03 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx3; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx3 ON public.account_request_counts_2026_04 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx4; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx4 ON public.account_request_counts_2026_05 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx5; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx5 ON public.account_request_counts_2026_06 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx6; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx6 ON public.account_request_counts_2026_07 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx7; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx7 ON public.account_request_counts_2026_08 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx8; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_cou_idx8 ON public.account_request_counts_2026_09 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_0_account_id_month_request_coun_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_0_account_id_month_request_coun_idx ON public.account_request_counts_2026_01 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_10_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_10_account_id_month_idx ON public.account_request_counts_2026_10 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_11_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_11_account_id_month_idx ON public.account_request_counts_2026_11 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_12_account_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_request_counts_2026_12_account_id_month_idx ON public.account_request_counts_2026_12 USING btree (account_id, month);


--
-- Name: account_request_counts_2026_1_account_id_month_request_cou_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_1_account_id_month_request_cou_idx1 ON public.account_request_counts_2026_11 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_1_account_id_month_request_cou_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_1_account_id_month_request_cou_idx2 ON public.account_request_counts_2026_12 USING btree (account_id, month, request_count);


--
-- Name: account_request_counts_2026_1_account_id_month_request_coun_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_request_counts_2026_1_account_id_month_request_coun_idx ON public.account_request_counts_2026_10 USING btree (account_id, month, request_count);


--
-- Name: customer_owner_processor_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_owner_processor_index ON public.pay_customers USING btree (owner_type, owner_id, deleted_at);


--
-- Name: index_domain_request_counts_on_account_domain_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_domain_request_counts_on_account_domain_and_hour ON ONLY public.domain_request_counts USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_account_id_domain_id_hour_idx ON public.domain_request_counts_2025_08 USING btree (account_id, domain_id, hour);


--
-- Name: index_domain_request_counts_on_account_id_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_account_id_and_hour ON ONLY public.domain_request_counts USING btree (account_id, hour);


--
-- Name: domain_request_counts_2025_08_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_account_id_hour_idx ON public.domain_request_counts_2025_08 USING btree (account_id, hour);


--
-- Name: index_domain_request_counts_on_domain_id_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_domain_id_and_hour ON ONLY public.domain_request_counts USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_idx ON public.domain_request_counts_2025_08 USING btree (domain_id, hour);


--
-- Name: index_domain_request_counts_on_domain_hour_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_domain_hour_count ON ONLY public.domain_request_counts USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx ON public.domain_request_counts_2025_08 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_account_id_domain_id_hour_idx ON public.domain_request_counts_2025_09 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_account_id_hour_idx ON public.domain_request_counts_2025_09 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_idx ON public.domain_request_counts_2025_09 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx ON public.domain_request_counts_2025_09 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_10_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_10_account_id_domain_id_hour_idx ON public.domain_request_counts_2025_10 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_10_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_10_account_id_hour_idx ON public.domain_request_counts_2025_10 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2025_10_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_10_domain_id_hour_idx ON public.domain_request_counts_2025_10 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_10_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_10_domain_id_hour_request_count_idx ON public.domain_request_counts_2025_10 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_11_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_11_account_id_domain_id_hour_idx ON public.domain_request_counts_2025_11 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_11_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_11_account_id_hour_idx ON public.domain_request_counts_2025_11 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2025_11_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_11_domain_id_hour_idx ON public.domain_request_counts_2025_11 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_11_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_11_domain_id_hour_request_count_idx ON public.domain_request_counts_2025_11 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_12_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_12_account_id_domain_id_hour_idx ON public.domain_request_counts_2025_12 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_12_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_12_account_id_hour_idx ON public.domain_request_counts_2025_12 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2025_12_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_12_domain_id_hour_idx ON public.domain_request_counts_2025_12 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_12_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_12_domain_id_hour_request_count_idx ON public.domain_request_counts_2025_12 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_01_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_01_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_01 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_01_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_01_account_id_hour_idx ON public.domain_request_counts_2026_01 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_01_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_01_domain_id_hour_idx ON public.domain_request_counts_2026_01 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_01_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_01_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_01 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_02_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_02_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_02 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_02_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_02_account_id_hour_idx ON public.domain_request_counts_2026_02 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_02_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_02_domain_id_hour_idx ON public.domain_request_counts_2026_02 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_02_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_02_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_02 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_03_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_03_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_03 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_03_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_03_account_id_hour_idx ON public.domain_request_counts_2026_03 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_03_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_03_domain_id_hour_idx ON public.domain_request_counts_2026_03 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_03_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_03_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_03 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_04_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_04_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_04 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_04_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_04_account_id_hour_idx ON public.domain_request_counts_2026_04 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_04_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_04_domain_id_hour_idx ON public.domain_request_counts_2026_04 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_04_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_04_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_04 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_05_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_05_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_05 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_05_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_05_account_id_hour_idx ON public.domain_request_counts_2026_05 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_05_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_05_domain_id_hour_idx ON public.domain_request_counts_2026_05 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_05_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_05_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_05 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_06_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_06_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_06 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_06_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_06_account_id_hour_idx ON public.domain_request_counts_2026_06 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_06_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_06_domain_id_hour_idx ON public.domain_request_counts_2026_06 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_06_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_06_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_06 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_07_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_07_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_07 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_07_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_07_account_id_hour_idx ON public.domain_request_counts_2026_07 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_07_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_07_domain_id_hour_idx ON public.domain_request_counts_2026_07 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_07_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_07_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_07 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_08_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_08_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_08 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_08_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_08_account_id_hour_idx ON public.domain_request_counts_2026_08 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_08_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_08_domain_id_hour_idx ON public.domain_request_counts_2026_08 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_08_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_08_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_08 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_09_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_09_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_09 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_09_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_09_account_id_hour_idx ON public.domain_request_counts_2026_09 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_09_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_09_domain_id_hour_idx ON public.domain_request_counts_2026_09 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_09_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_09_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_09 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_10_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_10_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_10 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_10_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_10_account_id_hour_idx ON public.domain_request_counts_2026_10 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_10_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_10_domain_id_hour_idx ON public.domain_request_counts_2026_10 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_10_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_10_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_10 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_11_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_11_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_11 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_11_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_11_account_id_hour_idx ON public.domain_request_counts_2026_11 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_11_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_11_domain_id_hour_idx ON public.domain_request_counts_2026_11 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_11_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_11_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_11 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2026_12_account_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2026_12_account_id_domain_id_hour_idx ON public.domain_request_counts_2026_12 USING btree (account_id, domain_id, hour);


--
-- Name: domain_request_counts_2026_12_account_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_12_account_id_hour_idx ON public.domain_request_counts_2026_12 USING btree (account_id, hour);


--
-- Name: domain_request_counts_2026_12_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_12_domain_id_hour_idx ON public.domain_request_counts_2026_12 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2026_12_domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2026_12_domain_id_hour_request_count_idx ON public.domain_request_counts_2026_12 USING btree (domain_id, hour, request_count);


--
-- Name: idx_ad_perf_daily_campaign_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ad_perf_daily_campaign_date ON public.ad_performance_daily USING btree (campaign_id, date);


--
-- Name: idx_ads_account_invitations_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_account_invitations_lookup ON public.ads_account_invitations USING btree (ads_account_id, email_address, platform);


--
-- Name: idx_analytics_daily_acct_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_daily_acct_date ON public.analytics_daily_metrics USING btree (account_id, date);


--
-- Name: idx_analytics_daily_acct_proj_date; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_analytics_daily_acct_proj_date ON public.analytics_daily_metrics USING btree (account_id, project_id, date);


--
-- Name: idx_analytics_daily_proj_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_daily_proj_date ON public.analytics_daily_metrics USING btree (project_id, date);


--
-- Name: idx_document_chunks_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_chunks_embedding ON public.document_chunks USING ivfflat (embedding public.vector_cosine_ops);


--
-- Name: idx_icon_embeddings_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icon_embeddings_text ON public.icon_embeddings USING ivfflat (embedding public.vector_cosine_ops);


--
-- Name: idx_model_preferences_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_model_preferences_unique ON public.model_preferences USING btree (cost_tier, speed_tier, skill);


--
-- Name: idx_on_project_id_workflow_type_status_a7aa4433b7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_project_id_workflow_type_status_a7aa4433b7 ON public.project_workflows USING btree (project_id, workflow_type, status);


--
-- Name: idx_on_website_id_environment_is_preview_bab671a888; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_website_id_environment_is_preview_bab671a888 ON public.website_deploys USING btree (website_id, environment, is_preview);


--
-- Name: idx_runs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_status ON public.runs USING btree (status);


--
-- Name: idx_runs_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_runs_thread_id ON public.runs USING btree (thread_id);


--
-- Name: idx_store_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_expires_at ON public.store USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_store_namespace_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_namespace_path ON public.store USING btree (namespace_path);


--
-- Name: idx_store_value_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_store_value_gin ON public.store USING gin (value);


--
-- Name: idx_template_files_content_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_files_content_tsv ON public.template_files USING gin (content_tsv);


--
-- Name: idx_template_files_path_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_template_files_path_trgm ON public.template_files USING gin (path public.gin_trgm_ops);


--
-- Name: idx_threads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_threads_status ON public.threads USING btree (status);


--
-- Name: idx_website_file_histories_content_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_file_histories_content_tsv ON public.website_file_histories USING gin (content_tsv);


--
-- Name: idx_website_files_content_tsv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_files_content_tsv ON public.website_files USING gin (content_tsv);


--
-- Name: idx_website_files_path_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_website_files_path_trgm ON public.website_files USING gin (path public.gin_trgm_ops);


--
-- Name: index_account_invitations_on_account_id_and_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_account_invitations_on_account_id_and_email ON public.account_invitations USING btree (account_id, email);


--
-- Name: index_account_invitations_on_invited_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_account_invitations_on_invited_by_id ON public.account_invitations USING btree (invited_by_id);


--
-- Name: index_account_invitations_on_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_account_invitations_on_token ON public.account_invitations USING btree (token);


--
-- Name: index_account_users_on_account_id_and_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_account_users_on_account_id_and_user_id ON public.account_users USING btree (account_id, user_id);


--
-- Name: index_accounts_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_accounts_on_name ON public.accounts USING btree (name);


--
-- Name: index_accounts_on_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_accounts_on_owner_id ON public.accounts USING btree (owner_id);


--
-- Name: index_action_text_rich_texts_uniqueness; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_action_text_rich_texts_uniqueness ON public.action_text_rich_texts USING btree (record_type, record_id, name);


--
-- Name: index_active_storage_attachments_on_blob_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_active_storage_attachments_on_blob_id ON public.active_storage_attachments USING btree (blob_id);


--
-- Name: index_active_storage_attachments_uniqueness; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_attachments_uniqueness ON public.active_storage_attachments USING btree (record_type, record_id, name, blob_id);


--
-- Name: index_active_storage_blobs_on_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_blobs_on_key ON public.active_storage_blobs USING btree (key);


--
-- Name: index_active_storage_variant_records_uniqueness; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_variant_records_uniqueness ON public.active_storage_variant_records USING btree (blob_id, variation_digest);


--
-- Name: index_ad_budgets_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_budgets_on_campaign_id ON public.ad_budgets USING btree (campaign_id);


--
-- Name: index_ad_budgets_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_budgets_on_deleted_at ON public.ad_budgets USING btree (deleted_at);


--
-- Name: index_ad_budgets_on_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_budgets_on_google_id ON public.ad_budgets USING btree ((((platform_settings -> 'google'::text) ->> 'budget_id'::text)));


--
-- Name: index_ad_budgets_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_budgets_on_platform_settings ON public.ad_budgets USING gin (platform_settings);


--
-- Name: index_ad_callouts_on_ad_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_ad_group_id ON public.ad_callouts USING btree (ad_group_id);


--
-- Name: index_ad_callouts_on_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_asset_id ON public.ad_callouts USING btree ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)));


--
-- Name: index_ad_callouts_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_campaign_id ON public.ad_callouts USING btree (campaign_id);


--
-- Name: index_ad_callouts_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_created_at ON public.ad_callouts USING btree (created_at);


--
-- Name: index_ad_callouts_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_deleted_at ON public.ad_callouts USING btree (deleted_at);


--
-- Name: index_ad_callouts_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_platform_settings ON public.ad_callouts USING gin (platform_settings);


--
-- Name: index_ad_callouts_on_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_callouts_on_position ON public.ad_callouts USING btree ("position");


--
-- Name: index_ad_descriptions_on_ad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_ad_id ON public.ad_descriptions USING btree (ad_id);


--
-- Name: index_ad_descriptions_on_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_asset_id ON public.ad_descriptions USING btree ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)));


--
-- Name: index_ad_descriptions_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_created_at ON public.ad_descriptions USING btree (created_at);


--
-- Name: index_ad_descriptions_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_deleted_at ON public.ad_descriptions USING btree (deleted_at);


--
-- Name: index_ad_descriptions_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_platform_settings ON public.ad_descriptions USING gin (platform_settings);


--
-- Name: index_ad_descriptions_on_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_descriptions_on_position ON public.ad_descriptions USING btree ("position");


--
-- Name: index_ad_groups_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_campaign_id ON public.ad_groups USING btree (campaign_id);


--
-- Name: index_ad_groups_on_campaign_id_and_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_campaign_id_and_name ON public.ad_groups USING btree (campaign_id, name);


--
-- Name: index_ad_groups_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_created_at ON public.ad_groups USING btree (created_at);


--
-- Name: index_ad_groups_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_deleted_at ON public.ad_groups USING btree (deleted_at);


--
-- Name: index_ad_groups_on_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_google_id ON public.ad_groups USING btree ((((platform_settings -> 'google'::text) ->> 'ad_group_id'::text)));


--
-- Name: index_ad_groups_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_name ON public.ad_groups USING btree (name);


--
-- Name: index_ad_groups_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_groups_on_platform_settings ON public.ad_groups USING gin (platform_settings);


--
-- Name: index_ad_headlines_on_ad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_ad_id ON public.ad_headlines USING btree (ad_id);


--
-- Name: index_ad_headlines_on_ad_id_and_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_ad_id_and_position ON public.ad_headlines USING btree (ad_id, "position");


--
-- Name: index_ad_headlines_on_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_asset_id ON public.ad_headlines USING btree ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)));


--
-- Name: index_ad_headlines_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_created_at ON public.ad_headlines USING btree (created_at);


--
-- Name: index_ad_headlines_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_deleted_at ON public.ad_headlines USING btree (deleted_at);


--
-- Name: index_ad_headlines_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_platform_settings ON public.ad_headlines USING gin (platform_settings);


--
-- Name: index_ad_headlines_on_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_headlines_on_position ON public.ad_headlines USING btree ("position");


--
-- Name: index_ad_keywords_on_ad_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_ad_group_id ON public.ad_keywords USING btree (ad_group_id);


--
-- Name: index_ad_keywords_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_created_at ON public.ad_keywords USING btree (created_at);


--
-- Name: index_ad_keywords_on_criterion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_criterion_id ON public.ad_keywords USING btree ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)));


--
-- Name: index_ad_keywords_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_deleted_at ON public.ad_keywords USING btree (deleted_at);


--
-- Name: index_ad_keywords_on_match_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_match_type ON public.ad_keywords USING btree (match_type);


--
-- Name: index_ad_keywords_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_platform_settings ON public.ad_keywords USING gin (platform_settings);


--
-- Name: index_ad_keywords_on_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_position ON public.ad_keywords USING btree ("position");


--
-- Name: index_ad_keywords_on_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_keywords_on_text ON public.ad_keywords USING btree (text);


--
-- Name: index_ad_languages_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_languages_on_campaign_id ON public.ad_languages USING btree (campaign_id);


--
-- Name: index_ad_languages_on_criterion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_languages_on_criterion_id ON public.ad_languages USING btree ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)));


--
-- Name: index_ad_languages_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_languages_on_deleted_at ON public.ad_languages USING btree (deleted_at);


--
-- Name: index_ad_languages_on_language_constant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_languages_on_language_constant_id ON public.ad_languages USING btree ((((platform_settings -> 'google'::text) ->> 'language_constant_id'::text)));


--
-- Name: index_ad_languages_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_languages_on_platform_settings ON public.ad_languages USING gin (platform_settings);


--
-- Name: index_ad_location_targets_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_location_targets_on_campaign_id ON public.ad_location_targets USING btree (campaign_id);


--
-- Name: index_ad_location_targets_on_criterion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_location_targets_on_criterion_id ON public.ad_location_targets USING btree ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)));


--
-- Name: index_ad_location_targets_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_location_targets_on_deleted_at ON public.ad_location_targets USING btree (deleted_at);


--
-- Name: index_ad_location_targets_on_location_identifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_location_targets_on_location_identifier ON public.ad_location_targets USING btree (location_identifier);


--
-- Name: index_ad_location_targets_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_location_targets_on_platform_settings ON public.ad_location_targets USING gin (platform_settings);


--
-- Name: index_ad_performance_daily_on_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_performance_daily_on_date ON public.ad_performance_daily USING btree (date);


--
-- Name: index_ad_performance_daily_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_performance_daily_on_deleted_at ON public.ad_performance_daily USING btree (deleted_at);


--
-- Name: index_ad_schedules_on_always_on; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_always_on ON public.ad_schedules USING btree (always_on);


--
-- Name: index_ad_schedules_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_campaign_id ON public.ad_schedules USING btree (campaign_id);


--
-- Name: index_ad_schedules_on_campaign_id_and_day_of_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_campaign_id_and_day_of_week ON public.ad_schedules USING btree (campaign_id, day_of_week);


--
-- Name: index_ad_schedules_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_created_at ON public.ad_schedules USING btree (created_at);


--
-- Name: index_ad_schedules_on_criterion_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_criterion_id ON public.ad_schedules USING btree ((((platform_settings -> 'google'::text) ->> 'criterion_id'::text)));


--
-- Name: index_ad_schedules_on_day_of_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_day_of_week ON public.ad_schedules USING btree (day_of_week);


--
-- Name: index_ad_schedules_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_deleted_at ON public.ad_schedules USING btree (deleted_at);


--
-- Name: index_ad_schedules_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_schedules_on_platform_settings ON public.ad_schedules USING gin (platform_settings);


--
-- Name: index_ad_structured_snippets_on_asset_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_asset_id ON public.ad_structured_snippets USING btree ((((platform_settings -> 'google'::text) ->> 'asset_id'::text)));


--
-- Name: index_ad_structured_snippets_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_campaign_id ON public.ad_structured_snippets USING btree (campaign_id);


--
-- Name: index_ad_structured_snippets_on_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_category ON public.ad_structured_snippets USING btree (category);


--
-- Name: index_ad_structured_snippets_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_created_at ON public.ad_structured_snippets USING btree (created_at);


--
-- Name: index_ad_structured_snippets_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_deleted_at ON public.ad_structured_snippets USING btree (deleted_at);


--
-- Name: index_ad_structured_snippets_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ad_structured_snippets_on_platform_settings ON public.ad_structured_snippets USING gin (platform_settings);


--
-- Name: index_ads_account_invitations_on_ads_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_account_invitations_on_ads_account_id ON public.ads_account_invitations USING btree (ads_account_id);


--
-- Name: index_ads_account_invitations_on_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_account_invitations_on_platform ON public.ads_account_invitations USING btree (platform);


--
-- Name: index_ads_account_invitations_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_account_invitations_on_platform_settings ON public.ads_account_invitations USING gin (platform_settings);


--
-- Name: index_ads_accounts_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_accounts_on_account_id ON public.ads_accounts USING btree (account_id);


--
-- Name: index_ads_accounts_on_account_id_and_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_ads_accounts_on_account_id_and_platform ON public.ads_accounts USING btree (account_id, platform);


--
-- Name: index_ads_accounts_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_accounts_on_deleted_at ON public.ads_accounts USING btree (deleted_at);


--
-- Name: index_ads_accounts_on_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_accounts_on_google_id ON public.ads_accounts USING btree (((platform_settings ->> 'google'::text)));


--
-- Name: index_ads_accounts_on_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_accounts_on_platform ON public.ads_accounts USING btree (platform);


--
-- Name: index_ads_accounts_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_accounts_on_platform_settings ON public.ads_accounts USING gin (platform_settings);


--
-- Name: index_ads_on_ad_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_ad_group_id ON public.ads USING btree (ad_group_id);


--
-- Name: index_ads_on_ad_group_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_ad_group_id_and_status ON public.ads USING btree (ad_group_id, status);


--
-- Name: index_ads_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_deleted_at ON public.ads USING btree (deleted_at);


--
-- Name: index_ads_on_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_google_id ON public.ads USING btree ((((platform_settings -> 'google'::text) ->> 'ad_id'::text)));


--
-- Name: index_ads_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_platform_settings ON public.ads USING gin (platform_settings);


--
-- Name: index_ads_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ads_on_status ON public.ads USING btree (status);


--
-- Name: index_agent_context_events_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_agent_context_events_on_account_id ON public.agent_context_events USING btree (account_id);


--
-- Name: index_agent_context_events_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_agent_context_events_on_created_at ON public.agent_context_events USING btree (created_at);


--
-- Name: index_agent_context_events_on_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_agent_context_events_on_event_type ON public.agent_context_events USING btree (event_type);


--
-- Name: index_agent_context_events_on_eventable_type_and_eventable_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_agent_context_events_on_eventable_type_and_eventable_id ON public.agent_context_events USING btree (eventable_type, eventable_id);


--
-- Name: index_agent_context_events_on_project_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_agent_context_events_on_project_id_and_created_at ON public.agent_context_events USING btree (project_id, created_at);


--
-- Name: index_ahoy_events_on_name_and_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_events_on_name_and_time ON public.ahoy_events USING btree (name, "time");


--
-- Name: index_ahoy_events_on_properties; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_events_on_properties ON public.ahoy_events USING gin (properties jsonb_path_ops);


--
-- Name: index_ahoy_events_on_visit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_events_on_visit_id ON public.ahoy_events USING btree (visit_id);


--
-- Name: index_ahoy_visits_on_fbclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_visits_on_fbclid ON public.ahoy_visits USING btree (fbclid);


--
-- Name: index_ahoy_visits_on_gclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_visits_on_gclid ON public.ahoy_visits USING btree (gclid);


--
-- Name: index_ahoy_visits_on_visit_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_ahoy_visits_on_visit_token ON public.ahoy_visits USING btree (visit_token);


--
-- Name: index_ahoy_visits_on_visitor_token_and_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_visits_on_visitor_token_and_started_at ON public.ahoy_visits USING btree (visitor_token, started_at);


--
-- Name: index_ahoy_visits_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_visits_on_website_id ON public.ahoy_visits USING btree (website_id);


--
-- Name: index_ahoy_visits_on_website_id_and_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_ahoy_visits_on_website_id_and_started_at ON public.ahoy_visits USING btree (website_id, started_at);


--
-- Name: index_analytics_daily_metrics_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_analytics_daily_metrics_on_deleted_at ON public.analytics_daily_metrics USING btree (deleted_at);


--
-- Name: index_api_tokens_on_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_api_tokens_on_token ON public.api_tokens USING btree (token);


--
-- Name: index_api_tokens_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_api_tokens_on_user_id ON public.api_tokens USING btree (user_id);


--
-- Name: index_app_events_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_account_id ON public.app_events USING btree (account_id);


--
-- Name: index_app_events_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_campaign_id ON public.app_events USING btree (campaign_id);


--
-- Name: index_app_events_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_created_at ON public.app_events USING btree (created_at);


--
-- Name: index_app_events_on_event_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_event_name ON public.app_events USING btree (event_name);


--
-- Name: index_app_events_on_event_name_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_event_name_and_created_at ON public.app_events USING btree (event_name, created_at);


--
-- Name: index_app_events_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_project_id ON public.app_events USING btree (project_id);


--
-- Name: index_app_events_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_user_id ON public.app_events USING btree (user_id);


--
-- Name: index_app_events_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_app_events_on_website_id ON public.app_events USING btree (website_id);


--
-- Name: index_brainstorms_on_completed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_brainstorms_on_completed_at ON public.brainstorms USING btree (completed_at);


--
-- Name: index_brainstorms_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_brainstorms_on_created_at ON public.brainstorms USING btree (created_at);


--
-- Name: index_brainstorms_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_brainstorms_on_deleted_at ON public.brainstorms USING btree (deleted_at);


--
-- Name: index_brainstorms_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_brainstorms_on_website_id ON public.brainstorms USING btree (website_id);


--
-- Name: index_campaign_deploys_on_campaign_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_campaign_history_id ON public.campaign_deploys USING btree (campaign_history_id);


--
-- Name: index_campaign_deploys_on_campaign_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_campaign_id ON public.campaign_deploys USING btree (campaign_id);


--
-- Name: index_campaign_deploys_on_campaign_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_campaign_id_and_status ON public.campaign_deploys USING btree (campaign_id, status);


--
-- Name: index_campaign_deploys_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_created_at ON public.campaign_deploys USING btree (created_at);


--
-- Name: index_campaign_deploys_on_current_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_current_step ON public.campaign_deploys USING btree (current_step);


--
-- Name: index_campaign_deploys_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_deleted_at ON public.campaign_deploys USING btree (deleted_at);


--
-- Name: index_campaign_deploys_on_shasum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_shasum ON public.campaign_deploys USING btree (shasum);


--
-- Name: index_campaign_deploys_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaign_deploys_on_status ON public.campaign_deploys USING btree (status);


--
-- Name: index_campaigns_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_account_id ON public.campaigns USING btree (account_id);


--
-- Name: index_campaigns_on_account_id_and_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_account_id_and_stage ON public.campaigns USING btree (account_id, stage);


--
-- Name: index_campaigns_on_account_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_account_id_and_status ON public.campaigns USING btree (account_id, status);


--
-- Name: index_campaigns_on_ads_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_ads_account_id ON public.campaigns USING btree (ads_account_id);


--
-- Name: index_campaigns_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_created_at ON public.campaigns USING btree (created_at);


--
-- Name: index_campaigns_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_deleted_at ON public.campaigns USING btree (deleted_at);


--
-- Name: index_campaigns_on_end_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_end_date ON public.campaigns USING btree (end_date);


--
-- Name: index_campaigns_on_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_google_id ON public.campaigns USING btree ((((platform_settings -> 'google'::text) ->> 'campaign_id'::text)));


--
-- Name: index_campaigns_on_launched_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_launched_at ON public.campaigns USING btree (launched_at);


--
-- Name: index_campaigns_on_platform_settings; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_platform_settings ON public.campaigns USING gin (platform_settings);


--
-- Name: index_campaigns_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_project_id ON public.campaigns USING btree (project_id);


--
-- Name: index_campaigns_on_project_id_and_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_project_id_and_stage ON public.campaigns USING btree (project_id, stage);


--
-- Name: index_campaigns_on_project_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_project_id_and_status ON public.campaigns USING btree (project_id, status);


--
-- Name: index_campaigns_on_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_stage ON public.campaigns USING btree (stage);


--
-- Name: index_campaigns_on_start_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_start_date ON public.campaigns USING btree (start_date);


--
-- Name: index_campaigns_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_status ON public.campaigns USING btree (status);


--
-- Name: index_campaigns_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_campaigns_on_website_id ON public.campaigns USING btree (website_id);


--
-- Name: index_chats_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_chats_on_account_id ON public.chats USING btree (account_id);


--
-- Name: index_chats_on_active_chat_type_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_chats_on_active_chat_type_account ON public.chats USING btree (chat_type, account_id) WHERE ((project_id IS NULL) AND (deleted_at IS NULL) AND (active = true));


--
-- Name: index_chats_on_active_chat_type_project; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_chats_on_active_chat_type_project ON public.chats USING btree (chat_type, project_id) WHERE ((project_id IS NOT NULL) AND (deleted_at IS NULL) AND (active = true));


--
-- Name: index_chats_on_chat_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_chats_on_chat_type ON public.chats USING btree (chat_type);


--
-- Name: index_chats_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_chats_on_deleted_at ON public.chats USING btree (deleted_at);


--
-- Name: index_chats_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_chats_on_project_id ON public.chats USING btree (project_id);


--
-- Name: index_chats_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_chats_on_thread_id ON public.chats USING btree (thread_id);


--
-- Name: index_cloudflare_firewall_rules_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_account_id ON public.cloudflare_firewall_rules USING btree (account_id);


--
-- Name: index_cloudflare_firewall_rules_on_blocked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_blocked_at ON public.cloudflare_firewall_rules USING btree (blocked_at);


--
-- Name: index_cloudflare_firewall_rules_on_cloudflare_rule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_cloudflare_firewall_rules_on_cloudflare_rule_id ON public.cloudflare_firewall_rules USING btree (cloudflare_rule_id);


--
-- Name: index_cloudflare_firewall_rules_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_created_at ON public.cloudflare_firewall_rules USING btree (created_at);


--
-- Name: index_cloudflare_firewall_rules_on_domain_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_cloudflare_firewall_rules_on_domain_id ON public.cloudflare_firewall_rules USING btree (domain_id);


--
-- Name: index_cloudflare_firewall_rules_on_firewall_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_firewall_id ON public.cloudflare_firewall_rules USING btree (firewall_id);


--
-- Name: index_cloudflare_firewall_rules_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_status ON public.cloudflare_firewall_rules USING btree (status);


--
-- Name: index_cloudflare_firewall_rules_on_unblocked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_unblocked_at ON public.cloudflare_firewall_rules USING btree (unblocked_at);


--
-- Name: index_cloudflare_firewalls_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_account_id ON public.cloudflare_firewalls USING btree (account_id);


--
-- Name: index_cloudflare_firewalls_on_blocked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_blocked_at ON public.cloudflare_firewalls USING btree (blocked_at);


--
-- Name: index_cloudflare_firewalls_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_created_at ON public.cloudflare_firewalls USING btree (created_at);


--
-- Name: index_cloudflare_firewalls_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_status ON public.cloudflare_firewalls USING btree (status);


--
-- Name: index_cloudflare_firewalls_on_unblocked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_unblocked_at ON public.cloudflare_firewalls USING btree (unblocked_at);


--
-- Name: index_connected_accounts_on_owner_id_and_owner_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_connected_accounts_on_owner_id_and_owner_type ON public.connected_accounts USING btree (owner_id, owner_type);


--
-- Name: index_credit_gifts_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_gifts_on_account_id ON public.credit_gifts USING btree (account_id);


--
-- Name: index_credit_gifts_on_account_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_gifts_on_account_id_and_created_at ON public.credit_gifts USING btree (account_id, created_at);


--
-- Name: index_credit_gifts_on_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_gifts_on_admin_id ON public.credit_gifts USING btree (admin_id);


--
-- Name: index_credit_gifts_on_credits_allocated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_gifts_on_credits_allocated ON public.credit_gifts USING btree (credits_allocated);


--
-- Name: index_credit_pack_purchases_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_account_id ON public.credit_pack_purchases USING btree (account_id);


--
-- Name: index_credit_pack_purchases_on_account_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_account_id_and_created_at ON public.credit_pack_purchases USING btree (account_id, created_at);


--
-- Name: index_credit_pack_purchases_on_account_id_and_is_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_account_id_and_is_used ON public.credit_pack_purchases USING btree (account_id, is_used);


--
-- Name: index_credit_pack_purchases_on_credit_pack_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_credit_pack_id ON public.credit_pack_purchases USING btree (credit_pack_id);


--
-- Name: index_credit_pack_purchases_on_credits_allocated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_credits_allocated ON public.credit_pack_purchases USING btree (credits_allocated);


--
-- Name: index_credit_pack_purchases_on_pay_charge_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_pack_purchases_on_pay_charge_id ON public.credit_pack_purchases USING btree (pay_charge_id);


--
-- Name: index_credit_packs_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_credit_packs_on_name ON public.credit_packs USING btree (name);


--
-- Name: index_credit_transactions_on_account_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_transactions_on_account_id_and_created_at ON public.credit_transactions USING btree (account_id, created_at);


--
-- Name: index_credit_transactions_on_idempotency_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_credit_transactions_on_idempotency_key ON public.credit_transactions USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: index_credit_transactions_on_reference_type_and_reference_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_transactions_on_reference_type_and_reference_id ON public.credit_transactions USING btree (reference_type, reference_id);


--
-- Name: index_credit_usage_adjustments_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_usage_adjustments_on_account_id ON public.credit_usage_adjustments USING btree (account_id);


--
-- Name: index_credit_usage_adjustments_on_account_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_usage_adjustments_on_account_id_and_created_at ON public.credit_usage_adjustments USING btree (account_id, created_at);


--
-- Name: index_credit_usage_adjustments_on_admin_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_usage_adjustments_on_admin_id ON public.credit_usage_adjustments USING btree (admin_id);


--
-- Name: index_credit_usage_adjustments_on_credits_adjusted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_credit_usage_adjustments_on_credits_adjusted ON public.credit_usage_adjustments USING btree (credits_adjusted);


--
-- Name: index_dashboard_insights_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_dashboard_insights_on_account_id ON public.dashboard_insights USING btree (account_id);


--
-- Name: index_deploy_files_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploy_files_on_created_at ON public.deploy_files USING btree (created_at);


--
-- Name: index_deploy_files_on_deploy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploy_files_on_deploy_id ON public.deploy_files USING btree (deploy_id);


--
-- Name: index_deploy_files_on_website_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploy_files_on_website_file_id ON public.deploy_files USING btree (website_file_id);


--
-- Name: index_deploys_on_active_project; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_deploys_on_active_project ON public.deploys USING btree (project_id, active) WHERE ((deleted_at IS NULL) AND (active = true));


--
-- Name: index_deploys_on_campaign_deploy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_campaign_deploy_id ON public.deploys USING btree (campaign_deploy_id);


--
-- Name: index_deploys_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_deleted_at ON public.deploys USING btree (deleted_at);


--
-- Name: index_deploys_on_deploy_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_deploy_type ON public.deploys USING btree (deploy_type);


--
-- Name: index_deploys_on_finished_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_finished_at ON public.deploys USING btree (finished_at);


--
-- Name: index_deploys_on_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_is_live ON public.deploys USING btree (is_live);


--
-- Name: index_deploys_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_project_id ON public.deploys USING btree (project_id);


--
-- Name: index_deploys_on_project_id_and_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_project_id_and_is_live ON public.deploys USING btree (project_id, is_live);


--
-- Name: index_deploys_on_project_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_project_id_and_status ON public.deploys USING btree (project_id, status);


--
-- Name: index_deploys_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_status ON public.deploys USING btree (status);


--
-- Name: index_deploys_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_thread_id ON public.deploys USING btree (thread_id);


--
-- Name: index_deploys_on_website_deploy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_website_deploy_id ON public.deploys USING btree (website_deploy_id);


--
-- Name: index_document_chunks_on_document_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_document_chunks_on_document_id ON public.document_chunks USING btree (document_id);


--
-- Name: index_document_chunks_on_document_id_and_question_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_document_chunks_on_document_id_and_question_hash ON public.document_chunks USING btree (document_id, question_hash);


--
-- Name: index_document_chunks_on_section; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_document_chunks_on_section ON public.document_chunks USING btree (section);


--
-- Name: index_documents_on_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_documents_on_document_type ON public.documents USING btree (document_type);


--
-- Name: index_documents_on_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_documents_on_slug ON public.documents USING btree (slug);


--
-- Name: index_documents_on_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_documents_on_source_type ON public.documents USING btree (source_type);


--
-- Name: index_documents_on_source_type_and_source_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_documents_on_source_type_and_source_id ON public.documents USING btree (source_type, source_id);


--
-- Name: index_documents_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_documents_on_status ON public.documents USING btree (status);


--
-- Name: index_documents_on_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_documents_on_tags ON public.documents USING gin (tags);


--
-- Name: index_domains_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_account_id ON public.domains USING btree (account_id);


--
-- Name: index_domains_on_account_id_and_platform_subdomain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_account_id_and_platform_subdomain ON public.domains USING btree (account_id, is_platform_subdomain);


--
-- Name: index_domains_on_cloudflare_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_cloudflare_zone_id ON public.domains USING btree (cloudflare_zone_id);


--
-- Name: index_domains_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_created_at ON public.domains USING btree (created_at);


--
-- Name: index_domains_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_deleted_at ON public.domains USING btree (deleted_at);


--
-- Name: index_domains_on_dns_last_checked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_dns_last_checked_at ON public.domains USING btree (dns_last_checked_at);


--
-- Name: index_domains_on_dns_verification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_dns_verification_status ON public.domains USING btree (dns_verification_status);


--
-- Name: index_domains_on_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_domain ON public.domains USING btree (domain);


--
-- Name: index_faqs_on_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_faqs_on_category ON public.faqs USING btree (category);


--
-- Name: index_faqs_on_published_and_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_faqs_on_published_and_position ON public.faqs USING btree (published, "position");


--
-- Name: index_faqs_on_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_faqs_on_slug ON public.faqs USING btree (slug);


--
-- Name: index_geo_target_constants_on_canonical_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_geo_target_constants_on_canonical_name ON public.geo_target_constants USING gin (canonical_name public.gin_trgm_ops);


--
-- Name: index_geo_target_constants_on_country_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_geo_target_constants_on_country_code ON public.geo_target_constants USING btree (country_code);


--
-- Name: index_geo_target_constants_on_criteria_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_geo_target_constants_on_criteria_id ON public.geo_target_constants USING btree (criteria_id);


--
-- Name: index_geo_target_constants_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_geo_target_constants_on_name ON public.geo_target_constants USING gin (name public.gin_trgm_ops);


--
-- Name: index_geo_target_constants_on_parent_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_geo_target_constants_on_parent_id ON public.geo_target_constants USING btree (parent_id);


--
-- Name: index_geo_target_constants_on_target_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_geo_target_constants_on_target_type ON public.geo_target_constants USING btree (target_type);


--
-- Name: index_icon_embeddings_on_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_icon_embeddings_on_key ON public.icon_embeddings USING btree (key);


--
-- Name: index_icon_query_caches_on_last_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_last_used_at ON public.icon_query_caches USING btree (last_used_at);


--
-- Name: index_icon_query_caches_on_min_similarity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_min_similarity ON public.icon_query_caches USING btree (min_similarity);


--
-- Name: index_icon_query_caches_on_query; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_query ON public.icon_query_caches USING btree (query);


--
-- Name: index_icon_query_caches_on_top_k; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_top_k ON public.icon_query_caches USING btree (top_k);


--
-- Name: index_icon_query_caches_on_ttl_seconds; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_ttl_seconds ON public.icon_query_caches USING btree (ttl_seconds);


--
-- Name: index_icon_query_caches_on_use_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_icon_query_caches_on_use_count ON public.icon_query_caches USING btree (use_count);


--
-- Name: index_job_runs_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_account_id ON public.job_runs USING btree (account_id);


--
-- Name: index_job_runs_on_deploy_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_deploy_id ON public.job_runs USING btree (deploy_id);


--
-- Name: index_job_runs_on_error_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_error_type ON public.job_runs USING btree (error_type);


--
-- Name: index_job_runs_on_job_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_job_class ON public.job_runs USING btree (job_class);


--
-- Name: index_job_runs_on_job_class_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_job_class_and_status ON public.job_runs USING btree (job_class, status);


--
-- Name: index_job_runs_on_langgraph_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_langgraph_thread_id ON public.job_runs USING btree (langgraph_thread_id);


--
-- Name: index_job_runs_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_job_runs_on_status ON public.job_runs USING btree (status);


--
-- Name: index_leads_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_on_account_id ON public.leads USING btree (account_id);


--
-- Name: index_leads_on_account_id_and_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_leads_on_account_id_and_email ON public.leads USING btree (account_id, email);


--
-- Name: index_leads_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_leads_on_email ON public.leads USING btree (email);


--
-- Name: index_llm_usage_on_chat_id_and_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_llm_usage_on_chat_id_and_run_id ON public.llm_usage USING btree (chat_id, run_id);


--
-- Name: index_llm_usage_on_processed_at_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_llm_usage_on_processed_at_and_created_at ON public.llm_usage USING btree (processed_at, created_at);


--
-- Name: index_llm_usage_on_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_llm_usage_on_run_id ON public.llm_usage USING btree (run_id);


--
-- Name: index_llm_usage_on_thread_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_llm_usage_on_thread_id_and_created_at ON public.llm_usage USING btree (thread_id, created_at);


--
-- Name: index_model_configs_on_model_card; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_model_configs_on_model_card ON public.model_configs USING btree (model_card);


--
-- Name: index_model_configs_on_model_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_model_configs_on_model_key ON public.model_configs USING btree (model_key);


--
-- Name: index_noticed_events_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_noticed_events_on_account_id ON public.noticed_events USING btree (account_id);


--
-- Name: index_noticed_events_on_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_noticed_events_on_record ON public.noticed_events USING btree (record_type, record_id);


--
-- Name: index_noticed_notifications_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_noticed_notifications_on_account_id ON public.noticed_notifications USING btree (account_id);


--
-- Name: index_noticed_notifications_on_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_noticed_notifications_on_event_id ON public.noticed_notifications USING btree (event_id);


--
-- Name: index_noticed_notifications_on_recipient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_noticed_notifications_on_recipient ON public.noticed_notifications USING btree (recipient_type, recipient_id);


--
-- Name: index_notification_tokens_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notification_tokens_on_user_id ON public.notification_tokens USING btree (user_id);


--
-- Name: index_notifications_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_account_id ON public.notifications USING btree (account_id);


--
-- Name: index_notifications_on_recipient_type_and_recipient_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_notifications_on_recipient_type_and_recipient_id ON public.notifications USING btree (recipient_type, recipient_id);


--
-- Name: index_pay_charges_on_customer_id_and_processor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_pay_charges_on_customer_id_and_processor_id ON public.pay_charges USING btree (customer_id, processor_id);


--
-- Name: index_pay_customers_on_processor_and_processor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_customers_on_processor_and_processor_id ON public.pay_customers USING btree (processor, processor_id);


--
-- Name: index_pay_merchants_on_owner_type_and_owner_id_and_processor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_merchants_on_owner_type_and_owner_id_and_processor ON public.pay_merchants USING btree (owner_type, owner_id, processor);


--
-- Name: index_pay_payment_methods_on_customer_id_and_processor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_pay_payment_methods_on_customer_id_and_processor_id ON public.pay_payment_methods USING btree (customer_id, processor_id);


--
-- Name: index_pay_subscriptions_on_customer_id_and_processor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_pay_subscriptions_on_customer_id_and_processor_id ON public.pay_subscriptions USING btree (customer_id, processor_id);


--
-- Name: index_pay_subscriptions_on_metered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_subscriptions_on_metered ON public.pay_subscriptions USING btree (metered);


--
-- Name: index_pay_subscriptions_on_pause_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_subscriptions_on_pause_starts_at ON public.pay_subscriptions USING btree (pause_starts_at);


--
-- Name: index_pay_subscriptions_on_reset_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_subscriptions_on_reset_day ON public.pay_subscriptions USING btree (EXTRACT(day FROM current_period_start));


--
-- Name: index_pay_subscriptions_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pay_subscriptions_on_status ON public.pay_subscriptions USING btree (status);


--
-- Name: index_plan_tiers_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_plan_tiers_on_name ON public.plan_tiers USING btree (name);


--
-- Name: index_plans_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plans_on_created_at ON public.plans USING btree (created_at);


--
-- Name: index_plans_on_interval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plans_on_interval ON public.plans USING btree ("interval");


--
-- Name: index_plans_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_plans_on_name ON public.plans USING btree (name);


--
-- Name: index_plans_on_plan_tier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plans_on_plan_tier_id ON public.plans USING btree (plan_tier_id);


--
-- Name: index_project_workflows_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_created_at ON public.project_workflows USING btree (created_at);


--
-- Name: index_project_workflows_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_deleted_at ON public.project_workflows USING btree (deleted_at);


--
-- Name: index_project_workflows_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_project_id ON public.project_workflows USING btree (project_id);


--
-- Name: index_project_workflows_on_project_id_and_workflow_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_project_id_and_workflow_type ON public.project_workflows USING btree (project_id, workflow_type);


--
-- Name: index_project_workflows_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_status ON public.project_workflows USING btree (status);


--
-- Name: index_project_workflows_on_step; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_step ON public.project_workflows USING btree (step);


--
-- Name: index_project_workflows_on_substep; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_substep ON public.project_workflows USING btree (substep);


--
-- Name: index_project_workflows_on_workflow_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_workflows_on_workflow_type ON public.project_workflows USING btree (workflow_type);


--
-- Name: index_projects_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_account_id ON public.projects USING btree (account_id);


--
-- Name: index_projects_on_account_id_and_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_account_id_and_created_at ON public.projects USING btree (account_id, created_at);


--
-- Name: index_projects_on_account_id_and_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_projects_on_account_id_and_name ON public.projects USING btree (account_id, name) WHERE (deleted_at IS NULL);


--
-- Name: index_projects_on_account_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_account_id_and_status ON public.projects USING btree (account_id, status);


--
-- Name: index_projects_on_account_id_and_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_account_id_and_updated_at ON public.projects USING btree (account_id, updated_at);


--
-- Name: index_projects_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_created_at ON public.projects USING btree (created_at);


--
-- Name: index_projects_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_deleted_at ON public.projects USING btree (deleted_at);


--
-- Name: index_projects_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_name ON public.projects USING btree (name);


--
-- Name: index_projects_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_status ON public.projects USING btree (status);


--
-- Name: index_projects_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_updated_at ON public.projects USING btree (updated_at);


--
-- Name: index_projects_on_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_projects_on_uuid ON public.projects USING btree (uuid);


--
-- Name: index_social_links_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_social_links_on_deleted_at ON public.social_links USING btree (deleted_at);


--
-- Name: index_social_links_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_social_links_on_project_id ON public.social_links USING btree (project_id);


--
-- Name: index_social_links_on_project_id_and_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_social_links_on_project_id_and_platform ON public.social_links USING btree (project_id, platform) WHERE (deleted_at IS NULL);


--
-- Name: index_support_requests_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_support_requests_on_account_id ON public.support_requests USING btree (account_id);


--
-- Name: index_support_requests_on_supportable; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_support_requests_on_supportable ON public.support_requests USING btree (supportable_type, supportable_id);


--
-- Name: index_support_requests_on_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_support_requests_on_ticket_id ON public.support_requests USING btree (ticket_id);


--
-- Name: index_support_requests_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_support_requests_on_user_id ON public.support_requests USING btree (user_id);


--
-- Name: index_tasks_on_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_action ON public.tasks USING btree (action);


--
-- Name: index_tasks_on_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_component_id ON public.tasks USING btree (component_id);


--
-- Name: index_tasks_on_component_overview_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_component_overview_id ON public.tasks USING btree (component_overview_id);


--
-- Name: index_tasks_on_component_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_component_type ON public.tasks USING btree (component_type);


--
-- Name: index_tasks_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_created_at ON public.tasks USING btree (created_at);


--
-- Name: index_tasks_on_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_path ON public.tasks USING btree (path);


--
-- Name: index_tasks_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_project_id ON public.tasks USING btree (project_id);


--
-- Name: index_tasks_on_results; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_results ON public.tasks USING gin (results);


--
-- Name: index_tasks_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_status ON public.tasks USING btree (status);


--
-- Name: index_tasks_on_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_subtype ON public.tasks USING btree (subtype);


--
-- Name: index_tasks_on_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_type ON public.tasks USING btree (type);


--
-- Name: index_tasks_on_website_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_website_file_id ON public.tasks USING btree (website_file_id);


--
-- Name: index_tasks_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tasks_on_website_id ON public.tasks USING btree (website_id);


--
-- Name: index_template_files_on_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_template_files_on_path ON public.template_files USING btree (path);


--
-- Name: index_template_files_on_shasum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_template_files_on_shasum ON public.template_files USING btree (shasum);


--
-- Name: index_template_files_on_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_template_files_on_template_id ON public.template_files USING btree (template_id);


--
-- Name: index_template_files_on_template_id_and_path; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_template_files_on_template_id_and_path ON public.template_files USING btree (template_id, path);


--
-- Name: index_templates_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_templates_on_name ON public.templates USING btree (name);


--
-- Name: index_theme_labels_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_theme_labels_on_name ON public.theme_labels USING btree (name);


--
-- Name: index_themes_on_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_on_author_id ON public.themes USING btree (author_id);


--
-- Name: index_themes_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_on_name ON public.themes USING btree (name);


--
-- Name: index_themes_on_theme_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_on_theme_type ON public.themes USING btree (theme_type);


--
-- Name: index_themes_to_theme_labels_on_theme_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_to_theme_labels_on_theme_id ON public.themes_to_theme_labels USING btree (theme_id);


--
-- Name: index_themes_to_theme_labels_on_theme_id_and_theme_label_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_to_theme_labels_on_theme_id_and_theme_label_id ON public.themes_to_theme_labels USING btree (theme_id, theme_label_id);


--
-- Name: index_themes_to_theme_labels_on_theme_label_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_to_theme_labels_on_theme_label_id ON public.themes_to_theme_labels USING btree (theme_label_id);


--
-- Name: index_tier_limits_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tier_limits_on_created_at ON public.tier_limits USING btree (created_at);


--
-- Name: index_tier_limits_on_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tier_limits_on_limit ON public.tier_limits USING btree ("limit");


--
-- Name: index_tier_limits_on_limit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tier_limits_on_limit_type ON public.tier_limits USING btree (limit_type);


--
-- Name: index_tier_limits_on_tier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_tier_limits_on_tier_id ON public.tier_limits USING btree (tier_id);


--
-- Name: index_tier_limits_on_tier_id_and_limit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_tier_limits_on_tier_id_and_limit_type ON public.tier_limits USING btree (tier_id, limit_type);


--
-- Name: index_uploads_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_uploads_on_account_id ON public.uploads USING btree (account_id);


--
-- Name: index_uploads_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_uploads_on_created_at ON public.uploads USING btree (created_at);


--
-- Name: index_uploads_on_is_logo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_uploads_on_is_logo ON public.uploads USING btree (is_logo);


--
-- Name: index_uploads_on_media_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_uploads_on_media_type ON public.uploads USING btree (media_type);


--
-- Name: index_uploads_on_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_uploads_on_uuid ON public.uploads USING btree (uuid);


--
-- Name: index_user_request_counts_on_user_id_and_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_user_request_counts_on_user_id_and_month ON ONLY public.user_request_counts USING btree (user_id, month);


--
-- Name: index_user_request_counts_on_user_month; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_user_request_counts_on_user_month ON ONLY public.user_request_counts USING btree (user_id, month, request_count);


--
-- Name: index_users_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email);


--
-- Name: index_users_on_invitation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_invitation_token ON public.users USING btree (invitation_token);


--
-- Name: index_users_on_invitations_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_users_on_invitations_count ON public.users USING btree (invitations_count);


--
-- Name: index_users_on_invited_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_users_on_invited_by_id ON public.users USING btree (invited_by_id);


--
-- Name: index_users_on_invited_by_type_and_invited_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_users_on_invited_by_type_and_invited_by_id ON public.users USING btree (invited_by_type, invited_by_id);


--
-- Name: index_users_on_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_jti ON public.users USING btree (jti);


--
-- Name: index_users_on_reset_password_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_reset_password_token ON public.users USING btree (reset_password_token);


--
-- Name: index_website_deploys_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_created_at ON public.website_deploys USING btree (created_at);


--
-- Name: index_website_deploys_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_deleted_at ON public.website_deploys USING btree (deleted_at);


--
-- Name: index_website_deploys_on_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_environment ON public.website_deploys USING btree (environment);


--
-- Name: index_website_deploys_on_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_is_live ON public.website_deploys USING btree (is_live);


--
-- Name: index_website_deploys_on_is_preview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_is_preview ON public.website_deploys USING btree (is_preview);


--
-- Name: index_website_deploys_on_revertible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_revertible ON public.website_deploys USING btree (revertible);


--
-- Name: index_website_deploys_on_shasum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_shasum ON public.website_deploys USING btree (shasum);


--
-- Name: index_website_deploys_on_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_snapshot_id ON public.website_deploys USING btree (snapshot_id);


--
-- Name: index_website_deploys_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_status ON public.website_deploys USING btree (status);


--
-- Name: index_website_deploys_on_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_trigger ON public.website_deploys USING btree (trigger);


--
-- Name: index_website_deploys_on_website_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_website_history_id ON public.website_deploys USING btree (website_history_id);


--
-- Name: index_website_deploys_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_website_id ON public.website_deploys USING btree (website_id);


--
-- Name: index_website_deploys_on_website_id_and_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_deploys_on_website_id_and_is_live ON public.website_deploys USING btree (website_id, is_live);


--
-- Name: index_website_file_histories_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_created_at ON public.website_file_histories USING btree (created_at);


--
-- Name: index_website_file_histories_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_deleted_at ON public.website_file_histories USING btree (deleted_at);


--
-- Name: index_website_file_histories_on_history_ended_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_history_ended_at ON public.website_file_histories USING btree (history_ended_at);


--
-- Name: index_website_file_histories_on_history_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_history_started_at ON public.website_file_histories USING btree (history_started_at);


--
-- Name: index_website_file_histories_on_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_history_user_id ON public.website_file_histories USING btree (history_user_id);


--
-- Name: index_website_file_histories_on_shasum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_shasum ON public.website_file_histories USING btree (shasum);


--
-- Name: index_website_file_histories_on_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_snapshot_id ON public.website_file_histories USING btree (snapshot_id);


--
-- Name: index_website_file_histories_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_updated_at ON public.website_file_histories USING btree (updated_at);


--
-- Name: index_website_file_histories_on_website_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_website_file_id ON public.website_file_histories USING btree (website_file_id);


--
-- Name: index_website_file_histories_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_website_id ON public.website_file_histories USING btree (website_id);


--
-- Name: index_website_files_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_created_at ON public.website_files USING btree (created_at);


--
-- Name: index_website_files_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_deleted_at ON public.website_files USING btree (deleted_at);


--
-- Name: index_website_files_on_shasum; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_shasum ON public.website_files USING btree (shasum);


--
-- Name: index_website_files_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_updated_at ON public.website_files USING btree (updated_at);


--
-- Name: index_website_files_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_website_id ON public.website_files USING btree (website_id);


--
-- Name: index_website_files_on_website_id_and_path_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_website_files_on_website_id_and_path_unique ON public.website_files USING btree (website_id, path) WHERE (deleted_at IS NULL);


--
-- Name: index_website_histories_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_account_id ON public.website_histories USING btree (account_id);


--
-- Name: index_website_histories_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_created_at ON public.website_histories USING btree (created_at);


--
-- Name: index_website_histories_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_deleted_at ON public.website_histories USING btree (deleted_at);


--
-- Name: index_website_histories_on_history_ended_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_history_ended_at ON public.website_histories USING btree (history_ended_at);


--
-- Name: index_website_histories_on_history_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_history_started_at ON public.website_histories USING btree (history_started_at);


--
-- Name: index_website_histories_on_history_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_history_user_id ON public.website_histories USING btree (history_user_id);


--
-- Name: index_website_histories_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_name ON public.website_histories USING btree (name);


--
-- Name: index_website_histories_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_project_id ON public.website_histories USING btree (project_id);


--
-- Name: index_website_histories_on_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_snapshot_id ON public.website_histories USING btree (snapshot_id);


--
-- Name: index_website_histories_on_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_template_id ON public.website_histories USING btree (template_id);


--
-- Name: index_website_histories_on_theme_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_theme_id ON public.website_histories USING btree (theme_id);


--
-- Name: index_website_histories_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_thread_id ON public.website_histories USING btree (thread_id);


--
-- Name: index_website_histories_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_website_id ON public.website_histories USING btree (website_id);


--
-- Name: index_website_leads_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_deleted_at ON public.website_leads USING btree (deleted_at);


--
-- Name: index_website_leads_on_fbclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_fbclid ON public.website_leads USING btree (fbclid);


--
-- Name: index_website_leads_on_gclid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_gclid ON public.website_leads USING btree (gclid);


--
-- Name: index_website_leads_on_lead_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_lead_id ON public.website_leads USING btree (lead_id);


--
-- Name: index_website_leads_on_lead_id_and_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_website_leads_on_lead_id_and_website_id ON public.website_leads USING btree (lead_id, website_id);


--
-- Name: index_website_leads_on_visit_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_visit_id ON public.website_leads USING btree (visit_id);


--
-- Name: index_website_leads_on_visitor_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_visitor_token ON public.website_leads USING btree (visitor_token);


--
-- Name: index_website_leads_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_website_id ON public.website_leads USING btree (website_id);


--
-- Name: index_website_leads_on_website_id_and_created_at_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_leads_on_website_id_and_created_at_desc ON public.website_leads USING btree (website_id, created_at DESC);


--
-- Name: index_website_uploads_on_upload_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_uploads_on_upload_id ON public.website_uploads USING btree (upload_id);


--
-- Name: index_website_uploads_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_uploads_on_website_id ON public.website_uploads USING btree (website_id);


--
-- Name: index_website_urls_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_urls_on_account_id ON public.website_urls USING btree (account_id);


--
-- Name: index_website_urls_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_urls_on_deleted_at ON public.website_urls USING btree (deleted_at);


--
-- Name: index_website_urls_on_domain_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_urls_on_domain_id ON public.website_urls USING btree (domain_id);


--
-- Name: index_website_urls_on_domain_id_and_path; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_website_urls_on_domain_id_and_path ON public.website_urls USING btree (domain_id, path) WHERE (deleted_at IS NULL);


--
-- Name: index_website_urls_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_urls_on_website_id ON public.website_urls USING btree (website_id);


--
-- Name: index_websites_on_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_account_id ON public.websites USING btree (account_id);


--
-- Name: index_websites_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_created_at ON public.websites USING btree (created_at);


--
-- Name: index_websites_on_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_deleted_at ON public.websites USING btree (deleted_at);


--
-- Name: index_websites_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_name ON public.websites USING btree (name);


--
-- Name: index_websites_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_project_id ON public.websites USING btree (project_id);


--
-- Name: index_websites_on_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_template_id ON public.websites USING btree (template_id);


--
-- Name: index_websites_on_theme_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_theme_id ON public.websites USING btree (theme_id);


--
-- Name: llm_conversation_traces_chat_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_chat_id_created_at_idx ON ONLY public.llm_conversation_traces USING btree (chat_id, created_at);


--
-- Name: llm_conversation_traces_2026_01_chat_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_01_chat_id_created_at_idx ON public.llm_conversation_traces_2026_01 USING btree (chat_id, created_at);


--
-- Name: llm_conversation_traces_run_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_conversation_traces_run_id_created_at_idx ON ONLY public.llm_conversation_traces USING btree (run_id, created_at);


--
-- Name: llm_conversation_traces_2026_01_run_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_conversation_traces_2026_01_run_id_created_at_idx ON public.llm_conversation_traces_2026_01 USING btree (run_id, created_at);


--
-- Name: llm_conversation_traces_thread_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_thread_id_created_at_idx ON ONLY public.llm_conversation_traces USING btree (thread_id, created_at);


--
-- Name: llm_conversation_traces_2026_01_thread_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_01_thread_id_created_at_idx ON public.llm_conversation_traces_2026_01 USING btree (thread_id, created_at);


--
-- Name: llm_conversation_traces_2026_02_chat_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_02_chat_id_created_at_idx ON public.llm_conversation_traces_2026_02 USING btree (chat_id, created_at);


--
-- Name: llm_conversation_traces_2026_02_run_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_conversation_traces_2026_02_run_id_created_at_idx ON public.llm_conversation_traces_2026_02 USING btree (run_id, created_at);


--
-- Name: llm_conversation_traces_2026_02_thread_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_02_thread_id_created_at_idx ON public.llm_conversation_traces_2026_02 USING btree (thread_id, created_at);


--
-- Name: llm_conversation_traces_2026_03_chat_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_03_chat_id_created_at_idx ON public.llm_conversation_traces_2026_03 USING btree (chat_id, created_at);


--
-- Name: llm_conversation_traces_2026_03_run_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX llm_conversation_traces_2026_03_run_id_created_at_idx ON public.llm_conversation_traces_2026_03 USING btree (run_id, created_at);


--
-- Name: llm_conversation_traces_2026_03_thread_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llm_conversation_traces_2026_03_thread_id_created_at_idx ON public.llm_conversation_traces_2026_03 USING btree (thread_id, created_at);


--
-- Name: user_request_counts_2025_08_user_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_request_counts_2025_08_user_id_month_idx ON public.user_request_counts_2025_08 USING btree (user_id, month);


--
-- Name: user_request_counts_2025_08_user_id_month_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_request_counts_2025_08_user_id_month_request_count_idx ON public.user_request_counts_2025_08 USING btree (user_id, month, request_count);


--
-- Name: user_request_counts_2025_09_user_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_request_counts_2025_09_user_id_month_idx ON public.user_request_counts_2025_09 USING btree (user_id, month);


--
-- Name: user_request_counts_2025_09_user_id_month_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_request_counts_2025_09_user_id_month_request_count_idx ON public.user_request_counts_2025_09 USING btree (user_id, month, request_count);


--
-- Name: user_request_counts_2025_10_user_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_request_counts_2025_10_user_id_month_idx ON public.user_request_counts_2025_10 USING btree (user_id, month);


--
-- Name: user_request_counts_2025_10_user_id_month_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_request_counts_2025_10_user_id_month_request_count_idx ON public.user_request_counts_2025_10 USING btree (user_id, month, request_count);


--
-- Name: user_request_counts_2025_11_user_id_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_request_counts_2025_11_user_id_month_idx ON public.user_request_counts_2025_11 USING btree (user_id, month);


--
-- Name: user_request_counts_2025_11_user_id_month_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_request_counts_2025_11_user_id_month_request_count_idx ON public.user_request_counts_2025_11 USING btree (user_id, month, request_count);


--
-- Name: account_request_counts_2025_08_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2025_08_account_id_month_idx;


--
-- Name: account_request_counts_2025_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2025_08_pkey;


--
-- Name: account_request_counts_2025_09_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2025_09_account_id_month_idx;


--
-- Name: account_request_counts_2025_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2025_09_pkey;


--
-- Name: account_request_counts_2025_0_account_id_month_request_cou_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2025_0_account_id_month_request_cou_idx1;


--
-- Name: account_request_counts_2025_0_account_id_month_request_coun_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2025_0_account_id_month_request_coun_idx;


--
-- Name: account_request_counts_2025_10_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2025_10_account_id_month_idx;


--
-- Name: account_request_counts_2025_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2025_10_pkey;


--
-- Name: account_request_counts_2025_11_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2025_11_account_id_month_idx;


--
-- Name: account_request_counts_2025_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2025_11_pkey;


--
-- Name: account_request_counts_2025_12_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2025_12_account_id_month_idx;


--
-- Name: account_request_counts_2025_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2025_12_pkey;


--
-- Name: account_request_counts_2025_1_account_id_month_request_cou_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2025_1_account_id_month_request_cou_idx1;


--
-- Name: account_request_counts_2025_1_account_id_month_request_cou_idx2; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2025_1_account_id_month_request_cou_idx2;


--
-- Name: account_request_counts_2025_1_account_id_month_request_coun_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2025_1_account_id_month_request_coun_idx;


--
-- Name: account_request_counts_2026_01_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_01_account_id_month_idx;


--
-- Name: account_request_counts_2026_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_01_pkey;


--
-- Name: account_request_counts_2026_02_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_02_account_id_month_idx;


--
-- Name: account_request_counts_2026_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_02_pkey;


--
-- Name: account_request_counts_2026_03_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_03_account_id_month_idx;


--
-- Name: account_request_counts_2026_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_03_pkey;


--
-- Name: account_request_counts_2026_04_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_04_account_id_month_idx;


--
-- Name: account_request_counts_2026_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_04_pkey;


--
-- Name: account_request_counts_2026_05_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_05_account_id_month_idx;


--
-- Name: account_request_counts_2026_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_05_pkey;


--
-- Name: account_request_counts_2026_06_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_06_account_id_month_idx;


--
-- Name: account_request_counts_2026_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_06_pkey;


--
-- Name: account_request_counts_2026_07_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_07_account_id_month_idx;


--
-- Name: account_request_counts_2026_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_07_pkey;


--
-- Name: account_request_counts_2026_08_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_08_account_id_month_idx;


--
-- Name: account_request_counts_2026_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_08_pkey;


--
-- Name: account_request_counts_2026_09_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_09_account_id_month_idx;


--
-- Name: account_request_counts_2026_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_09_pkey;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx1;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx2; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx2;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx3; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx3;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx4; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx4;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx5; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx5;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx6; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx6;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx7; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx7;


--
-- Name: account_request_counts_2026_0_account_id_month_request_cou_idx8; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_cou_idx8;


--
-- Name: account_request_counts_2026_0_account_id_month_request_coun_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_0_account_id_month_request_coun_idx;


--
-- Name: account_request_counts_2026_10_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_10_account_id_month_idx;


--
-- Name: account_request_counts_2026_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_10_pkey;


--
-- Name: account_request_counts_2026_11_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_11_account_id_month_idx;


--
-- Name: account_request_counts_2026_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_11_pkey;


--
-- Name: account_request_counts_2026_12_account_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_id_and_month ATTACH PARTITION public.account_request_counts_2026_12_account_id_month_idx;


--
-- Name: account_request_counts_2026_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.account_request_counts_pkey ATTACH PARTITION public.account_request_counts_2026_12_pkey;


--
-- Name: account_request_counts_2026_1_account_id_month_request_cou_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_1_account_id_month_request_cou_idx1;


--
-- Name: account_request_counts_2026_1_account_id_month_request_cou_idx2; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_1_account_id_month_request_cou_idx2;


--
-- Name: account_request_counts_2026_1_account_id_month_request_coun_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_account_request_counts_on_account_month ATTACH PARTITION public.account_request_counts_2026_1_account_id_month_request_coun_idx;


--
-- Name: domain_request_counts_2025_08_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_account_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_pkey;


--
-- Name: domain_request_counts_2025_09_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_account_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_pkey;


--
-- Name: domain_request_counts_2025_10_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_10_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_10_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_10_account_id_hour_idx;


--
-- Name: domain_request_counts_2025_10_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_10_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_10_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_10_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_10_pkey;


--
-- Name: domain_request_counts_2025_11_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_11_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_11_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_11_account_id_hour_idx;


--
-- Name: domain_request_counts_2025_11_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_11_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_11_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_11_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_11_pkey;


--
-- Name: domain_request_counts_2025_12_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_12_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_12_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_12_account_id_hour_idx;


--
-- Name: domain_request_counts_2025_12_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_12_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_12_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_12_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_12_pkey;


--
-- Name: domain_request_counts_2026_01_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_01_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_01_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_01_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_01_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_01_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_01_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_01_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_01_pkey;


--
-- Name: domain_request_counts_2026_02_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_02_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_02_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_02_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_02_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_02_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_02_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_02_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_02_pkey;


--
-- Name: domain_request_counts_2026_03_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_03_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_03_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_03_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_03_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_03_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_03_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_03_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_03_pkey;


--
-- Name: domain_request_counts_2026_04_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_04_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_04_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_04_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_04_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_04_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_04_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_04_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_04_pkey;


--
-- Name: domain_request_counts_2026_05_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_05_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_05_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_05_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_05_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_05_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_05_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_05_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_05_pkey;


--
-- Name: domain_request_counts_2026_06_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_06_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_06_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_06_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_06_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_06_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_06_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_06_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_06_pkey;


--
-- Name: domain_request_counts_2026_07_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_07_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_07_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_07_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_07_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_07_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_07_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_07_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_07_pkey;


--
-- Name: domain_request_counts_2026_08_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_08_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_08_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_08_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_08_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_08_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_08_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_08_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_08_pkey;


--
-- Name: domain_request_counts_2026_09_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_09_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_09_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_09_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_09_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_09_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_09_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_09_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_09_pkey;


--
-- Name: domain_request_counts_2026_10_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_10_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_10_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_10_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_10_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_10_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_10_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_10_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_10_pkey;


--
-- Name: domain_request_counts_2026_11_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_11_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_11_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_11_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_11_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_11_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_11_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_11_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_11_pkey;


--
-- Name: domain_request_counts_2026_12_account_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_domain_and_hour ATTACH PARTITION public.domain_request_counts_2026_12_account_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_12_account_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_account_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_12_account_id_hour_idx;


--
-- Name: domain_request_counts_2026_12_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2026_12_domain_id_hour_idx;


--
-- Name: domain_request_counts_2026_12_domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2026_12_domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2026_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2026_12_pkey;


--
-- Name: llm_conversation_traces_2026_01_chat_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_chat_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_01_chat_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_pkey ATTACH PARTITION public.llm_conversation_traces_2026_01_pkey;


--
-- Name: llm_conversation_traces_2026_01_run_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_run_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_01_run_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_01_thread_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_thread_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_01_thread_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_02_chat_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_chat_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_02_chat_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_pkey ATTACH PARTITION public.llm_conversation_traces_2026_02_pkey;


--
-- Name: llm_conversation_traces_2026_02_run_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_run_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_02_run_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_02_thread_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_thread_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_02_thread_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_03_chat_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_chat_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_03_chat_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_pkey ATTACH PARTITION public.llm_conversation_traces_2026_03_pkey;


--
-- Name: llm_conversation_traces_2026_03_run_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_run_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_03_run_id_created_at_idx;


--
-- Name: llm_conversation_traces_2026_03_thread_id_created_at_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.llm_conversation_traces_thread_id_created_at_idx ATTACH PARTITION public.llm_conversation_traces_2026_03_thread_id_created_at_idx;


--
-- Name: user_request_counts_2025_08_pkey1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_08_pkey1;


--
-- Name: user_request_counts_2025_08_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_08_user_id_month_idx;


--
-- Name: user_request_counts_2025_08_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_08_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_09_pkey1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_09_pkey1;


--
-- Name: user_request_counts_2025_09_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_09_user_id_month_idx;


--
-- Name: user_request_counts_2025_09_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_09_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_10_pkey1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_10_pkey1;


--
-- Name: user_request_counts_2025_10_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_10_user_id_month_idx;


--
-- Name: user_request_counts_2025_10_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_10_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_11_pkey1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_11_pkey1;


--
-- Name: user_request_counts_2025_11_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_11_user_id_month_idx;


--
-- Name: user_request_counts_2025_11_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_11_user_id_month_request_count_idx;


--
-- Name: runs run_insert_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER run_insert_notify AFTER INSERT ON public.runs FOR EACH ROW EXECUTE FUNCTION public.notify_new_run();


--
-- Name: template_files tsvector_update_template_files; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tsvector_update_template_files BEFORE INSERT OR UPDATE OF content, path ON public.template_files FOR EACH ROW EXECUTE FUNCTION public.update_content_tsv();


--
-- Name: website_files tsvector_update_website_files; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tsvector_update_website_files BEFORE INSERT OR UPDATE OF content, path ON public.website_files FOR EACH ROW EXECUTE FUNCTION public.update_content_tsv();


--
-- Name: store update_store_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_store_updated_at BEFORE UPDATE ON public.store FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: support_requests fk_rails_03ae9ca37e; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT fk_rails_03ae9ca37e FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: account_invitations fk_rails_04a176d6ed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations
    ADD CONSTRAINT fk_rails_04a176d6ed FOREIGN KEY (invited_by_id) REFERENCES public.users(id);


--
-- Name: deploys fk_rails_0773f47ab4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys
    ADD CONSTRAINT fk_rails_0773f47ab4 FOREIGN KEY (campaign_deploy_id) REFERENCES public.campaign_deploys(id);


--
-- Name: analytics_daily_metrics fk_rails_0ce0c1e505; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_metrics
    ADD CONSTRAINT fk_rails_0ce0c1e505 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: dashboard_insights fk_rails_18fc5689ed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_insights
    ADD CONSTRAINT fk_rails_18fc5689ed FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: ads_account_invitations fk_rails_1d7b1920c0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads_account_invitations
    ADD CONSTRAINT fk_rails_1d7b1920c0 FOREIGN KEY (ads_account_id) REFERENCES public.ads_accounts(id);


--
-- Name: support_requests fk_rails_23b687fadb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT fk_rails_23b687fadb FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: accounts fk_rails_37ced7af95; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_rails_37ced7af95 FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: website_urls fk_rails_5b1c40b4b3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_urls
    ADD CONSTRAINT fk_rails_5b1c40b4b3 FOREIGN KEY (domain_id) REFERENCES public.domains(id);


--
-- Name: credit_gifts fk_rails_5dc0a58710; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_gifts
    ADD CONSTRAINT fk_rails_5dc0a58710 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: account_users fk_rails_685e030c15; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_users
    ADD CONSTRAINT fk_rails_685e030c15 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: account_invitations fk_rails_7a9e106543; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations
    ADD CONSTRAINT fk_rails_7a9e106543 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: website_urls fk_rails_8eb3a9594a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_urls
    ADD CONSTRAINT fk_rails_8eb3a9594a FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: active_storage_variant_records fk_rails_993965df05; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records
    ADD CONSTRAINT fk_rails_993965df05 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id);


--
-- Name: document_chunks fk_rails_99b41ada32; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_chunks
    ADD CONSTRAINT fk_rails_99b41ada32 FOREIGN KEY (document_id) REFERENCES public.documents(id);


--
-- Name: social_links fk_rails_9c390957fe; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_links
    ADD CONSTRAINT fk_rails_9c390957fe FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: credit_gifts fk_rails_a73fa2a3d6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_gifts
    ADD CONSTRAINT fk_rails_a73fa2a3d6 FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: pay_charges fk_rails_b19d32f835; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_charges
    ADD CONSTRAINT fk_rails_b19d32f835 FOREIGN KEY (customer_id) REFERENCES public.pay_customers(id);


--
-- Name: pay_subscriptions fk_rails_b7cd64d378; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_subscriptions
    ADD CONSTRAINT fk_rails_b7cd64d378 FOREIGN KEY (customer_id) REFERENCES public.pay_customers(id);


--
-- Name: credit_usage_adjustments fk_rails_bd70944f0c; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_usage_adjustments
    ADD CONSTRAINT fk_rails_bd70944f0c FOREIGN KEY (admin_id) REFERENCES public.users(id);


--
-- Name: ad_performance_daily fk_rails_c0834a269a; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_performance_daily
    ADD CONSTRAINT fk_rails_c0834a269a FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id);


--
-- Name: credit_usage_adjustments fk_rails_c3dc680e42; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_usage_adjustments
    ADD CONSTRAINT fk_rails_c3dc680e42 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: deploys fk_rails_c721010c48; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys
    ADD CONSTRAINT fk_rails_c721010c48 FOREIGN KEY (website_deploy_id) REFERENCES public.website_deploys(id);


--
-- Name: pay_payment_methods fk_rails_c78c6cb84d; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pay_payment_methods
    ADD CONSTRAINT fk_rails_c78c6cb84d FOREIGN KEY (customer_id) REFERENCES public.pay_customers(id);


--
-- Name: account_users fk_rails_c96445f213; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_users
    ADD CONSTRAINT fk_rails_c96445f213 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: analytics_daily_metrics fk_rails_d80058f7c6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_daily_metrics
    ADD CONSTRAINT fk_rails_d80058f7c6 FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: deploys fk_rails_eeb0884eb6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys
    ADD CONSTRAINT fk_rails_eeb0884eb6 FOREIGN KEY (project_id) REFERENCES public.projects(id);


--
-- Name: api_tokens fk_rails_f16b5e0447; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT fk_rails_f16b5e0447 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: website_urls fk_rails_f97a85eb03; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.website_urls
    ADD CONSTRAINT fk_rails_f97a85eb03 FOREIGN KEY (website_id) REFERENCES public.websites(id);


--
-- Name: job_runs fk_rails_fb366570a2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_runs
    ADD CONSTRAINT fk_rails_fb366570a2 FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20260221001835'),
('20260220211738'),
('20260220184159'),
('20260220151951'),
('20260216214522'),
('20260216182055'),
('20260216180433'),
('20260216145338'),
('20260215170847'),
('20260214233252'),
('20260214233149'),
('20260214201721'),
('20260214182238'),
('20260214175050'),
('20260213230932'),
('20260213225309'),
('20260213214137'),
('20260204152455'),
('20260204124042'),
('20260204014903'),
('20260202005230'),
('20260201235035'),
('20260201153847'),
('20260131154443'),
('20260130210726'),
('20260130204037'),
('20260130161923'),
('20260130143844'),
('20260130100003'),
('20260130100002'),
('20260130100001'),
('20260129225919'),
('20260129182538'),
('20260129120000'),
('20260128183648'),
('20260128103702'),
('20260128103701'),
('20260128103700'),
('20260127235148'),
('20260127170000'),
('20260126223106'),
('20260126203735'),
('20260126170112'),
('20260126164801'),
('20260126164140'),
('20260126162948'),
('20260126130109'),
('20260126130108'),
('20260126130107'),
('20260125205452'),
('20260123211427'),
('20260123211228'),
('20260123211124'),
('20260123211123'),
('20260123211021'),
('20260123210921'),
('20260123210745'),
('20260123185919'),
('20260122190035'),
('20260122150349'),
('20260122150336'),
('20260122150323'),
('20260120194521'),
('20260120155753'),
('20260117001808'),
('20260116143258'),
('20260115181801'),
('20260115181736'),
('20260115181121'),
('20260115170002'),
('20260115170001'),
('20260115170000'),
('20260115160347'),
('20260114203730'),
('20260113213841'),
('20260113211110'),
('20260113201504'),
('20260113201439'),
('20260113201418'),
('20260113001126'),
('20260112235846'),
('20260112152551'),
('20260112140931'),
('20260109153827'),
('20260109153750'),
('20260109151006'),
('20260109144621'),
('20260109140318'),
('20260109132117'),
('20260108110952'),
('20260108105901'),
('20260107115249'),
('20260105183720'),
('20260105171150'),
('20260103000003'),
('20260103000002'),
('20260103000001'),
('20251230152039'),
('20251229001513'),
('20251223152858'),
('20251223010445'),
('20251220160359'),
('20251220153026'),
('20251219192557'),
('20251219013512'),
('20251218235348'),
('20251218132052'),
('20251218125017'),
('20251217173931'),
('20251216144601'),
('20251201143930'),
('20251130121846'),
('20251129165029'),
('20251129163807'),
('20251129160020'),
('20251129155957'),
('20251129094502'),
('20251125163826'),
('20251125163744'),
('20251125000849'),
('20251125000841'),
('20251125000832'),
('20251125000816'),
('20251125000749'),
('20251124234744'),
('20251124234730'),
('20251124234418'),
('20251124234408'),
('20251124234404'),
('20251124234400'),
('20251121145610'),
('20251121145502'),
('20251121145154'),
('20251121141322'),
('20251120202225'),
('20251120201336'),
('20251118140220'),
('20251118140001'),
('20251118135945'),
('20251118135743'),
('20251111214423'),
('20251111174656'),
('20251106161828'),
('20251026083206'),
('20250928143302'),
('20250925210226'),
('20250925190459'),
('20250924170806'),
('20250924124014'),
('20250924121729'),
('20250918180911'),
('20250917204530'),
('20250917201500'),
('20250917200014'),
('20250917191837'),
('20250917185529'),
('20250917185329'),
('20250917185319'),
('20250917185049'),
('20250917182443'),
('20250917181924'),
('20250916122108'),
('20250911224320'),
('20250911224216'),
('20250911222652'),
('20250911222149'),
('20250911144717'),
('20250911015053'),
('20250910211652'),
('20250825171143'),
('20250825152350'),
('20250825152347'),
('20250825152345'),
('20250825152336'),
('20250823000001'),
('20250822161443'),
('20250822131159'),
('20250821235609'),
('20250821231029'),
('20250821165504'),
('20250821143055'),
('20250821142928'),
('20250821133027'),
('20250821130228'),
('20250821123635'),
('20250821121633'),
('20250821120442'),
('20250821120438'),
('20250821120404'),
('20250821120312'),
('20250821020317'),
('20250821015631'),
('20250821015603'),
('20250821015549'),
('20250821015232'),
('20250821015229'),
('20250821014829'),
('20250522174109'),
('20250522174042'),
('20250521175233'),
('20250519163858'),
('20250519163700'),
('20250519163652'),
('20250519163628'),
('20250519151847'),
('20250519151843'),
('20250519151655'),
('20250519151439'),
('20250519150512'),
('20250519145956'),
('20241209212429'),
('20240821183620'),
('20240224021434'),
('20240222020825'),
('20240222013808'),
('20240129200820'),
('20240102192139'),
('20231128155334'),
('20231024150632'),
('20231010151212'),
('20230810152614'),
('20230717174558'),
('20230503180159'),
('20230204162609'),
('20230114132615'),
('20221216130900'),
('20221121232410'),
('20220329195242'),
('20211002195137'),
('20210805001857'),
('20210804000959'),
('20210422222152'),
('20210419210614'),
('20210312034326'),
('20201209233134'),
('20201209233133'),
('20201206085920'),
('20200806001403'),
('20200726201932'),
('20200715173316'),
('20200326020204'),
('20200209004223'),
('20200208030344'),
('20200110222159'),
('20200102195022'),
('20191219010439'),
('20191025224530'),
('20190820024249'),
('20190801160834'),
('20190409222127'),
('20190211194309'),
('20190211185458'),
('20190211185457'),
('20190207041139'),
('20190114062651'),
('20190114062649'),
('20180821214213'),
('20180821214212'),
('20180820210659'),
('20180817230558'),
('20180801000001'),
('20180801000000');

