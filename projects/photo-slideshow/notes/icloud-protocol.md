# iCloud new-style Shared Album (iOS 27, CloudKit) — protocol notes
Captured 2026-11-11 ~01:07 CET, headless Chromium 156 (Playwright) + curl. Web build `2642Build18`
(the handoff doc saw `2640Build32` — it already changed once in a few days). Sharing key, tokens,
owner e-mail and GPS values are redacted here: `<KEY>`, `<TOKEN>`. Raw captures live in `raw/` (local only, contain secrets).

## Sequence
0. `GET https://photos.icloud.com/shared/album/<KEY>` (HTML). Build number = `<html data-cw-private-build-number="2642Build18">`
   (also in `/applications/photos3/<build>/en-us/main.js` paths). Works with plain curl.
1. `POST https://ckdatabasews.icloud.com/database/1/com.apple.photos.cloud/production/public/records/resolve`
   `?remapEnums=true&getCurrentSyncToken=true&clientBuildNumber=<b>&clientMasteringNumber=<b>&sharing_url_key=<KEY>`
   - headers: `Content-Type: text/plain` (simple CORS request, no preflight), no cookies, no auth.
   - body: `{"shortGUIDs":[{"value":"<KEY>"}]}`
   - response `results[0]`: `zoneID{zoneName:"SharedCollection-<UUID>",ownerRecordName,zoneType}`, `share` (title, keyAssetIdentifier,
     thumbnailImageData base64 JPEG, participants, owner identity incl. **e-mail**, publicPermission), `ownerIdentity`,
     `anonymousPublicAccess{token:<TOKEN>, tokenTTL:1200000 (20 min), databasePartition:"https://p124-ckdatabasews.icloud.com:443", resolvedPartitionNumber:124}`.
   - **Flaky**: ~30 % of calls return HTTP 200 with `serverErrorCode:"TRY_AGAIN_LATER"` ("Cannot get accountInfo for caller" /
     "Failed to lookup the assignment in Account Service"), independent of Origin. Retry after 1–2 s always succeeded.
     Apple's own page does NOT retry: it falls back to a "Sign In" screen (seen in the first capture).
2. On `<databasePartition>/database/1/com.apple.photos.cloud/production/shared/...` with query
   `?remapEnums=true&getCurrentSyncToken=true&sharing_url_key=<KEY>&publicAccessAuthToken=<TOKEN>&clientBuildNumber=<b>&clientMasteringNumber=<b>&clientId=<random uuid>`:
   a. `records/query` count: `{"query":{"recordType":"HyperionIndexCountLookup","filterBy":[{"fieldName":"indexCountID","comparator":"IN","fieldValue":{"value":["CPLAssetByAddedDate"],"type":"STRING_LIST"}}]},"zoneID":<zoneID>}`
      → `records[0].fields.itemCount.value` (= 4).
   b. `records/lookup` `{"records":[{"recordName":"<keyAssetIdentifier>"}],"zoneID":…}` → CPLAsset, then same for its masterRef → CPLMaster (cover image only).
   c. `records/query` list: `{"query":{"recordType":"CPLAssetAndMasterByAddedDate","filterBy":[{"fieldName":"direction","comparator":"EQUALS","fieldValue":{"value":"ASCENDING","type":"STRING"}},{"fieldName":"startRank","comparator":"EQUALS","fieldValue":{"value":0,"type":"INT64"}}]},"zoneID":…,"resultsLimit":8}`
      → `records[]` = CPLMaster + CPLAsset for the page. **Order is not interleaved:** within each page CloudKit
      returns **all CPLMaster records first, then all CPLAsset records** (verified with resultsLimit 2…50). Pair each
      asset to its master via `fields.masterRef.value.recordName` — sequential “next master + next asset” pairing
      collapses an N-photo page to **one** pair. **Pagination = startRank** (asset index); `resultsLimit` counts
      records (2 per photo); no continuationMarker. Verified with resultsLimit 2 / startRank 0..3.
   d. `changes/zone` `{"zones":[{"syncToken":"<from previous response>","zoneID":…}]}` → `moreComing`, `records[]` — usable for cheap change polling.
   - Responses carry `access-control-expose-headers: X-CloudKit-PublicAccess-AuthToken,…` (token can be refreshed via header).
