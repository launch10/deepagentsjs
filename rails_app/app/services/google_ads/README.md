# Google Ads Setup + FAQs

## Important Links

- [Google Ads API Center](https://ads.google.com/aw/apicenter)
- [Google Ads API Documentation](https://developers.google.com/google-ads/api/docs/start)
- [OAuth Playground](https://developers.google.com/oauthplayground)
- [Create Clients](https://console.cloud.google.com/auth/clients?project=launch10-479317)

## Creating an API Client

Only setup this once for all environments - do not create a separate API client for each environment. The same client can be used for both test and production by simply changing the customer ID.

### 1. Get A Developer Token

1. Login to the main Google Ads account API Center https://ads.google.com/aw/apicenter

2. Select "Web application"

3. Add authorized redirect URI: http://localhost:3000

4. Add authorized redirect URI: https://launch10.ai

5. Add authorized redirect URI: https://developers.google.com/oauthplayground/

6. Copy Client ID and Client Secret to Rails credentials

7. Navigate to Settings > Tools & Settings > Measurement > Developer tokens

8. Click "New token" and follow the prompts

9. Copy the developer token to your Rails credentials

- [Create Clients](https://console.cloud.google.com/auth/clients?project=launch10-479317)

## Creating Test MCC Account

https://developers.google.com/google-ads/api/docs/first-call/test-accounts

## Creating Production MCC Account

## Generate access tokens / refresh tokens

[OAuth Playground](https://developers.google.com/oauthplayground)

### Steps:

1. Click gear icon -> Check 'Use your own OAuth credentials'

2. Enter your client_id and client_secret

3. In left panel, find 'Google Ads API' and select scope:

4. https://www.googleapis.com/auth/adwords

5. Click 'Authorize APIs' and grant access

6. Click 'Exchange authorization code for tokens'

7. Copy the refresh_token to your Rails credentials
