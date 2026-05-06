//! Service Account auth for FEAT-26 Google Sheets sync (PR G v1.0.8).
//!
//! Google Sheets needs an OAuth2 Bearer token for any *write* call. Browser
//! / 3-legged OAuth would force the admin through a consent screen every
//! launch, which is awful UX for a desktop kiosk. Service Account auth
//! sidesteps that: the admin generates a JSON key once in Google Cloud
//! Console, pastes it into Pengaturan → Sinkronisasi, and the desktop app
//! signs short-lived JWTs with the SA's private key whenever it needs an
//! access token.
//!
//! Flow per [Google docs][1]:
//!
//! 1. Build a JWT with header `{"alg":"RS256","typ":"JWT"}` and claims
//!    `{iss, scope, aud, exp, iat}` where `iss` is the SA email.
//! 2. Sign with the SA's RSA private key (PEM-encoded, included in the JSON).
//! 3. POST `assertion=<jwt>&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`
//!    to `https://oauth2.googleapis.com/token`.
//! 4. Use the returned `access_token` as `Authorization: Bearer …` for ≤1 h.
//!
//! We cache the token in [`TokenCache`] until five minutes before its `exp`,
//! so a typical push/pull cycle only does the JWT dance once.
//!
//! [1]: https://developers.google.com/identity/protocols/oauth2/service-account

use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// Default OAuth scope. Read+write to spreadsheets the admin shares with the
/// SA email. Drive scope is *not* required because the user passes the
/// spreadsheet ID explicitly; we never enumerate Drive.
pub const DEFAULT_SCOPE: &str = "https://www.googleapis.com/auth/spreadsheets";

/// Service Account JSON shape. Only fields we actually use; the file from
/// Google Cloud has a few more (`token_uri`, `auth_uri`, `client_id`, …)
/// that we don't need.
#[derive(Debug, Clone, Deserialize)]
pub struct ServiceAccount {
    #[serde(rename = "type")]
    pub kind: String,
    #[allow(dead_code)]
    pub project_id: String,
    pub client_email: String,
    pub private_key: String,
    #[serde(default)]
    pub private_key_id: String,
}

impl ServiceAccount {
    /// Parse the JSON the admin pasted into Pengaturan → Sinkronisasi.
    /// Returns a friendly Validation error rather than the raw serde
    /// message, so the toast in `formatTauriError` is readable.
    pub fn from_json(raw: &str) -> AppResult<Self> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(AppError::Validation(
                "Service Account JSON kosong".into(),
            ));
        }
        let sa: ServiceAccount = serde_json::from_str(trimmed)
            .map_err(|e| AppError::Validation(format!("Service Account JSON tidak valid: {e}")))?;
        if sa.kind != "service_account" {
            return Err(AppError::Validation(format!(
                "JSON yang dipaste bukan Service Account (type=\"{}\")",
                sa.kind
            )));
        }
        if sa.client_email.is_empty() {
            return Err(AppError::Validation(
                "Service Account JSON kekurangan field client_email".into(),
            ));
        }
        if sa.private_key.is_empty() {
            return Err(AppError::Validation(
                "Service Account JSON kekurangan field private_key".into(),
            ));
        }
        if !sa.private_key.contains("BEGIN") {
            return Err(AppError::Validation(
                "private_key bukan PEM (perlu '-----BEGIN PRIVATE KEY-----' header)".into(),
            ));
        }
        Ok(sa)
    }
}

#[derive(Debug, Serialize)]
struct JwtClaims<'a> {
    iss: &'a str,
    scope: &'a str,
    aud: &'a str,
    exp: u64,
    iat: u64,
}

/// Build the assertion JWT for a single token-exchange request.
///
/// Returns the compact-serialised JWT string. The optional `now_secs`
/// argument lets unit tests pin the timestamp; in production we read
/// `SystemTime::now()`.
pub fn build_assertion_jwt(
    sa: &ServiceAccount,
    scope: &str,
    now_secs: Option<u64>,
) -> AppResult<String> {
    let now = now_secs.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
    let claims = JwtClaims {
        iss: &sa.client_email,
        scope,
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };
    let mut header = Header::new(jsonwebtoken::Algorithm::RS256);
    if !sa.private_key_id.is_empty() {
        header.kid = Some(sa.private_key_id.clone());
    }
    let key = EncodingKey::from_rsa_pem(sa.private_key.as_bytes()).map_err(|e| {
        AppError::Validation(format!(
            "private_key tidak bisa di-decode sebagai RSA PEM: {e}"
        ))
    })?;
    encode(&header, &claims, &key)
        .map_err(|e| AppError::Internal(format!("JWT sign gagal: {e}")))
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    #[allow(dead_code)]
    token_type: String,
}

/// Exchange a signed assertion JWT for an OAuth2 access token.
pub async fn fetch_access_token(
    http: &reqwest::Client,
    sa: &ServiceAccount,
    scope: &str,
) -> AppResult<AccessToken> {
    let jwt = build_assertion_jwt(sa, scope, None)?;
    let resp = http
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ])
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("oauth2 token request gagal: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Validation(format!(
            "Google OAuth2 menolak Service Account ({status}): {body}"
        )));
    }
    let parsed: TokenResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("oauth2 response tidak parsable: {e}")))?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(AccessToken {
        token: parsed.access_token,
        expires_at_secs: now + parsed.expires_in.saturating_sub(60),
    })
}