3. Images: `GET https://cvws-h2.icloud-content.com/B/<id>/<name>?o=…&v=1&x=3&a=…&e=<unix>&fl=&r=…&k=…&ckc=com.apple.photos.cloud&ckz=<zone>&y=1&p=124&s=<sig>`
   (`downloadURL` inside each `res*Res` ASSETID field; the `${f}` placeholder is already filled for public albums).
   - `e` = expiry ≈ **16 min** after issue (01:07:27 → 01:23:25). Changing `e` → HTTP 400 (signed).
   - Works without Referer, with a foreign Referer, without Origin. Response `Access-Control-Allow-Origin` echoes the Origin, `allow-credentials:false`.
   - `cache-control: private,max-age=2592000` (content-addressed by checksum). Content-Type `application/octet-stream` unless `&og=…` is added; `<img>` renders it fine.

## Records
- CPLMaster fields: itemType (`public.heic`), filenameEnc (base64 plain text, e.g. IMG_xxxx.HEIC), mediaMetaDataEnc (base64 **plain** bplist of
  CGImageProperties incl. `{GPS}`, `{Exif}`, `{MakerApple}`), originalOrientation, and derivatives `res<Name>Res/Width/Height/FileType/FileSize/Fingerprint`:
  - `JPEGThumb` 480×360, `JPEGMed` 2048×1536 (≈0.5–0.9 MB), `JPEGFull` 4032×3024 (only on some), `Original` HEIC 4032×3024,
  - Live Photo video: `OriginalVidCompl` 1744×1308 MOV, `VidMed` 872×654, `VidSmall` 581×436; `SidecarOther`.
- CPLAsset fields: addedDate, assetDate, orientation, duration, masterRef, isFavorite/isHidden, people, keywordsEnc, timeZoneNameEnc,
  **locationEnc (base64 plain bplist: lat, lon, alt, speed, course, accuracy, timestamp)**. "Enc" fields are NOT encrypted for public albums.
- JPEG derivatives are pre-rotated (no EXIF Orientation tag; portrait comes as 1536×2048) but still **contain EXIF GPS**.
- This album: 4 photos, 3 Live Photos, 0 videos (video would be itemType com.apple.quicktime-movie / duration>0).

## CORS
- resolve/query with `Origin: https://branovaclav.github.io` → `Access-Control-Allow-Origin: *` (no credentials). Preflight OPTIONS → 200,
  allow-origin *, methods GET/POST/PUT/DELETE, allow-headers content-type, max-age 86400. With Origin photos.icloud.com it echoes + credentials true.
- Verified end-to-end in a real browser served from origin https://branovaclav.github.io (local mapping), both Chromium 156 and **Chromium 81.0.4044**:
  ES5 XHR resolve → query → `<img>` of JPEGMed all OK (`c81/srv/es5_test.html`, key passed in `#k=` hash).

## Apple's page on Chromium 81
- Inline bootstrap gate: `window.MathMLElement && "".replaceAll && (Promise.any || UA includes "AppleWebKit/")` else redirect to
  `https://www.icloud.com/unsupported_browser`. MathMLElement = Chrome 109+, replaceAll = 85+. Confirmed: Chromium 81 headless shows
  "Your browser is not supported." with its own UA, an Android Chrome 81 UA and a spoofed Chrome 140 UA (feature detection, not UA).
- Bundles parse as ES2019 (Babel-transpiled; acorn), so syntax itself isn't the blocker; they use structuredClone (98), Object.hasOwn (93),
  findLast (97), replaceAll; main.js ~1 MB + ui.main.js ~1.7 MB of JS.

## Privacy-relevant data exposed to anyone with the link
- Owner full name + **Apple ID e-mail** (resolve: share.owner, participants, ownerIdentity); "Created by …" shown on the page.
- **GPS coordinates** per photo (locationEnc + EXIF {GPS} in mediaMetaDataEnc and inside the JPEG derivatives), capture timestamps, time zone, original filenames, device name in `modified.deviceID` (e.g. "<name>'s iPhone"), Live Photo videos, full-res HEIC originals.
- `publicPermission: READ_WRITE`, `publicCustomAccess: "contributor"` → link holders can add photos (counts against owner storage).

## Build number sensitivity
- resolve succeeds with an old build (`2640Build32`) and with clientBuildNumber/clientMasteringNumber omitted entirely → not validated today.
- Album HTML has no Access-Control-Allow-Origin, so a browser page on github.io cannot read the build from Apple's HTML (not needed currently).
