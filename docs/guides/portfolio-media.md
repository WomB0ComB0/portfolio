# Capture and publish portfolio media

Use photos and short walkthroughs to show a specific project or role. Keep the source capture,
edited export, poster and captions together so the same material can be reused in the portfolio and
a social post.

## Capture a useful state

1. Choose one task to demonstrate: opening a workspace, changing a filter, inspecting a result or
   completing a public flow. Use real UI and describe exactly what the recording shows.
2. Prepare public or synthetic demo data. Remove names, tokens, private client content and browser
   notifications. Confirm permission before showing client or team work; credit collaborators in the
   caption where needed.
3. Check the page at desktop and mobile sizes. Wait for its meaningful content to appear, dismiss
   overlays through their normal controls, and keep theme and viewport fixed across captures.
4. Record a few deliberate actions with pauses long enough to read the result. Inspect every
   exported still and the whole video before selecting assets for Studio.

Pin the CLI version. A globally installed `ui-capture` may be older:

```sh
npx --yes @elysiumoss/ui-capture@0.7.0 https://resq.software/en \
  --showcase ./resq-public-site.showcase.json \
  --output-dir ./capture \
  --viewports desktop:1600x900,mobile:390x844 \
  --wait-until domcontentloaded \
  --color-scheme dark \
  --launch-args '--window-size=1600,900'
```

For native fullscreen recording at 1920 × 1080, use `--launch-args '--window-size=1920,1080'` and a
matching desktop viewport. The launch size matters separately from the page viewport.

This example was exercised against ResQ's public site. It shows the landing page and a public
use-case tab, not an authenticated simulation or operator console. Replace the URL and selectors
when capturing another project.

```json
{
  "version": 1,
  "name": "resq-public-site",
  "title": "ResQ public site walkthrough",
  "cursor": false,
  "captions": false,
  "scenes": [
    {
      "name": "overview",
      "caption": "Public site overview",
      "readySelector": "#hero-heading",
      "holdMs": 3500,
      "steps": [
        {
          "kind": "click",
          "selector": "button:has-text('Decline')",
          "optional": true,
          "timeoutMs": 2500,
          "settleMs": 1000
        }
      ]
    },
    {
      "name": "use-cases",
      "caption": "Explore the logistics use case",
      "holdMs": 3500,
      "steps": [
        {
          "kind": "click",
          "selector": "button[role='tab']:has-text('Logistics')",
          "settleMs": 1500
        },
        { "kind": "hover", "selector": "#use-cases-heading", "settleMs": 800 }
      ]
    }
  ]
}
```

The showcase writes scene screenshots and a walkthrough per viewport under `showcases/<name>/`.
`captions: false` keeps scene text overlays out of the image. Spoken or meaningful audio still needs
a separate captions file.

For a simple page screenshot without a walkthrough:

```sh
npx --yes @elysiumoss/ui-capture@0.7.0 https://example.com/project \
  --max-depth 0 --output-dir ./capture \
  --viewports desktop:1920x1080,mobile:390x844 \
  --wait-until domcontentloaded --wait 2000 --color-scheme dark
```

Review the report for failed or skipped captures. For interactive states, use explicit readiness
selectors; increase the wait only when the page actually needs it. Keep a clean screenshot of the
result as the poster, rather than using a loading screen.

## Prepare the assets

- **Photos:** JPEG, PNG, WebP, GIF or AVIF. Prefer PNG/WebP for readable UI captures. Write alt text
  describing the visible result; put context and credits in the caption.
- **Videos:** compressed MP4 or WebM. H.264 MP4 with AAC audio is a practical export for broad
  playback. Keep text legible on mobile and remove idle time. The site delivers the original file
  from Sanity, so export the size you intend visitors to download.
- **Poster:** a representative frame. The video title names the player; the poster is its preview.
- **Captions:** upload WebVTT for speech or meaningful sound. Review timing and wording. Convert an
  existing SRT with `ffmpeg -i captions.srt captions.vtt`, then set its language code and readable
  label, such as `en` and `English`.
- **External video:** use an absolute HTTP(S) watch URL. It opens on the host in a new tab; maintain
  captions there.

## Add it to the correct entry

Open Sanity Studio and find **Photos and videos** on the intended record:

| Location                                                   | Where it appears                                                                                   |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Project                                                    | Extra media section on that project's detail page; existing main image and gallery stay available. |
| Experience                                                 | Organization-level media on that experience detail page.                                           |
| Experience → Roles Within This Organization → a dated role | Media below that individual role's full detail.                                                    |

Choose **Photo** or **Video**, complete its fields and drag entries into the intended order. A video
uses exactly one uploaded file or external watch URL. For an upload, add a poster and captions when
applicable. Keep organization-wide work at the parent level and role-specific evidence with its
role. Atroviola Studio and ElysiumOSS remain separate records; media placement must reflect the
actual engagement.

Preview and publish only the assets you selected. Empty media fields add no section, and index
timelines stay compact. Uploaded videos use native controls, play inline on request and do not
autoplay or preload the video. Photos open their full image in a new tab and use the existing CDN
image pipeline.

After publishing, allow the site's five-minute data cache to refresh. Check the detail page on
desktop and mobile: image and caption order, keyboard links and controls, actual playback, poster,
captions menu, external destination and any horizontal overflow. Keep the final URLs and credits
with the source captures.