#[derive(Debug, Clone)]
pub struct AccessToken {
    pub token: String,
    pub expires_at_secs: u64,
}

impl AccessToken {
    /// True iff `exp - now > 5 minutes`. We refresh once we hit the 5-min
    /// safety margin to never slip past the actual `exp` mid-request.
    pub fn is_fresh(&self, now_secs: u64) -> bool {
        self.expires_at_secs.saturating_sub(now_secs) > 300
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal RSA test key — generated once with
    /// `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048`. Used
    /// by both the JWT-sign assertion and the ServiceAccount parser tests.
    /// NOT a secret — it lives in source on purpose so CI can run offline.
    const TEST_PRIVATE_KEY: &str = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCu80GjMF4mOjkq\ndOi814E04dugWf7hwA0F7d84NfbeoyWF02yGMH847iNHx0kDikeNPXBY8ttMtVoV\nVqoj067O9dYg4UoxgV82+lgM9fB6rsBQPDumR46w+g7BHpctuDO+p9VgtdqpvSU8\nRjWcNszyeiemzpgC2+LQ8lkBDclGwhCOK6t/GbnfZeUFenGrSyicSeFN4Sa5dGbl\nZUqaHOyFh229UuuMTA7gSBsHI+ZfwAH4cWpQZPfCvnPNHDpzruON3/w7JCvZjMRF\numzvjnTjffjcigS0CME5j5xDbsF+LTrwpeMivrI3c0rWOLMgGAUlJeRkQsTWw5UZ\nGbdUqsP3AgMBAAECggEALJb8ajrYLDcXvd35ObRVjqRoJUj6wRABYbr8cyex6ZG8\nbQzzcoomytxLKq68ycWzMejwWwNe6ICqWpjxmVsJCV+3+T5iehamrW0GBxuh9KrY\ngjqv21QOpsW8//SrhHAX5CaDqHgBKNT4ChI89Lk06DJBK+8o6EWh3C6Ah9e7Lqi3\n588iQeqNpMCwoRyewUU1XFfPB4ZlifBGk3lUCfzv90UcqBSKllQAgnQOhSOCLX9f\n7k8skSol0ONHK8iz/Y14Fxe42937lHYQ4UEVFdj0ygpdpt5rDn1gPmIg4S27FUcV\nh6ffHW7gYC6t3zKDQkTcGYbPb98QQ7s+/w0AAEO6YQKBgQC6CKLpOhWWlc58F7y4\nVBRv8S5ryX0kW7JYGS368euNuiOb35Ywbzd8p0y+/uR8f/5BTtmrULf+r88HLzAM\nV3GkA55gFtZy2YKt4BEZfFqrRAg5/uHycBCqy9F+bFHuap3X4Z8w34sTQTcnqGst\nU5hz4hRFBONeZcyrRYHsanw44QKBgQDwv389hYTiUq6xK+J+UFNBsNwQgVOaBVRA\n5xWQFUzIIq2/GqHwMpjMwux2gU7xFrctvFe5G7oTu7SEdKqkMbgtSSNw8Zl7A7Uw\n2k8mRQgdGrfMWWgCX6wPC5C/R/EeOGTWPwdzab1EkUP51La7vhMZSHr3nhwzXr3X\n0kpPgyvf1wKBgFr91GkNDvgbh+ZsWdMy1Ng3+EOiRsJc02uBzVqbr2If9EDOaJCC\nJXqj/cbBt5IprHvXDGJd1dENvs49x1uR/bSCTJmlMfj06JURLmvvxg1U9k0fnPZO\n1+giTvJuGtjpbxDje1CVVlnxoP+Vwe5mn/+2ScHEdU17r1LqaXTwVJghAoGBAL0K\nUZp4bnjc3emnAQmYf1e0zYh0VLY7ewYfrlHeN9VrTa0i94fJ4yvd35nKPbeX06yp\nGOT0fa+jE8NybM/TbsC4jojQXWk35x3+PmpZiF56LVrb1Y0PnOaPeVCJ6C6Hr75/\n7ZTVsdXWj17shbR0M0EGJfCsCY7Y1Q9URB+da2UvAoGAR9knTKtypWdSkxs4vlbt\n0UGpLnt43TfxUvwA660OXx2buP8cb3UiDtPWl1pCrMA4Ks0QOlS8jmjeR36fMcvb\nJ2nJpOv2Jc9U6bSSs/iL3vWq+MVhvuVLthYK7d/dOWGPAv//mYZTh9MSb9EtrQBq\nFxymUQrUCqzet1ptyu5SwEs=\n-----END PRIVATE KEY-----\n";

    fn fixture_sa() -> ServiceAccount {
        ServiceAccount {
            kind: "service_account".into(),
            project_id: "test-project-12345".into(),
            client_email: "test-sa@test-project-12345.iam.gserviceaccount.com".into(),
            private_key: TEST_PRIVATE_KEY.into(),
            private_key_id: "abc123def456".into(),
        }
    }

    #[test]
    fn from_json_rejects_empty_input() {
        let err = ServiceAccount::from_json("   ").unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("kosong")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn from_json_rejects_non_sa_type() {
        let raw = serde_json::json!({
            "type": "user",
            "project_id": "x",
            "client_email": "x@x",
            "private_key": "abc",
        })
        .to_string();
        let err = ServiceAccount::from_json(&raw).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("Service Account") && m.contains("user")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn from_json_rejects_missing_fields() {
        let raw = serde_json::json!({
            "type": "service_account",
            "project_id": "x",
            "client_email": "",
            "private_key": "x",
        })
        .to_string();
        let err = ServiceAccount::from_json(&raw).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("client_email")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn from_json_rejects_non_pem_private_key() {
        let raw = serde_json::json!({
            "type": "service_account",
            "project_id": "x",
            "client_email": "x@x",
            "private_key": "not-a-pem-key",
        })
        .to_string();
        let err = ServiceAccount::from_json(&raw).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("PEM")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn from_json_accepts_valid_sa() {
        let raw = serde_json::json!({
            "type": "service_account",
            "project_id": "test-project-12345",
            "client_email": "test@test.iam.gserviceaccount.com",
            "private_key": TEST_PRIVATE_KEY,
            "private_key_id": "abc123",
        })
        .to_string();
        let sa = ServiceAccount::from_json(&raw).unwrap();
        assert_eq!(sa.client_email, "test@test.iam.gserviceaccount.com");
        assert_eq!(sa.private_key_id, "abc123");
    }

    #[test]
    fn build_assertion_jwt_produces_three_segments() {
        let sa = fixture_sa();
        let jwt = build_assertion_jwt(&sa, DEFAULT_SCOPE, Some(1_700_000_000)).unwrap();
        let parts: Vec<&str> = jwt.split('.').collect();
        assert_eq!(parts.len(), 3, "JWT must have header.payload.signature");
        assert!(!parts[0].is_empty());
        assert!(!parts[1].is_empty());
        assert!(!parts[2].is_empty());
    }

    #[test]
    fn build_assertion_jwt_payload_contains_required_claims() {
        let sa = fixture_sa();
        let jwt = build_assertion_jwt(&sa, DEFAULT_SCOPE, Some(1_700_000_000)).unwrap();
        let payload_b64 = jwt.split('.').nth(1).unwrap();
        // jsonwebtoken uses URL-safe base64 without padding.
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine as _;
        let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64).unwrap();
        let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).unwrap();
        assert_eq!(
            payload["iss"],
            "test-sa@test-project-12345.iam.gserviceaccount.com"
        );
        assert_eq!(payload["scope"], DEFAULT_SCOPE);
        assert_eq!(payload["aud"], "https://oauth2.googleapis.com/token");
        assert_eq!(payload["iat"], 1_700_000_000);
        assert_eq!(payload["exp"], 1_700_003_600);
    }

    #[test]
    fn build_assertion_jwt_includes_kid_when_set() {
        let sa = fixture_sa();
        let jwt = build_assertion_jwt(&sa, DEFAULT_SCOPE, Some(1_700_000_000)).unwrap();
        let header_b64 = jwt.split('.').next().unwrap();
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine as _;
        let header_bytes = URL_SAFE_NO_PAD.decode(header_b64).unwrap();
        let header: serde_json::Value = serde_json::from_slice(&header_bytes).unwrap();
        assert_eq!(header["alg"], "RS256");
        assert_eq!(header["typ"], "JWT");
        assert_eq!(header["kid"], "abc123def456");
    }

    #[test]
    fn build_assertion_jwt_omits_kid_when_empty() {
        let mut sa = fixture_sa();
        sa.private_key_id.clear();
        let jwt = build_assertion_jwt(&sa, DEFAULT_SCOPE, Some(1_700_000_000)).unwrap();
        let header_b64 = jwt.split('.').next().unwrap();
        use base64::engine::general_purpose::URL_SAFE_NO_PAD;
        use base64::Engine as _;
        let header_bytes = URL_SAFE_NO_PAD.decode(header_b64).unwrap();
        let header: serde_json::Value = serde_json::from_slice(&header_bytes).unwrap();
        assert!(header.get("kid").is_none());
    }

    #[test]
    fn build_assertion_jwt_rejects_non_pem_key() {
        let mut sa = fixture_sa();
        sa.private_key = "not-a-real-key".into();
        let err = build_assertion_jwt(&sa, DEFAULT_SCOPE, Some(1_700_000_000)).unwrap_err();
        match err {
            AppError::Validation(m) => assert!(m.contains("RSA PEM")),
            _ => panic!("expected Validation"),
        }
    }

    #[test]
    fn access_token_freshness_within_5min_window() {
        let token = AccessToken {
            token: "x".into(),
            expires_at_secs: 1000,
        };
        assert!(token.is_fresh(0));
        assert!(token.is_fresh(699));
        assert!(!token.is_fresh(700));
        assert!(!token.is_fresh(900));
        assert!(!token.is_fresh(2000));
    }
}
