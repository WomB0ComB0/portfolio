# Experience and project media

## Goal

Let the owner add ordered photos, uploaded videos and external video links to project details, experience entries and individual sub-roles in Sanity.
The owner explicitly confirmed media at both experience levels.
Use the site's existing visual language and keep entries without media unchanged.
This accompanies a separate LinkedIn draft and a ui-capture workflow for better screenshots and walkthroughs.

## Design

Add optional media arrays using shared Studio definitions and runtime types.
Photo entries hold a Sanity image, meaningful alt text and an optional caption.
Video entries hold a title, an uploaded MP4/WebM or an external HTTP(S) link, optional poster/caption, and optional WebVTT captions with a language label for uploads.
Exactly one video source is selected.
Preserve the existing project hero/image/gallery fields and all historical experience data.
New project media appears in an additional detail-page section, without changing existing screenshot/list views.

Uploaded video plays inline from Sanity's CDN with native controls, playsInline, preload=none and no autoplay.
External video links have an explicit accessible watch link; do not introduce provider embeds or broaden frame-src.
Images use the existing CdnImage/Sanity image pipeline and open their full image through an accessible link.
Reuse an existing image dialog only if it is cleanly shareable; do not refactor unrelated gallery behavior.
Render the surrounding gallery on the server, introducing client code only if an existing accessible viewer requires it.
Use optional sections with existing palette/spacing/border tokens, descriptive captions and stable dimensions.
Show organization media on experience detail pages and child media under the relevant full sub-role; compact/index timelines remain light.

Add only the exact Sanity CDN origin to media-src so uploaded video works.
Keep existing restrictive iframe policy and external-link behavior intact.
Bad or legacy media must not invalidate an otherwise usable project, experience, or child role.
Validate source schemes, file formats and required accessible labels at the authoring and rendering boundaries.

## Implementation plan

> For agentic workers: follow superpowers:subagent-driven-development with specification review followed by independent code-quality review.

### 1. Data and authoring

Relevant files: src/sanity/schemaTypes/experience.ts, project.ts, index.ts; src/lib/sanity/schemas.ts; src/hooks/sanity/schemas.ts; src/lib/sanity/queries.ts; tests/unit/sanity/.

- [ ] Read relevant installed Next guides before any code: videos, images, server/client boundaries. Read local Sanity/Effect4 code and declarations where APIs are uncertain.
- [ ] Add shared media types/Studio field factories in small focused files and register them.
- [ ] Add media to project, experience and experienceSubRole authoring schemas, including the copied legacy schema exports where still supported.
- [ ] Extend all relevant GROQ projections and runtime decoding. Reuse existing resolved file/image structures where possible.
- [ ] Test missing/null/empty media, malformed siblings, asset references, safe URLs, video source exclusivity, and project/experience/sub-role compatibility.
- [ ] Ensure published APIs carry media through the full loader/decoder path without dropping existing content.

### 2. Rendering and playback

Relevant files: experience/_interface/role-detail/role-detail.tsx, experience/_components/role-progression.tsx, experience/_lib/role-subroles.ts and role-index.ts; projects detail/case components; shared components; src/lib/security/csp.ts.

- [ ] Build the shared media section and integrate it in the three detail locations.
- [ ] Preserve model-derived dates/counts and the existing project image gallery; media never changes timeline calculations.
- [ ] Provide useful labels and captions, native video controls, poster images and VTT support. No autoplay or eager video download.
- [ ] Add the narrow CDN media-src policy and a regression for it.
- [ ] Test markup, empty-state compatibility, invalid media handling, sub-role attachment, links and video attributes. Tests should verify behavior, not merely repeat implementation constants.
- [ ] Browser-check desktop/mobile against real components with representative image/video/link fixtures, including video playback, keyboard use, layout and no media requests before playback.
- [ ] Capture the result with ui-capture. Temporary local QA routes/assets are allowed but must not be committed or deployed; do not write fabricated content into production Sanity.

### 3. Creator workflow and delivery

- [ ] Document a repeatable ui-capture workflow: stable states and clean desktop/mobile screenshots, short functional walkthroughs, poster/caption/alt text, and assigning assets to the correct project/experience/sub-role in Studio.
- [ ] Document asset formats, raw CDN delivery, credit/privacy considerations for real project captures, and external video links.
- [ ] Avoid new runtime dependencies and preserve the original dirty checkout and user port3000.
- [ ] Run focused and full repo-required checks, independent reviews, and a production build. Keep the existing approved picomatch build exception scoped; Snyk Code quota failures are already nonblocking, not other failures.
- [ ] Commit verified code; parent handles PR, exact-head CI, merge and production/Studio deployment under existing authorization.
- [ ] Verify production data/page compatibility and confirm Studio inputs. Supply a usable LinkedIn draft and local capture example assets.

## Boundaries

No LinkedIn posting, sign-ins to client apps, paid services, content migrations or unsupported historical claims.
Do not attach or publish arbitrary media to real experience records without the owner choosing the corresponding content.
Preserve Atroviola Studio and ElysiumOSS as separate identities.
A public demo recording must show an actual public UI and accurately identify what is being demonstrated.
