# Vibe custom domain setup

## Current state

November 15, 2026. The user authorized connecting `vibe-chat.us`, managed through Porkbun, to the shared Vibe deployment. ACM certificate verification is pending. CloudFront domain attachment and DNS cutover have yet to run. The app remains available at https://d1ia555vbcj8k2.cloudfront.net.

| Setting | Value |
| --- | --- |
| AWS account | `851725603471` |
| Application region | `us-east-2` |
| CloudFormation stack | `Vibe-dev` |
| CloudFront distribution | `E2CC4LLGDDIPFE` |
| DNS destination | `d1ia555vbcj8k2.cloudfront.net` |
| Certificate region | `us-east-1`, required for CloudFront |
| Certificate ARN | `arn:aws:acm:us-east-1:851725603471:certificate/d99e921e-40fb-47f7-bb87-2907a98dae20` |

## 1. Verify domain ownership in Porkbun

Open Domain Management, find `vibe-chat.us`, then open DNS records. Add this record.

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Host | `_34f961639a3edb3f5b6139d51d3f51a0` |
| Answer | `_295107084457cd43c46a24e4f9159b02.wzccmgtwzk.acm-validations.aws` |
| TTL | `600` |

Porkbun appends the domain to the Host. Keep this record for ACM automatic renewal. Wait for ACM to report `ISSUED` before deploying the domain attachment.

## 2. Activate the AWS configuration

The infrastructure supports paired CDK context keys `vibe:domainName` and `vibe:certificateArn`. After validation, persist both in `infra/cdk.json` so teammates retain the configuration on later deployments.

```json
"vibe:domainName": "vibe-chat.us",
"vibe:certificateArn": "arn:aws:acm:us-east-1:851725603471:certificate/d99e921e-40fb-47f7-bb87-2907a98dae20"
```

Use the setup/build instructions in `STATUS.md`, verify your AWS identity, and select the shared account and Ohio region. Review strict synthesis and CDK diff, then deploy under the current chat authorization. The change attaches the domain/certificate to the existing distribution and sets API `APP_URL` to `https://vibe-chat.us` for email invitation links. `WebsiteUrl` becomes the canonical URL and `CloudFrontUrl` retains the distribution hostname.

The certificate was requested directly in ACM and is imported by ARN. On another device targeting this account, reuse its ARN. For another account, request and DNS-validate a new certificate in that account's `us-east-1`, then use its ARN and that deployment's distribution hostname.

## 3. Route the domain after CloudFront is ready

After the distribution reaches `Deployed` with the domain attached, add the following Porkbun record.

| Field | Value |
| --- | --- |
| Type | `ALIAS` |
| Host | Leave blank for the root domain |
| Answer | `d1ia555vbcj8k2.cloudfront.net` |
| TTL | `600` |

Replace conflicting apex parking/routing records. Preserve unrelated mail, verification and subdomain records. The selected hostname is `vibe-chat.us`. Adding `www.vibe-chat.us` requires certificate coverage and a CloudFront alias for that hostname.

## 4. Verify and publish

Check authoritative/public DNS, HTTPS certificate coverage, homepage, SPA navigation, `/config.json`, authenticated API access and an invitation URL. Then update the README live link and `STATUS.md` with the completed deployment and observed results.

Production uses relative `/api` routing, so the browser continues through the same CloudFront distribution. Cognito currently uses password authentication without OAuth callback URLs.

[CloudFront distribution console](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E2CC4LLGDDIPFE)
