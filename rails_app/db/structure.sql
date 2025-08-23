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
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


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
    account_users_count integer DEFAULT 0
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
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: cloudflare_firewall_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cloudflare_firewall_rules (
    id bigint NOT NULL,
    firewall_id bigint NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
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
    user_id bigint NOT NULL,
    cloudflare_zone_id character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying,
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
    is_preview boolean DEFAULT false NOT NULL
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
-- Name: domain_request_counts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts (
    id bigint NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
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
-- Name: domain_request_counts_2025_08_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_01 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_02 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_03 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_04 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_05 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_06 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_07 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_08 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_09 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_10 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_11 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_12 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_13; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_13 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_14; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_14 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_15; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_15 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_16; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_16 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_17; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_17 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_18; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_18 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_19; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_19 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_20; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_20 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_21; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_21 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_22; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_22 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_23; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_23 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_24; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_24 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_25; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_25 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_26; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_26 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_27; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_27 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_28 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_29; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_29 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_30; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_30 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_08_31; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_08_31 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_01 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_02 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_03 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_04 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_05 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_06 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_07 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_08 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_09 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_10 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_11 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_12 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_13; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_13 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_14; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_14 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_15; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_15 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_16; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_16 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_17; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_17 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_18; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_18 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_19; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_19 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_20; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_20 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_21; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_21 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_22; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_22 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_23; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_23 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_24; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_24 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_25; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_25 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_26; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_26 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_27; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_27 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_28; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_28 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_29; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_29 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
    request_count bigint NOT NULL,
    hour timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: domain_request_counts_2025_09_30; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_request_counts_2025_09_30 (
    id bigint DEFAULT nextval('public.domain_request_counts_id_seq'::regclass) NOT NULL,
    domain_id bigint NOT NULL,
    user_id bigint NOT NULL,
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
    website_id bigint,
    user_id bigint,
    cloudflare_zone_id character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
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
-- Name: file_specifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.file_specifications (
    id bigint NOT NULL,
    canonical_path character varying,
    description character varying,
    filetype character varying,
    subtype character varying,
    language character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: file_specifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.file_specifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: file_specifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.file_specifications_id_seq OWNED BY public.file_specifications.id;


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
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id bigint NOT NULL,
    name character varying,
    project_id bigint NOT NULL,
    file_id bigint NOT NULL,
    page_type character varying NOT NULL,
    plan jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;


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
-- Name: plan_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_limits (
    id bigint NOT NULL,
    plan_id bigint,
    limit_type character varying,
    "limit" integer,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: plan_limits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plan_limits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plan_limits_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plan_limits_id_seq OWNED BY public.plan_limits.id;


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
    contact_url character varying
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
-- Name: project_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_plans (
    id bigint NOT NULL,
    project_id bigint NOT NULL,
    tone character varying NOT NULL,
    core_emotional_driver character varying,
    attention_grabber character varying,
    problem_statement character varying,
    emotional_bridge character varying,
    product_reveal character varying,
    social_proof character varying,
    urgency_hook character varying,
    call_to_action character varying,
    page_mood character varying,
    visual_evocation character varying,
    landing_page_copy text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: project_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_plans_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_plans_id_seq OWNED BY public.project_plans.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id bigint NOT NULL,
    name character varying NOT NULL,
    account_id bigint NOT NULL,
    theme_id bigint,
    thread_id character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
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
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    id bigint NOT NULL,
    name character varying,
    page_id bigint NOT NULL,
    component_id character varying NOT NULL,
    file_id bigint,
    theme_variation character varying,
    content_plan jsonb DEFAULT '{}'::jsonb,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sections_id_seq OWNED BY public.sections.id;


--
-- Name: template_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.template_files (
    id bigint NOT NULL,
    template_id bigint,
    path character varying,
    content text,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


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
    updated_at timestamp(6) without time zone NOT NULL
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
-- Name: website_file_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_file_histories (
    id bigint NOT NULL,
    website_file_id integer NOT NULL,
    website_id integer NOT NULL,
    file_specification_id integer,
    path character varying NOT NULL,
    content character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    history_started_at timestamp(6) without time zone NOT NULL,
    history_ended_at timestamp(6) without time zone,
    history_user_id integer,
    snapshot_id character varying
);


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
-- Name: website_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_files (
    id bigint NOT NULL,
    website_id bigint NOT NULL,
    file_specification_id bigint,
    path character varying NOT NULL,
    content character varying NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


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
-- Name: website_histories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.website_histories (
    id bigint NOT NULL,
    website_id integer NOT NULL,
    name character varying,
    project_id integer,
    user_id integer,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    history_started_at timestamp(6) without time zone NOT NULL,
    history_ended_at timestamp(6) without time zone,
    history_user_id integer,
    snapshot_id character varying,
    thread_id character varying,
    template_id integer
);


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
-- Name: websites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.websites (
    id bigint NOT NULL,
    name character varying,
    project_id bigint,
    user_id bigint,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    thread_id character varying,
    template_id bigint
);


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
-- Name: domain_request_counts_2025_08_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_01 FOR VALUES FROM ('2025-07-31 20:00:00-04') TO ('2025-08-01 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_02 FOR VALUES FROM ('2025-08-01 20:00:00-04') TO ('2025-08-02 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_03 FOR VALUES FROM ('2025-08-02 20:00:00-04') TO ('2025-08-03 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_04 FOR VALUES FROM ('2025-08-03 20:00:00-04') TO ('2025-08-04 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_05 FOR VALUES FROM ('2025-08-04 20:00:00-04') TO ('2025-08-05 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_06 FOR VALUES FROM ('2025-08-05 20:00:00-04') TO ('2025-08-06 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_07 FOR VALUES FROM ('2025-08-06 20:00:00-04') TO ('2025-08-07 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_08 FOR VALUES FROM ('2025-08-07 20:00:00-04') TO ('2025-08-08 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_09 FOR VALUES FROM ('2025-08-08 20:00:00-04') TO ('2025-08-09 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_10 FOR VALUES FROM ('2025-08-09 20:00:00-04') TO ('2025-08-10 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_11 FOR VALUES FROM ('2025-08-10 20:00:00-04') TO ('2025-08-11 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_12 FOR VALUES FROM ('2025-08-11 20:00:00-04') TO ('2025-08-12 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_13; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_13 FOR VALUES FROM ('2025-08-12 20:00:00-04') TO ('2025-08-13 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_14; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_14 FOR VALUES FROM ('2025-08-13 20:00:00-04') TO ('2025-08-14 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_15; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_15 FOR VALUES FROM ('2025-08-14 20:00:00-04') TO ('2025-08-15 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_16; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_16 FOR VALUES FROM ('2025-08-15 20:00:00-04') TO ('2025-08-16 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_17; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_17 FOR VALUES FROM ('2025-08-16 20:00:00-04') TO ('2025-08-17 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_18; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_18 FOR VALUES FROM ('2025-08-17 20:00:00-04') TO ('2025-08-18 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_19; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_19 FOR VALUES FROM ('2025-08-18 20:00:00-04') TO ('2025-08-19 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_20; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_20 FOR VALUES FROM ('2025-08-19 20:00:00-04') TO ('2025-08-20 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_21; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_21 FOR VALUES FROM ('2025-08-20 20:00:00-04') TO ('2025-08-21 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_22; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_22 FOR VALUES FROM ('2025-08-21 20:00:00-04') TO ('2025-08-22 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_23; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_23 FOR VALUES FROM ('2025-08-22 20:00:00-04') TO ('2025-08-23 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_24; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_24 FOR VALUES FROM ('2025-08-23 20:00:00-04') TO ('2025-08-24 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_25; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_25 FOR VALUES FROM ('2025-08-24 20:00:00-04') TO ('2025-08-25 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_26; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_26 FOR VALUES FROM ('2025-08-25 20:00:00-04') TO ('2025-08-26 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_27; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_27 FOR VALUES FROM ('2025-08-26 20:00:00-04') TO ('2025-08-27 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_28; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_28 FOR VALUES FROM ('2025-08-27 20:00:00-04') TO ('2025-08-28 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_29; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_29 FOR VALUES FROM ('2025-08-28 20:00:00-04') TO ('2025-08-29 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_30; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_30 FOR VALUES FROM ('2025-08-29 20:00:00-04') TO ('2025-08-30 20:00:00-04');


--
-- Name: domain_request_counts_2025_08_31; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_08_31 FOR VALUES FROM ('2025-08-30 20:00:00-04') TO ('2025-08-31 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_01 FOR VALUES FROM ('2025-08-31 20:00:00-04') TO ('2025-09-01 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_02 FOR VALUES FROM ('2025-09-01 20:00:00-04') TO ('2025-09-02 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_03 FOR VALUES FROM ('2025-09-02 20:00:00-04') TO ('2025-09-03 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_04 FOR VALUES FROM ('2025-09-03 20:00:00-04') TO ('2025-09-04 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_05 FOR VALUES FROM ('2025-09-04 20:00:00-04') TO ('2025-09-05 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_06 FOR VALUES FROM ('2025-09-05 20:00:00-04') TO ('2025-09-06 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_07 FOR VALUES FROM ('2025-09-06 20:00:00-04') TO ('2025-09-07 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_08 FOR VALUES FROM ('2025-09-07 20:00:00-04') TO ('2025-09-08 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_09 FOR VALUES FROM ('2025-09-08 20:00:00-04') TO ('2025-09-09 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_10 FOR VALUES FROM ('2025-09-09 20:00:00-04') TO ('2025-09-10 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_11 FOR VALUES FROM ('2025-09-10 20:00:00-04') TO ('2025-09-11 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_12 FOR VALUES FROM ('2025-09-11 20:00:00-04') TO ('2025-09-12 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_13; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_13 FOR VALUES FROM ('2025-09-12 20:00:00-04') TO ('2025-09-13 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_14; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_14 FOR VALUES FROM ('2025-09-13 20:00:00-04') TO ('2025-09-14 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_15; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_15 FOR VALUES FROM ('2025-09-14 20:00:00-04') TO ('2025-09-15 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_16; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_16 FOR VALUES FROM ('2025-09-15 20:00:00-04') TO ('2025-09-16 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_17; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_17 FOR VALUES FROM ('2025-09-16 20:00:00-04') TO ('2025-09-17 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_18; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_18 FOR VALUES FROM ('2025-09-17 20:00:00-04') TO ('2025-09-18 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_19; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_19 FOR VALUES FROM ('2025-09-18 20:00:00-04') TO ('2025-09-19 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_20; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_20 FOR VALUES FROM ('2025-09-19 20:00:00-04') TO ('2025-09-20 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_21; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_21 FOR VALUES FROM ('2025-09-20 20:00:00-04') TO ('2025-09-21 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_22; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_22 FOR VALUES FROM ('2025-09-21 20:00:00-04') TO ('2025-09-22 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_23; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_23 FOR VALUES FROM ('2025-09-22 20:00:00-04') TO ('2025-09-23 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_24; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_24 FOR VALUES FROM ('2025-09-23 20:00:00-04') TO ('2025-09-24 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_25; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_25 FOR VALUES FROM ('2025-09-24 20:00:00-04') TO ('2025-09-25 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_26; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_26 FOR VALUES FROM ('2025-09-25 20:00:00-04') TO ('2025-09-26 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_27; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_27 FOR VALUES FROM ('2025-09-26 20:00:00-04') TO ('2025-09-27 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_28; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_28 FOR VALUES FROM ('2025-09-27 20:00:00-04') TO ('2025-09-28 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_29; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_29 FOR VALUES FROM ('2025-09-28 20:00:00-04') TO ('2025-09-29 20:00:00-04');


--
-- Name: domain_request_counts_2025_09_30; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ATTACH PARTITION public.domain_request_counts_2025_09_30 FOR VALUES FROM ('2025-09-29 20:00:00-04') TO ('2025-09-30 20:00:00-04');


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
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: api_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens ALTER COLUMN id SET DEFAULT nextval('public.api_tokens_id_seq'::regclass);


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
-- Name: deploy_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploy_files ALTER COLUMN id SET DEFAULT nextval('public.deploy_files_id_seq'::regclass);


--
-- Name: deploys id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deploys ALTER COLUMN id SET DEFAULT nextval('public.deploys_id_seq'::regclass);


--
-- Name: domain_request_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts ALTER COLUMN id SET DEFAULT nextval('public.domain_request_counts_id_seq'::regclass);


--
-- Name: domains id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains ALTER COLUMN id SET DEFAULT nextval('public.domains_id_seq'::regclass);


--
-- Name: file_specifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_specifications ALTER COLUMN id SET DEFAULT nextval('public.file_specifications_id_seq'::regclass);


--
-- Name: icon_embeddings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_embeddings ALTER COLUMN id SET DEFAULT nextval('public.icon_embeddings_id_seq'::regclass);


--
-- Name: inbound_webhooks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhooks ALTER COLUMN id SET DEFAULT nextval('public.inbound_webhooks_id_seq'::regclass);


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
-- Name: pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages ALTER COLUMN id SET DEFAULT nextval('public.pages_id_seq'::regclass);


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
-- Name: plan_limits id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_limits ALTER COLUMN id SET DEFAULT nextval('public.plan_limits_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: project_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plans ALTER COLUMN id SET DEFAULT nextval('public.project_plans_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections ALTER COLUMN id SET DEFAULT nextval('public.sections_id_seq'::regclass);


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
-- Name: user_request_counts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts ALTER COLUMN id SET DEFAULT nextval('public.user_request_counts_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


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
-- Name: websites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websites ALTER COLUMN id SET DEFAULT nextval('public.websites_id_seq'::regclass);


--
-- Name: account_invitations account_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations
    ADD CONSTRAINT account_invitations_pkey PRIMARY KEY (id);


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
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


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
-- Name: domain_request_counts domain_request_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts
    ADD CONSTRAINT domain_request_counts_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_01 domain_request_counts_2025_08_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_01
    ADD CONSTRAINT domain_request_counts_2025_08_01_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_02 domain_request_counts_2025_08_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_02
    ADD CONSTRAINT domain_request_counts_2025_08_02_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_03 domain_request_counts_2025_08_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_03
    ADD CONSTRAINT domain_request_counts_2025_08_03_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_04 domain_request_counts_2025_08_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_04
    ADD CONSTRAINT domain_request_counts_2025_08_04_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_05 domain_request_counts_2025_08_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_05
    ADD CONSTRAINT domain_request_counts_2025_08_05_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_06 domain_request_counts_2025_08_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_06
    ADD CONSTRAINT domain_request_counts_2025_08_06_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_07 domain_request_counts_2025_08_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_07
    ADD CONSTRAINT domain_request_counts_2025_08_07_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_08 domain_request_counts_2025_08_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_08
    ADD CONSTRAINT domain_request_counts_2025_08_08_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_09 domain_request_counts_2025_08_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_09
    ADD CONSTRAINT domain_request_counts_2025_08_09_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_10 domain_request_counts_2025_08_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_10
    ADD CONSTRAINT domain_request_counts_2025_08_10_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_11 domain_request_counts_2025_08_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_11
    ADD CONSTRAINT domain_request_counts_2025_08_11_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_12 domain_request_counts_2025_08_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_12
    ADD CONSTRAINT domain_request_counts_2025_08_12_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_13 domain_request_counts_2025_08_13_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_13
    ADD CONSTRAINT domain_request_counts_2025_08_13_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_14 domain_request_counts_2025_08_14_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_14
    ADD CONSTRAINT domain_request_counts_2025_08_14_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_15 domain_request_counts_2025_08_15_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_15
    ADD CONSTRAINT domain_request_counts_2025_08_15_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_16 domain_request_counts_2025_08_16_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_16
    ADD CONSTRAINT domain_request_counts_2025_08_16_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_17 domain_request_counts_2025_08_17_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_17
    ADD CONSTRAINT domain_request_counts_2025_08_17_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_18 domain_request_counts_2025_08_18_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_18
    ADD CONSTRAINT domain_request_counts_2025_08_18_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_19 domain_request_counts_2025_08_19_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_19
    ADD CONSTRAINT domain_request_counts_2025_08_19_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_20 domain_request_counts_2025_08_20_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_20
    ADD CONSTRAINT domain_request_counts_2025_08_20_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_21 domain_request_counts_2025_08_21_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_21
    ADD CONSTRAINT domain_request_counts_2025_08_21_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_22 domain_request_counts_2025_08_22_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_22
    ADD CONSTRAINT domain_request_counts_2025_08_22_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_23 domain_request_counts_2025_08_23_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_23
    ADD CONSTRAINT domain_request_counts_2025_08_23_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_24 domain_request_counts_2025_08_24_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_24
    ADD CONSTRAINT domain_request_counts_2025_08_24_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_25 domain_request_counts_2025_08_25_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_25
    ADD CONSTRAINT domain_request_counts_2025_08_25_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_26 domain_request_counts_2025_08_26_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_26
    ADD CONSTRAINT domain_request_counts_2025_08_26_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_27 domain_request_counts_2025_08_27_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_27
    ADD CONSTRAINT domain_request_counts_2025_08_27_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_28 domain_request_counts_2025_08_28_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_28
    ADD CONSTRAINT domain_request_counts_2025_08_28_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_29 domain_request_counts_2025_08_29_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_29
    ADD CONSTRAINT domain_request_counts_2025_08_29_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_30 domain_request_counts_2025_08_30_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_30
    ADD CONSTRAINT domain_request_counts_2025_08_30_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_08_31 domain_request_counts_2025_08_31_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_08_31
    ADD CONSTRAINT domain_request_counts_2025_08_31_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_01 domain_request_counts_2025_09_01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_01
    ADD CONSTRAINT domain_request_counts_2025_09_01_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_02 domain_request_counts_2025_09_02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_02
    ADD CONSTRAINT domain_request_counts_2025_09_02_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_03 domain_request_counts_2025_09_03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_03
    ADD CONSTRAINT domain_request_counts_2025_09_03_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_04 domain_request_counts_2025_09_04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_04
    ADD CONSTRAINT domain_request_counts_2025_09_04_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_05 domain_request_counts_2025_09_05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_05
    ADD CONSTRAINT domain_request_counts_2025_09_05_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_06 domain_request_counts_2025_09_06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_06
    ADD CONSTRAINT domain_request_counts_2025_09_06_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_07 domain_request_counts_2025_09_07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_07
    ADD CONSTRAINT domain_request_counts_2025_09_07_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_08 domain_request_counts_2025_09_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_08
    ADD CONSTRAINT domain_request_counts_2025_09_08_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_09 domain_request_counts_2025_09_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_09
    ADD CONSTRAINT domain_request_counts_2025_09_09_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_10 domain_request_counts_2025_09_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_10
    ADD CONSTRAINT domain_request_counts_2025_09_10_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_11 domain_request_counts_2025_09_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_11
    ADD CONSTRAINT domain_request_counts_2025_09_11_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_12 domain_request_counts_2025_09_12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_12
    ADD CONSTRAINT domain_request_counts_2025_09_12_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_13 domain_request_counts_2025_09_13_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_13
    ADD CONSTRAINT domain_request_counts_2025_09_13_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_14 domain_request_counts_2025_09_14_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_14
    ADD CONSTRAINT domain_request_counts_2025_09_14_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_15 domain_request_counts_2025_09_15_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_15
    ADD CONSTRAINT domain_request_counts_2025_09_15_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_16 domain_request_counts_2025_09_16_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_16
    ADD CONSTRAINT domain_request_counts_2025_09_16_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_17 domain_request_counts_2025_09_17_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_17
    ADD CONSTRAINT domain_request_counts_2025_09_17_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_18 domain_request_counts_2025_09_18_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_18
    ADD CONSTRAINT domain_request_counts_2025_09_18_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_19 domain_request_counts_2025_09_19_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_19
    ADD CONSTRAINT domain_request_counts_2025_09_19_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_20 domain_request_counts_2025_09_20_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_20
    ADD CONSTRAINT domain_request_counts_2025_09_20_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_21 domain_request_counts_2025_09_21_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_21
    ADD CONSTRAINT domain_request_counts_2025_09_21_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_22 domain_request_counts_2025_09_22_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_22
    ADD CONSTRAINT domain_request_counts_2025_09_22_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_23 domain_request_counts_2025_09_23_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_23
    ADD CONSTRAINT domain_request_counts_2025_09_23_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_24 domain_request_counts_2025_09_24_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_24
    ADD CONSTRAINT domain_request_counts_2025_09_24_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_25 domain_request_counts_2025_09_25_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_25
    ADD CONSTRAINT domain_request_counts_2025_09_25_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_26 domain_request_counts_2025_09_26_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_26
    ADD CONSTRAINT domain_request_counts_2025_09_26_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_27 domain_request_counts_2025_09_27_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_27
    ADD CONSTRAINT domain_request_counts_2025_09_27_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_28 domain_request_counts_2025_09_28_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_28
    ADD CONSTRAINT domain_request_counts_2025_09_28_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_29 domain_request_counts_2025_09_29_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_29
    ADD CONSTRAINT domain_request_counts_2025_09_29_pkey PRIMARY KEY (id, hour);


--
-- Name: domain_request_counts_2025_09_30 domain_request_counts_2025_09_30_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_request_counts_2025_09_30
    ADD CONSTRAINT domain_request_counts_2025_09_30_pkey PRIMARY KEY (id, hour);


--
-- Name: domains domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domains
    ADD CONSTRAINT domains_pkey PRIMARY KEY (id);


--
-- Name: file_specifications file_specifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.file_specifications
    ADD CONSTRAINT file_specifications_pkey PRIMARY KEY (id);


--
-- Name: icon_embeddings icon_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.icon_embeddings
    ADD CONSTRAINT icon_embeddings_pkey PRIMARY KEY (id);


--
-- Name: inbound_webhooks inbound_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_webhooks
    ADD CONSTRAINT inbound_webhooks_pkey PRIMARY KEY (id);


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
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


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
-- Name: plan_limits plan_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_limits
    ADD CONSTRAINT plan_limits_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: project_plans project_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_plans
    ADD CONSTRAINT project_plans_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


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
-- Name: user_request_counts user_request_counts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts
    ADD CONSTRAINT user_request_counts_pkey PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_08 user_request_counts_2025_08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_08
    ADD CONSTRAINT user_request_counts_2025_08_pkey PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_09 user_request_counts_2025_09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_09
    ADD CONSTRAINT user_request_counts_2025_09_pkey PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_10 user_request_counts_2025_10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_10
    ADD CONSTRAINT user_request_counts_2025_10_pkey PRIMARY KEY (id, month);


--
-- Name: user_request_counts_2025_11 user_request_counts_2025_11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_request_counts_2025_11
    ADD CONSTRAINT user_request_counts_2025_11_pkey PRIMARY KEY (id, month);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: websites websites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websites
    ADD CONSTRAINT websites_pkey PRIMARY KEY (id);


--
-- Name: customer_owner_processor_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_owner_processor_index ON public.pay_customers USING btree (owner_type, owner_id, deleted_at);


--
-- Name: index_domain_request_counts_on_domain_id_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_domain_id_and_hour ON ONLY public.domain_request_counts USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_01_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_01_domain_id_hour_idx ON public.domain_request_counts_2025_08_01 USING btree (domain_id, hour);


--
-- Name: index_domain_request_counts_on_user_domain_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_domain_request_counts_on_user_domain_and_hour ON ONLY public.domain_request_counts USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_01_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_01_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_01 USING btree (user_id, domain_id, hour);


--
-- Name: index_domain_request_counts_on_user_id_and_hour; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_user_id_and_hour ON ONLY public.domain_request_counts USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_01_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_01_user_id_hour_idx ON public.domain_request_counts_2025_08_01 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_02_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_02_domain_id_hour_idx ON public.domain_request_counts_2025_08_02 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_02_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_02_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_02 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_02_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_02_user_id_hour_idx ON public.domain_request_counts_2025_08_02 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_03_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_03_domain_id_hour_idx ON public.domain_request_counts_2025_08_03 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_03_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_03_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_03 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_03_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_03_user_id_hour_idx ON public.domain_request_counts_2025_08_03 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_04_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_04_domain_id_hour_idx ON public.domain_request_counts_2025_08_04 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_04_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_04_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_04 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_04_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_04_user_id_hour_idx ON public.domain_request_counts_2025_08_04 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_05_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_05_domain_id_hour_idx ON public.domain_request_counts_2025_08_05 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_05_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_05_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_05 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_05_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_05_user_id_hour_idx ON public.domain_request_counts_2025_08_05 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_06_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_06_domain_id_hour_idx ON public.domain_request_counts_2025_08_06 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_06_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_06_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_06 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_06_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_06_user_id_hour_idx ON public.domain_request_counts_2025_08_06 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_07_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_07_domain_id_hour_idx ON public.domain_request_counts_2025_08_07 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_07_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_07_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_07 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_07_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_07_user_id_hour_idx ON public.domain_request_counts_2025_08_07 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_08_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_08_domain_id_hour_idx ON public.domain_request_counts_2025_08_08 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_08_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_08_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_08 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_08_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_08_user_id_hour_idx ON public.domain_request_counts_2025_08_08 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_09_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_09_domain_id_hour_idx ON public.domain_request_counts_2025_08_09 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_09_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_09_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_09 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_09_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_09_user_id_hour_idx ON public.domain_request_counts_2025_08_09 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_10_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_10_domain_id_hour_idx ON public.domain_request_counts_2025_08_10 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_10_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_10_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_10 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_10_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_10_user_id_hour_idx ON public.domain_request_counts_2025_08_10 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_11_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_11_domain_id_hour_idx ON public.domain_request_counts_2025_08_11 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_11_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_11_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_11 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_11_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_11_user_id_hour_idx ON public.domain_request_counts_2025_08_11 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_12_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_12_domain_id_hour_idx ON public.domain_request_counts_2025_08_12 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_12_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_12_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_12 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_12_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_12_user_id_hour_idx ON public.domain_request_counts_2025_08_12 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_13_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_13_domain_id_hour_idx ON public.domain_request_counts_2025_08_13 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_13_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_13_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_13 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_13_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_13_user_id_hour_idx ON public.domain_request_counts_2025_08_13 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_14_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_14_domain_id_hour_idx ON public.domain_request_counts_2025_08_14 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_14_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_14_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_14 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_14_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_14_user_id_hour_idx ON public.domain_request_counts_2025_08_14 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_15_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_15_domain_id_hour_idx ON public.domain_request_counts_2025_08_15 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_15_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_15_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_15 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_15_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_15_user_id_hour_idx ON public.domain_request_counts_2025_08_15 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_16_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_16_domain_id_hour_idx ON public.domain_request_counts_2025_08_16 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_16_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_16_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_16 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_16_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_16_user_id_hour_idx ON public.domain_request_counts_2025_08_16 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_17_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_17_domain_id_hour_idx ON public.domain_request_counts_2025_08_17 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_17_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_17_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_17 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_17_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_17_user_id_hour_idx ON public.domain_request_counts_2025_08_17 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_18_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_18_domain_id_hour_idx ON public.domain_request_counts_2025_08_18 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_18_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_18_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_18 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_18_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_18_user_id_hour_idx ON public.domain_request_counts_2025_08_18 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_19_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_19_domain_id_hour_idx ON public.domain_request_counts_2025_08_19 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_19_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_19_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_19 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_19_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_19_user_id_hour_idx ON public.domain_request_counts_2025_08_19 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_20_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_20_domain_id_hour_idx ON public.domain_request_counts_2025_08_20 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_20_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_20_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_20 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_20_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_20_user_id_hour_idx ON public.domain_request_counts_2025_08_20 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_21_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_21_domain_id_hour_idx ON public.domain_request_counts_2025_08_21 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_21_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_21_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_21 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_21_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_21_user_id_hour_idx ON public.domain_request_counts_2025_08_21 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_22_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_22_domain_id_hour_idx ON public.domain_request_counts_2025_08_22 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_22_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_22_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_22 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_22_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_22_user_id_hour_idx ON public.domain_request_counts_2025_08_22 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_23_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_23_domain_id_hour_idx ON public.domain_request_counts_2025_08_23 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_23_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_23_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_23 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_23_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_23_user_id_hour_idx ON public.domain_request_counts_2025_08_23 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_24_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_24_domain_id_hour_idx ON public.domain_request_counts_2025_08_24 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_24_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_24_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_24 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_24_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_24_user_id_hour_idx ON public.domain_request_counts_2025_08_24 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_25_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_25_domain_id_hour_idx ON public.domain_request_counts_2025_08_25 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_25_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_25_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_25 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_25_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_25_user_id_hour_idx ON public.domain_request_counts_2025_08_25 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_26_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_26_domain_id_hour_idx ON public.domain_request_counts_2025_08_26 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_26_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_26_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_26 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_26_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_26_user_id_hour_idx ON public.domain_request_counts_2025_08_26 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_27_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_27_domain_id_hour_idx ON public.domain_request_counts_2025_08_27 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_27_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_27_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_27 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_27_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_27_user_id_hour_idx ON public.domain_request_counts_2025_08_27 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_28_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_28_domain_id_hour_idx ON public.domain_request_counts_2025_08_28 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_28_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_28_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_28 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_28_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_28_user_id_hour_idx ON public.domain_request_counts_2025_08_28 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_29_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_29_domain_id_hour_idx ON public.domain_request_counts_2025_08_29 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_29_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_29_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_29 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_29_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_29_user_id_hour_idx ON public.domain_request_counts_2025_08_29 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_30_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_30_domain_id_hour_idx ON public.domain_request_counts_2025_08_30 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_30_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_30_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_30 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_30_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_30_user_id_hour_idx ON public.domain_request_counts_2025_08_30 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_08_31_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_31_domain_id_hour_idx ON public.domain_request_counts_2025_08_31 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_08_31_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_08_31_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_08_31 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_08_31_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_31_user_id_hour_idx ON public.domain_request_counts_2025_08_31 USING btree (user_id, hour);


--
-- Name: index_domain_request_counts_on_domain_hour_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domain_request_counts_on_domain_hour_count ON ONLY public.domain_request_counts USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08__domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08__domain_id_hour_request_count_idx ON public.domain_request_counts_2025_08_01 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx1 ON public.domain_request_counts_2025_08_02 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx2 ON public.domain_request_counts_2025_08_03 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx3 ON public.domain_request_counts_2025_08_04 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx4 ON public.domain_request_counts_2025_08_05 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx5 ON public.domain_request_counts_2025_08_06 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx6 ON public.domain_request_counts_2025_08_07 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx7 ON public.domain_request_counts_2025_08_08 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx8 ON public.domain_request_counts_2025_08_09 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_08_domain_id_hour_request_count_idx9 ON public.domain_request_counts_2025_08_10 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_01_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_01_domain_id_hour_idx ON public.domain_request_counts_2025_09_01 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_01_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_01_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_01 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_01_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_01_user_id_hour_idx ON public.domain_request_counts_2025_09_01 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_02_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_02_domain_id_hour_idx ON public.domain_request_counts_2025_09_02 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_02_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_02_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_02 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_02_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_02_user_id_hour_idx ON public.domain_request_counts_2025_09_02 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_03_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_03_domain_id_hour_idx ON public.domain_request_counts_2025_09_03 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_03_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_03_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_03 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_03_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_03_user_id_hour_idx ON public.domain_request_counts_2025_09_03 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_04_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_04_domain_id_hour_idx ON public.domain_request_counts_2025_09_04 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_04_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_04_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_04 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_04_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_04_user_id_hour_idx ON public.domain_request_counts_2025_09_04 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_05_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_05_domain_id_hour_idx ON public.domain_request_counts_2025_09_05 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_05_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_05_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_05 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_05_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_05_user_id_hour_idx ON public.domain_request_counts_2025_09_05 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_06_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_06_domain_id_hour_idx ON public.domain_request_counts_2025_09_06 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_06_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_06_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_06 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_06_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_06_user_id_hour_idx ON public.domain_request_counts_2025_09_06 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_07_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_07_domain_id_hour_idx ON public.domain_request_counts_2025_09_07 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_07_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_07_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_07 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_07_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_07_user_id_hour_idx ON public.domain_request_counts_2025_09_07 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_08_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_08_domain_id_hour_idx ON public.domain_request_counts_2025_09_08 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_08_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_08_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_08 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_08_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_08_user_id_hour_idx ON public.domain_request_counts_2025_09_08 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_09_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_09_domain_id_hour_idx ON public.domain_request_counts_2025_09_09 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_09_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_09_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_09 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_09_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_09_user_id_hour_idx ON public.domain_request_counts_2025_09_09 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_10_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_10_domain_id_hour_idx ON public.domain_request_counts_2025_09_10 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_10_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_10_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_10 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_10_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_10_user_id_hour_idx ON public.domain_request_counts_2025_09_10 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_11_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_11_domain_id_hour_idx ON public.domain_request_counts_2025_09_11 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_11_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_11_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_11 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_11_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_11_user_id_hour_idx ON public.domain_request_counts_2025_09_11 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_12_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_12_domain_id_hour_idx ON public.domain_request_counts_2025_09_12 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_12_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_12_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_12 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_12_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_12_user_id_hour_idx ON public.domain_request_counts_2025_09_12 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_13_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_13_domain_id_hour_idx ON public.domain_request_counts_2025_09_13 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_13_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_13_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_13 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_13_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_13_user_id_hour_idx ON public.domain_request_counts_2025_09_13 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_14_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_14_domain_id_hour_idx ON public.domain_request_counts_2025_09_14 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_14_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_14_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_14 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_14_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_14_user_id_hour_idx ON public.domain_request_counts_2025_09_14 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_15_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_15_domain_id_hour_idx ON public.domain_request_counts_2025_09_15 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_15_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_15_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_15 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_15_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_15_user_id_hour_idx ON public.domain_request_counts_2025_09_15 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_16_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_16_domain_id_hour_idx ON public.domain_request_counts_2025_09_16 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_16_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_16_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_16 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_16_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_16_user_id_hour_idx ON public.domain_request_counts_2025_09_16 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_17_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_17_domain_id_hour_idx ON public.domain_request_counts_2025_09_17 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_17_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_17_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_17 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_17_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_17_user_id_hour_idx ON public.domain_request_counts_2025_09_17 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_18_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_18_domain_id_hour_idx ON public.domain_request_counts_2025_09_18 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_18_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_18_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_18 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_18_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_18_user_id_hour_idx ON public.domain_request_counts_2025_09_18 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_19_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_19_domain_id_hour_idx ON public.domain_request_counts_2025_09_19 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_19_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_19_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_19 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_19_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_19_user_id_hour_idx ON public.domain_request_counts_2025_09_19 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_20_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_20_domain_id_hour_idx ON public.domain_request_counts_2025_09_20 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_20_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_20_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_20 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_20_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_20_user_id_hour_idx ON public.domain_request_counts_2025_09_20 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_21_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_21_domain_id_hour_idx ON public.domain_request_counts_2025_09_21 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_21_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_21_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_21 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_21_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_21_user_id_hour_idx ON public.domain_request_counts_2025_09_21 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_22_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_22_domain_id_hour_idx ON public.domain_request_counts_2025_09_22 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_22_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_22_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_22 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_22_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_22_user_id_hour_idx ON public.domain_request_counts_2025_09_22 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_23_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_23_domain_id_hour_idx ON public.domain_request_counts_2025_09_23 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_23_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_23_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_23 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_23_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_23_user_id_hour_idx ON public.domain_request_counts_2025_09_23 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_24_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_24_domain_id_hour_idx ON public.domain_request_counts_2025_09_24 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_24_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_24_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_24 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_24_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_24_user_id_hour_idx ON public.domain_request_counts_2025_09_24 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_25_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_25_domain_id_hour_idx ON public.domain_request_counts_2025_09_25 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_25_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_25_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_25 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_25_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_25_user_id_hour_idx ON public.domain_request_counts_2025_09_25 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_26_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_26_domain_id_hour_idx ON public.domain_request_counts_2025_09_26 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_26_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_26_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_26 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_26_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_26_user_id_hour_idx ON public.domain_request_counts_2025_09_26 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_27_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_27_domain_id_hour_idx ON public.domain_request_counts_2025_09_27 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_27_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_27_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_27 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_27_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_27_user_id_hour_idx ON public.domain_request_counts_2025_09_27 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_28_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_28_domain_id_hour_idx ON public.domain_request_counts_2025_09_28 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_28_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_28_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_28 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_28_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_28_user_id_hour_idx ON public.domain_request_counts_2025_09_28 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_29_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_29_domain_id_hour_idx ON public.domain_request_counts_2025_09_29 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_29_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_29_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_29 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_29_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_29_user_id_hour_idx ON public.domain_request_counts_2025_09_29 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09_30_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_30_domain_id_hour_idx ON public.domain_request_counts_2025_09_30 USING btree (domain_id, hour);


--
-- Name: domain_request_counts_2025_09_30_user_id_domain_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX domain_request_counts_2025_09_30_user_id_domain_id_hour_idx ON public.domain_request_counts_2025_09_30 USING btree (user_id, domain_id, hour);


--
-- Name: domain_request_counts_2025_09_30_user_id_hour_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_30_user_id_hour_idx ON public.domain_request_counts_2025_09_30 USING btree (user_id, hour);


--
-- Name: domain_request_counts_2025_09__domain_id_hour_request_count_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09__domain_id_hour_request_count_idx ON public.domain_request_counts_2025_09_01 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx1 ON public.domain_request_counts_2025_09_02 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx2; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx2 ON public.domain_request_counts_2025_09_03 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx3; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx3 ON public.domain_request_counts_2025_09_04 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx4; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx4 ON public.domain_request_counts_2025_09_05 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx5; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx5 ON public.domain_request_counts_2025_09_06 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx6; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx6 ON public.domain_request_counts_2025_09_07 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx7; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx7 ON public.domain_request_counts_2025_09_08 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx8; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx8 ON public.domain_request_counts_2025_09_09 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_09_domain_id_hour_request_count_idx9 ON public.domain_request_counts_2025_09_10 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx10; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx10 ON public.domain_request_counts_2025_08_11 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx11; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx11 ON public.domain_request_counts_2025_08_12 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx12; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx12 ON public.domain_request_counts_2025_08_13 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx13; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx13 ON public.domain_request_counts_2025_08_14 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx14; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx14 ON public.domain_request_counts_2025_08_15 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx15; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx15 ON public.domain_request_counts_2025_08_16 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx16; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx16 ON public.domain_request_counts_2025_08_17 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx17; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx17 ON public.domain_request_counts_2025_08_18 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx18; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx18 ON public.domain_request_counts_2025_08_19 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx19; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx19 ON public.domain_request_counts_2025_08_20 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx20; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx20 ON public.domain_request_counts_2025_08_21 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx21; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx21 ON public.domain_request_counts_2025_08_22 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx22; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx22 ON public.domain_request_counts_2025_08_23 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx23; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx23 ON public.domain_request_counts_2025_08_24 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx24; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx24 ON public.domain_request_counts_2025_08_25 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx25; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx25 ON public.domain_request_counts_2025_08_26 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx26; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx26 ON public.domain_request_counts_2025_08_27 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx27; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx27 ON public.domain_request_counts_2025_08_28 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx28; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx28 ON public.domain_request_counts_2025_08_29 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx29; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx29 ON public.domain_request_counts_2025_08_30 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx30; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx30 ON public.domain_request_counts_2025_08_31 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx31; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx31 ON public.domain_request_counts_2025_09_11 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx32; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx32 ON public.domain_request_counts_2025_09_12 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx33; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx33 ON public.domain_request_counts_2025_09_13 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx34; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx34 ON public.domain_request_counts_2025_09_14 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx35; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx35 ON public.domain_request_counts_2025_09_15 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx36; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx36 ON public.domain_request_counts_2025_09_16 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx37; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx37 ON public.domain_request_counts_2025_09_17 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx38; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx38 ON public.domain_request_counts_2025_09_18 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx39; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx39 ON public.domain_request_counts_2025_09_19 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx40; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx40 ON public.domain_request_counts_2025_09_20 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx41; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx41 ON public.domain_request_counts_2025_09_21 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx42; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx42 ON public.domain_request_counts_2025_09_22 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx43; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx43 ON public.domain_request_counts_2025_09_23 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx44; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx44 ON public.domain_request_counts_2025_09_24 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx45; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx45 ON public.domain_request_counts_2025_09_25 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx46; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx46 ON public.domain_request_counts_2025_09_26 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx47; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx47 ON public.domain_request_counts_2025_09_27 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx48; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx48 ON public.domain_request_counts_2025_09_28 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx49; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx49 ON public.domain_request_counts_2025_09_29 USING btree (domain_id, hour, request_count);


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx50; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_request_counts_2025_0_domain_id_hour_request_count_idx50 ON public.domain_request_counts_2025_09_30 USING btree (domain_id, hour, request_count);


--
-- Name: idx_icon_embeddings_text; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_icon_embeddings_text ON public.icon_embeddings USING ivfflat (embedding public.vector_cosine_ops);


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
-- Name: index_api_tokens_on_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_api_tokens_on_token ON public.api_tokens USING btree (token);


--
-- Name: index_api_tokens_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_api_tokens_on_user_id ON public.api_tokens USING btree (user_id);


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
-- Name: index_cloudflare_firewall_rules_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewall_rules_on_user_id ON public.cloudflare_firewall_rules USING btree (user_id);


--
-- Name: index_cloudflare_firewalls_on_blocked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_blocked_at ON public.cloudflare_firewalls USING btree (blocked_at);


--
-- Name: index_cloudflare_firewalls_on_cloudflare_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_cloudflare_zone_id ON public.cloudflare_firewalls USING btree (cloudflare_zone_id);


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
-- Name: index_cloudflare_firewalls_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_cloudflare_firewalls_on_user_id ON public.cloudflare_firewalls USING btree (user_id);


--
-- Name: index_connected_accounts_on_owner_id_and_owner_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_connected_accounts_on_owner_id_and_owner_type ON public.connected_accounts USING btree (owner_id, owner_type);


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
-- Name: index_deploys_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_created_at ON public.deploys USING btree (created_at);


--
-- Name: index_deploys_on_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_environment ON public.deploys USING btree (environment);


--
-- Name: index_deploys_on_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_is_live ON public.deploys USING btree (is_live);


--
-- Name: index_deploys_on_is_preview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_is_preview ON public.deploys USING btree (is_preview);


--
-- Name: index_deploys_on_revertible; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_revertible ON public.deploys USING btree (revertible);


--
-- Name: index_deploys_on_snapshot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_snapshot_id ON public.deploys USING btree (snapshot_id);


--
-- Name: index_deploys_on_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_status ON public.deploys USING btree (status);


--
-- Name: index_deploys_on_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_trigger ON public.deploys USING btree (trigger);


--
-- Name: index_deploys_on_website_history_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_website_history_id ON public.deploys USING btree (website_history_id);


--
-- Name: index_deploys_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_website_id ON public.deploys USING btree (website_id);


--
-- Name: index_deploys_on_website_id_and_environment_and_is_preview; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_website_id_and_environment_and_is_preview ON public.deploys USING btree (website_id, environment, is_preview);


--
-- Name: index_deploys_on_website_id_and_is_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_deploys_on_website_id_and_is_live ON public.deploys USING btree (website_id, is_live);


--
-- Name: index_domains_on_cloudflare_zone_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_cloudflare_zone_id ON public.domains USING btree (cloudflare_zone_id);


--
-- Name: index_domains_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_created_at ON public.domains USING btree (created_at);


--
-- Name: index_domains_on_domain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_domain ON public.domains USING btree (domain);


--
-- Name: index_domains_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_user_id ON public.domains USING btree (user_id);


--
-- Name: index_domains_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_domains_on_website_id ON public.domains USING btree (website_id);


--
-- Name: index_file_specifications_on_canonical_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_file_specifications_on_canonical_path ON public.file_specifications USING btree (canonical_path);


--
-- Name: index_file_specifications_on_filetype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_file_specifications_on_filetype ON public.file_specifications USING btree (filetype);


--
-- Name: index_file_specifications_on_subtype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_file_specifications_on_subtype ON public.file_specifications USING btree (subtype);


--
-- Name: index_icon_embeddings_on_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_icon_embeddings_on_key ON public.icon_embeddings USING btree (key);


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
-- Name: index_pages_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pages_on_created_at ON public.pages USING btree (created_at);


--
-- Name: index_pages_on_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pages_on_file_id ON public.pages USING btree (file_id);


--
-- Name: index_pages_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pages_on_project_id ON public.pages USING btree (project_id);


--
-- Name: index_pages_on_project_id_and_page_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_pages_on_project_id_and_page_type ON public.pages USING btree (project_id, page_type);


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
-- Name: index_plan_limits_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plan_limits_on_created_at ON public.plan_limits USING btree (created_at);


--
-- Name: index_plan_limits_on_limit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plan_limits_on_limit ON public.plan_limits USING btree ("limit");


--
-- Name: index_plan_limits_on_limit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plan_limits_on_limit_type ON public.plan_limits USING btree (limit_type);


--
-- Name: index_plan_limits_on_plan_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plan_limits_on_plan_id ON public.plan_limits USING btree (plan_id);


--
-- Name: index_plan_limits_on_plan_id_and_limit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_plan_limits_on_plan_id_and_limit_type ON public.plan_limits USING btree (plan_id, limit_type);


--
-- Name: index_plans_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_plans_on_created_at ON public.plans USING btree (created_at);


--
-- Name: index_plans_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_plans_on_name ON public.plans USING btree (name);


--
-- Name: index_project_plans_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_plans_on_created_at ON public.project_plans USING btree (created_at);


--
-- Name: index_project_plans_on_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_plans_on_project_id ON public.project_plans USING btree (project_id);


--
-- Name: index_project_plans_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_project_plans_on_updated_at ON public.project_plans USING btree (updated_at);


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

CREATE UNIQUE INDEX index_projects_on_account_id_and_name ON public.projects USING btree (account_id, name);


--
-- Name: index_projects_on_account_id_and_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_projects_on_account_id_and_thread_id ON public.projects USING btree (account_id, thread_id);


--
-- Name: index_projects_on_account_id_and_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_account_id_and_updated_at ON public.projects USING btree (account_id, updated_at);


--
-- Name: index_projects_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_created_at ON public.projects USING btree (created_at);


--
-- Name: index_projects_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_name ON public.projects USING btree (name);


--
-- Name: index_projects_on_theme_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_theme_id ON public.projects USING btree (theme_id);


--
-- Name: index_projects_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_thread_id ON public.projects USING btree (thread_id);


--
-- Name: index_projects_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_projects_on_updated_at ON public.projects USING btree (updated_at);


--
-- Name: index_sections_on_component_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sections_on_component_id ON public.sections USING btree (component_id);


--
-- Name: index_sections_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sections_on_created_at ON public.sections USING btree (created_at);


--
-- Name: index_sections_on_file_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sections_on_file_id ON public.sections USING btree (file_id);


--
-- Name: index_sections_on_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_sections_on_page_id ON public.sections USING btree (page_id);


--
-- Name: index_template_files_on_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_template_files_on_path ON public.template_files USING btree (path);


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
-- Name: index_themes_on_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_themes_on_name ON public.themes USING btree (name);


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
-- Name: index_website_file_histories_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_created_at ON public.website_file_histories USING btree (created_at);


--
-- Name: index_website_file_histories_on_file_specification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_file_histories_on_file_specification_id ON public.website_file_histories USING btree (file_specification_id);


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
-- Name: index_website_files_on_file_specification_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_file_specification_id ON public.website_files USING btree (file_specification_id);


--
-- Name: index_website_files_on_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_updated_at ON public.website_files USING btree (updated_at);


--
-- Name: index_website_files_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_files_on_website_id ON public.website_files USING btree (website_id);


--
-- Name: index_website_histories_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_created_at ON public.website_histories USING btree (created_at);


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
-- Name: index_website_histories_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_thread_id ON public.website_histories USING btree (thread_id);


--
-- Name: index_website_histories_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_user_id ON public.website_histories USING btree (user_id);


--
-- Name: index_website_histories_on_website_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_website_histories_on_website_id ON public.website_histories USING btree (website_id);


--
-- Name: index_websites_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_created_at ON public.websites USING btree (created_at);


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
-- Name: index_websites_on_thread_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_websites_on_thread_id ON public.websites USING btree (thread_id);


--
-- Name: index_websites_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_websites_on_user_id ON public.websites USING btree (user_id);


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
-- Name: domain_request_counts_2025_08_01_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_01_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_01_pkey;


--
-- Name: domain_request_counts_2025_08_01_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_01_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_01_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_01_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_02_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_02_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_02_pkey;


--
-- Name: domain_request_counts_2025_08_02_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_02_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_02_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_02_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_03_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_03_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_03_pkey;


--
-- Name: domain_request_counts_2025_08_03_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_03_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_03_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_03_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_04_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_04_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_04_pkey;


--
-- Name: domain_request_counts_2025_08_04_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_04_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_04_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_04_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_05_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_05_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_05_pkey;


--
-- Name: domain_request_counts_2025_08_05_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_05_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_05_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_05_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_06_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_06_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_06_pkey;


--
-- Name: domain_request_counts_2025_08_06_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_06_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_06_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_06_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_07_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_07_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_07_pkey;


--
-- Name: domain_request_counts_2025_08_07_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_07_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_07_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_07_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_08_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_08_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_08_pkey;


--
-- Name: domain_request_counts_2025_08_08_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_08_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_08_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_08_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_09_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_09_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_09_pkey;


--
-- Name: domain_request_counts_2025_08_09_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_09_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_09_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_09_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_10_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_10_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_10_pkey;


--
-- Name: domain_request_counts_2025_08_10_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_10_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_10_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_10_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_11_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_11_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_11_pkey;


--
-- Name: domain_request_counts_2025_08_11_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_11_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_11_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_11_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_12_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_12_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_12_pkey;


--
-- Name: domain_request_counts_2025_08_12_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_12_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_12_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_12_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_13_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_13_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_13_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_13_pkey;


--
-- Name: domain_request_counts_2025_08_13_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_13_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_13_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_13_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_14_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_14_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_14_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_14_pkey;


--
-- Name: domain_request_counts_2025_08_14_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_14_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_14_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_14_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_15_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_15_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_15_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_15_pkey;


--
-- Name: domain_request_counts_2025_08_15_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_15_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_15_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_15_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_16_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_16_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_16_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_16_pkey;


--
-- Name: domain_request_counts_2025_08_16_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_16_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_16_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_16_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_17_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_17_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_17_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_17_pkey;


--
-- Name: domain_request_counts_2025_08_17_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_17_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_17_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_17_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_18_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_18_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_18_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_18_pkey;


--
-- Name: domain_request_counts_2025_08_18_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_18_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_18_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_18_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_19_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_19_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_19_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_19_pkey;


--
-- Name: domain_request_counts_2025_08_19_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_19_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_19_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_19_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_20_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_20_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_20_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_20_pkey;


--
-- Name: domain_request_counts_2025_08_20_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_20_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_20_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_20_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_21_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_21_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_21_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_21_pkey;


--
-- Name: domain_request_counts_2025_08_21_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_21_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_21_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_21_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_22_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_22_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_22_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_22_pkey;


--
-- Name: domain_request_counts_2025_08_22_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_22_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_22_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_22_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_23_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_23_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_23_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_23_pkey;


--
-- Name: domain_request_counts_2025_08_23_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_23_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_23_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_23_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_24_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_24_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_24_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_24_pkey;


--
-- Name: domain_request_counts_2025_08_24_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_24_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_24_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_24_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_25_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_25_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_25_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_25_pkey;


--
-- Name: domain_request_counts_2025_08_25_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_25_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_25_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_25_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_26_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_26_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_26_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_26_pkey;


--
-- Name: domain_request_counts_2025_08_26_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_26_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_26_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_26_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_27_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_27_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_27_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_27_pkey;


--
-- Name: domain_request_counts_2025_08_27_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_27_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_27_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_27_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_28_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_28_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_28_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_28_pkey;


--
-- Name: domain_request_counts_2025_08_28_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_28_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_28_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_28_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_29_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_29_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_29_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_29_pkey;


--
-- Name: domain_request_counts_2025_08_29_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_29_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_29_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_29_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_30_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_30_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_30_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_30_pkey;


--
-- Name: domain_request_counts_2025_08_30_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_30_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_30_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_30_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_31_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_31_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_31_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_08_31_pkey;


--
-- Name: domain_request_counts_2025_08_31_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_31_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_08_31_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_08_31_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_08__domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08__domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx1;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx2; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx2;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx3; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx3;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx4; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx4;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx5; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx5;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx6; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx6;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx7; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx7;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx8; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx8;


--
-- Name: domain_request_counts_2025_08_domain_id_hour_request_count_idx9; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_08_domain_id_hour_request_count_idx9;


--
-- Name: domain_request_counts_2025_09_01_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_01_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_01_pkey;


--
-- Name: domain_request_counts_2025_09_01_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_01_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_01_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_01_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_02_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_02_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_02_pkey;


--
-- Name: domain_request_counts_2025_09_02_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_02_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_02_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_02_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_03_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_03_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_03_pkey;


--
-- Name: domain_request_counts_2025_09_03_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_03_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_03_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_03_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_04_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_04_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_04_pkey;


--
-- Name: domain_request_counts_2025_09_04_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_04_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_04_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_04_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_05_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_05_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_05_pkey;


--
-- Name: domain_request_counts_2025_09_05_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_05_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_05_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_05_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_06_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_06_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_06_pkey;


--
-- Name: domain_request_counts_2025_09_06_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_06_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_06_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_06_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_07_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_07_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_07_pkey;


--
-- Name: domain_request_counts_2025_09_07_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_07_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_07_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_07_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_08_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_08_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_08_pkey;


--
-- Name: domain_request_counts_2025_09_08_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_08_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_08_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_08_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_09_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_09_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_09_pkey;


--
-- Name: domain_request_counts_2025_09_09_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_09_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_09_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_09_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_10_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_10_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_10_pkey;


--
-- Name: domain_request_counts_2025_09_10_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_10_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_10_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_10_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_11_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_11_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_11_pkey;


--
-- Name: domain_request_counts_2025_09_11_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_11_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_11_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_11_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_12_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_12_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_12_pkey;


--
-- Name: domain_request_counts_2025_09_12_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_12_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_12_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_12_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_13_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_13_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_13_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_13_pkey;


--
-- Name: domain_request_counts_2025_09_13_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_13_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_13_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_13_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_14_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_14_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_14_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_14_pkey;


--
-- Name: domain_request_counts_2025_09_14_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_14_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_14_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_14_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_15_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_15_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_15_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_15_pkey;


--
-- Name: domain_request_counts_2025_09_15_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_15_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_15_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_15_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_16_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_16_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_16_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_16_pkey;


--
-- Name: domain_request_counts_2025_09_16_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_16_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_16_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_16_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_17_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_17_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_17_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_17_pkey;


--
-- Name: domain_request_counts_2025_09_17_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_17_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_17_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_17_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_18_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_18_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_18_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_18_pkey;


--
-- Name: domain_request_counts_2025_09_18_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_18_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_18_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_18_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_19_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_19_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_19_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_19_pkey;


--
-- Name: domain_request_counts_2025_09_19_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_19_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_19_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_19_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_20_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_20_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_20_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_20_pkey;


--
-- Name: domain_request_counts_2025_09_20_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_20_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_20_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_20_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_21_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_21_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_21_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_21_pkey;


--
-- Name: domain_request_counts_2025_09_21_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_21_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_21_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_21_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_22_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_22_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_22_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_22_pkey;


--
-- Name: domain_request_counts_2025_09_22_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_22_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_22_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_22_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_23_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_23_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_23_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_23_pkey;


--
-- Name: domain_request_counts_2025_09_23_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_23_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_23_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_23_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_24_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_24_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_24_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_24_pkey;


--
-- Name: domain_request_counts_2025_09_24_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_24_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_24_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_24_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_25_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_25_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_25_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_25_pkey;


--
-- Name: domain_request_counts_2025_09_25_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_25_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_25_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_25_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_26_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_26_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_26_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_26_pkey;


--
-- Name: domain_request_counts_2025_09_26_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_26_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_26_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_26_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_27_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_27_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_27_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_27_pkey;


--
-- Name: domain_request_counts_2025_09_27_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_27_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_27_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_27_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_28_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_28_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_28_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_28_pkey;


--
-- Name: domain_request_counts_2025_09_28_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_28_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_28_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_28_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_29_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_29_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_29_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_29_pkey;


--
-- Name: domain_request_counts_2025_09_29_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_29_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_29_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_29_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_30_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_30_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_30_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.domain_request_counts_pkey ATTACH PARTITION public.domain_request_counts_2025_09_30_pkey;


--
-- Name: domain_request_counts_2025_09_30_user_id_domain_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_domain_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_30_user_id_domain_id_hour_idx;


--
-- Name: domain_request_counts_2025_09_30_user_id_hour_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_user_id_and_hour ATTACH PARTITION public.domain_request_counts_2025_09_30_user_id_hour_idx;


--
-- Name: domain_request_counts_2025_09__domain_id_hour_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09__domain_id_hour_request_count_idx;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx1; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx1;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx2; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx2;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx3; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx3;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx4; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx4;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx5; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx5;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx6; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx6;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx7; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx7;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx8; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx8;


--
-- Name: domain_request_counts_2025_09_domain_id_hour_request_count_idx9; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_09_domain_id_hour_request_count_idx9;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx10; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx10;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx11; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx11;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx12; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx12;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx13; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx13;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx14; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx14;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx15; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx15;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx16; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx16;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx17; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx17;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx18; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx18;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx19; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx19;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx20; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx20;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx21; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx21;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx22; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx22;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx23; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx23;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx24; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx24;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx25; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx25;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx26; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx26;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx27; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx27;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx28; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx28;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx29; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx29;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx30; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx30;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx31; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx31;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx32; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx32;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx33; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx33;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx34; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx34;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx35; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx35;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx36; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx36;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx37; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx37;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx38; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx38;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx39; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx39;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx40; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx40;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx41; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx41;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx42; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx42;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx43; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx43;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx44; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx44;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx45; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx45;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx46; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx46;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx47; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx47;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx48; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx48;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx49; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx49;


--
-- Name: domain_request_counts_2025_0_domain_id_hour_request_count_idx50; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_domain_request_counts_on_domain_hour_count ATTACH PARTITION public.domain_request_counts_2025_0_domain_id_hour_request_count_idx50;


--
-- Name: user_request_counts_2025_08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_08_pkey;


--
-- Name: user_request_counts_2025_08_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_08_user_id_month_idx;


--
-- Name: user_request_counts_2025_08_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_08_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_09_pkey;


--
-- Name: user_request_counts_2025_09_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_09_user_id_month_idx;


--
-- Name: user_request_counts_2025_09_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_09_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_10_pkey;


--
-- Name: user_request_counts_2025_10_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_10_user_id_month_idx;


--
-- Name: user_request_counts_2025_10_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_10_user_id_month_request_count_idx;


--
-- Name: user_request_counts_2025_11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.user_request_counts_pkey ATTACH PARTITION public.user_request_counts_2025_11_pkey;


--
-- Name: user_request_counts_2025_11_user_id_month_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_id_and_month ATTACH PARTITION public.user_request_counts_2025_11_user_id_month_idx;


--
-- Name: user_request_counts_2025_11_user_id_month_request_count_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.index_user_request_counts_on_user_month ATTACH PARTITION public.user_request_counts_2025_11_user_id_month_request_count_idx;


--
-- Name: account_invitations fk_rails_04a176d6ed; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invitations
    ADD CONSTRAINT fk_rails_04a176d6ed FOREIGN KEY (invited_by_id) REFERENCES public.users(id);


--
-- Name: accounts fk_rails_37ced7af95; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT fk_rails_37ced7af95 FOREIGN KEY (owner_id) REFERENCES public.users(id);


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
-- Name: active_storage_variant_records fk_rails_993965df05; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records
    ADD CONSTRAINT fk_rails_993965df05 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id);


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
-- Name: api_tokens fk_rails_f16b5e0447; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_tokens
    ADD CONSTRAINT fk_rails_f16b5e0447 FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
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

